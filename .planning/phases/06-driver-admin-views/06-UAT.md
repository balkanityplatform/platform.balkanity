---
status: complete
phase: 06-driver-admin-views
source: [06-VERIFICATION.md]
started: 2026-06-19T16:00:00Z
updated: 2026-06-19T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Driver opens /driver and sees the masked pool, then claims a transfer
expected: Pool shows masked cards (no guest PII visible). Claiming wins lands driver on /driver/run/<id> showing full PII. Losing claim shows neutral grey toast and card disappears silently.
result: pass
evidence: |
  Driven in Chrome (chrome-devtools MCP), mobile viewport 390x844, driver
  rumen.milanov91@gmail.com. Pool rendered 4 masked cards — only flight no.,
  fare, pax, bags, zone→airport, time. ZERO guest PII (no name/email/phone) on
  any card (screenshot 01-driver-pool-masked.png). WIN: claimed BA0890 → landed
  /driver/run/a1111111-...-002 showing full PII "John Carter" + "+447700900123"
  + exact address (screenshot 02-claim-win-full-pii.png). LOSE: flipped a pool
  row to claimed in DB to simulate a concurrent winner, then clicked its stale
  Claim — card silently removed, no error state (screenshot 03-claim-lose-toast.png);
  PoolView.tsx:124-127 sets the neutral grey (bg-slate, role=status) claimLostToast
  on reason==='already_claimed' and drops the card (also observed mid-flight via
  the disabled button state).

### 2. Driver advances a claimed transfer through all stages to completed
expected: From /driver/run, each card shows a single CTA — 'Start driving' (en_route), 'Mark arrived' (arrived), 'Mark picked up' (picked_up), 'Mark completed' (completed). After tapping completed, the card moves from the active run list into the 'Completed today' collapsed section.
result: pass
evidence: |
  /driver/run showed Maria Petrova (a2222222-...-004) with a single CTA per
  stage. Advanced claimed→en_route ('Start driving') → arrived ('Mark arrived')
  → picked_up ('Mark picked up') → completed ('Mark completed'); the second
  claimed card (John Carter) stayed on 'Start driving' throughout (per-transfer
  independence). On 'Mark completed' the card left the active list and
  'Completed today' incremented (1)→(2); expanded section contained both the
  prior completed booking and Maria (screenshot 04-driver-run-completed.png).

### 3. Admin opens /admin/transfers and filters, searches, and identifies needs-attention rows
expected: Unclaimed 'paid' rows are pinned at the top with a visible text badge (not colour alone). Status filter chips narrow the list. Typing a guest name or flight number narrows correctly. The needs-attention quick filter shows only flagged rows.
result: pass
evidence: |
  Desktop viewport, admin balkanityplatform@gmail.com. Two paid+unclaimed rows
  (Refund Tester, Lukas Mueller) pinned at top each with a "NEEDS ATTENTION" text
  badge (screenshot 05-admin-list-needs-attention-pinned.png). Flight search
  ?q=FR3201 → exactly Maria Petrova; name search ?q=Carter → exactly John Carter.
  Status chip 'Claimed' → ?status=claimed → exactly the 3 claimed rows (chip
  pressed). 'Needs attention' quick filter → ?attention=1 → exactly the 2
  paid+unclaimed rows (screenshot 06-admin-needs-attention-filter.png); the
  intersection status=claimed&attention=1 correctly returned an empty state.

### 4. Admin assigns a transfer (one-tap), reassigns with a reason dialog, releases back to pool, and cancels with a reason
expected: Assign sets the driver immediately (no dialog) AND the transfer moves into the assigned driver's run (status becomes claimed — it must NOT remain in the pool or vanish). Reassign/release/cancel each open a confirm dialog requiring a non-empty reason note before proceeding. After release, the transfer reappears in the driver pool (/driver). Cancel does NOT auto-refund.
result: pass
evidence: |
  Exercised on Lukas Mueller (a1111111-...-003). ASSIGN (CR-01 fix): one-tap
  driver-id field, no confirm dialog; DB after = status 'claimed' + driver_id=rumen
  (NOT orphaned) — claimed+driver_id is exactly the run-query condition, so it
  enters the driver's run. REASSIGN (CR-03 fix): modal requiring Driver id +
  Reason (both required); DB after = status stayed claimed, last_action_reason=
  "UAT reassign test", last_action_by=admin. RELEASE: modal requiring reason; DB
  after = status claimed→paid + driver_id NULL → back in pool (paid+unclaimed).
  CANCEL: modal copy explicitly "The guest is not automatically refunded — use
  Refund separately", required reason, plus a decoupled "Also issue a refund?"
  button; DB after = status 'cancelled', reason recorded, NO Stripe call.

### 5. Admin issues a manual Stripe refund from the transfer detail page
expected: The fee-not-recovered disclosure is always visible before the refund form is submitted. The amount field is pre-filled to the full paid amount but editable down. Submitting triggers a real (or Stripe test-mode) refund. The submit button is disabled after first click until the action completes.
result: pass
evidence: |
  Refund Tester (a4444444-...-007) seeded with a real succeeded sk_test
  PaymentIntent (pi_3Tk2SYIVJCasWEpx1gxg81DF). Refund form showed the always-on
  disclosure "The ~€1.00 Stripe processing fee is NOT recovered by this refund.",
  amount pre-filled to full €50 and editable (screenshot
  07-admin-refund-form-disclosure.png). Edited down to €20 + reason → submit
  issued a REAL test-mode refund re_3Tk2SYIVJCasWEpx1FCJNe4T, amount 2000,
  status succeeded (screenshot 08-admin-refund-success.png). IDEMPOTENCY:
  re-submitted the same €20 → Stripe still shows exactly 1 refund, €20 total
  (not €40) — refund:{id}:{amount} idempotency key held. Submit disabled while
  pending confirmed in RefundForm.tsx:68 (disabled={pending} via useActionState).

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
