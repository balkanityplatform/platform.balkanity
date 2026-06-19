-- 0005_claim_correctness.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- THIS FILE IS AUTHORED, NOT APPLIED. The live apply to Balkanity is a BLOCKING, signed-off
-- task (Plan 03) via the Supabase Management API /database/query with SUPABASE_ACCESS_TOKEN —
-- NOT MCP (MCP reaches only Kalvia; see project memory), NOT `supabase db push`, NOT a direct
-- host psql DDL run. Do not run db push / migration up / db reset against any remote from here.
-- This migration is the ENTIRE data-layer contract for Phase 5 (claim-correctness): it assembles
-- three hardened Postgres objects on top of the Phase-3/4 transfer entity:
--   1) public.wp_pool        — the masked pre-claim read (SECURITY DEFINER read, Open Q1 = option b).
--                              Exposes ONLY the 8 D-01 pre-claim columns; PII columns are physically
--                              omitted (never selected), so the payload structurally cannot carry them.
--   2) public.claim_transfer — a SECURITY DEFINER atomic-claim RPC: ONE conditional UPDATE under
--                              READ COMMITTED that decides the race (D-04). Winner gets the full row
--                              via RETURNING *; losers get a graceful zero-PII result (D-03).
--   3) wp_transfers_claimed_driver_read — a claiming-driver RLS SELECT policy. NO write policy is
--                              added anywhere — the no-write-policy lock from 0002/0003/0004 holds;
--                              the SECURITY DEFINER RPC is the ONLY sanctioned claim write path.
--
-- Open Q1 resolution (RESEARCH lines 449-454): the masked pool is a SECURITY DEFINER read, NOT a
-- security_invoker view. A security_invoker view inherits the driver's base-table RLS, which would
-- force a permissive pre-claim base-table SELECT policy that re-opens the SC3 PII-leak path. The
-- DEFINER read returns only the 8 masked columns AND lets the base table stay 0-rows for a
-- non-claiming driver (SC4). No base-table pre-claim SELECT policy for drivers is added.
--
-- Trust-boundary notes (threat model 05-02):
--   T-05-PII   wp_pool selects ONLY the 8 D-01 columns; guest_name / guest_email / guest_phone /
--              d.address / t.notes are NEVER selected. With no base-table driver read policy, the
--              raw wp_transfers table returns 0 rows to a non-claiming driver (SC3/SC4).
--   T-05-EOP1  claim_transfer + wp_pool are SECURITY DEFINER with set search_path = '' and every
--              relation fully schema-qualified (public.*, auth.uid()) — search_path-injection-proof.
--   T-05-EOP2  EXECUTE on claim_transfer is revoked from public/anon and granted only to
--              authenticated; the RPC also null-guards auth.uid() (anon → not_authenticated).
--   T-05-SPOOF claim_transfer derives the claiming driver from auth.uid() INTERNALLY; its signature
--              takes only p_transfer_id — no client-supplied driver id is ever trusted (D-04).
--   T-05-RACE  The claim is ONE atomic conditional UPDATE WHERE status='paid' AND driver_id IS NULL
--              under READ COMMITTED — never RLS, never SELECT-then-UPDATE. The 2nd writer blocks on
--              the row lock, re-checks the committed 'claimed' row, matches nothing → loser branch.
--   T-05-MONEY claim only moves paid → claimed; it NEVER sets status='paid'. The single `paid`
--              writer remains the verified Stripe webhook (single-writer lock unbroken).
--   T-05-KALVIA File authored only; the Balkanity-only guardrail above gates the live apply (Plan 03)
--              to the Management API against ref qyhdogajtmnvxphrslwm.
-- Seam note (PLAT-01): wp_transfers / wp_pool / wp_claim_result / claim_transfer = module objects
--   → wp_ / claim_ prefix; destinations = platform-generic → UNPREFIXED.
--
-- Reuse note: public.is_admin() is NOT redefined here — it already exists from 0002; admin coverage
--   on wp_transfers comes from the existing wp_transfers_admin_read (0003), which OR's in is_admin().
-- Re-runnability: every statement uses `create or replace` / `drop ... if exists` / `create ... if
--   not exists` so a partial re-run is safe and idempotent (mirrors 0004).

-- ============================================================================
-- 1) wp_pool — masked pre-claim read (SECURITY DEFINER read, Open Q1 = option b).
--    Returns ONLY the 8 D-01 pre-claim columns (plus id/status for keying): date/arrival time,
--    airport + zone (AREA only, NEVER d.address), flight_no (operational, non-PII, D-02), fare,
--    pax, luggage_count. guest_name / guest_email / guest_phone / d.address / t.notes are NEVER
--    selected — structural omission, not select-then-hide. Filtered to the open pool
--    (status='paid' AND driver_id IS NULL). Restricted to drivers + admins (D-06); a guest caller
--    gets 0 rows. SECURITY DEFINER + set search_path = '' so the base table stays 0-rows for a
--    non-claiming driver (no base-table pre-claim SELECT policy is added — SC4 stays tight).
-- ============================================================================
create or replace function public.wp_pool()
returns table (
  id            uuid,
  status        text,
  arrival_at    timestamptz,
  airport       text,
  zone          text,
  flight_no     text,
  amount_cents  integer,
  pax           integer,
  luggage_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.status,
    t.arrival_at,                 -- date + arrival time (D-01)
    d.airport,                    -- from destinations (D-01)
    d.zone,                       -- AREA only, NEVER d.address (D-01)
    t.flight_no,                  -- operational, non-PII for v1 (D-02)
    t.amount_cents,               -- fare (D-01)
    t.pax,                        -- (D-01)
    t.luggage_count               -- (D-01)
  from public.wp_transfers t
  join public.destinations d on d.id = t.destination_id
  where t.status = 'paid'
    and t.driver_id is null
    and (
      public.is_admin()
      or exists (
        select 1 from public.driver_profiles dp
        where dp.user_id = (select auth.uid())
      )
    );
$$;

comment on function public.wp_pool() is
  'Masked pre-claim pool read (CLAIM-03 / SC1, D-01). SECURITY DEFINER + empty search_path so it returns ONLY the 8 D-01 columns and the base table stays 0-rows for a non-claiming driver (Open Q1 = option b). Guest contact PII and exact address/notes are never selected. Restricted to drivers + admins.';

-- D-06: only authenticated drivers/admins may invoke the masked pool read; anon/public cannot.
revoke execute on function public.wp_pool() from public, anon;
grant  execute on function public.wp_pool() to authenticated;

-- ============================================================================
-- 2) claim_transfer — the SECURITY DEFINER atomic-claim RPC (CLAIM-02 / SC2, D-03/D-04).
--    The composite return type is self-documenting and types cleanly on the client. The RPC
--    derives the claiming driver from auth.uid() internally (never a client argument — D-04),
--    performs ONE atomic conditional UPDATE (the concurrency control — never SELECT-then-UPDATE),
--    and returns the typed result: winner gets the full row via RETURNING *; losers get
--    ok=false / reason='already_claimed' / transfer=null (graceful, zero PII — D-03). An admin
--    caller resolves through auth.uid() identically to a driver, so an admin can act-as-driver
--    with no extra branch (D-07). The RPC stays purely about the single-transfer race — NO
--    per-driver hold cap, NO active-claim count check (D-05). The paid → claimed write passes the
--    existing 0004 transition-guard trigger unchanged (SECURITY DEFINER bypasses RLS, NOT triggers).
-- ============================================================================
drop type if exists public.wp_claim_result cascade;
create type public.wp_claim_result as (
  ok       boolean,
  reason   text,
  transfer public.wp_transfers   -- full row for the winner; NULL for losers (D-03)
);

create or replace function public.claim_transfer(p_transfer_id uuid)
returns public.wp_claim_result
language plpgsql
security definer
set search_path = ''               -- HARDEN: empty path; every relation is schema-qualified
as $$
declare
  v_uid uuid := (select auth.uid());           -- the REAL caller; never a client-supplied id (D-04)
  v_row public.wp_transfers;
begin
  if v_uid is null then
    return (false, 'not_authenticated', null)::public.wp_claim_result;
  end if;

  -- THE concurrency control (D-04, T-05-RACE): one atomic conditional UPDATE under READ
  -- COMMITTED. The 2nd writer blocks on the row lock, re-checks the WHERE against the committed
  -- 'claimed' row, matches nothing → 0 rows affected → loser branch. Never a SELECT-then-UPDATE;
  -- never trusts a client-supplied driver id. This only moves paid → claimed; it NEVER writes
  -- status='paid' (the single-writer money lock is the verified Stripe webhook).
  update public.wp_transfers
     set status = 'claimed',
         driver_id = v_uid
   where id = p_transfer_id
     and status = 'paid'
     and driver_id is null
  returning * into v_row;

  if not found then
    return (false, 'already_claimed', null)::public.wp_claim_result;   -- graceful loser, zero PII (D-03)
  end if;

  return (true, null, v_row)::public.wp_claim_result;                  -- winner gets the full row atomically
end;
$$;

comment on function public.claim_transfer(uuid) is
  'Atomic-claim RPC (CLAIM-02 / SC2, D-03/D-04). SECURITY DEFINER + empty search_path. Derives the driver from auth.uid() (never a client arg), decides the race with ONE conditional UPDATE WHERE status=paid AND driver_id IS NULL ... RETURNING *, and returns a typed {ok, reason, transfer}. Only moves paid → claimed; never sets paid. No per-driver hold cap (D-05).';

-- D-06 / T-05-EOP2 (Pitfall 5): the claim RPC is callable only by authenticated drivers/admins.
revoke execute on function public.claim_transfer(uuid) from public, anon;
grant  execute on function public.claim_transfer(uuid) to authenticated;

-- ============================================================================
-- 3) wp_transfers_claimed_driver_read — claiming-driver RLS SELECT policy (CLAIM-03 / SC4, D-08).
--    Mirrors the 0004 SELECT-policy shape (drop-if-exists for re-runnability; (select auth.uid())
--    initPlan-cache wrap). Postgres ORs permissive SELECT policies, so this coexists with
--    wp_transfers_admin_read (0003, is_admin) and wp_transfers_guest_self_read (0004). A driver
--    reads the full row of the transfer they claimed (driver_id = their uid); an admin is already
--    covered by wp_transfers_admin_read, so a driver-self clause alone suffices (RESEARCH Q3, D-08).
--    A non-claiming driver matches NEITHER this nor admin_read nor guest_self_read → 0 rows (SC4).
--    NO INSERT/UPDATE/DELETE policy is added anywhere — the no-write-policy lock holds; the
--    SECURITY DEFINER claim_transfer RPC is the only sanctioned claim write path.
-- ============================================================================
drop policy if exists "wp_transfers_claimed_driver_read" on public.wp_transfers;
create policy "wp_transfers_claimed_driver_read" on public.wp_transfers
  for select to authenticated
  using ( (select auth.uid()) = driver_id );
