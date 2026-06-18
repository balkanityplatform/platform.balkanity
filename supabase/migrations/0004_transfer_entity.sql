-- 0004_transfer_entity.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- THIS FILE IS AUTHORED, NOT APPLIED. The live apply to Balkanity is the Plan 05 BLOCKING,
-- signed-off task via the Supabase CLI / Management access token — NOT MCP (MCP reaches only
-- Kalvia; see project memory). Do not run db push / migration up / db reset against any remote
-- here. This migration turns the minimal Phase-3 money-spine into the full transfer entity.
--
-- This migration ALTERs (does NOT create) public.wp_transfers — the table was created in
-- 0003_payments_spine.sql (D-04). Three parts, in one file:
--   1) ALTER wp_transfers — add the NULL-able guest PII + lifecycle + driver-scaffold columns.
--      Every new column is NULL-able with NO default → the additive ALTER does NOT rewrite or
--      invalidate the existing Phase-3 seed rows, and the webhook's column list (a strict subset:
--      status / amount_cents / paid_at / stripe_* / fee_cents) keeps working unchanged.
--   2) A BEFORE-UPDATE transition-guard trigger encoding the complete 8-state lifecycle (D-08/
--      D-09/D-10) — the HARD backstop that fires for EVERY writer incl. the service-role webhook
--      (service-role bypasses RLS, NOT triggers). Mirrors platform/transfers/lifecycle.ts exactly.
--   3) Two RLS SELECT policies — a guest-self-read on wp_transfers via the JWT email claim (D-05,
--      the real PII boundary; UI masking leaks via the auto-REST API) and a narrow anon-read for
--      ACTIVE destinations (BOOK-01, the public /pickup read path 0002 deferred).
--
-- Trust-boundary notes (threat model 04-02):
--   T-04-TMP1  wp_enforce_transfer_transition BEFORE-UPDATE trigger raises check_violation on any
--              non-mapped lifecycle jump by ANY writer incl. service-role (triggers are NOT
--              bypassed by the service-role client; only RLS is).
--   T-04-TMP2  The allowed map MUST include requested→paid (Pitfall 4) or the verified Stripe
--              webhook's `.neq("status","paid")` UPDATE is blocked → Stripe retries forever.
--   T-04-ID1   wp_transfers_guest_self_read RLS: (select auth.jwt() ->> 'email') = guest_email is
--              the data-layer PII boundary; a JWT email ≠ guest_email matches no policy → 0 rows.
--   T-04-ID2   No matching permissive SELECT policy for a non-owning authenticated driver → 0 rows
--              pre-claim. The no-write-policy lock (no INSERT/UPDATE/DELETE policy) prevents
--              tampering; every write stays service-role-only (the single-writer `paid` lock).
--   T-04-ID3   destinations_public_active_read using ( active = true ) → inactive/secret
--              destinations return 0 rows; the policy exposes only bookable, non-PII metadata.
-- Seam note (PLAT-01): wp_transfers = module table → wp_ prefix; destinations = platform-generic
--   → UNPREFIXED. The trigger function carries the wp_ prefix (module-scoped lifecycle).
--
-- Re-runnability: every statement uses `if not exists` / `create or replace` / `drop ... if
--   exists` so a partial re-run is safe and idempotent.

-- ============================================================================
-- 1) ALTER wp_transfers — add NULL-able PII + lifecycle + driver-scaffold columns (D-04).
--    ALL columns are NULL-able with NO default → existing Phase-3 seed rows survive untouched
--    and the webhook's narrower column set (a strict subset) is unaffected. No NOT NULL is added
--    on any new column. The no-write-policy lock from 0003 stays intact — NO INSERT/UPDATE/DELETE
--    policy is added on wp_transfers anywhere in this file (writes are service-role-only).
-- ============================================================================
alter table public.wp_transfers add column if not exists guest_name    text;
alter table public.wp_transfers add column if not exists guest_email   text;
alter table public.wp_transfers add column if not exists guest_phone   text;
alter table public.wp_transfers add column if not exists pax           integer check (pax is null or (pax >= 1 and pax <= 8));            -- D-03: 1–8 passengers
alter table public.wp_transfers add column if not exists luggage_count integer check (luggage_count is null or luggage_count >= 0);      -- non-negative bag count
alter table public.wp_transfers add column if not exists flight_no     text;
alter table public.wp_transfers add column if not exists arrival_at    timestamptz;
alter table public.wp_transfers add column if not exists notes         text;
-- driver_id — the Phase-5/6 claim scaffold (D-06 reverse-reveal joins driver_profiles on this).
-- on delete set null: deleting a driver auth user un-assigns the transfer rather than cascading
-- a delete of a paid money row. Referenced columns are added now so the claim RPC has its target.
alter table public.wp_transfers add column if not exists driver_id     uuid references auth.users(id) on delete set null;

comment on column public.wp_transfers.guest_email is
  'Guest contact email — the key the wp_transfers_guest_self_read RLS policy matches against the JWT email claim (D-05). NULL-able so Phase-3 seed rows survive.';
comment on column public.wp_transfers.driver_id is
  'Claiming driver (Phase 5/6 scaffold, D-06). FK auth.users on delete set null — un-assigns rather than deleting the paid row.';

-- The Phase-5/6 claim pool sorts the open transfers on arrival_at (CLAIM-06).
create index if not exists wp_transfers_arrival_at_idx  on public.wp_transfers (arrival_at);
-- The guest-self-read RLS policy filters on guest_email — back it with an index.
create index if not exists wp_transfers_guest_email_idx on public.wp_transfers (guest_email);
