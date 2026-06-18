---
phase: 04-transfer-entity-booking-form
plan: 01
subsystem: testing
tags: [lifecycle, state-machine, i18n, nyquist-baseline, vitest, playwright, zod, stripe-checkout, magic-link]

# Dependency graph
requires:
  - phase: 03-payments
    provides: "createCheckoutSession({transferId,amountCents}) helper, single-paid-writer grep gate, StatusDot TransferState union, wp_transfers money-spine"
  - phase: 01-foundation
    provides: "Dict parity gate (en.ts/bg.ts tsc shape), Vitest+Playwright Wave 0 runner, /auth/confirm verifyOtp route"
provides:
  - "platform/transfers/lifecycle.ts — ALLOWED_TRANSITIONS map (TS mirror of the migration-0004 DB trigger), canTransition(), LIFECYCLE_ORDER"
  - "Wave 0 RED specs for the booking action (BOOK-02/03), confirmation stub (BOOK-06), and guest-status e2e (BOOK-07/AUTH-02)"
  - "All Phase 4 booking/disclosure/validation/status/track/confirmation-email copy keys in en.ts + bg.ts"
affects: [04-02-migration, 04-03-booking-form, 04-04-status-page, 05-claim, 06-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-layer lifecycle map mirrors the DB trigger; the DB trigger is the hard backstop (D-08), the TS map is friendly-error-only"
    - "Nyquist baseline: RED specs land before the surfaces they verify, using runtime-string dynamic import + typed cast to stay tsc-clean while RED"
    - "Exhaustive 8x8 pair test pins the TS transition map to the DB-trigger table (drift guard, T-04-01)"

key-files:
  created:
    - platform/transfers/lifecycle.ts
    - platform/transfers/lifecycle.test.ts
    - app/pickup/[slug]/booking.test.ts
    - platform/transfers/confirmation.test.ts
    - tests/e2e/guest-status.spec.ts
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts

key-decisions:
  - "lifecycle.ts imports TransferState from StatusDot (single source of truth) and declares no local state enum (T-04-02)"
  - "LIFECYCLE_ORDER excludes cancelled — the UI renders cancelled as a distinct terminal row only when reached (UI-SPEC)"
  - "The exhaustive lifecycle test authors an independent EXPECTED map (not imported from lifecycle.ts) so source drift cannot self-satisfy the cross-product assertion"

patterns-established:
  - "DB-trigger-mirror app guard: ALLOWED_TRANSITIONS + canTransition give friendly errors; the 0004 BEFORE-UPDATE trigger is the enforcement boundary"
  - "Wave 0 RED spec via runtime-string dynamic import + typed cast (tsc-clean before impl, RED at runtime) — extends the 03-01 pattern to the booking/confirmation surfaces"

requirements-completed: [XFER-01, BOOK-02, BOOK-03, BOOK-04, BOOK-06, BOOK-07, AUTH-02]

# Metrics
duration: 5min
completed: 2026-06-18
---

# Phase 4 Plan 01: Lifecycle Map + Wave 0 Baseline + Copy Surface Summary

**Pure-TS 8-state lifecycle transition map (mirror of the migration-0004 DB trigger) with an exhaustive 8x8 pair gate, three Nyquist RED specs for the booking/confirmation/status surfaces, and the full EN/BG Phase 4 copy contract behind the tsc Dict parity gate.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-18T19:47Z
- **Completed:** 2026-06-18T19:54Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `platform/transfers/lifecycle.ts`: `ALLOWED_TRANSITIONS` (the exact RESEARCH Pattern 2 / D-08/D-09/D-10 map), `canTransition()`, and `LIFECYCLE_ORDER` (7 happy-path states, `cancelled` excluded) — imports `TransferState` from `StatusDot`, no local enum.
- Exhaustive lifecycle test iterates all 64 ordered state pairs against an independently-authored expected map, plus spot-checks for the load-bearing edges (`requested→paid` allowed — Pitfall 4; `picked_up`/`completed`/`cancelled` terminal rules — D-10). GREEN.
- Three Wave 0 RED specs land tsc-clean and RED at runtime, referencing the surfaces Plans 03/04 will build: booking action (server-trusted amount + zod boundary, BOOK-02/03), confirmation magic-link stub (no second `paid` writer, BOOK-06), guest-status e2e timeline + receipt (BOOK-07/AUTH-02).
- Full Phase 4 copy surface added to `en.ts` (EN canonical, verbatim from the UI-SPEC Copywriting Contract) and `bg.ts` (BG translations, `{placeholders}` preserved) — Dict parity gate green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lifecycle transition map + RED unit spec** - `9e849e2` (feat) — map + exhaustive test land together GREEN (TDD task; map exists in the same task, so a single feat commit rather than a separate test→feat split).
2. **Task 2: Wave 0 RED specs (booking, confirmation, guest-status e2e)** - `2a8fbaa` (test)
3. **Task 3: Phase 4 copy keys in en.ts + bg.ts** - `eb4b67c` (feat)

## Files Created/Modified

- `platform/transfers/lifecycle.ts` - TS allowed-transition map + canTransition + LIFECYCLE_ORDER (friendly-error mirror of the 0004 DB trigger).
- `platform/transfers/lifecycle.test.ts` - 8x8 exhaustive pair gate + edge spot-checks (XFER-01).
- `app/pickup/[slug]/booking.test.ts` - RED spec: zod boundary + server-sourced amount + single createCheckoutSession call (BOOK-02/03).
- `platform/transfers/confirmation.test.ts` - RED spec: magiclink to `/status/<id>` via `/auth/confirm` + no `status:'paid'` in the target module (BOOK-06).
- `tests/e2e/guest-status.spec.ts` - RED skeleton: lifecycle timeline dots + receipt; magic-link/session steps `test.fixme` referencing Plan 04 (BOOK-07/AUTH-02).
- `platform/i18n/en.ts` - Phase 4 copy section (booking, disclosure, validation, inactive-slug, confirmation-email, status, track).
- `platform/i18n/bg.ts` - matching BG translations for every new key.

## Decisions Made

- The lifecycle test authors its own independent `EXPECTED` map rather than importing `lifecycle.ts`'s, so a future divergence in the source map cannot self-satisfy the cross-product assertion (real drift guard against the DB trigger).
- Task 1 (`tdd="true"`) produced a single `feat` commit, not a separate RED test commit, because the map and its test land together GREEN by design (the plan specifies the test is GREEN for this task). The RED baseline for the *not-yet-built* surfaces lives in Task 2.

## Deviations from Plan

None - plan executed exactly as written. No package installs (RESEARCH Package Legitimacy Audit: zero new packages; T-04-SC accept).

## Issues Encountered

None. Final test state is exactly the designed baseline: full vitest run = 19 files / 96 tests passing (incl. the new lifecycle suite GREEN and all pre-existing suites unaffected) + 2 files / 10 tests RED (the two new Wave 0 specs referencing the missing booking action / confirmation module via module-resolution errors, not syntax errors). `npm run typecheck` is green (Dict parity holds). `npx playwright test --list` collects the 3-test guest-status spec without error.

## Threat Surface / Stubs

- **Stubs:** None that block the plan goal. The three RED specs intentionally reference future modules (`app/pickup/[slug]/actions.ts`, `platform/transfers/confirmation-email.ts`, `app/status/[id]/page.tsx`) — this is the Nyquist baseline, resolved by Plans 03/04. No production stub data flows to any UI in this plan.
- **Threat flags:** None. This plan crosses no runtime trust boundary (pure test/utility/copy authoring). The lifecycle map is advisory app-layer only; the 0004 DB trigger (Plan 02) is the enforcement boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full 8-state lifecycle contract (TS + the planned DB-trigger map it mirrors) is locked and test-pinned — Plan 02's migration-0004 trigger must encode exactly this table or `lifecycle.test.ts` will diverge from the (future) adversarial DB test.
- All Phase 4 copy keys exist in both dictionaries, so the booking form (Plan 03) and status page (Plan 04) islands can consume keys without re-deriving copy.
- The three RED specs are the GREEN targets for Plans 03 (booking action) and 04 (confirmation stub + status page / magic-link session).

## Self-Check: PASSED

All 5 created files + 2 modified files exist on disk; all 3 task commits (`9e849e2`, `2a8fbaa`, `eb4b67c`) are present in git history.

---
*Phase: 04-transfer-entity-booking-form*
*Completed: 2026-06-18*
