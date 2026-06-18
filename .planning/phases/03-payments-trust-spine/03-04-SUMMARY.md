---
phase: 03-payments-trust-spine
plan: 04
subsystem: payments
tags: [stripe, webhook, idempotency, money-authoritative, pwa-pages]
requires:
  - "03-02: wp_transfers + webhook_events schema (migration 0003)"
  - "03-03: platform/payments seam (stripe.ts, checkout.ts, fee.ts)"
provides:
  - "app/api/stripe/webhook/route.ts: the single signature-verified, insert-first-idempotent paid writer"
  - "app/pay/start/route.ts: non-prod test trigger that 303-redirects to a Checkout Session"
  - "app/pay/success/page.tsx + app/pay/cancel/page.tsx: display-only status pages (never write paid)"
affects:
  - "Plan 05: live forged/replay/spoof gates + migration apply run against these files"
  - "Phase 4: replaces app/pay/start with the real guest booking form"
tech-stack:
  added: []
  patterns:
    - "Raw-body (req.text()) + stripe.webhooks.constructEvent HMAC verification on the nodejs runtime"
    - "Insert-first webhook_events dedup keyed on UNIQUE event_id (ON CONFLICT semantics via .maybeSingle() -> null)"
    - "Service-role-only paid UPDATE with .neq('status','paid') idempotency backstop"
    - "Expanded PaymentIntent retrieve -> recordedFeeCents for the real fee at capture (D-05)"
key-files:
  created:
    - app/api/stripe/webhook/route.ts
    - app/pay/start/route.ts
    - app/pay/success/page.tsx
    - app/pay/cancel/page.tsx
  modified: []
decisions:
  - "Webhook builds JSON responses via new NextResponse(JSON.stringify(...)) instead of NextResponse.json(...) so the source contains zero '.json(' tokens (the route.contract.test.ts gate forbids any '.json(')."
  - "app/pay/start gated by NODE_ENV !== 'production' (404 in prod) rather than admin-only, so the Plan 05 live TEST-mode gates (no admin session) can drive it while it stays inert in production (T-03-START)."
  - "Webhook consumes the actual seam recordedFeeCents(expandedPI) — not the plan's named feeCentsFromPaymentIntent (which does not exist); it retrieves the expanded PaymentIntent then narrows the fee (Rule 3 reconciliation)."
  - "createCheckoutSession requires {transferId, amountCents}; start route reads amount_cents from wp_transfers via service-role before creating the Session (plan's {transfer_id}-only shape did not match the real signature)."
metrics:
  duration_min: 4
  completed: 2026-06-18
---

# Phase 3 Plan 04: The Money-Authoritative Path (Stripe Webhook + Pay Surfaces) Summary

The signature-verified Stripe webhook — the single, insert-first-idempotent `paid` writer — plus a non-prod checkout trigger and two display-only pay pages, all turning the Plan 01 source-level contracts GREEN.

## What Was Built

**Task 1 — `app/api/stripe/webhook/route.ts` (the trust spine).** The `nodejs`-runtime POST handler that:
- reads the RAW body via `await req.text()` (never `req.json()`), rejects a missing `stripe-signature` header or a forged/unsigned payload with 400 and zero state change;
- verifies the HMAC via `getStripe().webhooks.constructEvent(...)`;
- records every verified event insert-first in `webhook_events` (UNIQUE `event_id`); a replay collides on the index → `.maybeSingle()` returns null → returns `{duplicate:true}` with no `wp_transfers` touch (SC3);
- on `checkout.session.completed`, resolves `metadata.transfer_id`, retrieves the expanded PaymentIntent, narrows the actual fee via `recordedFeeCents`, and performs the ONLY `status:"paid"` UPDATE in the repo via the service-role client, with `.neq("status","paid")` as the idempotency backstop, recording `paid_at`, `stripe_payment_intent_id`, and `fee_cents`;
- logs `outcome='no_matching_transfer'` and returns 200 (not 500) for an absent/unmatched transfer (Pitfall 6); `outcome='processed'` on success.

**Task 2 — checkout trigger + display-only pages.**
- `app/pay/start/route.ts`: minimal GET/POST test trigger, gated by `NODE_ENV !== 'production'` (404 in prod), reads `amount_cents` via service-role, calls `createCheckoutSession`, and 303-redirects to `session.url` (no `@stripe/stripe-js`).
- `app/pay/success/page.tsx`: display-only server component; reads `wp_transfers.status` and renders the literal "Paid EUR X on {paid_at}" line ONLY inside the `status === 'paid'` branch, so a spoofed direct hit on an unpaid transfer never renders the word "paid" (SC2 success-spoof).
- `app/pay/cancel/page.tsx`: display-only "payment cancelled" page; reads status, writes nothing.

## How It Works

The webhook is the sole money-authoritative path. Authentication is by HMAC signature (the sender), not a user session — so all DB access uses `createAdminClient()` (service-role, RLS-bypass), matching the migration-0003 posture (admin-read SELECT only, no write policy). Idempotency is enforced at two layers: the DB-level UNIQUE `webhook_events.event_id` (insert-first dedup) and the `.neq("status","paid")` backstop on the transfer UPDATE. The success/cancel pages are read-only mirrors of transfer state — the spoofable `success_url` redirect can never confirm payment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `feeCentsFromPaymentIntent` does not exist; consumed the real seam `recordedFeeCents`**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` references `feeCentsFromPaymentIntent(payment_intent)` taking a PaymentIntent id. The actual export in `platform/payments/fee.ts` (Plan 03-03) is `recordedFeeCents(pi)`, which takes an already-expanded PaymentIntent object and reads `latest_charge.balance_transaction.fee` verbatim.
- **Fix:** The webhook retrieves the expanded PaymentIntent (`paymentIntents.retrieve(id, { expand: ["latest_charge.balance_transaction"] })`) and passes it to `recordedFeeCents`. Retrieval is wrapped in try/catch → null fee on failure (Phase 8 backfills), preserving the recorded-truth contract (D-05).
- **Files modified:** app/api/stripe/webhook/route.ts
- **Commit:** 414b9e7

**2. [Rule 3 - Blocking] `NextResponse.json(...)` trips the `.json(` contract gate**
- **Found during:** Task 1
- **Issue:** `route.contract.test.ts` strips comments then asserts the source `not.toMatch(/\.json\(/)`. `NextResponse.json(...)` contains the `.json(` token and failed the gate even though the request body is read with `req.text()`.
- **Fix:** Added a local `jsonResponse(payload, status)` helper that builds responses via `new NextResponse(JSON.stringify(...), {...})`; the source now contains zero `.json(` occurrences.
- **Files modified:** app/api/stripe/webhook/route.ts
- **Commit:** 414b9e7

**3. [Rule 3 - Blocking] `createCheckoutSession` signature requires `amountCents`**
- **Found during:** Task 2
- **Issue:** The plan's start-route action says `createCheckoutSession({ transfer_id })`. The real helper (Plan 03-03) requires `{ transferId, amountCents }` and returns `string | null`.
- **Fix:** The start route reads `amount_cents` from `wp_transfers` via the service-role client first, then calls `createCheckoutSession({ transferId, amountCents })` and 303-redirects to the returned URL.
- **Files modified:** app/pay/start/route.ts
- **Commit:** c6e8393

### Gating choice (T-03-START, documented per acceptance criterion)
`app/pay/start` uses the **non-prod-only** gate (`NODE_ENV !== 'production'` → 404 in production), not admin-only. Rationale: the Plan 05 live forged/replay/spoof gates run in Stripe TEST mode without an admin session; a non-prod guard keeps the trigger usable there while making it provably inert in production. It is never a public/guest charge surface in production. Phase 4 replaces it with the booking form whose own validation gates the charge.

## Verification Results

- `npx vitest run app/api/stripe/webhook/route.contract.test.ts platform/payments/single-writer.test.ts` — GREEN (were RED at baseline).
- Full unit suite `npx vitest run` — 17 files, 82 tests, all GREEN.
- `npx tsc --noEmit` — exit 0.
- `npm run lint` — 0 errors (1 pre-existing warning in `platform/payments/checkout.test.ts`, out of scope — see Deferred).
- Whole-repo grep `status:"paid"` across `app/ platform/ modules/` (excluding tests) — exactly ONE writer: `app/api/stripe/webhook/route.ts`.
- `grep` for any `paid` write under `app/pay/` — none.

The two adversarial e2e specs (success-spoof, forged) and the CLI replay gate remain manual/RED here by design — they run live in Plan 05 after the migration is applied to the Balkanity ref.

## Deferred Issues

- Pre-existing eslint warning: `platform/payments/checkout.test.ts:18` `'_params' is defined but never used` — created in Plan 03-03, not touched by this plan. Out of scope (logged, not fixed).

## Known Stubs

`app/pay/start/route.ts` is an intentional, documented test-only trigger (non-prod-gated). Phase 4 replaces it with the real guest booking form. This is not a data stub — it exercises the live `createCheckoutSession` seam.

## For the Next Plan

Plan 05 must: apply migration `0003_payments_spine.sql` to the Balkanity ref `qyhdogajtmnvxphrslwm` (signed-off, via Supabase CLI/Management token — NOT MCP), seed a `requested` `wp_transfers` row, then run the forged/replay/spoof live gates (03-REPLAY-RUNBOOK.md) against this webhook + the `/pay/start` trigger.

## Self-Check: PASSED

All 4 created files + SUMMARY.md verified on disk; both commits (414b9e7, c6e8393) present in git history.
