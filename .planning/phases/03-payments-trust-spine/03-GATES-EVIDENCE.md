---
phase: 03-payments-trust-spine
plan: 05
type: gates-evidence
created: 2026-06-18
status: partial
gates:
  schema_apply: passed
  gate_a_forged_spoof: passed     # SC2
  gate_c_single_writer: passed    # SC1
  gate_b_replay: deferred         # SC3 — needs Stripe CLI + sk_test_/whsec_ keys
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

## GATE B — Replay → exactly one effect (SC3) — DEFERRED

**Status: NOT RUN (deferred by operator decision 2026-06-18).** SC3 requires the Stripe CLI
(`stripe listen` / `stripe events resend`) and real TEST-mode keys (`sk_test_` / `whsec_`),
which are not installed/configured in this environment:

```
stripe CLI            → NOT installed
STRIPE_SECRET_KEY     → not in .env.local (real sk_test_ required)
STRIPE_WEBHOOK_SECRET → not in .env.local (real whsec_ from `stripe listen` required)
```

The DB-level idempotency authority IS in place and verified: the UNIQUE
`webhook_events_event_id_key` index exists live, and the route is insert-first
(`route.ts` records `webhook_events` on `event.id` BEFORE any `paid` effect; a duplicate
`event.id` violates the UNIQUE index → `.maybeSingle()` → null → short-circuit, no second
effect). What remains is the **live demonstration** via `stripe events resend`.

### To complete SC3 (runbook: `03-REPLAY-RUNBOOK.md`)

1. `brew install stripe/stripe-cli/stripe && stripe login`  (TEST mode)
2. Add real `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_WEBHOOK_SECRET=whsec_…` (from
   `stripe listen`) to `.env.local` (server-only; never tracked / `NEXT_PUBLIC_`).
3. Seed a `wp_transfers` row (status `requested`); use its id as `metadata.transfer_id`.
4. `stripe listen --forward-to localhost:3000/api/stripe/webhook`; trigger a real signed
   `checkout.session.completed`; capture `evt_…`; `stripe events resend evt_…`.
5. Assert: exactly ONE `webhook_events` row for that `event_id`; `wp_transfers.paid_at`
   unchanged on the second delivery; the transfer flipped to `paid` exactly once with
   `fee_cents` recorded. Append the output here and flip `gate_b_replay: passed`.

---

## Acceptance summary

| Criterion | Gate | Status |
|-----------|------|--------|
| Migration 0003 signed off + live on Balkanity (never Kalvia) | Task 1 | ✅ PASS |
| Forged/unsigned POST → 400 + zero state change | GATE A | ✅ PASS |
| Spoofed success-URL never writes `paid` | GATE A | ✅ PASS |
| Exactly one `paid` writer; full suite green | GATE C | ✅ PASS |
| Replayed `event.id` → exactly one effect | GATE B | ⏸ DEFERRED (SC3) |

**Phase 3 is NOT fully complete:** SC3 (live replay) remains a hard acceptance bar and is
pending the Stripe CLI + TEST keys. All other acceptance bars are met and evidence-recorded.
