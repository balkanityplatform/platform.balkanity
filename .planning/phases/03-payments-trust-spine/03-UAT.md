---
status: testing
phase: 03-payments-trust-spine
source: [03-VERIFICATION.md]
started: 2026-06-18
updated: 2026-06-18
---

## Current Test

number: 1
name: Live Stripe-CLI replay → exactly one effect (SC3, GATE B)
expected: |
  After a real signed checkout.session.completed delivery for a seeded wp_transfers row,
  `stripe events resend <evt_…>` re-delivers the same event.id. Assert: exactly ONE
  webhook_events row for that event_id; wp_transfers.paid_at UNCHANGED on the second
  delivery; the transfer flipped to paid exactly once with fee_cents recorded.
awaiting: user response

## Tests

### 1. Live Stripe-CLI replay → exactly one effect (SC3, GATE B)
expected: |
  Prereqs: `brew install stripe/stripe-cli/stripe` + `stripe login` (TEST mode); add real
  STRIPE_SECRET_KEY=sk_test_… and STRIPE_WEBHOOK_SECRET=whsec_… (from `stripe listen`) to
  .env.local (server-only, never tracked / NEXT_PUBLIC_); dev server running; seed a
  wp_transfers row in `requested` state and use its id as metadata.transfer_id.
  Steps (full runbook: 03-REPLAY-RUNBOOK.md):
    1. stripe listen --forward-to localhost:3000/api/stripe/webhook
    2. Trigger a real signed checkout.session.completed for the seeded transfer; capture evt_…
    3. stripe events resend evt_…
  Assert: exactly ONE webhook_events row for that event_id; paid_at unchanged on the second
  delivery; transfer flipped to paid exactly once with fee_cents recorded from balance_transaction.
  On pass: append output to 03-GATES-EVIDENCE.md §GATE B, flip gate_b_replay: passed.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
