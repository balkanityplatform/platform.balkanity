---
status: testing
phase: 06-driver-admin-views
source: [06-VERIFICATION.md]
started: 2026-06-19T16:00:00Z
updated: 2026-06-19T16:00:00Z
---

## Current Test

number: 1
name: Driver opens /driver and sees the masked pool, then claims a transfer
expected: |
  Pool shows masked cards (no guest PII visible). A winning claim lands the driver on
  /driver/run/<id> showing full PII. A losing claim shows a neutral grey toast and the
  card disappears silently.
awaiting: user response

## Tests

### 1. Driver opens /driver and sees the masked pool, then claims a transfer
expected: Pool shows masked cards (no guest PII visible). Claiming wins lands driver on /driver/run/<id> showing full PII. Losing claim shows neutral grey toast and card disappears silently.
result: [pending]

### 2. Driver advances a claimed transfer through all stages to completed
expected: From /driver/run, each card shows a single CTA — 'Start driving' (en_route), 'Mark arrived' (arrived), 'Mark picked up' (picked_up), 'Mark completed' (completed). After tapping completed, the card moves from the active run list into the 'Completed today' collapsed section.
result: [pending]

### 3. Admin opens /admin/transfers and filters, searches, and identifies needs-attention rows
expected: Unclaimed 'paid' rows are pinned at the top with a visible text badge (not colour alone). Status filter chips narrow the list. Typing a guest name or flight number narrows correctly. The needs-attention quick filter shows only flagged rows.
result: [pending]

### 4. Admin assigns a transfer (one-tap), reassigns with a reason dialog, releases back to pool, and cancels with a reason
expected: Assign sets the driver immediately (no dialog) AND the transfer moves into the assigned driver's run (status becomes claimed — it must NOT remain in the pool or vanish). Reassign/release/cancel each open a confirm dialog requiring a non-empty reason note before proceeding. After release, the transfer reappears in the driver pool (/driver). Cancel does NOT auto-refund.
result: [pending]

### 5. Admin issues a manual Stripe refund from the transfer detail page
expected: The fee-not-recovered disclosure is always visible before the refund form is submitted. The amount field is pre-filled to the full paid amount but editable down. Submitting triggers a real (or Stripe test-mode) refund. The submit button is disabled after first click until the action completes.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
