---
phase: 05-claim-correctness
plan: 01
subsystem: testing
tags: [postgres, supabase, vitest, rls, security-definer, concurrency, pii, nyquist]

# Dependency graph
requires:
  - phase: 03-payments-trust-spine
    provides: "wp_transfers money-spine + webhook_events + is_admin() + source-level contract test pattern (payments-schema.test.ts) + adversarial-gate pattern (webhook-forged/success-spoof)"
  - phase: 04-transfer-entity
    provides: "wp_transfers PII + lifecycle + driver_id columns, the paid->claimed transition guard trigger, guest-self-read RLS"
provides:
  - "Source-level migration-0005 claim contract test (RED) — pins the full security shape (masked read, PII omission, search_path='', race predicate, RETURNING *, grant/revoke, no-write-policy, Balkanity guardrail)"
  - "Shared service-role seed/teardown + caller-auth client fixtures (TEST-DB only) — seedPaidTransfer/seedDrivers/makeCallerClient/teardown"
  - "Concurrency one-winner adversarial gate (RED) — N parallel-JWT claims via single Promise.all"
  - "Non-claiming-driver zero-PII adversarial gate (RED) — wp_pool key check + base-table 0-rows under raw PostgREST"
affects: [05-claim-correctness Plan 02 (migration 0005 authoring), 05-claim-correctness Plan 03 (live apply + gate evidence), 06-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nyquist RED baseline: contract + adversarial gates land BEFORE the DB object they verify"
    - "Two-identity test split: service-role for seed/teardown ONLY, caller-auth JWT for the claim/read path (D-04)"
    - "Live-env-gated gates skip (describe.skip) rather than false-pass when the TEST DB env is absent"

key-files:
  created:
    - platform/rls/claim-schema.test.ts
    - tests/claim/fixtures.ts
    - tests/claim/concurrency.gate.test.ts
    - tests/claim/pii-payload.gate.test.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "claim-schema contract accepts EITHER security_invoker view OR a SECURITY DEFINER pool-read function for the masked read (Open Q1 resolves in Plan 02) — both preserve the D-01 column omission"
  - "Gates skip cleanly via hasLiveEnv() when the live TEST-DB env is absent (no false-pass), staying RED-correct at Wave 0 without 0005 or live env"
  - "PII_KEYS = {guest_name, guest_email, guest_phone, address, notes}; flight_no deliberately excluded and asserted PRESENT (operational, D-02)"

patterns-established:
  - "Pattern: source-level migration contract via readFileSync + comment-strip (mirror payments-schema.test.ts)"
  - "Pattern: parallel-JWT concurrency barrier — single Promise.all over N independent caller clients, no await-in-loop, looped K rounds on re-seeded rows (Pitfall 3)"
  - "Pattern: negative PII payload assertion on Object.keys(row) + adversarial base-table read returning 0 rows (data-layer, not UI)"

requirements-completed: [CLAIM-02, CLAIM-03]

# Metrics
duration: 7min
completed: 2026-06-19
---

# Phase 5 Plan 01: Claim-Correctness Nyquist Baseline Summary

**Source-level migration-0005 claim contract + the two live adversarial gates (concurrency one-winner, non-claiming-driver zero-PII) + shared service-role seed/caller-auth fixtures — all RED by design, encoding the exact contract migration 0005 (Plan 02) and its live apply (Plan 03) must satisfy.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-19T06:44:00Z (approx)
- **Completed:** 2026-06-19T06:51:27Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Locked the two definition-of-done invariants (CLAIM-02 atomic claim, CLAIM-03 data-layer PII gating) as machine-checked assertions BEFORE any DB object exists, mirroring the Phase 3 Nyquist baseline.
- Source-level contract (`claim-schema.test.ts`) pins the full 0005 security shape: masked read (security_invoker OR definer pool), PII column omission, `search_path=''` hardening, the `status='paid' AND driver_id IS NULL` race predicate, `RETURNING *`, grant-authenticated/revoke-anon+public, the no-write-policy lock, and the Balkanity-only guardrail (asserted against raw header text).
- Shared fixtures confine service-role to seeding/teardown only and expose a caller-auth client (anon key + driver JWT) for the claim/read path (D-04) — the threat-register mitigation for T-05-03.
- Two adversarial gates: the concurrency gate fires N=20 parallel JWT claims via a single `Promise.all` (no await-in-loop), looped K=5 rounds on re-seeded rows, asserting exactly one winner + N-1 `already_claimed` losers with `transfer=null` and `winner.driver_id == caller uid`; the PII gate asserts zero PII keys in `wp_pool` (flight_no present) + zero base-table rows under a raw PostgREST attack.

## Task Commits

Each task was committed atomically:

1. **Task 1: Source-level migration-0005 contract test (RED)** - `1c6cc86` (test)
2. **Task 2: Shared service-role seed/teardown fixtures** - `56be53a` (test)
3. **Task 3: Concurrency + PII adversarial gates (RED, live-seeding-gated)** - `90c10d3` (test)

## Files Created/Modified
- `platform/rls/claim-schema.test.ts` - Source-level migration-0005 security contract (8 assertions); RED via ENOENT (no 0005 yet).
- `tests/claim/fixtures.ts` - `seedPaidTransfer` (FK chain + one paid/unclaimed row with the four PII fields), `seedDrivers(n)` (auth users + app_users/driver_profiles + minted JWTs), `makeCallerClient(token)` (anon-key caller-auth), `teardown(ids)`; live-env-gated.
- `tests/claim/concurrency.gate.test.ts` - CLAIM-02/SC2 one-winner gate; single `Promise.all` over N independent caller clients, looped K rounds.
- `tests/claim/pii-payload.gate.test.ts` - CLAIM-03/SC3,SC4 zero-PII gate; `wp_pool` key check + base-table 0-rows adversarial read.
- `vitest.config.ts` - Added `tests/claim/**/*.test.{ts,tsx}` to `include`; `tests/e2e/**` stays excluded.

## RED / Nyquist Baseline State (EXPECTED — this is the intended outcome)

All four test artifacts are RED at this wave, exactly as the plan requires — this is the designed Nyquist baseline, NOT a failure:

- **`claim-schema.test.ts`** is RED because `supabase/migrations/0005_claim_correctness.sql` does not exist (`readFileSync` throws ENOENT at module load). Verified: `RED-as-expected (no 0005 yet)`. It turns GREEN when Plan 02 authors 0005 to the contract.
- **`concurrency.gate.test.ts` / `pii-payload.gate.test.ts`** target the `claim_transfer` RPC + `wp_pool` view, neither of which exists yet. Run without the live TEST-DB env they **skip** (3 skipped via `describe.skip` on `hasLiveEnv()`) rather than false-pass; run against a TEST DB before the Plan 03 apply they would fail (RPC/view absent). They turn GREEN at the Plan 03 BLOCKING live apply. Verified: vitest discovers both files (`2 skipped (2)`, `3 skipped (3)`).

Migration 0005 was deliberately NOT authored and no schema change was made — those are the Plan 02 / Plan 03 deliverables.

## Regression check
- `platform/payments/single-writer.test.ts` — **STILL GREEN** (`2 passed`). This plan introduces no second `status='paid'` writer.
- `npx tsc --noEmit` — no errors referencing any of the four new files.

## Decisions Made
- The masked-read assertion accepts EITHER `security_invoker = on` OR a `wp_pool` definer function/view, deferring Open Q1 to Plan 02 while still pinning the D-01 column omission either way.
- Gates use `describe.skip` keyed on `hasLiveEnv()` so the suite is green-when-skipped offline but cannot silently pass the actual assertions — the assertions only run with a live TEST DB.
- `PII_KEYS` excludes `flight_no` and the PII gate positively asserts `flight_no` is present (D-02 reclassification as operational/non-PII).

## Deviations from Plan

None - plan executed exactly as written. (No bugs, no missing critical functionality, no blocking issues; zero packages installed, consistent with the threat register T-05-SC `accept` disposition.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required by this plan. (The live TEST-DB env vars the gates consume — `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — are already set from Phases 1–3 and are exercised at the Plan 03 live apply, not here.)

## Next Phase Readiness
- The full Phase 5 test contract is now wired and RED. Plan 02 authors `supabase/migrations/0005_claim_correctness.sql` (masked `wp_pool` read + `claim_transfer()` SECURITY DEFINER RPC + claiming-driver RLS policy) to turn `claim-schema.test.ts` GREEN.
- Plan 03 applies 0005 live to Balkanity (`qyhdogajtmnvxphrslwm` ONLY, via the Management API — never Kalvia) behind the BLOCKING sign-off, then runs the two live gates against the TEST DB and records `05-GATES-EVIDENCE.md`.
- Reminder for Plan 02 (RESEARCH Open Q1): a `security_invoker` view needs a base-table pre-claim read grant that re-opens the SC3/SC4 PII path; a SECURITY DEFINER pool read does not. The contract test accepts either, but the planner/sign-off must pick the definer-read flavor to keep the base table 0-rows for non-claiming drivers.

## Self-Check: PASSED

- Files: FOUND `platform/rls/claim-schema.test.ts`, FOUND `tests/claim/fixtures.ts`, FOUND `tests/claim/concurrency.gate.test.ts`, FOUND `tests/claim/pii-payload.gate.test.ts`.
- Commits: FOUND `1c6cc86`, FOUND `56be53a`, FOUND `90c10d3`.

---
*Phase: 05-claim-correctness*
*Completed: 2026-06-19*
