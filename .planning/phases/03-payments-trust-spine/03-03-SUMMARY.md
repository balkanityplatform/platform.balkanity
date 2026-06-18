---
phase: 03-payments-trust-spine
plan: 03
subsystem: payments
tags: [stripe, checkout, server-only, zod, vitest, eur, integer-cents]

# Dependency graph
requires:
  - phase: 03-payments-trust-spine (Plan 01)
    provides: "RED contract tests platform/payments/checkout.test.ts + fee.test.ts; runtime-string dynamic-import specifiers (@/platform/payments/checkout, @/platform/payments/fee)"
  - phase: 02 (foundation)
    provides: "platform/supabase/admin.ts server-only pattern; platform/money/commission.ts integer-cents convention; NEXT_PUBLIC_SITE_URL trusted-base convention"
provides:
  - "platform/payments/stripe.ts — server-only Stripe client factory, apiVersion 2026-05-27.dahlia"
  - "platform/payments/checkout.ts — createCheckoutSession({transferId,amountCents}) code-created EUR Checkout Session with metadata.transfer_id; returns session.url"
  - "platform/payments/fee.ts — recordedFeeCents(pi) verbatim integer balance_transaction.fee, null-guarded (D-05)"
affects: [03-04-webhook, 03-05-reconciliation, phase-4-booking-form, phase-8-reconciliation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-only payments seam: import 'server-only' first line as a build-fail secret-key leak guard (mirrors admin.ts)"
    - "Code-created Stripe Checkout Session with metadata.transfer_id mirrored onto payment_intent_data.metadata (never a dashboard Payment Link)"
    - "Recorded fee = verbatim balance_transaction.fee in integer cents (D-05), distinct from the commission.ts display estimate"
    - "vitest.setup no-op mock of `server-only` so server-only modules unit-test under jsdom without weakening the production build guard"

key-files:
  created:
    - platform/payments/stripe.ts
    - platform/payments/checkout.ts
    - platform/payments/fee.ts
  modified:
    - vitest.setup.ts

key-decisions:
  - "apiVersion literal '2026-05-27.dahlia' type-checks directly against stripe@22.2.1 typings (apiVersion?: string; LatestApiVersion constant = '2026-05-27.dahlia') — no version-string downgrade or `as any` cast needed."
  - "createCheckoutSession signature follows the Plan-01 unit contract exactly: { transferId, amountCents } — amountCents (integer cents) is the unit_amount source passed straight to Stripe. No DB resolution inside the helper (the test mocks only @/platform/payments/stripe, not admin), so the DB read/persist that the plan prose described would have broken the contract; deferred to the caller (Phase 4 booking action) which already resolves the wp_transfers row."
  - "transferId validated with an explicit 8-4-4-4-12 hex UUID-shape regex instead of zod's `.uuid()`: the Plan-01 fixture id (11111111-...-111111111111) is well-formed hex but fails zod's RFC-4122 version/variant nibble check. The real authorization gate is row resolution at the caller boundary (D-03), so this is a shape gate, not the authz check."
  - "fee helper exported as recordedFeeCents(pi: unknown): number|null (synchronous, takes an expanded PaymentIntent object) per the fee.test.ts contract — NOT the async feeCentsFromPaymentIntent(id) the plan prose named. The Stripe retrieve+expand is the caller's (webhook, Plan 04) responsibility; this helper extracts/guards the fee."

patterns-established:
  - "server-only build-fail guard on every payments module touching the Stripe secret"
  - "metadata.transfer_id is the sole link between a Checkout Session and a transfer row (webhook resolution key)"

requirements-completed: [BOOK-05]

# Metrics
duration: 14min
completed: 2026-06-18
---

# Phase 3 Plan 03: Payments Seam (stripe.ts / checkout.ts / fee.ts) Summary

**Server-only Stripe seam: a `2026-05-27.dahlia`-pinned client factory, a code-created EUR/integer-cents Checkout Session carrying `metadata.transfer_id`, and a verbatim recorded-fee extractor — turning the Plan-01 checkout + fee contract tests GREEN.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-18T17:14:00Z
- **Completed:** 2026-06-18T17:27:52Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `platform/payments/stripe.ts` — `getStripe()` (+ `createStripeClient` alias) constructs Stripe with `apiVersion: "2026-05-27.dahlia"` from `STRIPE_SECRET_KEY`, `import "server-only"` as the first line (build-fail key-leak guard, T-03-ID2).
- `platform/payments/checkout.ts` — `createCheckoutSession({transferId, amountCents})`: `mode:"payment"`, EUR `price_data` with integer `unit_amount`, `metadata.transfer_id` mirrored onto `payment_intent_data.metadata`, success/cancel URLs from trusted `NEXT_PUBLIC_SITE_URL` (never request Origin, WR-04); returns `session.url`.
- `platform/payments/fee.ts` — `recordedFeeCents(pi)` returns the exact integer `latest_charge.balance_transaction.fee` (D-05 recorded truth), null-guarded against unexpanded/absent balance transactions (Pitfall 5).
- `checkout.test.ts` + `fee.test.ts` GREEN (4/4); `tsc --noEmit` clean; eslint clean; no new `status:'paid'` writer introduced (single-writer gate stays at its expected 0-writer RED baseline until the webhook lands in Plan 04).

## Task Commits

1. **Task 1: Server-only Stripe client factory (stripe.ts)** - `774f4a8` (feat)
2. **Task 2: Checkout-session helper + recorded-fee helper (checkout.ts, fee.ts)** - `b59bf01` (feat)

_TDD note: contract tests (checkout.test.ts, fee.test.ts) were authored RED in Plan 01; this plan supplied the implementations (GREEN). No separate RED commit was created here since the failing tests already existed in history._

## Files Created/Modified
- `platform/payments/stripe.ts` - Server-only Stripe client factory, pinned apiVersion.
- `platform/payments/checkout.ts` - Code-created EUR Checkout Session helper, returns session.url.
- `platform/payments/fee.ts` - Verbatim recorded-fee extractor from expanded balance_transaction.
- `vitest.setup.ts` - Added no-op `vi.mock("server-only", ...)` so server-only modules unit-test under jsdom.

## Decisions Made
See `key-decisions` in frontmatter. Headline: the implementation signatures follow the Plan-01 unit contracts (the test files are the source of truth) where they diverged from the plan prose — `createCheckoutSession({transferId, amountCents})` (no in-helper DB read) and `recordedFeeCents(pi)` (synchronous, takes the expanded PaymentIntent). The plan's named exports (`feeCentsFromPaymentIntent`, in-helper transfer-row resolution) were superseded by the asserted contracts; the deferred DB resolution/persistence + the expand-retrieve belong to the callers (Phase 4 booking action, Plan 04 webhook).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stub `server-only` under the jsdom test environment**
- **Found during:** Task 2 (running checkout.test.ts / fee.test.ts)
- **Issue:** The real `server-only` package throws on import under jsdom ("This module cannot be imported from a Client Component"). checkout.ts/fee.ts import `server-only` directly (the required build guard), so all 4 tests errored at import time. Existing tests sidestepped this only because they mocked their server-only dependencies; these helpers ARE the server-only modules under test.
- **Fix:** Added `vi.mock("server-only", () => ({}))` to `vitest.setup.ts` (a no-op). The production `next build` guard is unchanged — only the test runtime is neutralized.
- **Files modified:** vitest.setup.ts
- **Verification:** 4/4 tests GREEN; the build guard is still enforced by `next build` (not vitest).
- **Committed in:** `b59bf01`

**2. [Rule 1 - Bug] transferId UUID-shape regex instead of zod `.uuid()`**
- **Found during:** Task 2 (checkout.test.ts)
- **Issue:** The plan prescribed `z.string().uuid()`, but the Plan-01 fixture id `11111111-1111-1111-1111-111111111111` fails zod's RFC-4122 version/variant-nibble validation, so the contract test failed with "Invalid UUID".
- **Fix:** Replaced `.uuid()` with an explicit `^[0-9a-f]{8}-...-[0-9a-f]{12}$` shape regex. Authorization still comes from resolving the id to a real `wp_transfers` row at the caller boundary (D-03); this is a shape gate only.
- **Files modified:** platform/payments/checkout.ts
- **Verification:** checkout.test.ts GREEN; tsc clean.
- **Committed in:** `b59bf01`

---

**Total deviations:** 2 auto-fixed (1 blocking test-infra, 1 bug/contract-mismatch).
**Impact on plan:** Both fixes were required to satisfy the Plan-01 contracts (the source of truth). No scope creep; no security boundary weakened (server-only stub is test-runtime only; UUID shape is a gate, not the authz check).

## Issues Encountered
- `apiVersion` literal type concern (Research Q2) did not materialize: stripe@22.2.1 types `apiVersion?: string` and ship `LatestApiVersion = "2026-05-27.dahlia"`, so the pinned literal type-checks with no cast.

## Known Stubs
None. checkout.ts intentionally does NOT resolve/persist the wp_transfers row or set any status — DB persistence belongs to the Phase 4 booking caller and `paid` is webhook-only (Plan 04). This is the locked seam boundary, not a stub.

## Threat Flags
None — no new security surface beyond the threat_model already enumerated (server-only guard, uuid-shape input gate, trusted SITE_URL, integer-cents money handling all implemented). No DB application, no webhook route touched.

## User Setup Required
None for this plan. (Runtime use will require `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_SITE_URL` env vars when the booking form/webhook ship in Phase 4 / Plan 04.)

## Next Phase Readiness
- The payments seam is ready for Plan 04 (webhook): the webhook will `getStripe()`, resolve `metadata.transfer_id`, expand the PaymentIntent and pass it to `recordedFeeCents`, and be the single `status:'paid'` writer (turning single-writer.test.ts GREEN).
- Phase 4 booking action will call `createCheckoutSession` and 303-redirect to the returned `session.url`, after it resolves+validates the transfer row and amount.

## Self-Check: PASSED

- FOUND: platform/payments/stripe.ts
- FOUND: platform/payments/checkout.ts
- FOUND: platform/payments/fee.ts
- FOUND: .planning/phases/03-payments-trust-spine/03-03-SUMMARY.md
- FOUND commit: 774f4a8 (Task 1)
- FOUND commit: b59bf01 (Task 2)

---
*Phase: 03-payments-trust-spine*
*Completed: 2026-06-18*
