---
phase: 03-payments-trust-spine
verified: 2026-06-18T21:10:00Z
status: passed
score: 5/5
overrides_applied: 0
human_verification: []
sc3_live_verified: "2026-06-18 — stripe events resend evt_1TjkgDIVJCasWEpxBXrU3J3y: exactly one webhook_events row, paid_at unchanged, transfer paid once (see 03-GATES-EVIDENCE.md §GATE B)"
---

# Phase 3: Payments Trust Spine — Verification Report

**Phase Goal:** The money path is built and adversarially proven before any claim/booking-UI code: a code-created Stripe Checkout Session, and a signature-verified, raw-body, event.id-idempotent webhook that is the ONLY writer of `paid`, backed by a `webhook_events` log.
**Verified:** 2026-06-18T21:10:00Z (SC3 live replay confirmed 2026-06-18T21:29Z)
**Status:** passed (5/5)
**Re-verification:** SC3 closed via live Stripe-CLI `stripe events resend` — see 03-GATES-EVIDENCE.md §GATE B

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `paid` is set in exactly one code path — signature-verified checkout.session.completed handler, nodejs runtime, raw req.text(), service-role client; grep confirms no other writer | VERIFIED | `grep -RnE "status.*paid"` on app/platform/modules (excl. tests): exactly one hit at `app/api/stripe/webhook/route.ts:151`. `export const runtime = "nodejs"` at line 31; `await req.text()` at line 47; `createAdminClient()` at line 70. `npm run test` 86/86; `npm run typecheck` exit 0. `platform/payments/single-writer.test.ts` passes and names the one file. |
| 2 | ADVERSARIAL GATE: forged/unsigned POST → 400 + zero state change; spoofed success-URL never writes paid | VERIFIED | `tests/e2e/webhook-forged.spec.ts` 2/2 pass (live Playwright run recorded in 03-GATES-EVIDENCE.md). `tests/e2e/success-spoof.spec.ts` 1/1 pass. Live DB confirmed 0 webhook_events rows for evt_forged, 0 wp_transfers rows with status='paid'. `app/pay/success/page.tsx` contains no `.update()` or `.insert()` call — display-only SELECT only. |
| 3 | ADVERSARIAL GATE: replaying the same Stripe event.id twice → exactly one effect (UNIQUE webhook_events.event_id + insert-first dedup) | VERIFIED | LIVE (2026-06-18): `stripe events resend evt_1TjkgDIVJCasWEpxBXrU3J3y` against Balkanity in TEST mode → webhook_events rows for that event_id STILL 1, `wp_transfers.paid_at` UNCHANGED (18:28:46.43+00), transfer paid exactly once. First delivery had marked it paid (outcome=processed). Also unit-proven: `route.idempotency.test.ts` 4/4 (23505 short-circuit, zero wp_transfers writes on replay). Evidence: 03-GATES-EVIDENCE.md §GATE B. |
| 4 | Every Stripe event recorded in webhook_events with idempotency key, signature result, processing outcome | VERIFIED | Migration 0003 defines: `event_id text not null`, `type text not null`, `signature_result text not null`, `outcome text not null default 'received'`. Route writes all four on every verified event (route.ts:79-86). `platform/rls/payments-schema.test.ts` (all 7 pass) asserts these columns exist in the migration source. Live schema query confirmed all columns present post-apply (03-GATES-EVIDENCE.md). |
| 5 | Code-created Checkout Session (not dashboard Payment Link) carries metadata.transfer_id; per-transaction processing fee recorded | VERIFIED | `platform/payments/checkout.ts` calls `getStripe().checkout.sessions.create({mode:"payment", metadata:{transfer_id:transferId}, ...})`. `platform/payments/checkout.test.ts` asserts mode, EUR, integer unit_amount, metadata.transfer_id. `platform/payments/fee.ts` returns `balanceTransaction.fee` verbatim. `platform/payments/fee.test.ts` 3/3 pass. Webhook writes `fee_cents: feeCents` at route.ts:154. |

**Score:** 4/5 truths verified (SC3 UNCERTAIN — unit/DB proven, live end-to-end replay deferred)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/stripe/webhook/route.ts` | Single paid writer, nodejs, req.text(), constructEvent, insert-first | VERIFIED | 189 lines. All six hard invariants documented and coded. `export const runtime = "nodejs"` (line 31), `await req.text()` (line 47), explicit 23505 branch (lines 89-97), service-role client only (line 70), `.neq("status","paid")` backstop (line 157). |
| `platform/payments/checkout.ts` | Code-created Checkout Session with metadata.transfer_id | VERIFIED | Calls `checkout.sessions.create` with mode=payment, currency=eur, integer unit_amount, metadata.transfer_id, server 303-redirect pattern. |
| `platform/payments/fee.ts` | Verbatim fee from balance_transaction.fee | VERIFIED | Returns `balanceTransaction.fee` unmodified. Null guard on absent/unexpanded balance_transaction. |
| `platform/payments/stripe.ts` | Server-only Stripe client factory | VERIFIED | `import "server-only"`, `getStripe()` singleton with `apiVersion: "2026-05-27.dahlia"`. |
| `supabase/migrations/0003_payments_spine.sql` | wp_transfers + webhook_events, RLS, UNIQUE event_id, admin-read only | VERIFIED | Applied live to Balkanity (qyhdogajtmnvxphrslwm). UNIQUE index `webhook_events_event_id_key` confirmed live. RLS enabled on both tables. No INSERT/UPDATE/DELETE policy. |
| `app/pay/success/page.tsx` | Display-only; renders paid only when status===paid; never writes | VERIFIED | SELECT only (`select("status, amount_cents, paid_at")`). "Paid EUR…" rendered inside `isPaid === true` branch only. |
| `app/pay/cancel/page.tsx` | Display-only; never writes | VERIFIED | SELECT only (`select("status")`). No update/insert. |
| `platform/payments/single-writer.test.ts` | Source grep gate: exactly one paid writer | VERIFIED | 77 lines. Scans app/platform/modules (excl. tests), asserts writers.length === 1 at webhook route. 86/86 suite passes. |
| `app/api/stripe/webhook/route.contract.test.ts` | Source contract: nodejs, req.text(), no req.json(), constructEvent | VERIFIED | 4 assertions, all passing. |
| `platform/rls/payments-schema.test.ts` | Source contract for 0003 (UNIQUE, RLS, no write policy) | VERIFIED | 7 assertions, all passing. |
| `app/api/stripe/webhook/route.idempotency.test.ts` | Behavioral idempotency: 23505 short-circuit, 5xx on transient errors, write_failed outcome | VERIFIED | 4 behavioral tests: first delivery, replay 23505, transient insert error, transient paid error. All pass. Fixes CR-01 and CR-02. |
| `platform/payments/checkout.test.ts` | sessions.create args: EUR, integer unit_amount, metadata.transfer_id | VERIFIED | 1 test, passes. |
| `platform/payments/fee.test.ts` | fee verbatim from balance_transaction, null guard | VERIFIED | 3 tests, all pass. |
| `tests/e2e/webhook-forged.spec.ts` | Live forged-POST → 400 | VERIFIED | 2 tests passed in Playwright (03-GATES-EVIDENCE.md). |
| `tests/e2e/success-spoof.spec.ts` | Live success-URL never renders paid for unpaid transfer | VERIFIED | 1 test passed in Playwright (03-GATES-EVIDENCE.md). |
| `.planning/phases/03-payments-trust-spine/03-REPLAY-RUNBOOK.md` | Operator runbook for SC3 live demo | VERIFIED | File exists (03-GATES-EVIDENCE.md §GATE B references it; confirmed present via ls). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `checkout.ts` | Stripe API | `getStripe().checkout.sessions.create()` | WIRED | metadata.transfer_id + integer amountCents forwarded directly |
| `route.ts` | `webhook_events` | `admin.from("webhook_events").insert(...)` | WIRED | Insert-first before any paid write; 23505 → duplicate short-circuit |
| `route.ts` | `wp_transfers` | `admin.from("wp_transfers").update({status:"paid"})` | WIRED | Service-role client; .neq("status","paid") backstop; only on checkout.session.completed |
| `route.ts` | `platform/payments/fee.ts` | `recordedFeeCents(pi)` | WIRED | Expanded PI retrieved; fee written at route.ts:154 |
| `pay/success/page.tsx` | `wp_transfers` | `admin.from("wp_transfers").select(...)` | WIRED (read-only) | No write path present |
| `pay/start/route.ts` | `checkout.ts` | `createCheckoutSession({transferId, amountCents})` | WIRED | Service-role read of amount_cents, then session created, 303 redirect |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `route.ts` | `paidRows` | `wp_transfers.update({status:"paid"}).select("id")` | Yes — conditional UPDATE against live table | FLOWING |
| `route.ts` | `inserted` | `webhook_events.insert(...).maybeSingle()` | Yes — real insert with UNIQUE constraint | FLOWING |
| `route.ts` | `feeCents` | Stripe `paymentIntents.retrieve` expanded balance_transaction | Yes (null-guarded for unavailable) | FLOWING |
| `pay/success/page.tsx` | `status` / `amountCents` / `paidAt` | `wp_transfers.select(...)` | Yes — real DB read | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite green | `npm run test` | 18 test files, 86 tests, all passed (1.67s) | PASS |
| TypeScript clean | `npm run typecheck` | `tsc --noEmit` exit 0, no output | PASS |
| Single paid writer | `grep -RnE "status.*paid" app/ platform/ modules/ (excl. tests, comments)` | Exactly 1 production hit: `app/api/stripe/webhook/route.ts:151` | PASS |
| Forged POST → 400 (e2e) | Playwright webhook-forged.spec.ts (03-GATES-EVIDENCE.md) | 2/2 passed; live DB: 0 webhook_events, 0 paid transfers | PASS |
| Success-URL spoof display-only | Playwright success-spoof.spec.ts (03-GATES-EVIDENCE.md) | 1/1 passed | PASS |
| Live replay end-to-end | `stripe events resend evt_…` (Stripe CLI) | DEFERRED — CLI not installed, no sk_test_/whsec_ keys | SKIP |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes defined for this phase. Gate evidence is captured in `03-GATES-EVIDENCE.md`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BOOK-05 | 03-01 through 03-05 | `paid` set ONLY by signature-verified Stripe webhook (raw body), idempotent on Stripe event id; client success redirect never sets `paid` | SATISFIED | Single-writer grep passes; route.ts is the sole writer; idempotency test 4/4; SC2 gate passed live. SC3 unit-proven, live resend demo pending. |
| HLTH-01 | 03-01 through 03-05 | `webhook_events` log records idempotency, signature result, and processing outcome for every Stripe event | SATISFIED | Migration 0003 live with all required columns (event_id, signature_result, outcome). Route writes insert-first on every verified event. Schema contract test 7/7 pass. |

Both BOOK-05 and HLTH-01 are marked `[x]` (Complete) in REQUIREMENTS.md as of the phase traceability record.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/stripe/webhook/route.ts` | 119–125 | `outcome: "no_matching_transfer"` used for both genuinely-absent transfer AND already-paid case | Info (IN-01 from review) | Audit ambiguity only; does not affect money correctness |
| `platform/payments/checkout.ts` | 46 | `NEXT_PUBLIC_SITE_URL ?? ""` empty fallback produces relative URLs | Warning (WR-04 from review) | Misconfiguration path; Stripe would reject at session.create; no charge without valid URL |
| `app/api/stripe/webhook/route.ts` | 139–142 | `fee` retrieval failure silently swallowed; no audit distinction between "fee pending" and "fee fetch errored" | Warning (WR-05 from review) | Observable via null fee_cents; non-blocking to paid transition |
| `app/api/stripe/webhook/route.ts` | (replay branch) | `duplicate_skipped` outcome documented in migration but never written | Warning (WR-06 from review) | Audit gap; no correctness impact |
| `app/pay/start/route.ts` | 26 | Gate uses `NODE_ENV !== "production"` (WR-03) | Warning (advisory) | Vercel sets NODE_ENV=production for all builds; gate has correct behavior but semantics unclear |
| `app/api/stripe/webhook/route.ts` | (WR-01) | `stripe_checkout_session_id` never persisted on the transfer row | Warning | Weakens reconciliation join; column is dead/null; non-blocking for current phase |

No `TBD`, `FIXME`, or `XXX` markers found in any of the phase's key files. All 6 warnings above are advisory (noted in 03-REVIEW.md); none are unresolved debt markers blocking phase completion. Both Criticals (CR-01 and CR-02) were resolved in commit `7b956d4` and verified by the 86/86 suite.

---

### Human Verification Required

#### 1. Stripe CLI Live Replay Demonstration (SC3 end-to-end)

**Test:**
1. `brew install stripe/stripe-cli/stripe && stripe login` (TEST mode)
2. Add real `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_WEBHOOK_SECRET=whsec_…` (from `stripe listen`) to `.env.local` (server-only; never tracked or `NEXT_PUBLIC_`)
3. Start the dev server: `npm run dev`
4. In a second terminal: `stripe listen --forward-to localhost:3000/api/stripe/webhook` — copy the `whsec_…` value into `.env.local`
5. Seed a `wp_transfers` row (status `requested`) via the Supabase Management API or `pay/start?t=<id>`. Use its id as `metadata.transfer_id`.
6. Trigger a real signed `checkout.session.completed` event (via `pay/start?t=<id>` driving an actual Stripe TEST checkout, or via `stripe trigger checkout.session.completed`)
7. Capture the `evt_…` id from the stripe CLI output
8. `stripe events resend evt_…`

**Expected:**
- Exactly ONE `webhook_events` row for that `event_id` (the second delivery returns `{received:true, duplicate:true}` with HTTP 200)
- `wp_transfers.paid_at` is set exactly once (from the first delivery); unchanged after the resend
- `wp_transfers.status === "paid"` after the first delivery; status unchanged after the resend
- The route logs `outcome="processed"` on the first delivery (no second row)
- Append the output to `03-GATES-EVIDENCE.md` §GATE B and flip `gate_b_replay: passed`

**Why human:** Requires the Stripe CLI binary (not installed), real Stripe TEST API keys (`sk_test_…` + `whsec_…` from `stripe listen`), a running dev server, and a seeded transfer row with a real FK-valid `destination_id`. The unit-level proof (`route.idempotency.test.ts` 4/4 with mocked 23505) and the DB-level UNIQUE index (live on Balkanity) satisfy the logical contract. The outstanding item is the observable live demonstration that the full integration path — Stripe → signed HTTP → Node handler → Postgres UNIQUE constraint → single effect — works end-to-end with real keys. See `03-REPLAY-RUNBOOK.md` for the full step-by-step runbook.

---

### Gaps Summary

No gaps are blocking the phase goal at the code/logic level. The phase produced:

- A single, correctly wired `paid` writer in `app/api/stripe/webhook/route.ts` with all six documented hard invariants in code (nodejs runtime, raw body, HMAC verification, insert-first idempotency on UNIQUE event_id, service-role writes, display-only success page).
- A behavioral unit test suite (86/86) that proves the 23505 replay short-circuit, transient-error 5xx, and write_failed audit outcome — the CR-01/CR-02 fixes landed in commit `7b956d4`.
- A live schema (`0003`) applied to Balkanity with the UNIQUE `webhook_events_event_id_key` index, RLS enabled, and no write policy on either table.
- Recorded Playwright evidence of the forged-POST and success-spoof adversarial gates (GATE A — SC2).
- Recorded grep evidence of the single-writer gate (GATE C — SC1).

The one outstanding item is the **live Stripe CLI replay demonstration** (GATE B — SC3): the logic is built, the DB authority is in place, and the unit behavior is proven — only the observable end-to-end `stripe events resend` run with real TEST keys remains. This is classified as `human_needed` rather than `gaps_found` because the implementation is complete and the gap is an operator demonstration requiring external tooling.

Six advisory warnings from the code review (WR-01 through WR-06) are open and tracked in `03-REVIEW.md`. None block the phase goal; the most impactful (WR-01 `stripe_checkout_session_id` never persisted) weakens future reconciliation joins and is flagged for a follow-up pass in Phase 8.

---

_Verified: 2026-06-18T21:10:00Z_
_Verifier: Claude (gsd-verifier)_
