-- 0007_notifications.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- THIS FILE IS AUTHORED, NOT APPLIED. The live apply to Balkanity is a BLOCKING, signed-off
-- task (Plan 06) via the Supabase Management API /database/query with SUPABASE_ACCESS_TOKEN —
-- NOT MCP (MCP reaches only Kalvia; see project memory), NOT `supabase db push`, NOT a direct
-- host psql DDL run. Do not run db push / migration up / db reset against any remote from here.
--
-- This migration lays the Phase-7 (notifications) data layer on top of the locked
-- Phase-3/4/5/6 transfer + supply schema. FOUR declarations:
--   1) public.notifications — the polymorphic in-app feed (PLAT-01 platform-generic →
--      UNPREFIXED, like webhook_events). Per-user read state via read_at (NULL = unread,
--      D-05). NO transfer_id column — entity_type/entity_id is the polymorphic reference
--      (SC#1). RLS own-rows SELECT only; NO write policy → service-role-only writes (the
--      mark-read action is a GATED service-role action, NOT a client write policy — Open Q1).
--   2) public.email_log — the send-guardrail log (platform-generic → UNPREFIXED). A UNIQUE
--      idempotency_key (mirrors webhook_events.event_id) is the race-safe dedup authority;
--      a created_at index backs the daily soft-cap count query. RLS admin-read only; NO
--      write policy → service-role-only writes (Phase 8 health gauge reads this).
--   3) wp_transfers.locale (D-17) — NULL-able, NO default → no row rewrite; existing rows
--      stay NULL → EN fallback. The persisted booking language the webhook-fired guest
--      confirmation resolves copy against via getDictFor(locale ?? 'en').
--   4) driver_profiles digest-preference columns (D-07/D-08) — digest_enabled (off by
--      default) + digest_send_hour (0–23, NULL until set). Stored on driver_profiles
--      (consistent with where the driver display profile already lives). NO client write
--      policy added — the digest-preference write is a GATED service-role action (Plan 05).
--
-- Trust-boundary notes (threat model 07-01):
--   T-07-01  notifications + email_log get RLS ENABLED with a single SELECT policy each and
--            NO INSERT/UPDATE/DELETE policy → anon/authenticated cannot write; only the
--            service-role client can (the no-write-policy lock from 0002–0006 HOLDS). The
--            polymorphic entity_type/entity_id (NO transfer_id) is the PLAT-01 seam (SC#1).
--   T-07-03  This file is AUTHORED-NOT-APPLIED. The Balkanity-only guardrail above names
--            both refs; the Plan-06 live apply re-asserts the target ref before any DDL.
--            NEVER apply to Kalvia.
-- Seam note (PLAT-01): notifications / email_log = platform-generic → UNPREFIXED (like
--   webhook_events). wp_transfers / driver_profiles = module objects → already wp_/module-
--   scoped (their existing prefix/placement is preserved; this migration only ALTERs them).
--   NO transfer_id column on any shared table — polymorphic entity_type/entity_id only.
--
-- Reuse note: public.is_admin() is NOT redefined here — it already exists from 0002; the new
--   email_log admin-read policy reuses it.
-- Re-runnability: every statement uses `create table ... if not exists` / `create index if
--   not exists` / `add column if not exists` / `drop policy if exists` so a partial re-run is
--   safe and idempotent (mirrors 0004/0005/0006).

-- ============================================================================
-- 1) notifications — the polymorphic in-app feed (NOTF-01). Platform-generic → UNPREFIXED.
--    recipient_id FK auth.users on delete cascade (a deleted user's feed goes with them).
--    entity_type/entity_id is the polymorphic reference — there is deliberately NO
--    transfer_id column (SC#1, PLAT-01). title is pre-rendered EN/BG copy; body is optional.
--    read_at is the per-user read marker (NULL = unread, D-05). The partial unread index
--    backs the badge count + newest-first feed read.
-- ============================================================================
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type         text not null,                       -- e.g. new_paid_pool | run_assigned | new_paid_booking | email_cap_near
  entity_type  text,                                -- polymorphic — e.g. 'transfer' (NO transfer_id column, SC#1)
  entity_id    uuid,                                -- polymorphic id; resolved by the reading surface
  title        text not null,                       -- pre-rendered EN/BG copy (notifications.title)
  body         text,                                -- optional secondary line
  read_at      timestamptz,                         -- NULL = unread (per-user read state, D-05)
  created_at   timestamptz not null default now()
);

comment on table public.notifications is
  'Polymorphic in-app notification feed (NOTF-01). Platform-generic → UNPREFIXED (like webhook_events). entity_type/entity_id is the polymorphic reference — NO transfer_id column (PLAT-01 seam, SC#1). read_at NULL = unread (per-user read state, D-05). RLS own-rows SELECT only; NO write policy → service-role-only writes (mark-read is a gated service-role action, NOT a client write policy — Open Q1).';

-- Partial index over a recipient''s UNREAD rows, newest-first — backs the badge count and the
-- feed read (D-05). Partial (where read_at is null) keeps it small as read rows accumulate.
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

-- ============================================================================
-- 2) email_log — the send-guardrail log (NOTF-06). Platform-generic → UNPREFIXED. The
--    UNIQUE idempotency_key is the race-safe dedup authority (mirrors webhook_events.event_id):
--    a webhook retry firing the confirmation twice produces exactly one send. The created_at
--    index backs the daily soft-cap count query. tier ∈ {critical, best_effort};
--    outcome ∈ {sent, failed, skipped_cap}.
-- ============================================================================
create table if not exists public.email_log (
  id              uuid primary key default gen_random_uuid(),
  idempotency_key text not null,                    -- e.g. 'confirm:<transferId>' — the dedup authority
  recipient       text not null,
  tier            text not null,                    -- 'critical' | 'best_effort'
  outcome         text not null,                    -- 'sent' | 'failed' | 'skipped_cap'
  created_at      timestamptz not null default now()
);

comment on table public.email_log is
  'Send-guardrail log (NOTF-06). Platform-generic → UNPREFIXED. UNIQUE idempotency_key is the race-safe replay/dedup authority (cf. webhook_events.event_id) so a webhook retry produces exactly one send. created_at index backs the daily soft-cap count. RLS admin-read only; NO write policy → service-role-only writes (Phase 8 health gauge reads this).';

-- SC / NOTF-06: globally-unique idempotency_key — the race-safe dedup authority the sendEmail
-- wrapper checks before sending and records every outcome against (mirrors webhook_events.event_id).
create unique index if not exists email_log_idempotency_key_key
  on public.email_log (idempotency_key);

-- Daily-count query support: the soft-cap counts today''s sends (created_at >= todayUTC).
create index if not exists email_log_created_at_idx
  on public.email_log (created_at);

-- ============================================================================
-- 3) ALTER wp_transfers — add the NULL-able locale column (D-17). NO default → the additive
--    ALTER does NOT rewrite or invalidate existing rows; existing rows stay NULL → EN fallback
--    (the webhook confirmation resolves copy via getDictFor(locale ?? 'en')). NO write RLS
--    policy is added — the no-write-policy lock holds; the gated booking action (already a
--    service-role writer) is the only writer.
-- ============================================================================
alter table public.wp_transfers add column if not exists locale text;  -- D-17; NULL → EN fallback

comment on column public.wp_transfers.locale is
  'D-17 booking language tag (e.g. ''en'' | ''bg''), captured server-side at createBooking. NULL-able, no default → EN fallback for rows never set. Resolves the webhook-fired guest confirmation copy via getDictFor(locale ?? ''en''). Not PII.';

-- ============================================================================
-- 4) ALTER driver_profiles — add the digest-preference columns (D-07/D-08). Stored HERE
--    (not a separate table) because the driver display profile already lives on
--    driver_profiles — keeping the per-driver preference alongside it is the simplest shape.
--    digest_enabled is off by default (D-07 opt-in, protects the Resend cap). digest_send_hour
--    is the driver''s self-chosen 0–23 local send hour, NULL until set (D-08). Both additive
--    (default-false / NULL-able, no row rewrite). NO client write RLS policy — the digest-
--    preference write is a GATED service-role action (Plan 05), NOT a client write policy.
-- ============================================================================
alter table public.driver_profiles add column if not exists digest_enabled boolean not null default false;  -- D-07 off by default
alter table public.driver_profiles add column if not exists digest_send_hour smallint;                       -- D-08 0–23 self-chosen send hour, NULL until set

comment on column public.driver_profiles.digest_enabled is
  'D-07 daily-digest opt-in. Off by default (protects the Resend 100/day cap). Written by the gated service-role digest-preference action (Plan 05), NOT a client write policy.';
comment on column public.driver_profiles.digest_send_hour is
  'D-08 self-chosen whole-hour (0–23) local send time for the daily digest; NULL until the driver sets it. The cron trigger that fires due digests is Phase 8.';

-- ============================================================================
-- 5) Enable RLS + the SELECT-only policies on the two new tables. With RLS on and only a
--    SELECT policy, each table is deny-by-default for anon/authenticated writes (T-07-01).
--    NO INSERT/UPDATE/DELETE policy on either → every write goes through the service-role
--    client (which bypasses RLS) — the no-write-policy lock from 0002–0006 (see 0006:30-31).
-- ============================================================================
alter table public.notifications enable row level security;
alter table public.email_log     enable row level security;

-- notifications: own-rows-only SELECT (a caller reads ONLY their own feed). (select auth.uid())
-- is the initPlan-cached wrap used across 0004/0005. NO write policy — service-role-only writes;
-- the mark-read/mark-all-read action is a GATED service-role action (Open Q1), not a policy.
drop policy if exists "notifications_own_read" on public.notifications;
create policy "notifications_own_read" on public.notifications
  for select to authenticated
  using ( (select auth.uid()) = recipient_id );

-- email_log: admin-read only (Phase 8 health gauge). Reuses public.is_admin() (from 0002,
-- NOT redefined). NO write policy — service-role-only writes.
drop policy if exists "email_log_admin_read" on public.email_log;
create policy "email_log_admin_read" on public.email_log
  for select to authenticated
  using ( public.is_admin() );
