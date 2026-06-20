-- 0008_platform_health.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- THIS FILE IS AUTHORED, NOT APPLIED. The live apply to Balkanity is a BLOCKING, signed-off
-- task (Plan 05) via the Supabase Management API /database/query with SUPABASE_ACCESS_TOKEN —
-- NOT MCP (MCP reaches only Kalvia; see project memory), NOT `supabase db push`, NOT a direct
-- host psql DDL run. Do not run db push / migration up / db reset against any remote from here.
--
-- This migration lays the Phase-8 (platform-health) observability layer on top of the locked
-- Phase-1..7 schema. It introduces NO new business logic, lifecycle state, or actor — only a
-- scheduler (pg_cron + pg_net), a service-role-written health-event log, and two cron schedules
-- that fire existing Next route handlers. FIVE concerns, in order:
--   1) create extension pg_cron + pg_net — verified available-but-not-installed on Balkanity
--      (pg_cron 1.6.4, pg_net 0.20.3). These MUST be the FIRST DDL: `cron.schedule` errors with
--      "schema cron does not exist" if the extensions are not yet installed (Pitfall 6).
--   2) public.health_events — the polymorphic health-event log (PLAT-01 platform-generic →
--      UNPREFIXED, like webhook_events / notifications / email_log). entity_type/entity_id is
--      the polymorphic reference — there is deliberately NO transfer_id column (SC#1). entity_id
--      is text (Stripe event ids are not uuid). `kind` is FREE-FORM text with NO CHECK
--      constraint. resolved_at NULL = open. RLS admin-read SELECT only; NO write policy →
--      service-role-only writes (the no-write-policy lock from 0002–0007 HOLDS).
--   3) health_events_open_idx — partial index (where resolved_at is null) that backs the
--      per-entity dedup check (one open alert per discrepancy, Pitfall 2).
--   4) RLS enable + the single admin-read SELECT policy reusing public.is_admin() (from 0002,
--      NOT redefined). NO INSERT/UPDATE/DELETE policy.
--   5) Vault cron secret note + idempotent re-schedule block + the two cron schedules:
--      'health-sweep' (*/15) and 'digest-hourly' (0 *), each calling net.http_post to the
--      production Next route handlers with a Vault-stored x-cron-secret header.
--
-- Trust-boundary notes (threat model 08-01):
--   T-08-01  This file is AUTHORED-NOT-APPLIED. The Balkanity-only guardrail above names both
--            refs; the Plan-05 live apply re-asserts the target ref before any DDL. NEVER apply
--            to Kalvia.
--   T-08-02  health_events gets RLS ENABLED with a single admin-read SELECT policy and NO
--            INSERT/UPDATE/DELETE policy → anon/authenticated cannot write; only the
--            service-role client can (the no-write-policy lock HOLDS).
--   T-08-03  No transfer_id / PII column on the shared health table — polymorphic
--            entity_type/entity_id only (SC#1); `detail jsonb` carries non-PII facts only.
-- Reuse note: public.is_admin() is NOT redefined here — it already exists from 0002; the new
--   health_events_admin_read policy reuses it.
-- Re-runnability: every statement uses `create extension if not exists` / `create table ... if
--   not exists` / `create index if not exists` / `drop policy if exists` / unschedule-if-exists
--   so a partial re-run is safe and idempotent (mirrors 0004/0005/0006/0007).

-- ============================================================================
-- 1) Extensions — pg_cron + pg_net. MUST precede any cron.schedule call (Pitfall 6).
--    Verified available-but-not-installed on Balkanity (pg_cron 1.6.4, pg_net 0.20.3).
--    supabase_vault (0.3.1) is already installed (used in §5 for the cron auth secret).
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================================
-- 2) health_events — the polymorphic health-event log (HLTH-02/HLTH-04). Platform-generic →
--    UNPREFIXED (like webhook_events). entity_type/entity_id is the polymorphic reference —
--    there is deliberately NO transfer_id column (SC#1, PLAT-01). entity_id is TEXT (Stripe
--    event ids are not uuid). `kind` is FREE-FORM text with NO CHECK constraint. detail jsonb
--    carries non-PII facts only. resolved_at NULL = open (an unresolved alert).
-- ============================================================================
create table if not exists public.health_events (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,        -- FREE-FORM: 'reconciliation_discrepancy' | 'stuck_unclaimed' | 'keepalive' (NO check)
  entity_type text,                 -- polymorphic — e.g. 'transfer' | 'stripe_session' (NO transfer_id column, SC#1)
  entity_id   text,                 -- polymorphic id; TEXT (Stripe event/session ids are not uuid)
  detail      jsonb,                -- non-PII facts only (amounts, session id, timestamps)
  resolved_at timestamptz,          -- NULL = open; a resolved/auto-resolved row is non-alerting
  created_at  timestamptz not null default now()
);

comment on table public.health_events is
  'Polymorphic platform health-event log (HLTH-02/HLTH-04). Platform-generic → UNPREFIXED (like webhook_events). entity_type/entity_id is the polymorphic reference — NO transfer_id column (PLAT-01 seam, SC#1); detail jsonb carries non-PII facts only. resolved_at NULL = open. kind is FREE-FORM text with NO CHECK constraint; the three known values are: ''reconciliation_discrepancy'' (a paid Stripe session with no matching paid transfer — Plan 02), ''stuck_unclaimed'' (a paid transfer with no driver near arrival — Plan 02), and ''keepalive'' (a benign heartbeat row Plan 02 writes with resolved_at=now() to prevent the 7-day Supabase pause; auto-resolved, NEVER alerts and never appears in the open partial index). A constraint restricting the allowed kinds is deliberately omitted; if one is ever added it MUST allow ''keepalive''. RLS admin-read only; NO write policy → service-role-only writes.';

-- Partial index over OPEN rows (resolved_at IS NULL) keyed by (kind, entity_id) — backs the
-- per-entity dedup check so one discrepancy produces exactly one open alert (Pitfall 2).
-- 'keepalive' rows set resolved_at=now() so they are EXCLUDED here → never appear as open alerts.
create index if not exists health_events_open_idx
  on public.health_events (kind, entity_id)
  where resolved_at is null;

-- ============================================================================
-- 3) Enable RLS + the single admin-read SELECT policy. With RLS on and only a SELECT policy,
--    the table is deny-by-default for anon/authenticated writes (T-08-02). NO INSERT/UPDATE/
--    DELETE policy → every write goes through the service-role client (which bypasses RLS) —
--    the no-write-policy lock from 0002–0007. Reuses public.is_admin() (from 0002, NOT redefined).
-- ============================================================================
alter table public.health_events enable row level security;

drop policy if exists "health_events_admin_read" on public.health_events;
create policy "health_events_admin_read" on public.health_events
  for select to authenticated
  using ( public.is_admin() );

-- ============================================================================
-- 4) Cron auth secret + idempotent re-schedule block + the two cron schedules.
--    The shared secret authenticates the cron→route HTTP callback: the cron reads it from Vault
--    at fire time and sends it as the x-cron-secret header; the route compares it (timing-safe)
--    against the matching Vercel env CRON_SECRET. Storing it in Vault keeps it out of
--    cron.job.command (which is world-readable to any role that can select cron.job).
--
--    NOTE: net.http_post is ASYNCHRONOUS, fire-and-forget (Pitfall 4) — pg_net queues the
--    request and does NOT surface the HTTP response to the cron job. Observability of the
--    receiver is via health_events rows + cron.job_run_details (which only records that the
--    SQL ran, not the HTTP outcome) — NOT the cron return.
--
--    The production receiver URL is https://balkanityplatformproject.vercel.app (STATE handoff, A4).
-- ============================================================================

-- One-time (run at live-apply, Plan 05): store the shared secret. The SAME value goes into the
-- Vercel server env CRON_SECRET. The placeholder below is NOT a real value — replace at apply.
--   select vault.create_secret('REPLACE_WITH_LONG_RANDOM', 'cron_secret');

-- Idempotent reschedule: unschedule-if-exists then (re)schedule, so a re-run is safe.
select cron.unschedule('health-sweep')  where exists (select 1 from cron.job where jobname = 'health-sweep');
select cron.unschedule('digest-hourly') where exists (select 1 from cron.job where jobname = 'digest-hourly');

-- The 15-min health sweep (D-02): reconciliation + stuck + keep-alive.
select cron.schedule(
  'health-sweep',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://balkanityplatformproject.vercel.app/api/cron/health',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret',
                 (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- The hourly digest trigger (D-10): fires the existing sendDueDigests() via the digest route.
select cron.schedule(
  'digest-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://balkanityplatformproject.vercel.app/api/cron/digest',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret',
                 (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb
  );
  $$
);
