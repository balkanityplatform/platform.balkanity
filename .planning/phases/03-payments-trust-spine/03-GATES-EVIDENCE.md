---
phase: 03-payments-trust-spine
plan: 05
type: gates-evidence
created: 2026-06-18
status: passed
gates:
  schema_apply: passed
  gate_a_forged_spoof: passed     # SC2
  gate_c_single_writer: passed    # SC1
  gate_b_replay: passed           # SC3 — proven live via Stripe CLI resend (2026-06-18)
target_ref: qyhdogajtmnvxphrslwm   # Balkanity (NEVER Kalvia utyatpadtibqqswsfvtr)
---

# Phase 3 — Adversarial Gates Evidence

> Recorded commands + outputs for the FLAGGED schema apply and the adversarial gates that
> build/type checks cannot prove from source. All run against the LIVE Balkanity project
> (`qyhdogajtmnvxphrslwm`, eu-central-1) in Stripe TEST mode (D-02). No real money moved.

## Execution mode note

Live DB work was performed via the **Supabase Management API** (`SUPABASE_ACCESS_TOKEN` from
`.env.local`), **not MCP** (MCP reaches only Kalvia per project memory) and **not the direct
`db.<ref>.supabase.co` host** (IPv6-only; unresolvable on this network). The Management API
`/v1/projects/qyhdogajtmnvxphrslwm/database/query` endpoint is the confirmed IPv4 path to
Balkanity. Migration history (`supabase_migrations.schema_migrations`) was updated in the same
transaction so a future `supabase db push` stays consistent.

---

## Guardrail — target ref is Balkanity (T-03-ENV / T-03-ENV2)

```
$ curl -s https://api.supabase.com/v1/projects/qyhdogajtmnvxphrslwm \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
name: balkanityplatform's Project | ref: qyhdogajtmnvxphrslwm | region: eu-central-1

SUPABASE_URL ref      → qyhdogajtmnvxphrslwm   (Balkanity ✓)
SUPABASE_DB_URL ref   → qyhdogajtmnvxphrslwm   (Balkanity ✓)
Kalvia ref (utyatpadtibqqswsfvtr) present anywhere? → NO  (OK)
```

---

## Task 1 — Schema sign-off + apply migration 0003 (FLAGGED, D-04)

**Human sign-off:** Recorded 2026-06-18. The operator reviewed
`supabase/migrations/0003_payments_spine.sql` end-to-end (Balkanity-ref header guardrail;
minimal money-spine `wp_transfers`; `webhook_events` with UNIQUE `event_id`; both RLS-enabled,
single admin-read SELECT policy each, NO write policy; integer-cents CHECK) and approved apply
to `qyhdogajtmnvxphrslwm` via the **"Approve & apply now"** decision. `platform/rls/payments-schema.test.ts`
was GREEN (7/7) before apply.

### Pre-apply live state

```
public tables → app_users, companies, destinations, driver_profiles, properties
is_admin()    → present (dependency from 0002)
migration history → 0001, 0002
wp_transfers / webhook_events → DO NOT EXIST yet
```

### Apply (atomic — BEGIN … COMMIT, with history row recorded in the same txn)

```
POST /v1/projects/qyhdogajtmnvxphrslwm/database/query
body: BEGIN; <0003_payments_spine.sql> ;
      insert into supabase_migrations.schema_migrations (version, name, statements)
      values ('0003','payments_spine', ARRAY[$migration$ … $migration$]);
      COMMIT;
response: []      # empty array = DDL success, no error
```

### Post-apply live verification (IPv4 / Management API)

```
tables exist          → webhook_events, wp_transfers           ✓
RLS enabled           → webhook_events=true, wp_transfers=true  ✓
UNIQUE event_id index → CREATE UNIQUE INDEX webhook_events_event_id_key
                         ON public.webhook_events USING btree (event_id)  ✓
policies              → wp_transfers_admin_read   (SELECT)
                        webhook_events_admin_read (SELECT)
                        NO INSERT/UPDATE/DELETE policy on either table     ✓
wp_transfers columns  → id, destination_id, status, amount_cents, currency,
                        fee_cents, stripe_checkout_session_id,
                        stripe_payment_intent_id, paid_at, created_at      ✓ (minimal money-spine, D-03)
migration history     → 0001, 0002, 0003 (payments_spine)                 ✓
```

**Result: PASS.** `0003` is live on Balkanity and matches the source-level contract.

---

## GATE A — Forged signature + success-URL spoof (SC2, BOOK-05)

Run with **dummy** Stripe TEST values inline (`STRIPE_SECRET_KEY=sk_test_dummy…`,
`STRIPE_WEBHOOK_SECRET=whsec_dummy…`) so `stripe.webhooks.constructEvent` performs a genuine
HMAC rejection (not an accidental config-error 400). Dummies were passed as shell env only —
never written to a tracked file / `.env.local` / `NEXT_PUBLIC_` (honors STATE.md SECURITY TODO).

```
$ npm run test:e2e -- webhook-forged success-spoof --reporter=list

  ✓ webhook-forged.spec.ts › forged stripe-signature -> 400, zero state change (SC2)
  ✓ webhook-forged.spec.ts › missing stripe-signature header -> 400 (SC2)
  ✓ success-spoof.spec.ts  › direct success_url hit (no webhook) never shows paid (SC2, Pitfall 3)

  3 passed (6.4s)
```

### Live zero-state-change confirmation (beyond the HTTP 400)

```
webhook_events rows for 'evt_forged'  → 0   ✓  (forged event never recorded)
total webhook_events rows             → 0   ✓
wp_transfers rows with status='paid'  → 0   ✓  (nothing marked paid)
```

**Result: PASS.** Forged/unsigned POST → 400 with zero state change; the spoofable
`/pay/success` page is display-only and never renders/writes `paid`.

---

## GATE C — Single-writer grep + full suite (SC1)

```
$ grep -RnE "status['\"]?[[:space:]]*[:=][[:space:]]*['\"]paid" \
    app/ platform/ modules/ --include="*.ts" --include="*.tsx" | grep -v '\.test\.'
app/api/stripe/webhook/route.ts:139:        status: "paid",
# (line 133 is the explanatory comment; the success page's `=== "paid"` is a READ, not a write)

files with an actual `.update({... status:"paid" ...})` → app/api/stripe/webhook/route.ts   (exactly ONE)

$ npm run test         → Test Files 17 passed (17) · Tests 82 passed (82)
$ npm run typecheck    → tsc --noEmit, exit 0 (clean)
$ npm run lint         → 0 errors (1 pre-existing warning: _params unused in checkout.test.ts, Plan 03-03)
$ vitest platform/payments/single-writer.test.ts → 2 passed (the canonical grep-gate contract)
```

**Result: PASS.** Exactly one `paid` writer (the signature-verified webhook); full unit suite green.

---

## GATE B — Replay → exactly one effect (SC3) — PASSED (2026-06-18)

**Run live against Balkanity in Stripe TEST mode.** Stripe CLI v1.42.13 (installed to
`~/.local/bin/stripe` from the official GitHub release — no Homebrew/sudo), `stripe login`
on the **Balkanity Travel** sandbox, API version `2026-05-27.dahlia` (matches the pinned
SDK version). `STRIPE_SECRET_KEY=sk_test_…` in `.env.local`; `STRIPE_WEBHOOK_SECRET` wired
into the dev server from `stripe listen --print-secret` (server-only, NOT written to a
tracked file). A test FK chain (company→property→destination→transfer) was seeded on the
live DB and removed after the run (see Cleanup).

### Setup

```
~/.local/bin/stripe listen --forward-to localhost:3000/api/stripe/webhook
  → Ready! API Version 2026-05-27.dahlia. whsec_0d181f60…  (matches the dev-server secret)
seeded wp_transfers id = ae851182-3d39-4f64-ac39-b988ef638005 (status=requested, 5000 EUR cents)
```

### First delivery (signed checkout.session.completed carrying metadata.transfer_id)

```
~/.local/bin/stripe trigger checkout.session.completed \
  --add "checkout_session:metadata.transfer_id=ae851182-3d39-4f64-ac39-b988ef638005"
listen log → checkout.session.completed [evt_1TjkgDIVJCasWEpxBXrU3J3y]  <-- [200]

wp_transfers (after):  status=paid, paid_at=2026-06-18 18:28:46.43+00,
                       stripe_payment_intent_id=pi_3TjkgCIVJCasWEpx0RPNtyy8, fee_cents=null
webhook_events:        rows=1 for that event_id, outcome=processed, signature_result=valid
```
> `fee_cents=null` is expected: the balance transaction is not available at capture time
> (Pitfall 5) — Phase 8 reconciliation backfills it. The `paid` transition itself is correct.

### Replay (same event.id resent — the SC3 assertion)

```
paid_at BEFORE resend:  2026-06-18 18:28:46.43+00
~/.local/bin/stripe events resend evt_1TjkgDIVJCasWEpxBXrU3J3y
listen log → 21:29:25 checkout.session.completed [evt_1TjkgDIVJCasWEpxBXrU3J3y]  <-- [200]

webhook_events rows for event_id AFTER resend:  1   ← STILL ONE (UNIQUE + insert-first dedup)
wp_transfers.paid_at AFTER resend:  2026-06-18 18:28:46.43+00   ← UNCHANGED
wp_transfers.status:  paid
```

**Result: PASS.** Replaying the same `event.id` produced EXACTLY ONE effect — no second
`webhook_events` row, `paid_at` unchanged, the transfer marked `paid` exactly once. The
23505 short-circuit (CR-02 fix) returned 200 `{duplicate:true}` on the resend.

### Cleanup

The seeded test chain and all test-run `webhook_events` audit rows were deleted from the
live DB after the run (the table was empty before this gate). Dev server + `stripe listen`
stopped. `STRIPE_WEBHOOK_SECRET` was never persisted to a tracked file.

---

## Acceptance summary

| Criterion | Gate | Status |
|-----------|------|--------|
| Migration 0003 signed off + live on Balkanity (never Kalvia) | Task 1 | ✅ PASS |
| Forged/unsigned POST → 400 + zero state change | GATE A | ✅ PASS |
| Spoofed success-URL never writes `paid` | GATE A | ✅ PASS |
| Exactly one `paid` writer; full suite green | GATE C | ✅ PASS |
| Replayed `event.id` → exactly one effect | GATE B | ✅ PASS (live, 2026-06-18) |

**All Phase 3 acceptance bars are met and evidence-recorded.** SC3 was proven live via
`stripe events resend` against the Balkanity DB in TEST mode.
