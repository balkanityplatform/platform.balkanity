# Phase 3: Payments Trust Spine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 3-payments-trust-spine
**Areas discussed:** Settlement currency, Test vs live Stripe, What 'paid' flips, Recorded fee precision

---

## Settlement Currency

| Option | Description | Selected |
|--------|-------------|----------|
| EUR | Charge + settle in EUR. Matches D-07 display currency, EEA fee €0.25 + 1.5%, BG euro adoption. | ✓ |
| BGN | Charge/settle in лев (fee лв0.50); adds a currency layer vs EUR display. | |

**User's choice:** EUR
**Notes:** Resolves the ROADMAP "settlement currency must be decided before this phase" flag. → D-01.

---

## Test vs Live Stripe

| Option | Description | Selected |
|--------|-------------|----------|
| Test mode now | Build + run all adversarial gates with test keys + Stripe CLI; defer live cutover to pilot. No real money this phase. | ✓ |
| Live keys now | Wire live keys immediately; real charges possible during testing. | |

**User's choice:** Test mode now
**Notes:** Matches "adversarially proven before real money." → D-02.

---

## What 'paid' Flips

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal wp_transfers now | Phase 3 creates a minimal wp_transfers (id/status/amount/currency/stripe ids/fee/paid_at); Phase 4 ALTERs for PII+lifecycle. Single-writer + idempotency proven against a real row. | ✓ |
| Throwaway fixture | Defer wp_transfers to Phase 4; prove against a temporary seeded row. | |

**User's choice:** Minimal wp_transfers now
**Notes:** Phase 4 extends (not creates) the table; FLAGGED schema (migration 0003), sign-off applies. → D-03, D-04.

---

## Recorded Fee Precision

| Option | Description | Selected |
|--------|-------------|----------|
| Actual from balance txn | Fetch real fee via payment_intent → charge → balance_transaction; accurate for ledger + refund tracking. | ✓ |
| Fixed estimate | Record €0.25 + 1.5% estimate as roadmap states; simpler, reuses Phase 2 math. | |

**User's choice:** Actual from balance transaction
**Notes:** commission.ts estimate stays as the pre-payment display; actual fee is the recorded truth post-payment. → D-05.

---

## Claude's Discretion

- Next 16 raw-body handling mechanics (must pass forged-POST test before done)
- Exact dedup transaction shape (insert-first vs advisory lock)
- webhook_events column set beyond the mandated idempotency/signature/outcome
- Checkout success/cancel pages this phase (minimal/test — no booking UI yet)
- How forged/replay adversarial tests are seeded

## Deferred Ideas

None — discussion stayed within phase scope.
