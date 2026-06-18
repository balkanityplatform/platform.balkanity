---
phase: 03-payments-trust-spine
plan: 01
subsystem: testing
tags: [stripe, payments, vitest, playwright, webhook, rls, nyquist, idempotency]

# Dependency graph
requires:
  - phase: 02-supply-onboarding
    provides: "supply-rls.test.ts source-level contract precedent; destinations table (FK target for wp_transfers); is_admin() SECURITY DEFINER predicate; integer-cents money convention (commission.ts)"
provides:
  - "7 Wave 0 payment-contract test scaffolds (5 vitest source-level/unit + 2 Playwright adversarial), RED on disk as the Nyquist baseline"
  - "stripe@^22.2.1 dependency + committed lockfile (official SDK, no postinstall)"
  - "03-REPLAY-RUNBOOK.md — operator runbook for the SC3 Stripe-CLI replay idempotency gate"
  - "Confirmed apiVersion literal '2026-05-27.dahlia' type-checks against installed stripe@22.2 typings"
affects: [03-payments-trust-spine plans 02/03/04/05, transfer-pickup, platform-health]

# Tech tracking
tech-stack:
  added: [stripe@^22.2.1]
  patterns:
    - "Source-level contract test for migration 0003 mirrors supply-rls.test.ts (read SQL text, strip comments, regex-assert the security shape)"
    - "Comment-stripped grep gate for the single status:'paid' writer across app/platform/modules"
    - "Type-resilient dynamic import (runtime specifier + typed cast) so contract tests reference not-yet-existing modules while keeping tsc green"

key-files:
  created:
    - platform/rls/payments-schema.test.ts
    - platform/payments/single-writer.test.ts
    - app/api/stripe/webhook/route.contract.test.ts
    - platform/payments/checkout.test.ts
    - platform/payments/fee.test.ts
    - tests/e2e/webhook-forged.spec.ts
    - tests/e2e/success-spoof.spec.ts
    - .planning/phases/03-payments-trust-spine/03-REPLAY-RUNBOOK.md
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Contract tests for checkout.ts/fee.ts use a runtime-string dynamic import (not a static import) so the test files tsc-clean BEFORE the implementation lands, preserving RED-at-runtime while satisfying the plan's `tsc --noEmit passes` verification"
  - "apiVersion literal '2026-05-27.dahlia' verified accepted by stripe@22.2 typings (no `as any` cast needed)"
  - "single-writer grep gate asserts exactly-one AND that the one writer is the webhook route, so a misplaced writer fails even if the count is right"

patterns-established:
  - "Pattern: Nyquist payment-contract scaffolds land RED first; targets (migration 0003, stripe.ts/checkout.ts/fee.ts, webhook route, /pay/success) implemented in Plans 02-05 turn them GREEN"
  - "Pattern: e2e adversarial specs document Plan-05 live-DB seeding prerequisites inline (TODO markers) so the HTTP-400 portion runs now and state-change assertions wire up at the phase gate"

requirements-completed: [BOOK-05, HLTH-01]

# Metrics
duration: 9min
completed: 2026-06-18
---

# Phase 3 Plan 01: Payments Trust-Spine Test Scaffold Summary

**7 Nyquist Wave 0 payment-contract gates (single `paid` writer, `nodejs`+raw-body webhook, migration-0003 RLS/UNIQUE shape, EUR/integer-cents checkout, real-fee recording, forged-400 + success-spoof) plus `stripe@^22.2` and the Stripe-CLI replay runbook — all RED on disk as the locked contract for Plans 02-05.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-18T20:13Z
- **Completed:** 2026-06-18T20:24Z
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments
- Installed `stripe@^22.2.1` with a re-confirmed supply-chain audit (version 22.2.1, empty `scripts.postinstall`); lockfile committed; `@stripe/stripe-js` deliberately NOT added (server 303-redirect path locked).
- Verified the pinned `apiVersion` literal `'2026-05-27.dahlia'` type-checks against the installed v22 typings via `tsc --noEmit` (exit 0) — no cast needed; recorded as planned in Task 1.
- Authored 5 vitest scaffolds encoding SC1/SC3/SC4/SC5/D-05, all collected by `vitest run` and RED-because-unimplemented (targets land in Plans 02-04).
- Authored 2 Playwright adversarial specs (forged-signature → 400 + missing-signature → 400; success-spoof never shows paid), discovered by Playwright (3 tests) and correctly EXCLUDED from vitest.
- Wrote `03-REPLAY-RUNBOOK.md`: a self-contained operator runbook for the SC3 replay idempotency gate (install CLI → `stripe listen` → drive a TEST charge → `stripe events resend` → assert one `webhook_events` row + unchanged `paid_at`), TEST-mode (D-02) throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install stripe@^22.2 and verify the SDK is clean** - `501fad4` (chore)
2. **Task 2: Create the 5 vitest source-level + unit test scaffolds** - `9b3214a` (test)
3. **Task 3: Create the 2 Playwright adversarial specs + the replay runbook** - `f113469` (test)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `platform/rls/payments-schema.test.ts` - Source-level contract for migration 0003: 2x RLS enabled, exactly-one admin-read SELECT policy each via `is_admin()`, NO insert/update/delete policy, UNIQUE `webhook_events(event_id)`, required webhook_events + wp_transfers columns (incl. `amount_cents integer not null check (>= 0)`, FK to destinations), Balkanity-ref guardrail strings.
- `platform/payments/single-writer.test.ts` - Comment-stripped grep gate across app/platform/modules: exactly one `status:'paid'` writer AND it must be the webhook route (SC1).
- `app/api/stripe/webhook/route.contract.test.ts` - Asserts `runtime = "nodejs"`, `req.text()` present, `req.json(` absent, `constructEvent` present (SC1, Pitfalls 1/2).
- `platform/payments/checkout.test.ts` - Mocks the Stripe client; asserts `sessions.create` called with `mode:"payment"`, `currency:"eur"`, integer `unit_amount`, `metadata.transfer_id` (SC5).
- `platform/payments/fee.test.ts` - Asserts `recordedFeeCents` returns `balance_transaction.fee` verbatim (no rounding) and null-guards an absent balance_transaction (D-05, Pitfall 5).
- `tests/e2e/webhook-forged.spec.ts` - Forged `stripe-signature: t=1,v1=deadbeef` → 400 + zero state change; missing-signature variant → 400 (SC2).
- `tests/e2e/success-spoof.spec.ts` - Direct `/pay/success?t=…` hit with no webhook → page never shows paid (success page display-only; SC2, Pitfall 3).
- `.planning/phases/03-payments-trust-spine/03-REPLAY-RUNBOOK.md` - SC3 replay idempotency operator runbook.
- `package.json` / `package-lock.json` - `stripe ^22.2.1` added to dependencies + locked.

## Decisions Made
- **Type-resilient dynamic imports for checkout/fee contract tests.** The plan's verification requires `tsc --noEmit` to pass, but the contract tests must reference `@/platform/payments/checkout` and `@/platform/payments/fee` which do not exist yet. A static `import` of a missing module fails tsc. Resolved by importing via a runtime string specifier with a typed cast (`await import(specifier) as {...}`), so the test files compile cleanly while the import still throws at runtime — preserving the RED Nyquist baseline. The source-level tests (payments-schema, single-writer, route.contract) use `readFileSync` and are naturally tsc-clean.
- **`apiVersion` literal accepted as-is.** `'2026-05-27.dahlia'` type-checks against stripe@22.2 typings; no `as any` cast recorded.
- **single-writer gate is identity-checked, not just count-checked.** It asserts both `length === 1` and that the one writer matches `app/api/stripe/webhook/route.ts`, so a `paid` write in the wrong file fails even at count 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made checkout/fee contract imports type-resilient to satisfy `tsc --noEmit`**
- **Found during:** Task 2 (vitest scaffolds)
- **Issue:** Static `import { createCheckoutSession } from "@/platform/payments/checkout"` (and the fee equivalent) failed `tsc --noEmit` with TS2307 because the target modules do not exist yet (they land in Plan 03/04). The plan explicitly requires `npx tsc --noEmit` to exit 0. A `vi.fn(async () => ...)` mock also typed `.mock.calls` as an empty tuple, breaking `calls[0][0]` indexing.
- **Fix:** Switched both helpers to a runtime-string dynamic import with a typed cast (so tsc cannot statically resolve-and-fail the missing module) and typed the `sessionsCreate` mock parameter. The imports still throw at runtime, so the suites stay RED — the intended Nyquist baseline.
- **Files modified:** platform/payments/checkout.test.ts, platform/payments/fee.test.ts
- **Verification:** `npx tsc --noEmit` exit 0; the 6 payment tests still execute and fail RED-because-unimplemented; e2e specs unaffected.
- **Committed in:** `9b3214a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserves the plan's exact intent (RED scaffolds + tsc green) and introduces no scope creep. No targets were stubbed to make tests pass.

## Issues Encountered
None beyond the deviation above. The RED test output is the expected, correct end state for a Wave 0 scaffold plan.

## Verification Snapshot
- `npx tsc --noEmit` → exit 0 (stripe typings + all test files compile).
- `vitest run` on the 5 payment files → all 5 collected; 6 tests RED-because-unimplemented (targets land Plans 02-04). RED is the intended baseline.
- `vitest list` → does NOT collect the 2 e2e specs (excluded glob `tests/e2e/**`).
- `playwright test --list` → discovers all 3 e2e tests in 2 files.
- Runbook contains `stripe events resend`; forged spec contains `deadbeef`.

## User Setup Required
**External services require manual configuration before the live gates (Plan 05).** Stripe TEST-mode setup (per plan `user_setup`):
- `STRIPE_SECRET_KEY` (`sk_test_…`) — Stripe Dashboard (TEST mode) → Developers → API keys → Secret key.
- `STRIPE_WEBHOOK_SECRET` (`whsec_…`) — printed by `stripe listen --forward-to localhost:3000/api/stripe/webhook` (local) or Dashboard → Developers → Webhooks.
- Stripe CLI install for the SC3 replay gate: `brew install stripe/stripe-cli/stripe` then `stripe login`.
These are NOT written to any tracked file in this plan (T-03-ID accepted; secret handling lands in Plan 03).

## Next Phase Readiness
- The full payments contract is now locked on disk (RED). Plans 02-05 implement to turn the gates GREEN: migration 0003 (RLS/UNIQUE/columns) → `payments-schema.test.ts`; `stripe.ts`/`checkout.ts`/`fee.ts` → `checkout.test.ts`/`fee.test.ts`; webhook route → `single-writer.test.ts` + `route.contract.test.ts`; `/api/stripe/webhook` + `/pay/success` → the two e2e specs; live Stripe-CLI replay → `03-REPLAY-RUNBOOK.md` (SC3).
- Standing review gate: migration 0003 is a FLAGGED/irreversible schema change — human sign-off + Supabase CLI/Management-token apply to Balkanity ref `qyhdogajtmnvxphrslwm` (NEVER Kalvia), not MCP.
- `wave_0_complete` in 03-VALIDATION.md can flip to `true` (scaffolds exist RED on disk).

## Self-Check: PASSED

All 8 artifacts + the SUMMARY exist on disk; all 3 task commits (`501fad4`, `9b3214a`, `f113469`) present in git history.

---
*Phase: 03-payments-trust-spine*
*Completed: 2026-06-18*
