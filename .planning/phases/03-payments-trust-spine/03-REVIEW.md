---
phase: 03-payments-trust-spine
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - app/api/stripe/webhook/route.ts
  - app/pay/start/route.ts
  - app/pay/success/page.tsx
  - app/pay/cancel/page.tsx
  - platform/payments/stripe.ts
  - platform/payments/checkout.ts
  - platform/payments/fee.ts
  - supabase/migrations/0003_payments_spine.sql
  - app/api/stripe/webhook/route.contract.test.ts
  - platform/payments/checkout.test.ts
  - platform/payments/fee.test.ts
  - platform/payments/single-writer.test.ts
  - platform/rls/payments-schema.test.ts
  - tests/e2e/webhook-forged.spec.ts
  - tests/e2e/success-spoof.spec.ts
findings:
  critical: 0   # 2 found, both RESOLVED in 7b956d4 (see Resolution Log)
  critical_found: 2
  critical_resolved: 2
  warning: 6
  info: 4
  total: 12
status: criticals_resolved
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 15
**Status:** criticals_resolved (2 Critical fixed in `7b956d4`; 6 Warning + 4 Info remain advisory)

## Resolution Log

- **CR-01 (swallowed DB errors → HTTP 200 / silent money loss): RESOLVED** in `7b956d4`.
  The webhook now captures every Supabase `error` channel. A transient failure on the
  audit insert or the `paid` UPDATE returns HTTP 500 so Stripe retries; a failed paid
  write records `outcome=write_failed` (distinct from `no_matching_transfer`) so
  reconciliation can tell them apart.
- **CR-02 (idempotency relied on falsy data, not the 23505 UNIQUE violation): RESOLVED**
  in `7b956d4`. The replay short-circuit now branches explicitly on Postgres `23505`.
  New behavioral test `app/api/stripe/webhook/route.idempotency.test.ts` proves a
  replayed `event_id` returns `200 {duplicate:true}` with ZERO `wp_transfers` writes
  (SC3), and that transient insert/paid errors return 500. Full suite 86/86 green.
- **Warnings (WR-01..06) + Info (IN-01..04): OPEN (advisory).** Notable: `stripe_checkout_session_id`
  never persisted; `recordedFeeCents` lacks an integer guard; `pay/start` gates on
  `NODE_ENV`; `NEXT_PUBLIC_SITE_URL` empty-fallback. Tracked for a follow-up pass.

## Summary

This is the payments trust spine — reviewed against the six CLAUDE.md money invariants. The architecture is sound: the six invariants are structurally honored (nodejs runtime, `req.text()` + `constructEvent`, insert-first idempotency on a UNIQUE index, service-role-only writes, display-only success/cancel pages, RLS-enabled tables with no write policy). The single-writer grep gate, server-only import guards, and integer-cents money path are all correctly implemented.

However, the review found two Critical defects that undermine the trust guarantees the invariants are supposed to provide, plus several correctness/robustness warnings. The most serious is that the insert-first idempotency mechanism conflates a transient DB error with a successful replay-dedup, and the awaited DB writes have their `error` channels uniformly discarded — meaning a failed `paid` write or a failed audit write returns HTTP 200 to Stripe, which then stops retrying. This is a silent money-loss path that directly contradicts the reconciliation guarantee in the project DoD.

Note several "tests" here are source-level grep gates and `test.fixme`-gated e2e stubs; the actual concurrency / double-claim / state-change guarantees are NOT exercised by automated tests yet (deferred to Plan 05 live seeding). The "0 double-claims under concurrency" DoD is not yet test-covered.

## Critical Issues

### CR-01: Swallowed DB errors return HTTP 200 to Stripe — silent loss of the `paid` write and audit trail

**File:** `app/api/stripe/webhook/route.ts:76-86, 136-146, 109-112, 151-154, 158-161`
**Issue:** Every Supabase call in the webhook destructures only `{ data }` and discards `error`. Consider the money-bearing `wp_transfers` UPDATE (lines 136-146): if that write fails for any transient reason (connection drop, statement timeout, Supabase pause/cold-start — explicitly a documented risk per CLAUDE.md's 7-day pause note), `paidRows` is `undefined`, the code enters the `!paidRows` branch (line 148), marks the event `no_matching_transfer`, and returns HTTP 200 (line 155). Stripe treats 200 as success and **will not retry**. The transfer is permanently left unpaid even though the customer was charged, and the event is mis-labeled as "no matching transfer" rather than "failed."

This is the exact failure the reconciliation sweep is meant to catch, but the audit row's `outcome` is actively falsified to `no_matching_transfer`, so reconciliation cannot distinguish a genuine missing transfer from a write that errored. This violates the DoD invariant "100% of `paid` from verified webhooks" in the other direction: a verified webhook that *should* produce a `paid` silently does not, with no error signal.

The insert-first audit write (lines 76-86) has the same defect inverted: a transient error there yields `inserted === null`, which is treated as a *duplicate replay* (line 88-90) and returns `{ received: true, duplicate: true }` with HTTP 200 — so a brand-new event whose audit insert failed is silently dropped and never processed, and Stripe never retries it.

**Fix:** Capture and branch on `error`. Distinguish the UNIQUE-violation replay case (Postgres 23505) from genuine failures, and return 5xx on genuine failures so Stripe retries:
```ts
const { data: inserted, error: insertErr } = await admin
  .from("webhook_events")
  .insert({ /* ... */ })
  .select("event_id")
  .maybeSingle();

if (insertErr) {
  // 23505 = duplicate event_id → genuine replay, short-circuit 200.
  if (insertErr.code === "23505") {
    return jsonResponse({ received: true, duplicate: true });
  }
  // Any other error is transient — return 5xx so Stripe RETRIES.
  return jsonResponse({ error: "audit insert failed" }, 500);
}
```
```ts
const { data: paidRows, error: paidErr } = await admin
  .from("wp_transfers")
  .update({ /* ... */ })
  .eq("id", transferId)
  .neq("status", "paid")
  .select("id");

if (paidErr) {
  // Mark the audit row as failed (NOT no_matching_transfer) and 5xx for retry.
  await admin.from("webhook_events")
    .update({ outcome: "write_failed" }).eq("event_id", event.id);
  return jsonResponse({ error: "paid write failed" }, 500);
}
if (!paidRows || paidRows.length === 0) {
  // genuinely absent or already-paid → audit + 200
  ...
}
```

### CR-02: Idempotency dedup relies on insert returning `null` data, but a UNIQUE violation may surface as an unhandled error/throw rather than `inserted === null`

**File:** `app/api/stripe/webhook/route.ts:76-91`
**Issue:** The replay-protection invariant (#4) depends on the claim in the comment (lines 72-75) that a duplicate `event_id` "violates [the UNIQUE index] (Postgres 23505), so `.maybeSingle()` resolves to null and we short-circuit." This is not how `supabase-js` behaves. On a UNIQUE constraint violation, PostgREST returns HTTP 409 and `supabase-js` returns `{ data: null, error: { code: "23505", ... } }` — the `error` is populated; `data` being null is incidental. Because the code never inspects `error` (see CR-01), the current behavior *happens* to short-circuit correctly for the replay case — but only by coincidence, and it cannot tell a real 23505 replay apart from any other error that also yields null data. The load-bearing replay authority is therefore not actually asserting on the UNIQUE violation; it is asserting on "data was falsy," which is the same condition produced by a transient failure (CR-01). The two invariants (idempotency vs. error-handling) are entangled such that fixing one without the other re-breaks the system.

There is no automated test that proves a real duplicate `event_id` insert produces the short-circuit — `single-writer.test.ts` and the contract test are source-grep only, and the e2e replay assertion is a `TODO(Plan 05)` (webhook-forged.spec.ts:54-58). So this central guarantee (SC3) is unverified.

**Fix:** Branch explicitly on `error.code === "23505"` for the dedup decision (see CR-01 snippet). Then add a live-DB test (or at minimum a mocked-client unit test) that asserts a second insert of the same `event_id` returns the duplicate short-circuit and does NOT touch `wp_transfers`. Do not ship the "0 double-claims / replay-safe" DoD claim on an unverified coincidental code path.

## Warnings

### WR-01: `stripe_checkout_session_id` is never populated on the transfer row

**File:** `app/api/stripe/webhook/route.ts:136-146`; `supabase/migrations/0003_payments_spine.sql:46`
**Issue:** The schema defines `stripe_checkout_session_id` and the `pay/start` flow creates a session whose `id` is available, but neither the checkout helper persists it nor does the webhook write it on the `paid` transition (only `stripe_payment_intent_id` is set). The `checkout.session.completed` event carries `session.id` (`event.data.object.id`). Leaving this column always-null weakens reconciliation (you can't join a transfer back to its Checkout Session) and the column is dead.
**Fix:** Read `(event.data.object as {...}).id` and include `stripe_checkout_session_id: sessionId` in the UPDATE payload (or persist it at session-create time in the `pay/start` flow).

### WR-02: `recordedFeeCents` accepts a negative/refund fee and does not validate it is a non-negative integer

**File:** `platform/payments/fee.ts:26-55`
**Issue:** `isExpandedBalanceTransaction` only checks `typeof fee === "number"`, then returns it verbatim. A `balance_transaction.fee` can legitimately be negative or zero in some flows, and `NaN`/`Infinity` are also `typeof "number"`. The column `wp_transfers.fee_cents` is a plain `integer` with no CHECK, so a `NaN` would fail the DB write (caught by CR-01's swallow → 200), and a fractional value (Stripe sends integer minor units, but the fixture-driven contract does not enforce it) would be silently truncated by Postgres. The "verbatim, no transform" intent is fine, but the absence of an `Number.isInteger` / `Number.isFinite` guard means a malformed expansion poisons the money record.
**Fix:** Tighten the guard: `typeof v.fee === "number" && Number.isInteger(v.fee)`. Decide explicitly whether negative fees are valid for capture (they are not, for a charge) and clamp/null otherwise.

### WR-03: Production gate uses `NODE_ENV` instead of `VERCEL_ENV` — preview deployments are live, unauthenticated charge surfaces

**File:** `app/pay/start/route.ts:26`
**Issue:** The test-only checkout trigger is gated by `process.env.NODE_ENV === "production"`. On Vercel, **preview** deployments (and any non-production deployment) run with `NODE_ENV === "production"` only for the production build... actually the inverse risk: Vercel sets `NODE_ENV=production` for *all* deployed builds (production AND preview). So this gate correctly disables the route on preview too — good. The real gap is the opposite: there is no positive assertion that it is *enabled only in local dev*. If a build ever runs with `NODE_ENV` unset or `"development"` on a publicly reachable host (e.g. a misconfigured preview, a `next start` on a server), this becomes a public, unauthenticated endpoint that creates real Stripe Checkout Sessions against any seeded transfer id — a charge-initiation surface with no auth. The comment claims "NON-PROD-ONLY... usable [in TEST] while making it inert in prod," but the gate keys on `NODE_ENV`, not on Stripe test-mode or `VERCEL_ENV`.
**Fix:** Gate on `VERCEL_ENV !== undefined` (i.e. refuse to run on any Vercel deployment, prod or preview) OR require an explicit allowlist env flag the live test harness sets, so the route is fail-closed everywhere except where deliberately enabled. Do not rely on `NODE_ENV` semantics, which differ across `next dev`/`next start`/Vercel.

### WR-04: `createCheckoutSession` falls back to an empty base URL, producing relative/invalid success & cancel URLs

**File:** `platform/payments/checkout.ts:46, 64-65`
**Issue:** `const base = process.env.NEXT_PUBLIC_SITE_URL ?? ""` means that if the env var is unset, `success_url`/`cancel_url` become `/pay/success?t=...` — a relative URL. Stripe requires absolute `success_url`/`cancel_url`; `sessions.create` will throw (caught nowhere in the helper, surfaces as 502 in `pay/start`). The comment frames this as "never throws in non-prod/test," but it shifts the throw to Stripe instead. More importantly, in a real misconfiguration this silently breaks the post-payment redirect for a customer who *was charged*.
**Fix:** Fail fast at session creation if `NEXT_PUBLIC_SITE_URL` is unset (`throw new Error("NEXT_PUBLIC_SITE_URL required")`) rather than constructing an invalid URL, so the misconfiguration is caught before any charge is initiated.

### WR-05: New Stripe client constructed per call with no error context; `paymentIntents.retrieve` failure is silently swallowed to `null` fee even on transient errors

**File:** `app/api/stripe/webhook/route.ts:121-131`; `platform/payments/stripe.ts:21-25`
**Issue:** The fee retrieval wraps `paymentIntents.retrieve` in a bare `try { ... } catch { feeCents = null }`. This conflates "fee not yet available (expected, Phase 8 backfills)" with "Stripe API call failed transiently." Both produce a null fee and proceed to mark the transfer `paid`. That is acceptable for the paid transition (fee is non-blocking), but the swallowed error is invisible — there is no log, no `outcome` annotation distinguishing "paid, fee pending" from "paid, fee fetch errored." Reconciliation cannot tell which nulls are backfillable vs. which masked a real Stripe error.
**Fix:** Keep the non-blocking behavior, but record the distinction — e.g. set `outcome: "processed_fee_pending"` or log the caught error with the event id, so the backfill job and reconciliation have signal.

### WR-06: `webhook_events.outcome` value `duplicate_skipped` is documented but never written; replay branch returns without recording it

**File:** `app/api/stripe/webhook/route.ts:88-91`; `supabase/migrations/0003_payments_spine.sql:63`
**Issue:** The schema comment and migration enumerate `outcome` transitions including `duplicate_skipped`, and the replay branch returns `{ duplicate: true }` — but because the row already exists from the prior delivery (that's why the insert returned null), the duplicate branch correctly does not create a new row. However, the *original* row's outcome is whatever it was left at (likely `processed`), so there is no record that a replay was attempted/blocked. This is a minor audit gap rather than a correctness bug, but the documented `duplicate_skipped` state is effectively dead/unreachable, which is misleading for the reconciliation consumer.
**Fix:** Either drop `duplicate_skipped` from the documented enum, or on the replay path increment a counter / append to an audit field on the existing row so replays are observable.

## Info

### IN-01: Audit `outcome` is mislabeled `no_matching_transfer` for the already-paid case

**File:** `app/api/stripe/webhook/route.ts:148-156`
**Issue:** When `.neq("status","paid")` matches zero rows because the transfer was *already paid* (a legitimate double-delivery that the insert-first dedup somehow missed), the outcome is recorded as `no_matching_transfer` — but the transfer exists and is paid. The label is inaccurate.
**Fix:** Distinguish "row absent" from "row already paid" (do a follow-up select, or use a distinct outcome like `already_paid`).

### IN-02: `createStripeClient` alias exists only to satisfy a test mock surface

**File:** `platform/payments/stripe.ts:27-29`
**Issue:** `export const createStripeClient = getStripe` is justified in a comment as keeping the unit-test mock surface in sync. Production code only imports `getStripe`. Exporting an unused-in-prod alias purely for tests is a minor coupling smell.
**Fix:** Have the test mock `getStripe` only, and drop the alias; or document it as test-support API explicitly.

### IN-03: `fmtEur` renders raw `paid_at` ISO timestamp to the guest

**File:** `app/pay/success/page.tsx:60-61`
**Issue:** The success page interpolates `paid_at` (a raw ISO `timestamptz` string) directly into guest-facing copy: `Paid EUR 45.00 on 2026-06-18T...Z`. Not a security issue, but a UX/quality defect for a customer receipt.
**Fix:** Format the date for display (locale date), or omit it.

### IN-04: Money-path guarantees (replay dedup, zero-state-change-on-forge, no-double-claim) are not covered by executing tests

**File:** `tests/e2e/webhook-forged.spec.ts:54-58`; `tests/e2e/success-spoof.spec.ts:39-41`; `platform/rls/payments-schema.test.ts` (whole); `platform/payments/single-writer.test.ts` (whole)
**Issue:** The RLS test and single-writer test are source-grep contracts (they assert on migration/source *text*, not DB behavior). The e2e state-change assertions are `TODO(Plan 05)` comments, not assertions. So the actual DB-level guarantees — UNIQUE replay rejection, RLS deny-by-default writes, "transfer stays requested after a forged POST / direct success hit" — have zero executing coverage. This is by design (deferred to Plan 05 live seeding) but means CR-02's central claim is unverified and the DoD's "0 double-claims under concurrency" is untested.
**Fix:** Land the Plan 05 live-DB assertions before claiming the trust-spine DoD is met; do not treat the green source-grep gates as evidence of runtime correctness.

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
