---
status: passed
phase: 03-payments-trust-spine
source: [03-VERIFICATION.md]
started: 2026-06-18
updated: 2026-06-18
---

## Current Test

(none — all tests passed)

## Tests

### 1. Live Stripe-CLI replay → exactly one effect (SC3, GATE B)
expected: |
  stripe events resend <evt_…> re-delivers the same event.id; exactly ONE webhook_events
  row for that event_id; wp_transfers.paid_at unchanged on the second delivery; transfer
  flipped to paid exactly once with fee recorded (or null-then-backfilled per Pitfall 5).
result: passed
evidence: |
  2026-06-18, live against Balkanity (qyhdogajtmnvxphrslwm) in Stripe TEST mode,
  Stripe CLI v1.42.13, API version 2026-05-27.dahlia.
  First delivery: checkout.session.completed [evt_1TjkgDIVJCasWEpxBXrU3J3y] → 200;
    transfer ae851182-… → status=paid, paid_at=2026-06-18 18:28:46.43+00, PI=pi_3TjkgC…;
    webhook_events rows=1, outcome=processed. (fee_cents=null — balance txn not yet
    available at capture, Phase 8 backfills.)
  Replay (stripe events resend evt_1TjkgD…): → 200; webhook_events rows STILL 1;
    paid_at UNCHANGED; status still paid. Exactly one effect.
  Test data + audit rows cleaned from the live DB after the run.
  Full evidence: 03-GATES-EVIDENCE.md §GATE B.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none)
