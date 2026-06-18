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

-- ============================================================================
-- 2) BEFORE-UPDATE lifecycle transition-guard trigger — the full 8-state machine
--    (D-08/D-09/D-10). This is the HARD enforcement boundary: it fires for EVERY writer,
--    including the service-role webhook and the future claim RPC. The service-role client
--    bypasses RLS, NOT triggers — so lifecycle legality is guaranteed regardless of who writes.
--    The app-layer platform/transfers/lifecycle.ts ALLOWED_TRANSITIONS map is the cosmetic
--    friendly-error mirror of THIS table; the exhaustive 8×8 unit test pins the two together
--    (T-04-01). The allowed pairs below MUST match that TS map exactly.
--
--    D-10 STATE-vs-ACTOR split: this trigger guarantees STATE legality only — `cancelled` is
--    reachable only from the five pre-pickup states (requested/paid/claimed/en_route/arrived),
--    and `picked_up`/`completed`/`cancelled` are terminal. The ACTOR legality (e.g. admin-only
--    cancel) is an app-layer getCurrentRole() gate landing in Phase 6 — the trigger has NO auth
--    context on the service-role path, so it deliberately does not enforce who may cancel.
-- ============================================================================
create or replace function public.wp_enforce_transfer_transition()
returns trigger
language plpgsql
as $$
begin
  -- No-op / non-status update pass-through: a same-status UPDATE (or any update that does not
  -- touch status) is always legal. `is not distinct from` is NULL-safe. This composes with the
  -- webhook's `.neq("status","paid")` backstop — a redundant requested→paid retry that already
  -- landed `paid` short-circuits at the client query, and any non-status column edit passes here.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- The complete allowed-transition map — EXACTLY mirrors platform/transfers/lifecycle.ts
  -- ALLOWED_TRANSITIONS. requested→paid is load-bearing (Pitfall 4 / T-04-TMP2): without it the
  -- verified Stripe webhook can never flip a requested transfer to paid and Stripe retries forever.
  if not (
       (old.status = 'requested' and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid'      and new.status in ('claimed', 'cancelled'))
    or (old.status = 'claimed'   and new.status in ('en_route', 'cancelled'))
    or (old.status = 'en_route'  and new.status in ('arrived', 'cancelled'))
    or (old.status = 'arrived'   and new.status in ('picked_up', 'cancelled'))
    or (old.status = 'picked_up' and new.status in ('completed'))
    -- 'completed' and 'cancelled' are terminal: no outbound transition is permitted from either.
  ) then
    raise exception 'illegal transfer transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.wp_enforce_transfer_transition() is
  'BEFORE-UPDATE lifecycle guard (D-08/D-09/D-10). Encodes the full 8-state map mirroring platform/transfers/lifecycle.ts; permits requested→paid (Pitfall 4); raises check_violation on any illegal jump. Fires for ALL writers incl. service-role (triggers are not bypassed; only RLS is). State legality only — actor legality is the Phase-6 app gate.';

-- drop-if-exists first for re-runnability, then (re)create the BEFORE UPDATE, FOR EACH ROW trigger.
drop trigger if exists wp_transfers_transition_guard on public.wp_transfers;
create trigger wp_transfers_transition_guard
  before update on public.wp_transfers
  for each row execute function public.wp_enforce_transfer_transition();

-- ============================================================================
-- 3) RLS SELECT policies — the data-layer PII boundary (UI masking leaks via the
--    auto-generated REST / supabase-js API, so the boundary MUST live in RLS).
--    NO write policy is added on wp_transfers — the no-write-policy lock from 0003 holds;
--    every write stays service-role-only (the single-writer `paid` lock).
-- ============================================================================

-- (a) Guest-self-read on wp_transfers. Uses the current `auth.jwt() ->> 'email'` form wrapped
--     in a (select ...) subquery — the deprecated email() auth helper is NOT used, and the
--     subquery wrap is the initPlan-caching best practice (the claim is evaluated once per query,
--     not once per row). RLS is already ENABLED on wp_transfers (0003).
--
--     Coexistence (T-04-ID1): Postgres ORs permissive SELECT policies, so this coexists with the
--     existing `wp_transfers_admin_read` (0003) → an admin reads ALL rows; a guest reads ONLY the
--     row(s) whose guest_email equals their JWT email; a non-owning authenticated driver matches
--     NEITHER policy → zero rows pre-claim (the data-layer PII boundary Phase 5 hardens with the
--     masked claim pool). A JWT email that matches no guest_email returns zero rows.
drop policy if exists "wp_transfers_guest_self_read" on public.wp_transfers;
create policy "wp_transfers_guest_self_read" on public.wp_transfers
  for select to authenticated
  using ( (select auth.jwt() ->> 'email') = guest_email );

-- (b) Narrow active-destination anon read — the public /pickup/<slug> read path 0002 deferred
--     (Pitfall 1; the 0002 tail note: "Phase 4 will add a NARROW anon/guest SELECT policy for
--     ACTIVE destination slugs only"). RLS is already ENABLED on destinations (0002).
--
--     Coexistence (T-04-ID3): ORs with the existing `destinations_admin_read` (0002) → an admin
--     reads ALL destinations; anon + authenticated readers see ONLY rows where active = true.
--     An inactive destination returns zero rows → /pickup/<inactive-slug> renders the neutral
--     "not available" state rather than leaking secret/disabled destination metadata.
drop policy if exists "destinations_public_active_read" on public.destinations;
create policy "destinations_public_active_read" on public.destinations
  for select to anon, authenticated
  using ( active = true );
