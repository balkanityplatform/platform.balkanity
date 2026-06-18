---
status: testing
phase: 04-transfer-entity-booking-form
source: [04-VERIFICATION.md]
started: 2026-06-18T20:39:02Z
updated: 2026-06-18T20:39:02Z
---

## Current Test

number: 1
name: Live booking→pay→confirm→track smoke (Stripe CLI)
expected: |
  With `npm run dev` + `stripe listen --forward-to localhost:3000/api/stripe/webhook` running:
  opening /pickup/<active-slug> renders the fare + form; submitting creates a
  status='requested' wp_transfers row and 303-redirects to a Stripe Checkout URL;
  completing the TEST payment makes the verified webhook flip the row to 'paid' (the
  live trigger allows requested→paid) and logs the [BOOK-06 stub] confirmation magic
  link; clicking that magic link lands /auth/confirm on /status/<id> (same browser,
  PKCE) and the status page renders the lifecycle timeline with 'paid' highlighted +
  the "Paid €X on {date}" receipt — for the guest's own row only. No open-redirect,
  no getSession on the status path, no stale-SW serve.
awaiting: user response

## Tests

### 1. Live booking→pay→confirm→track smoke (Stripe CLI)
expected: |
  /pickup/<active-slug> renders fare+form → submit creates requested row + Checkout
  redirect → TEST pay → webhook flips paid + logs the confirmation magic link →
  magic link lands /status/<id> → timeline + paid receipt render for the owning guest
  only. (Runbook steps recorded in tests/runbooks/0004-lifecycle-trigger.md, Task 3.)
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
