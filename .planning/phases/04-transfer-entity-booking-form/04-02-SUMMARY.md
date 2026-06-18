---
phase: 04-transfer-entity-booking-form
plan: 02
subsystem: data-layer
tags: [migration, schema, rls, trigger, lifecycle, pii-boundary, supabase, flagged]

# Dependency graph
requires:
  - phase: 03-payments
    provides: "wp_transfers money-spine (0003) + webhook_events; is_admin() SECURITY DEFINER (0002); the no-write-policy lock"
  - phase: 04-transfer-entity-booking-form
    plan: 01
    provides: "platform/transfers/lifecycle.ts ALLOWED_TRANSITIONS — the TS map this DB trigger mirrors exactly"
provides:
  - "supabase/migrations/0004_transfer_entity.sql — wp_transfers PII+lifecycle ALTER + wp_enforce_transfer_transition BEFORE-UPDATE trigger + guest-self-read RLS + active-destination anon read (AUTHORED, not applied)"
  - "wp_transfers.driver_id FK scaffold (Phase 5/6 claim target, D-06)"
  - "destinations_public_active_read — the public /pickup read path 0002 deferred"
affects: [04-03-booking-form, 04-04-status-page, 04-05-apply-migration, 05-claim, 06-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB BEFORE-UPDATE trigger is the HARD lifecycle backstop (D-08): fires for the service-role webhook + future claim RPC alike (service-role bypasses RLS, NOT triggers)"
    - "RLS is the real PII boundary (UI masking leaks via the auto-REST API); guest-self-read uses (select auth.jwt() ->> 'email') — never the deprecated email() helper"
    - "Permissive SELECT policies OR together: admin-read (all) + guest-self-read (own row) coexist; a non-owning authenticated driver matches neither → zero rows"
    - "Additive NULL-able ALTER (no NOT NULL, no defaults) so existing Phase-3 seed rows survive untouched and the webhook's narrower column set keeps working"

key-files:
  created:
    - supabase/migrations/0004_transfer_entity.sql
  modified: []

key-decisions:
  - "The trigger's allowed map is authored EXACTLY against platform/transfers/lifecycle.ts ALLOWED_TRANSITIONS (the 04-01 TS mirror); the live 8x8 cross-check is Plan 05's adversarial runbook"
  - "requested→paid is explicitly in the map (Pitfall 4 / T-04-TMP2) so the webhook's .neq(status,paid) UPDATE is never blocked"
  - "D-10 state-vs-actor split documented inline: the trigger enforces STATE legality only; actor legality (admin-only cancel) is the Phase-6 app gate — the trigger has no auth context on the service-role path"
  - "A doc comment that literally contained the token auth.email() was reworded to 'email() auth helper' so the grep-based ZERO-occurrence acceptance check passes (Rule 3, verification fix)"

requirements-completed: [XFER-01, AUTH-02, BOOK-01]

# Metrics
duration: 2min
completed: 2026-06-18
---

# Phase 4 Plan 02: Transfer Entity Migration (0004) Summary

**Authored migration `0004_transfer_entity.sql` (FLAGGED / not applied): the additive NULL-able PII + lifecycle + driver-scaffold ALTER on `wp_transfers`, the full 8-state BEFORE-UPDATE transition-guard trigger mirroring `lifecycle.ts` exactly (incl. requested→paid), and two RLS SELECT policies — guest-self-read via the JWT email claim and the narrow active-destination anon read that unblocks `/pickup`.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-18T19:58Z
- **Completed:** 2026-06-18T20:01Z
- **Tasks:** 3
- **Files modified:** 1 (1 created)

## Accomplishments

- **Additive ALTER (Task 1):** Added nine NULL-able columns to `wp_transfers` — `guest_name`, `guest_email`, `guest_phone`, `pax` (check 1–8, D-03), `luggage_count` (check ≥ 0), `flight_no`, `arrival_at`, `notes`, and `driver_id uuid references auth.users(id) on delete set null` (the Phase 5/6 claim scaffold, D-06). No `NOT NULL`, no defaults → existing Phase-3 seed rows survive and the webhook's narrower column set is unaffected. Two indexes: `wp_transfers_arrival_at_idx` (claim-pool sort, CLAIM-06) and `wp_transfers_guest_email_idx` (guest-self-read RLS filter). The no-write-policy lock is preserved.
- **Lifecycle trigger (Task 2):** `public.wp_enforce_transfer_transition()` + `wp_transfers_transition_guard` (BEFORE UPDATE, FOR EACH ROW). Early-returns on a no-op (`new.status is not distinct from old.status`); otherwise enforces the exact 6-source allowed map (requested→[paid,cancelled], paid→[claimed,cancelled], claimed→[en_route,cancelled], en_route→[arrived,cancelled], arrived→[picked_up,cancelled], picked_up→[completed]; completed/cancelled terminal) and raises `check_violation` on any illegal jump. The map matches `platform/transfers/lifecycle.ts` ALLOWED_TRANSITIONS verbatim. Comments document the service-role-fires-too guarantee and the D-10 state-vs-actor split.
- **RLS policies (Task 3):** `wp_transfers_guest_self_read` (`for select to authenticated using ( (select auth.jwt() ->> 'email') = guest_email )`) — the data-layer PII boundary, using the current JWT email form (zero occurrences of the deprecated `email()` helper). `destinations_public_active_read` (`for select to anon, authenticated using ( active = true )`) — the public `/pickup/<slug>` read path 0002 deferred. Both wrapped in `drop policy if exists` for re-runnability; comments document the OR-coexistence with the existing admin-read policies and the non-owning-driver → zero-rows guarantee.

## Task Commits

Each task was committed atomically:

1. **Task 1: ALTER wp_transfers — NULL-able PII + lifecycle + driver scaffold** - `c23adbc` (feat)
2. **Task 2: BEFORE-UPDATE lifecycle transition-guard trigger (8-state map)** - `ee0891f` (feat)
3. **Task 3: guest-self-read RLS (auth.jwt email) + active-destination anon read** - `ca9de4d` (feat)

## Files Created/Modified

- `supabase/migrations/0004_transfer_entity.sql` - The FLAGGED / irreversible transfer-entity migration. One file, three parts: (1) additive NULL-able PII + lifecycle + driver-scaffold ALTER with claim-sort + guest-email indexes; (2) the 8-state BEFORE-UPDATE transition-guard trigger mirroring `lifecycle.ts`; (3) the guest-self-read + active-destination-anon-read RLS SELECT policies. Header carries the Balkanity-ref (`qyhdogajtmnvxphrslwm`) guardrail and the FLAGGED / sign-off / authored-not-applied note. 162 lines.

## Decisions Made

- **Trigger map authored against the TS mirror, not re-derived.** The allowed pairs were copied to match `platform/transfers/lifecycle.ts` ALLOWED_TRANSITIONS exactly so the 04-01 exhaustive 8×8 unit test stays the drift guard; the live DB cross-check is Plan 05's adversarial runbook.
- **`requested → paid` is load-bearing and explicit** (Pitfall 4 / T-04-TMP2): without it the verified Stripe webhook's `.neq("status","paid")` UPDATE would be rejected and Stripe would retry forever.
- **D-10 state-vs-actor split documented inline.** The trigger guarantees STATE legality only (cancelled reachable only from the five pre-pickup states; picked_up/completed/cancelled terminal). Actor legality (admin-only cancel) is the Phase-6 app `getCurrentRole()` gate — the trigger has no auth context on the service-role path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a doc comment containing the literal `auth.email()` token**
- **Found during:** Task 3 verification
- **Issue:** Task 3's acceptance criterion is a blunt grep — "the file contains ZERO occurrences of the deprecated `auth.email()` helper (grep `auth.email()` returns nothing)". My explanatory comment said "the deprecated `auth.email()` helper is NOT used", which itself contained the literal token and tripped the grep, failing the criterion despite the policy correctly using the `auth.jwt() ->> 'email'` form.
- **Fix:** Reworded the comment to "the deprecated email() auth helper is NOT used" — preserves the intent, removes the literal token. The policy SQL was never affected.
- **Files modified:** `supabase/migrations/0004_transfer_entity.sql`
- **Commit:** `ca9de4d` (the fix landed before the Task 3 commit)

## Issues Encountered

None beyond the deviation above. Structural sanity check passed: 9 ALTER columns, 1 function, 1 trigger, 2 policies, balanced `$$` dollar-quoting (one open/close pair), no INSERT/UPDATE/DELETE policy on `wp_transfers`, and only one `utyatpadtibqqswsfvtr` occurrence (the "NEVER Kalvia" guardrail in the header).

## Threat Surface / Stubs

- **Stubs:** None. This plan authors complete SQL DDL; no placeholder/mock data flows to any UI.
- **Threat flags:** None new beyond the plan's `<threat_model>`. All four `mitigate` dispositions are implemented in this migration: T-04-TMP1 (transition trigger), T-04-TMP2 (requested→paid in the map), T-04-ID1 (guest-self-read RLS), T-04-ID2 (no permissive policy for non-owning drivers → zero rows; no-write-policy lock), T-04-ID3 (active-destination anon read). T-04-SC (npm installs) — N/A, zero new packages.

## Important Constraint — File Authored, NOT Applied

This migration is a FLAGGED / irreversible schema change and has **NOT** been applied to any live or remote database. No `supabase db push` / `migration up` / `db reset` / psql-against-remote was run. The live apply to Balkanity (ref `qyhdogajtmnvxphrslwm` ONLY, never Kalvia `utyatpadtibqqswsfvtr`) is the **BLOCKING, signed-off task in Plan 05**, executed via the Supabase CLI / Management access token (NOT MCP — MCP reaches only Kalvia per project memory).

## Next Phase Readiness

- The data-layer authority for the whole phase is authored: the booking form (Plan 03) can write the PII columns and the status page (Plan 04) can rely on the guest-self-read RLS once the migration is applied in Plan 05.
- `destinations_public_active_read` unblocks the public `/pickup/<slug>` read the booking form depends on (BOOK-01) — pending the Plan 05 apply.
- Plan 05's adversarial runbook must seed and assert the live `requested → paid` transition and cross-check the trigger's 8 states against `lifecycle.ts` before sign-off.

## Self-Check: PASSED

- File `supabase/migrations/0004_transfer_entity.sql` exists on disk (162 lines).
- All three task commits present in git history: `c23adbc`, `ee0891f`, `ca9de4d`.

---
*Phase: 04-transfer-entity-booking-form*
*Completed: 2026-06-18*
