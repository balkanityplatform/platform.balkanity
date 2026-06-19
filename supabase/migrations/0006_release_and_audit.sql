-- 0006_release_and_audit.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- THIS FILE IS AUTHORED, NOT APPLIED. The live apply to Balkanity is a BLOCKING, signed-off
-- task (Plan 05) via the Supabase Management API /database/query with SUPABASE_ACCESS_TOKEN —
-- NOT MCP (MCP reaches only Kalvia; see project memory), NOT `supabase db push`, NOT a direct
-- host psql DDL run. Do not run db push / migration up / db reset against any remote from here.
--
-- This migration extends the LOCKED Phase-4/5 transfer data layer with the two Phase-6 deltas
-- required by the admin ops console (OPS-02/OPS-03) and the audit trail (D-15). Two parts:
--   1) AMEND public.wp_enforce_transfer_transition() — add ONE allowed pair to the lifecycle map:
--      claimed -> paid (the RELEASE backward edge, D-14). An admin releases a claimed transfer
--      back to the open pool so another driver can claim it. Release is restricted to `claimed`
--      ONLY — NO en_route -> paid or any other backward edge. This mirrors the new
--      platform/transfers/lifecycle.ts ALLOWED_TRANSITIONS.claimed entry exactly; the 8x8 unit
--      test pins the TS map to THIS trigger (T-04-01 / T-06-01).
--   2) ALTER public.wp_transfers — add the three NULL-able audit columns (D-15): last_action_reason
--      text / last_action_by uuid / last_action_at timestamptz. Recorded by the gated admin ops
--      actions (cancel/refund/reassign/release) so each operational mutation carries its D-10
--      reason note. All NULL-able with NO default → the additive ALTER does NOT rewrite or
--      invalidate existing Phase-3/4 rows (mirrors the 0004 ALTER pattern).
--
-- Trust-boundary notes (threat model 06-01):
--   T-06-01  The claimed -> paid trigger edge is restricted to `claimed` ONLY (no en_route -> paid).
--            Authored-not-applied; the live apply (Plan 05) is sign-off-gated. The TS map + this
--            trigger are pinned byte-for-byte by the 8x8 lifecycle pair test.
--   T-06-02  This migration adds NO INSERT/UPDATE/DELETE RLS policy — the no-write-policy lock from
--            0002/0003/0004/0005 HOLDS. Writes (including the release status='paid' write) stay
--            service-role-only behind the gated admin action; the single-writer money lock is widened
--            (in the source contract) to EXACTLY {webhook, gated release action}, never a client.
--   T-06-03  The Balkanity-only guardrail above names both refs; the Plan-05 live apply re-asserts the
--            target ref before any DDL. NEVER apply to Kalvia.
-- Seam note (PLAT-01): wp_transfers / wp_enforce_transfer_transition = module objects → wp_ prefix.
-- Re-runnability: every statement uses `create or replace` / `add column if not exists` /
--   `drop ... if exists` so a partial re-run is safe and idempotent (mirrors 0004/0005).

-- ============================================================================
-- 1) AMEND wp_enforce_transfer_transition() — add the claimed -> paid RELEASE edge (D-14).
--    Copies the entire 0004 function body and adds 'paid' to the `claimed` allowed set ONLY.
--    The no-op early-return and the check_violation raise are unchanged. The service-role
--    client bypasses RLS, NOT this trigger — so release legality is guaranteed regardless of
--    who writes. requested -> paid remains load-bearing (Pitfall 4 / T-04-TMP2).
-- ============================================================================
create or replace function public.wp_enforce_transfer_transition()
returns trigger
language plpgsql
as $$
begin
  -- No-op / non-status update pass-through: a same-status UPDATE (or any update that does not
  -- touch status) is always legal. `is not distinct from` is NULL-safe.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- The complete allowed-transition map — EXACTLY mirrors platform/transfers/lifecycle.ts
  -- ALLOWED_TRANSITIONS. requested -> paid is load-bearing (Pitfall 4 / T-04-TMP2). The new
  -- claimed -> paid pair is the D-14 RELEASE backward edge (Phase 6), restricted to `claimed`
  -- ONLY — there is deliberately NO en_route -> paid (or any other) backward edge.
  if not (
       (old.status = 'requested' and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid'      and new.status in ('claimed', 'cancelled'))
    or (old.status = 'claimed' and new.status in ('en_route', 'cancelled', 'paid'))
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
  'BEFORE-UPDATE lifecycle guard (D-08/D-09/D-10/D-14). Encodes the full 8-state map mirroring platform/transfers/lifecycle.ts; permits requested->paid (Pitfall 4) AND the Phase-6 claimed->paid RELEASE backward edge (D-14, claimed-only); raises check_violation on any illegal jump. Fires for ALL writers incl. service-role (triggers are not bypassed; only RLS is). State legality only — actor legality is the Phase-6 app gate.';

-- drop-if-exists first for re-runnability, then (re)create the BEFORE UPDATE, FOR EACH ROW trigger.
drop trigger if exists wp_transfers_transition_guard on public.wp_transfers;
create trigger wp_transfers_transition_guard
  before update on public.wp_transfers
  for each row execute function public.wp_enforce_transfer_transition();

-- ============================================================================
-- 2) ALTER wp_transfers — add the three NULL-able admin-audit columns (D-15).
--    Recorded by the gated admin ops actions (cancel/refund/reassign/release). All NULL-able
--    with NO default → the additive ALTER does NOT rewrite or invalidate existing rows (0004
--    pattern). NO write RLS policy is added — the no-write-policy lock holds; the gated
--    service-role action is the only writer.
-- ============================================================================
alter table public.wp_transfers add column if not exists last_action_reason text;
alter table public.wp_transfers add column if not exists last_action_by uuid;
alter table public.wp_transfers add column if not exists last_action_at timestamptz;

comment on column public.wp_transfers.last_action_reason is
  'D-10 admin audit reason for the most recent operational mutation (cancel/refund/reassign/release), recorded by the gated service-role admin action (D-15). Distinct from the Stripe `reason` enum — this is the free-text operator note. NULL-able; NULL for rows never operated on.';
