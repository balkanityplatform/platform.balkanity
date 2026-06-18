# Phase 3: Payments Trust Spine - Research

**Researched:** 2026-06-18
**Domain:** Stripe payments (code-created Checkout Session) + signature-verified, idempotent webhook on Next.js 16 App Router (Node runtime) writing to Supabase Postgres via the service-role client
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Currency:** Stripe Checkout charges and settles in **EUR**. No BGN currency layer. EUR is the locked display currency (Phase 2 D-07); EEA fee facts (€0.25 + 1.5%) are in EUR.
- **D-02 — Stripe environment:** Build and run **all** adversarial gates in Stripe **TEST mode** (test keys + Stripe CLI to forge/replay `checkout.session.completed`). Live-key cutover is **deferred to pilot launch** — no real money moves this phase. `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are server-only, never `NEXT_PUBLIC_`. Stripe API version pinned **`2026-05-27.dahlia`**; `stripe-node` v22.
- **D-03 — Paid-target seam:** Phase 3 **creates a minimal `wp_transfers` table now** — only the money-spine columns: `id`, `status` (the `paid` writer's target), amount/total in integer cents, `currency`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, recorded fee (cents), `paid_at`, plus FK to a destination (so `metadata.transfer_id` resolves to a real row). Single-writer + idempotency guarantees are proven against this **real** table, not a throwaway fixture.
- **D-04 — Phase 4 extends, not creates:** Phase 4 **ALTERs** `wp_transfers` to add PII + full lifecycle columns — it does NOT create the table. Next migration is **`0003`**, FLAGGED / irreversible; schema sign-off applies before apply (same gate as Phase 2's `0002`). Phase 4's planner must be told the table already exists.
- **D-05 — Fee recording:** On the `paid` transition, record the **actual** processing fee fetched from the Stripe **balance transaction** (`payment_intent` → `charge` → `balance_transaction`, one extra API call / one expand), stored in integer cents on the `wp_transfers` row. The Phase 2 `commission.ts` estimate (€0.25 + 1.5%) remains the **display** estimate pre-payment; the actual fee is the recorded truth post-payment. Refunds do **not** return the original fee.

### Claude's Discretion
- Raw-body handling mechanics for Next 16 App Router (**must be verified with the forged-POST test before done** — ROADMAP note).
- The exact dedup transaction shape (insert-into-`webhook_events`-first vs advisory lock).
- `webhook_events` column set beyond the mandated idempotency key / signature result / outcome.
- Checkout success/cancel URL pages this phase (no booking UI yet — minimal/test pages are fine).
- How the adversarial forged/replay tests are seeded.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope. (Out-of-phase, per CONTEXT `<domain>`: guest booking form + slug link, full `wp_transfers` PII/lifecycle columns + confirmation email → Phase 4; masked pool view + atomic claim RPC → Phase 5; admin refund UI → Phase 6; reconciliation sweep + email-cap gauge + keep-alive → Phase 8; live Stripe keys → pilot launch.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **BOOK-05** | `paid` is set ONLY by a signature-verified Stripe webhook (raw body), idempotent on Stripe event id; the client success redirect never sets `paid`. | Raw-body pattern (`req.text()` + `constructEvent`, `nodejs` runtime) → §"Pattern 1" + §"Code Examples". Single-writer enforced by routing the only `status='paid'` UPDATE through the service-role webhook handler + grep gate → §"Validation Architecture". Spoofed-success-URL gate → §"Adversarial Test Harness". |
| **HLTH-01** | `webhook_events` log records idempotency key, signature result, and processing outcome for every Stripe event. | `webhook_events` schema → §"Pattern 3" + §"wp_transfers / webhook_events schema". Insert-first dedup (UNIQUE `event_id`) → §"Pattern 2". RLS admin-read / no-write posture → §"Architecture Patterns". |
</phase_requirements>

## Summary

This phase builds the money-authoritative path and proves it adversarially before any booking UI exists. There are three moving parts: (1) a **code-created Stripe Checkout Session** carrying `metadata.transfer_id`, (2) a **Node-runtime webhook route handler** that reads the **raw request bytes** (`await req.text()`), verifies the Stripe signature with `stripe.webhooks.constructEvent`, and is the **only** code path that writes `status='paid'`, and (3) a **`webhook_events` log** with a `UNIQUE(event_id)` constraint enabling **insert-first idempotency** so a replayed event produces exactly one `paid` effect.

The single most important verified fact for this phase: on the **Node.js runtime** (which CONTEXT locks via `export const runtime = 'nodejs'`), Next.js App Router gives you the raw body through `await req.text()` with **no special config** — the Pages-Router `bodyParser:false` / `micro.buffer` machinery is obsolete. Use the **synchronous `constructEvent`** (Node's crypto is synchronous); `constructEventAsync` + `createSubtleCryptoProvider` is only needed on Edge/WebCrypto runtimes, which this phase explicitly avoids. The forged-POST adversarial gate (success criterion 2) is precisely the test that confirms raw-body handling is correct — if a body parser ever re-serialized the payload, `constructEvent` would throw and the gate would catch it.

The webhook is the sole `paid` writer, executed through the existing **service-role client** (`platform/supabase/admin.ts`, `import "server-only"`) which bypasses RLS. Idempotency is achieved by inserting the `event_id` into `webhook_events` **first** (UNIQUE constraint → duplicate delivery hits a conflict → short-circuit before the `paid` UPDATE), making replay safe by construction. The actual processing fee (D-05) is fetched in one call via `expand: ['latest_charge.balance_transaction']` on the PaymentIntent and stored as `balance_transaction.fee` (integer cents).

**Primary recommendation:** Build `app/api/stripe/webhook/route.ts` (`runtime='nodejs'`) with `req.text()` + `constructEvent`; gate every event through an **insert-first** `webhook_events` row (UNIQUE `event_id`); flip `wp_transfers.status='paid'` in the same handler via the service-role client and record the real fee via `expand latest_charge.balance_transaction`; create the Checkout Session server-side with inline `price_data` (EUR, integer `unit_amount`) + `metadata.transfer_id` and 303-redirect to `session.url`. Prove all three adversarial gates with the Stripe CLI in TEST mode before closing the phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Create Checkout Session (`metadata.transfer_id`, EUR, integer cents) | API / Backend (Next route handler or server action) | — | Needs `STRIPE_SECRET_KEY` (server-only); session creation is a trust-boundary write that must never touch the client. |
| Redirect guest to Stripe-hosted checkout | API / Backend (303 → `session.url`) | Browser (follows redirect) | CLAUDE.md prefers server 303-redirect over `@stripe/stripe-js` client redirect — fewer client deps, no secret exposure. |
| Verify webhook signature (raw body) | API / Backend (`app/api/stripe/webhook/route.ts`, `nodejs`) | — | Raw-body + HMAC verification is fragile on Edge; CONTEXT locks `runtime='nodejs'`. |
| Write `status='paid'` (the ONLY writer) | API / Backend via **service-role** client | Database (UNIQUE/CHECK constraints as backstop) | `paid` must bypass RLS and be set only after signature verification — service-role in the webhook is the single authoritative path (BOOK-05). |
| Idempotency / dedup on `event.id` | Database (UNIQUE `event_id` constraint) | API / Backend (insert-first then process) | DB constraint is the race-safe authority; the app reads the conflict to short-circuit (mirrors the Phase 2 `destinations_slug_key` 23505 pattern). |
| `webhook_events` audit log | Database (table + RLS admin-read) | API / Backend (service-role writes rows) | HLTH-01 audit record; admin-read RLS, no write policy (Phase 2 pattern). |
| Fetch actual processing fee | API / Backend (Stripe API `expand`) | Database (store `fee_cents`) | Fee lives in Stripe's balance transaction; fetched server-side, persisted as integer cents (D-05). |
| Pre-payment fee **estimate** (display) | API/UI via `platform/money/commission.ts` | — | Display-only estimate; NOT the recorded truth (recorded truth = balance transaction). Reused, not rebuilt. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` (stripe-node) | **`22.2.1`** (`^22.2`) | Code-created Checkout Sessions + `webhooks.constructEvent` signature verification + PaymentIntent/balance-transaction retrieval | Official Stripe Node SDK (`github.com/stripe/stripe-node`). Locked by CLAUDE.md. v22 supports the `2026-05-27.dahlia` API line. `[VERIFIED: npm registry]` — version 22.2.1 published 2026-06-17, `engines.node >=18`, no `postinstall` script. |
| `@supabase/supabase-js` | `2.108.2` (`^2.108`) | Service-role client for the `paid` write + `webhook_events` insert | Already in `package.json`; used via `platform/supabase/admin.ts`. `[VERIFIED: package.json + 01/02 usage]` |
| `zod` | `^4.4` | Server-side validation of the create-session input (transfer_id resolves to a real destination) and (optionally) narrow shape-checks on the verified event payload | Already a project dependency (Phase 2). CLAUDE.md: validate at trust boundaries, server-side. `[VERIFIED: package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@stripe/stripe-js` | `^7` | Client-side redirect to Checkout | **Do NOT add.** CLAUDE.md prefers a server 303-redirect to `session.url`; adding this is an unnecessary client dependency. Listed only to record the deliberate non-use. `[CITED: CLAUDE.md "What NOT to Use" / Alternatives]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server 303-redirect to `session.url` | `@stripe/stripe-js` `redirectToCheckout` | Client redirect adds a browser dependency and surfaces the publishable key flow; server redirect keeps the secret server-only and removes a dep. **Use server redirect** (CLAUDE.md lock). |
| Insert-first `webhook_events` dedup | Postgres advisory lock (`pg_advisory_xact_lock(hashtext(event_id))`) | Advisory lock serializes concurrent duplicates but still needs a persisted record for HLTH-01; the UNIQUE-constraint insert-first approach gives BOTH the audit row AND the dedup in one step, mirroring Phase 2's `23505` slug pattern. **Use insert-first.** |
| Synchronous `constructEvent` | `constructEventAsync` + `Stripe.createSubtleCryptoProvider()` | Async/SubtleCrypto is only required on Edge/WebCrypto runtimes (Cloudflare Workers, Deno). On the locked `nodejs` runtime, Node's crypto is synchronous → `constructEvent` is correct and simplest. **Use `constructEvent`.** |
| One extra API call (`charge` → `balance_transaction`) | `expand: ['latest_charge.balance_transaction']` on the PaymentIntent | Expand fetches the fee in a single retrieve instead of three sequential calls. **Use expand** (D-05 "one extra API call" satisfied by a single expanded retrieve). |

**Installation:**
```bash
npm install stripe@^22.2
```
(Only `stripe` is new. `@supabase/supabase-js`, `zod`, `server-only` already present.)

**Version verification (run during planning):**
```bash
npm view stripe version           # expect 22.2.x  (verified 22.2.1, 2026-06-17)
npm view stripe scripts.postinstall   # expect empty (verified: none)
```

## Package Legitimacy Audit

> slopcheck could not be installed in this research environment (`pip install slopcheck` unavailable). Per protocol, packages would default to `[ASSUMED]` — **except** `stripe` is the canonical official SDK already locked by CLAUDE.md and documented in its Verified Provider Facts, with source repo `github.com/stripe/stripe-node`, `engines.node >=18`, and **no postinstall script**. It is treated as `[VERIFIED]` on those grounds. The planner should still confirm `npm view stripe version` at install time.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `stripe` | npm | mature (years; latest 22.2.1 @ 2026-06-17) | very high (official SDK) | github.com/stripe/stripe-node | not run (unavailable) | **Approved** — official SDK, project-locked, no postinstall |
| `@supabase/supabase-js` | npm | mature | very high | github.com/supabase/supabase-js | not run | Approved — already installed/used |
| `zod` | npm | mature | very high | github.com/colinhacks/zod | not run | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Postinstall check:** `npm view stripe scripts.postinstall` → empty (no postinstall). No network/filesystem side effects on install.

## Architecture Patterns

### System Architecture Diagram

```
                                      ┌──────────────────────────────────────┐
  GUEST BROWSER                       │  NEXT.JS 16 (Vercel, nodejs runtime) │
  ─────────────                       │                                      │
  (Phase 4 will call this; this       │  ① Create-Session endpoint           │
   phase ships a minimal test         │     (server action / route handler)  │
   trigger + minimal success/cancel   │     - zod-validate transfer_id        │
   pages)                             │     - resolve transfer_id → real      │
        │  "pay" ─────────────────────┼──►    wp_transfers row (FK destination)│
        │                             │     - stripe.checkout.sessions.create │
        │                             │         { mode:'payment',             │
        │                             │           currency:'eur',             │
        │                             │           line_items[price_data       │
        │                             │             unit_amount=cents],       │
        │                             │           metadata.transfer_id,       │
        │                             │           success_url, cancel_url }    │
        │  303 redirect ◄─────────────┼──── returns session.url               │
        ▼                             │     - store stripe_checkout_session_id │
  ┌───────────────┐                   └──────────────────────────────────────┘
  │ Stripe-hosted │
  │  Checkout     │  guest pays (TEST card 4242…)
  └──────┬────────┘
         │
         │  (a) browser redirected to success_url   (SPOOFABLE — must NEVER write paid)
         │           └─► ② success page = DISPLAY ONLY (reads status; never writes)
         │
         │  (b) Stripe → POST checkout.session.completed (SIGNED)   ◄── AUTHORITATIVE
         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ③ app/api/stripe/webhook/route.ts   export const runtime = 'nodejs'      │
  │     - body = await req.text()              (RAW bytes — no .json())        │
  │     - sig  = req.headers.get('stripe-signature')                          │
  │     - event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)   │
  │           └─ throws → return 400, ZERO state change  (forged-POST gate)    │
  │     - service-role client (admin.ts, bypasses RLS):                       │
  │         INSERT INTO webhook_events(event_id, type, signature_result,      │
  │              payload, outcome='received') ON CONFLICT(event_id) DO NOTHING │
  │           └─ 0 rows inserted → DUPLICATE → log 'duplicate_skipped', 200    │
  │              (replay gate: exactly one effect)                            │
  │     - if checkout.session.completed:                                      │
  │         transfer_id = event.data.object.metadata.transfer_id             │
  │         pi = retrieve(payment_intent,                                     │
  │                expand ['latest_charge.balance_transaction'])             │
  │         fee_cents = pi.latest_charge.balance_transaction.fee             │
  │         UPDATE wp_transfers SET status='paid', paid_at=now(),            │
  │              stripe_payment_intent_id=…, fee_cents=…                      │
  │              WHERE id=transfer_id AND status<>'paid'   ◄── ONLY paid writer│
  │         UPDATE webhook_events SET outcome='processed' WHERE event_id=…    │
  │     - return 200                                                          │
  └──────────────────────────────────────────────────────────────────────────┘
                              │ service-role writes
                              ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  SUPABASE POSTGRES (Balkanity ref qyhdogajtmnvxphrslwm)  migration 0003   │
  │   wp_transfers  (status, amount_cents, currency, stripe_*_id, fee_cents,  │
  │                  paid_at, destination_id FK)  — RLS on, admin-read, no write│
  │   webhook_events(event_id UNIQUE, type, signature_result, outcome, …)     │
  │                  — RLS on, admin-read, no write                            │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
app/
├── api/
│   └── stripe/
│       └── webhook/
│           └── route.ts          # POST handler; export const runtime='nodejs'; the ONLY paid writer
├── (checkout test trigger)        # minimal: a server action or route that creates a Session + 303-redirects
│                                  #   (Phase 4 replaces this with the real booking form)
├── pay/                           # OPTIONAL minimal success/cancel test pages (display-only)
│   ├── success/page.tsx           # reads transfer status; NEVER writes paid
│   └── cancel/page.tsx
platform/
├── payments/                      # NEW — platform-generic payments seam (reused by future modules)
│   ├── stripe.ts                  # server-only Stripe client factory (apiVersion '2026-05-27.dahlia')
│   ├── checkout.ts                # createCheckoutSession(transfer) helper
│   └── webhook.ts                 # (optional) verify+dedup helper used by the route
├── supabase/admin.ts              # EXISTING service-role client (the paid writer's DB client)
└── money/commission.ts            # EXISTING — display-only fee ESTIMATE (do not use for recorded fee)
modules/welcome-pickup/            # wp_transfers is a MODULE table (wp_ prefix) — but no TS module
                                   #   code is strictly required this phase; the table lives in 0003
supabase/migrations/
└── 0003_payments_spine.sql        # FLAGGED — wp_transfers (minimal) + webhook_events + RLS
```
> **Seam note (PLAT-01):** `wp_transfers` is module-specific → **`wp_` prefix**. `webhook_events` is a **platform-generic** payments-health table → **UNPREFIXED** (like `companies`, `app_users`). The Stripe client/checkout helpers are platform-generic (payments is a shared foundation per PROJECT.md) → live under `platform/payments/`.

### Pattern 1: Node-runtime raw-body webhook (signature verification)
**What:** Read raw bytes with `req.text()`, verify with `constructEvent`, on `nodejs` runtime.
**When to use:** The Stripe webhook route — the authoritative `paid` path.
**Example:**
```typescript
// app/api/stripe/webhook/route.ts
// Source: https://docs.stripe.com/webhooks?lang=node  (App Router raw-body section)
export const runtime = "nodejs"; // CLAUDE.md lock: never Edge for the Stripe webhook

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/platform/payments/stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();                       // RAW bytes — NOT req.json()
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const stripe = getStripe();
  let event;
  try {
    // Synchronous constructEvent is correct on the Node runtime (Node crypto is sync).
    // constructEventAsync + createSubtleCryptoProvider is ONLY for Edge/WebCrypto.
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 }); // forged → 400, no state change
  }
  // … dedup + process (Pattern 2)
}
```
**Verified facts:** No `bodyParser:false` / `export const config` needed in App Router (that was Pages Router). `req.text()` preserves the exact bytes `constructEvent` needs. `[CITED: docs.stripe.com/webhooks]`

### Pattern 2: Insert-first idempotency (UNIQUE event_id)
**What:** Persist the event row **before** processing; the UNIQUE constraint makes replay a no-op.
**When to use:** Every verified event, before the `paid` UPDATE.
**Example:**
```typescript
// Source pattern: docs.stripe.com/webhooks (log event ids, skip already-logged)
//                 + Phase 2 destinations_slug_key 23505 conflict precedent
const admin = createAdminClient(); // service-role (bypasses RLS)

// INSERT-FIRST: the dedup gate. ON CONFLICT DO NOTHING → 0 rows on a replay.
const { data: inserted } = await admin
  .from("webhook_events")
  .insert({
    event_id: event.id,                 // UNIQUE — the idempotency key (HLTH-01)
    type: event.type,
    signature_result: "valid",          // we only reach here after constructEvent succeeded
    outcome: "received",
  })
  .select("event_id")
  .maybeSingle();                       // null when the row already existed (conflict)

if (!inserted) {
  // Replayed event.id → already processed → return 200, do NOT touch wp_transfers.
  return NextResponse.json({ received: true, duplicate: true });
}
// … now safe to flip paid exactly once, then UPDATE outcome='processed'
```
> **Concurrency note:** With `ON CONFLICT (event_id) DO NOTHING`, two simultaneous deliveries of the same `event.id` race on the UNIQUE constraint — exactly one wins the insert and proceeds; the other gets 0 rows and short-circuits. This is the same race-safe-by-constraint approach as Phase 2's slug uniqueness. The `paid` UPDATE additionally carries `WHERE status<>'paid'` as a second idempotency backstop.

### Pattern 3: `paid` UPDATE as the single writer (service-role)
**What:** The only `status='paid'` write in the codebase, in the webhook, via service-role.
**Example:**
```typescript
await admin
  .from("wp_transfers")
  .update({
    status: "paid",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntentId,
    fee_cents: feeCents,                // from balance_transaction (D-05)
  })
  .eq("id", transferId)
  .neq("status", "paid");               // backstop: idempotent even if dedup were bypassed
```
> **Grep gate (success criterion 1):** `grep -rn "status.*paid\|'paid'" app/ platform/ modules/` must show the `paid` write in **exactly one** file (this handler). Any other writer fails the gate.

### Pattern 4: Actual fee via single expanded retrieve (D-05)
```typescript
// Source: https://docs.stripe.com/api/balance_transactions  +  /api/payment_intents/retrieve
const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
  expand: ["latest_charge.balance_transaction"],
});
const bt = (pi.latest_charge as Stripe.Charge).balance_transaction as Stripe.BalanceTransaction;
const feeCents = bt.fee;        // integer minor units (EUR cents). bt.net = bt.amount - bt.fee
// Note: refunds do NOT return bt.fee (CLAUDE.md verified fact) — record it now as the recorded truth.
```
> The PaymentIntent id is available on the `checkout.session.completed` event as `event.data.object.payment_intent` (string). Alternatively `expand` it on the session retrieve. One retrieve with expand satisfies D-05's "one extra API call".

### Pattern 5: Code-created Checkout Session (EUR, integer cents, metadata)
```typescript
// Source: https://docs.stripe.com/api/checkout/sessions/create
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{
    quantity: 1,
    price_data: {
      currency: "eur",                          // D-01
      unit_amount: transfer.amount_cents,       // integer minor units — no floats
      product_data: { name: `Transfer: ${destinationLabel}` },
    },
  }],
  metadata: { transfer_id: transfer.id },       // resolves on the webhook (also consider payment_intent_data.metadata)
  success_url: `${SITE_URL}/pay/success?t=${transfer.id}`,  // display-only page
  cancel_url: `${SITE_URL}/pay/cancel?t=${transfer.id}`,
});
// CLAUDE.md prefers server redirect: in a route handler return NextResponse.redirect(session.url!, 303)
```
> `session.url` is returned for a server 303-redirect. Store `session.id` on the transfer as `stripe_checkout_session_id` so reconciliation (Phase 8) can match.

### Anti-Patterns to Avoid
- **`await req.json()` in the webhook** — re-serializes the payload, breaks HMAC verification. Use `req.text()`. `[CITED: CLAUDE.md "What NOT to Use"]`
- **Edge runtime for the webhook** — raw-body + crypto is fragile; CONTEXT locks `nodejs`. `[CITED: CLAUDE.md]`
- **Setting `paid` from the success_url / client** — redirects are spoofable; violates the core money invariant. Success page is display-only. `[CITED: CLAUDE.md + BOOK-05]`
- **Service-role / Stripe secret in any `NEXT_PUBLIC_` var or client component** — full key leak. Keep server-only. `[CITED: CLAUDE.md]`
- **Dashboard Stripe Payment Links** — forbidden; no `metadata.transfer_id`/`client_reference_id` control. Use code-created sessions. `[CITED: CLAUDE.md]`
- **Process-then-log (log the event id only after processing)** — leaves a window where a crash mid-process loses the dedup record. **Insert-first**, then mark `processed`. `[CITED: docs.stripe.com/webhooks]`
- **Floats for money** — store/transmit integer cents end-to-end (Phase 2 convention; `commission.ts`). `[CITED: STATE.md 02-01 decision]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC-SHA256 + timestamp tolerance + `v1=` scheme parsing | `stripe.webhooks.constructEvent(body, sig, secret)` | Stripe's scheme includes a timestamp-tolerance replay window and constant-time compare; hand-rolling invites a subtle bypass. |
| Replay/idempotency dedup | Bespoke in-memory cache or "have I seen this?" map | `UNIQUE(event_id)` + insert-first `ON CONFLICT DO NOTHING` | DB constraint is race-safe across concurrent deliveries and serverless instances; memory caches don't survive cold starts. |
| Fee calculation | Re-deriving `1.5% + €0.25` to persist as the "real" fee | `balance_transaction.fee` via expand | Card brand/region varies the actual fee (EEA vs UK 2.5% vs intl 3.25% + 2% conversion); only Stripe's balance transaction is authoritative. The 1.5%+€0.25 math stays a **display estimate** (`commission.ts`). |
| Checkout page / payment form | Custom card form / PaymentElement | Stripe-hosted Checkout (`checkout.sessions.create` → `session.url`) | PCI scope, SCA/3DS, localization handled by Stripe; CLAUDE.md locks code-created Checkout Sessions. |
| Currency/amount formatting for Stripe | Float math, multiplying by 100 at the boundary | Already integer cents (Phase 2) → pass `unit_amount` directly | Zero rounding drift; `commission.ts` already produces integer cents. |

**Key insight:** Every "trust" property in this phase (signature validity, exactly-once, true fee) has an authoritative source — Stripe's SDK, a Postgres UNIQUE constraint, and Stripe's balance transaction respectively. Hand-rolling any of them re-introduces exactly the foot-guns the trust-spine phase exists to eliminate.

## Runtime State Inventory

> This is a greenfield money-path phase (no rename/refactor of existing strings). The closest analogue is **schema + env additions**; recorded here for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `wp_transfers` and `webhook_events` are NEW tables (migration 0003). No existing data references `paid`. | New migration only. |
| Live service config | **Stripe Dashboard (TEST mode) webhook endpoint** must be registered to point at the deployed `/api/stripe/webhook` URL; the resulting **signing secret** (`whsec_…`) is config that lives in Stripe + Vercel env, NOT git. For local dev, `stripe listen --forward-to localhost:3000/api/stripe/webhook` prints its own `whsec_…`. | Register endpoint (or use CLI for local); set `STRIPE_WEBHOOK_SECRET`. |
| OS-registered state | None — Vercel serverless; no OS schedulers this phase (reconciliation cron is Phase 8). | None. |
| Secrets/env vars | **NEW server-only env:** `STRIPE_SECRET_KEY` (test `sk_test_…`), `STRIPE_WEBHOOK_SECRET` (test `whsec_…`). Must be set in `.env.local` (dev) AND Vercel project env (deploy). NEVER `NEXT_PUBLIC_`. Note STATE.md SECURITY TODO: `.env.local.example` currently holds real secrets — keep new Stripe keys out of any tracked file. | Add to `.env.local` + Vercel env; add placeholder names (no values) to `.env.local.example`. |
| Build artifacts / installed packages | `stripe` not yet in `package.json` / `node_modules`. | `npm install stripe@^22.2`; commit lockfile. |

## Common Pitfalls

### Pitfall 1: Body parsed before verification
**What goes wrong:** Using `req.json()` (or any middleware that reads the body) yields a re-serialized payload; `constructEvent` throws "No signatures found matching the expected signature."
**Why it happens:** Habit from JSON APIs; Pages-Router muscle memory.
**How to avoid:** `const body = await req.text()` as the first line; pass that exact string to `constructEvent`. On App Router this needs no config.
**Warning signs:** Signature failures on *every* event including legitimate ones; the forged-POST gate would not distinguish this from correct behavior, so also test a **valid** CLI-forwarded event passes.

### Pitfall 2: Edge runtime silently chosen
**What goes wrong:** If `runtime` is omitted and the project defaults shift, or someone sets `edge`, Node `crypto` is unavailable and `constructEvent` (sync) breaks; you'd be forced into `constructEventAsync` + SubtleCrypto.
**How to avoid:** Explicit `export const runtime = "nodejs"` in the route file (CONTEXT lock). Assert it in a source-level test (grep the route for the literal).
**Warning signs:** "crypto is not defined" / SubtleCrypto errors at runtime.

### Pitfall 3: Success-URL treated as payment confirmation
**What goes wrong:** A client lands on `success_url` and code marks the transfer paid — spoofable by hitting the URL directly.
**How to avoid:** Success page is **display-only** (reads `wp_transfers.status`, never writes). The adversarial gate hits `success_url` directly and asserts `status` is still not `paid` until the webhook fires.
**Warning signs:** Any `update(... status:'paid')` outside the webhook file — caught by the grep gate.

### Pitfall 4: Dedup logged after processing
**What goes wrong:** If you flip `paid` first and insert the `webhook_events` row after, a crash between them loses the dedup key; Stripe retries → double processing (duplicate emails in Phase 4, double fee writes).
**How to avoid:** **Insert-first** (Pattern 2); only after a successful insert do you process; mark `outcome='processed'` last. The `paid` UPDATE's `WHERE status<>'paid'` is the backstop.
**Warning signs:** Replay gate produces two effects.

### Pitfall 5: Fee fetched from the wrong object / not yet available
**What goes wrong:** Reading `fee` off the PaymentIntent or Charge directly (it's on the **balance_transaction**), or fetching before the charge has settled into a balance transaction.
**How to avoid:** `expand: ['latest_charge.balance_transaction']`; read `balance_transaction.fee`. For `checkout.session.completed` on a card payment, the charge + balance transaction exist by the time the event fires. Guard for `null` (record fee as null and let Phase 8 reconciliation backfill if absent).
**Warning signs:** `fee_cents` null or `balance_transaction` is a string id (not expanded).

### Pitfall 6: `metadata.transfer_id` missing / unresolvable
**What goes wrong:** Webhook receives an event with no `transfer_id`, or one that doesn't match a `wp_transfers` row → the `paid` UPDATE silently affects 0 rows.
**How to avoid:** This phase **creates a real `wp_transfers` row first** (D-03) so the id resolves. Log `outcome='no_matching_transfer'` (don't 500 — return 200 so Stripe stops retrying, and let Phase 8 reconciliation flag it). Check the UPDATE's affected-row count.
**Warning signs:** 200 responses with no state change.

### Pitfall 7: Wrong Supabase project / Stripe secret leak
**What goes wrong:** Migration applied to Kalvia, or secret keys committed.
**How to avoid:** Migration header carries the Balkanity-ref / never-Kalvia guardrail (Phase 1/2 pattern, asserted in a source-level test). Apply via Supabase CLI/Management token (NOT MCP — MCP hits Kalvia). Keys server-only; the `import "server-only"` guard on the Stripe client factory makes a client import a build failure.
**Warning signs:** Any tool reporting ref `utyatpadtibqqswsfvtr`; `next build` succeeding with a client import of the Stripe client.

## Code Examples

### Server-only Stripe client factory (pinned API version)
```typescript
// platform/payments/stripe.ts
import "server-only"; // build fails if a client component imports this (mirrors admin.ts)
// Source: docs.stripe.com/sdks/versioning  +  CLAUDE.md (apiVersion pin)
import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-05-27.dahlia", // D-02 lock; matches stripe-node v22 typings
    });
  }
  return _stripe;
}
```
> Note: the `apiVersion` string is type-checked against the installed `stripe-node` v22 typings. If TS rejects `'2026-05-27.dahlia'`, that signals a version mismatch — verify `npm view stripe version` is the 22.2.x line that ships those typings (a planner-time check).

### Adversarial gate: forged POST returns 400, zero state change (test sketch)
```bash
# Unsigned / bad-signature POST → 400, no row written
curl -i -X POST http://localhost:3000/api/stripe/webhook \
  -H "content-type: application/json" \
  -H "stripe-signature: t=1,v1=deadbeef" \
  -d '{"id":"evt_forged","type":"checkout.session.completed"}'
# expect: HTTP/1.1 400 ; assert no webhook_events row for evt_forged ; assert transfer still 'requested'
```

### Adversarial gate: replay → exactly one effect (Stripe CLI)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints whsec_… for STRIPE_WEBHOOK_SECRET
# trigger a real signed event, capture its evt_… id, then replay it:
stripe events resend evt_XXXXXXXX
# assert: webhook_events has exactly one row for evt_XXXXXXXX (UNIQUE) ;
#         wp_transfers flipped to paid exactly once (paid_at unchanged on replay)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router: `export const config = { api: { bodyParser:false } }` + `micro`/`buffer(req)` | App Router: `await req.text()` (no config) | Next 13+ App Router | Simpler, fewer deps; the locked pattern for this phase. |
| `constructEvent` everywhere | `constructEventAsync` + `createSubtleCryptoProvider` **only on Edge/WebCrypto** | stripe-node Edge support | On `nodejs` runtime, stay with sync `constructEvent`. |
| Three sequential retrieves (PI → charge → balance txn) for the fee | Single `expand: ['latest_charge.balance_transaction']` | Long-standing expand support | One API call (satisfies D-05). |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs` (use `@supabase/ssr` — not relevant to the webhook, but the carried-forward lock).
- Dashboard Payment Links for this use case (forbidden by brief).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `wp_transfers` is a **module** table → `wp_` prefix; `webhook_events` is **platform-generic** → unprefixed (per PLAT-01 seam convention seen in 0001/0002). | Project Structure / schema | Low — naming only; D-03 explicitly names the table `wp_transfers`. The `webhook_events` placement is the planner's call; both choices keep RLS posture identical. |
| A2 | The `checkout.session.completed` event is the trigger to flip `paid` (vs `payment_intent.succeeded`). | Webhook handler | Low — `checkout.session.completed` carries the session `metadata.transfer_id` directly and is the standard one-time-payment fulfilment event. Planner could additionally handle `async_payment_succeeded` if non-card methods were enabled (not in scope; cards only for the pilot). |
| A3 | On a card Checkout payment, the `balance_transaction` exists when `checkout.session.completed` fires, so `fee_cents` is populatable synchronously. | Fee recording (D-05) | Medium — for some payment methods the balance transaction is delayed. Mitigation already noted: store `null` and let Phase 8 reconciliation backfill. Pilot is card-only, so risk is low. |
| A4 | A minimal Checkout-session **trigger** (server action or test route) + minimal display-only success/cancel pages are acceptable this phase (no booking UI). | Project Structure | Low — CONTEXT explicitly grants "minimal/test pages are fine" under Claude's Discretion. |
| A5 | slopcheck unavailability is acceptable because `stripe` is the official, project-locked SDK with a clean (no-postinstall) install. | Package Legitimacy Audit | Low — `stripe` is unambiguously the canonical SDK; planner re-verifies `npm view` at install. |

## Open Questions

1. **Checkout-session trigger surface this phase (server action vs route handler vs throwaway script)?**
   - What we know: CONTEXT permits minimal/test surfaces; Phase 4 owns the real booking form that calls it.
   - What's unclear: whether to build the create-session helper as a reusable `platform/payments/checkout.ts` (recommended, since Phase 4 will consume it) plus a thin test trigger, or an inline throwaway.
   - Recommendation: build `platform/payments/checkout.ts` (reusable, platform-generic) + a minimal trigger; Phase 4 then just wires the form to it. Higher reuse, low extra cost.

2. **Does TS accept the `apiVersion: '2026-05-27.dahlia'` literal against stripe-node 22.2.1 typings?**
   - What we know: CLAUDE.md asserts v22 supports the dahlia line; `2026-05-27.dahlia` is the latest API version.
   - What's unclear: exact literal-type match in the installed `.d.ts` (occasionally the typings lag by a patch).
   - Recommendation: a planner-time `tsc` check after install; if the literal is rejected, pin to the exact version the typings expose (and record it) rather than `as any`-casting.

3. **`payment_intent_data.metadata.transfer_id` in addition to session `metadata`?**
   - What we know: both are available; the webhook can read either.
   - Recommendation: set `metadata.transfer_id` on the session (read directly off `checkout.session.completed`) AND mirror onto `payment_intent_data.metadata` so the id is also recoverable from PaymentIntent-centric reconciliation in Phase 8. Cheap belt-and-braces.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `stripe` npm package | Checkout + webhook verify + fee | ✗ (not installed) | target `^22.2` (22.2.1 verified) | none — `npm install stripe@^22.2` is a required step |
| Stripe CLI | Adversarial replay/forward gates (D-02) | unknown (verify at plan time: `stripe --version`) | — | If absent: `brew install stripe/stripe-cli/stripe` (macOS) or download binary; Dashboard "Send test webhook" is a weaker fallback for the replay gate |
| Stripe TEST keys (`sk_test_…`, `whsec_…`) | All gates run in TEST mode (D-02) | ✗ (not in `.env.local` yet) | — | none — must be obtained from the Stripe Dashboard (test mode) / `stripe listen` |
| Supabase CLI + Management token | Apply migration 0003 to Balkanity | ✓ (per STATE.md handoff; authed) | — | Management API via curl (per memory) — NOT MCP (MCP hits Kalvia) |
| `@supabase/supabase-js`, `zod`, `server-only` | service-role write, validation | ✓ | installed | — |

**Missing dependencies with no fallback:**
- `stripe` npm package — install step required.
- Stripe TEST keys — obtain from Dashboard; without them no gate can run.

**Missing dependencies with fallback:**
- Stripe CLI — installable; Dashboard test-webhook is a partial substitute (weaker for replay-by-same-event-id).

## Validation Architecture

> `workflow.nyquist_validation` is `true` (config.json) → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` (jsdom) for unit/source-level; Playwright `^1.61` for e2e (chromium) |
| Config file | `vitest.config.ts` (includes `app/**/*.test.{ts,tsx}`, `platform/**`, `modules/**`); `setupFiles: ./vitest.setup.ts` |
| Quick run command | `npm run test` (`vitest run`) |
| Full suite command | `npm run test && npm run typecheck && npm run lint` |
| e2e command | `npm run test:e2e` (Playwright) — for the live webhook/forged-POST flow |

> Established precedent (Phase 2): **source-level contract tests** read the migration SQL text and assert the security shape (`platform/rls/supply-rls.test.ts`). Reuse this exact pattern for the `webhook_events` / `wp_transfers` RLS + UNIQUE + grep-single-writer contracts. Live-DB assertions run at the BLOCKING push-verification checkpoint + e2e.

### Phase Requirements → Test Map (covers the 5 ROADMAP success criteria + 2 adversarial gates)
| Req / Criterion | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC1 / BOOK-05 | `paid` written in exactly one code path (grep gate; no other `status='paid'` writer) | source-level (grep assertion) | `vitest run platform/payments/single-writer.test.ts` | ❌ Wave 0 |
| SC1 | Webhook route declares `runtime='nodejs'` and reads `req.text()` (not `.json()`) | source-level | `vitest run app/api/stripe/webhook/route.contract.test.ts` | ❌ Wave 0 |
| SC2 (gate) | Forged/unsigned POST → 400 + zero state change | e2e / route unit (mock constructEvent throw) | `vitest run` (unit) + `playwright test tests/e2e/webhook-forged.spec.ts` | ❌ Wave 0 |
| SC2 (gate) | Spoofed `success_url` request never writes `paid` (success page display-only) | source-level + e2e | grep success page for no `paid` write; `playwright test tests/e2e/success-spoof.spec.ts` | ❌ Wave 0 |
| SC3 (gate) | Replayed `event.id` → exactly one effect (UNIQUE + insert-first) | live/e2e via Stripe CLI | `stripe events resend evt_…` then assert one `webhook_events` row + `paid_at` unchanged | ❌ Wave 0 (manual/CLI harness) |
| SC3 | `webhook_events.event_id` UNIQUE constraint present | source-level (migration text) | `vitest run platform/rls/payments-schema.test.ts` | ❌ Wave 0 |
| SC4 / HLTH-01 | `webhook_events` records idempotency key + signature_result + outcome | source-level (columns present) + unit (insert payload) | `vitest run platform/rls/payments-schema.test.ts` | ❌ Wave 0 |
| SC4 | Both `webhook_events` & `wp_transfers` RLS-enabled, admin-read, NO write policy | source-level (Phase 2 pattern) | `vitest run platform/rls/payments-schema.test.ts` | ❌ Wave 0 |
| SC5 | Code-created Session carries `metadata.transfer_id`, EUR, integer `unit_amount` (no Payment Link) | unit (mock Stripe; assert create args) | `vitest run platform/payments/checkout.test.ts` | ❌ Wave 0 |
| SC5 / D-05 | Actual fee recorded from balance_transaction in integer cents | unit (mock expanded PI; assert `fee_cents=bt.fee`) | `vitest run platform/payments/fee.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test` (quick vitest) + `npm run typecheck`.
- **Per wave merge:** `npm run test && npm run typecheck && npm run lint`.
- **Phase gate:** full suite green + the **three adversarial gates** demonstrated via the Stripe CLI in TEST mode (forged → 400, replay → one effect, success-spoof → no `paid`) + grep single-writer gate, all before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `platform/payments/single-writer.test.ts` — grep gate: exactly one `status='paid'` writer (SC1).
- [ ] `app/api/stripe/webhook/route.contract.test.ts` — asserts `runtime='nodejs'` + `req.text()` usage (SC1/Pitfall 1,2).
- [ ] `platform/rls/payments-schema.test.ts` — source-level contract for `0003`: UNIQUE `event_id`, required columns, RLS-enabled + admin-read + NO write policy, Balkanity-ref guardrail (mirrors `supply-rls.test.ts`).
- [ ] `platform/payments/checkout.test.ts` — Stripe `sessions.create` called with EUR + integer `unit_amount` + `metadata.transfer_id`, mode `payment` (SC5).
- [ ] `platform/payments/fee.test.ts` — `fee_cents` derived from expanded `latest_charge.balance_transaction.fee` (D-05).
- [ ] `tests/e2e/webhook-forged.spec.ts` + `tests/e2e/success-spoof.spec.ts` — the two HTTP adversarial gates (SC2).
- [ ] CLI replay harness (documented runbook, not a unit test) — `stripe listen` + `stripe events resend` for SC3.
- [ ] Framework install: none needed (Vitest + Playwright already configured); `npm install stripe@^22.2`.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` (config.json) → section required.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | No new user auth; the webhook authenticates **the sender** via HMAC signature (`constructEvent`), not a user. |
| V3 Session Management | no | Webhook is stateless; no session. |
| V4 Access Control | yes | `paid` write only via service-role in the verified webhook; `webhook_events`/`wp_transfers` RLS admin-read, no write policy (writes via service-role only) — data-layer enforcement, mirrors Phase 2. |
| V5 Input Validation | yes | `zod`-validate create-session input (transfer_id → real row); treat the webhook payload as untrusted until `constructEvent` succeeds, then read only expected fields. |
| V6 Cryptography | yes | **Never hand-roll** signature verification — `stripe.webhooks.constructEvent` (HMAC-SHA256 + timestamp tolerance + constant-time compare). |
| V7 Error Handling/Logging | yes | `webhook_events` logs signature_result + outcome for every event (HLTH-01); return 400 on bad signature with no internal detail leak. |
| V9 Communications | yes | Stripe→app over HTTPS (Vercel TLS); secrets server-only. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/unsigned webhook flips `paid` | Spoofing | `constructEvent` HMAC verification; forged → 400, zero state change (adversarial gate SC2). |
| Spoofed `success_url` confirms payment | Spoofing / Tampering | Success page display-only; `paid` never set off a redirect (BOOK-05; adversarial gate SC2). |
| Replay of a captured event → double effect | Tampering / Repudiation | UNIQUE `event_id` + insert-first dedup; `paid` UPDATE `WHERE status<>'paid'` backstop (gate SC3). |
| Secret-key / service-role leak to client | Information Disclosure / EoP | `import "server-only"` on Stripe client + `admin.ts`; never `NEXT_PUBLIC_`; build fails on client import. |
| Webhook timestamp-tolerance replay window | Tampering | Handled inside `constructEvent` (default tolerance); don't widen it. |
| Wrong project (Kalvia) migration | Tampering (wrong env) | Balkanity-ref guardrail in migration header + source-level test; apply via CLI/Management token, not MCP. |
| Money rounding/precision tampering | Tampering | Integer cents end-to-end; `unit_amount` passed directly; fee from balance_transaction (no float math). |

## Sources

### Primary (HIGH confidence)
- `docs.stripe.com/webhooks` (?lang=node) — App Router raw-body (`req.text()`), no `bodyParser` config; `constructEvent` vs `constructEventAsync`; `nodejs` runtime recommended; log event ids to dedup. (WebFetch + WebSearch, 2026-06-18)
- `docs.stripe.com/api/balance_transactions` + `/api/payment_intents/retrieve` — `balance_transaction.fee` is integer minor units; `net = amount - fee`; `expand: ['latest_charge.balance_transaction']` retrieves in one call. (WebFetch, 2026-06-18)
- `docs.stripe.com/api/checkout/sessions/create` — minimal EUR `price_data` (`currency`,`unit_amount`,`product_data.name`), `metadata`, `payment_intent_data.metadata`, `session.url` returned for server redirect. (WebFetch, 2026-06-18)
- npm registry (`npm view stripe …`) — `stripe@22.2.1` (published 2026-06-17), `engines.node >=18`, **no postinstall**, repo `github.com/stripe/stripe-node`. (Bash, 2026-06-18)
- `CLAUDE.md` — Verified Provider Facts (Stripe fees, API version `2026-05-27.dahlia`, stripe-node v22), Integration Patterns #3/#4, "What NOT to Use", Version Compatibility. (project file)
- Repo files: `platform/supabase/admin.ts`, `platform/money/commission.ts`, `supabase/migrations/0001`/`0002`, `platform/rls/supply-rls.test.ts`, `vitest.config.ts`, `package.json`, `.planning/config.json`. (Read, 2026-06-18)

### Secondary (MEDIUM confidence)
- `dev.to/whoffagents` Stripe webhook security/idempotency series; `bigbinary.com` webhook handling — insert-first dedup, UNIQUE event id, idempotency-key usage (corroborate the official-docs dedup guidance). (WebSearch, 2026-06-18)
- `supabase.com/docs/guides/functions/examples/stripe-webhooks` — Stripe-on-Supabase webhook shape (cross-reference). (WebSearch, 2026-06-18)

### Tertiary (LOW confidence)
- None relied upon; all load-bearing claims confirmed against official Stripe docs or the repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `stripe@22.2.1` verified on npm; only one new dep; rest already installed.
- Architecture (raw body, idempotency, fee, checkout): HIGH — every pattern confirmed against official Stripe docs + project locks; reuses proven Phase 2 RLS/service-role/source-level-test patterns.
- Pitfalls: HIGH — drawn from official docs + CLAUDE.md "What NOT to Use" + repo conventions.
- One MEDIUM item (A3): balance_transaction availability timing for non-card methods — mitigated (card-only pilot + null-then-backfill).

**Research date:** 2026-06-18
**Valid until:** ~2026-07-18 (stable APIs; re-check `stripe` version and that `2026-05-27.dahlia` is still current before live cutover).

## RESEARCH COMPLETE

**Phase:** 3 - payments-trust-spine
**Confidence:** HIGH

### Key Findings
- On the locked **`nodejs` runtime**, Next 16 App Router exposes the raw body via `await req.text()` with **no config** — use **synchronous `constructEvent`** (async/SubtleCrypto is Edge-only). This is the exact pattern the forged-POST gate verifies.
- **Insert-first into `webhook_events` with UNIQUE `event_id` + `ON CONFLICT DO NOTHING`** delivers BOTH the HLTH-01 audit row AND race-safe idempotency in one step (mirrors Phase 2's `23505` slug pattern); `paid` UPDATE carries `WHERE status<>'paid'` as a backstop.
- **Actual fee (D-05)** = `balance_transaction.fee` (integer cents), fetched in **one** call via `expand: ['latest_charge.balance_transaction']`; refunds don't return it, so record it now.
- **`stripe@22.2.1`** verified on npm (2026-06-17, no postinstall, official `stripe-node`); only new dep. Pin `apiVersion '2026-05-27.dahlia'` in a `server-only` client factory.
- Reuse established repo patterns: **service-role `paid` write** (`admin.ts`), **source-level migration contract tests** (`supply-rls.test.ts`), **admin-read/no-write RLS**, **integer cents** (`commission.ts` stays display-estimate only), **Balkanity-ref guardrail** in `0003`.

### File Created
`.planning/phases/03-payments-trust-spine/03-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | `stripe@22.2.1` verified on npm; single new dep; rest installed. |
| Architecture | HIGH | Raw-body, idempotency, fee, checkout all confirmed against official Stripe docs + project locks; reuses proven Phase 2 patterns. |
| Pitfalls | HIGH | From official docs + CLAUDE.md "What NOT to Use" + repo conventions. |

### Open Questions
1. Checkout-trigger surface this phase (recommend reusable `platform/payments/checkout.ts` + minimal trigger).
2. TS literal-type acceptance of `apiVersion '2026-05-27.dahlia'` vs installed v22 typings (planner-time `tsc` check).
3. Whether to mirror `transfer_id` onto `payment_intent_data.metadata` for Phase 8 reconciliation (recommended).

### Ready for Planning
Research complete. Planner can now create PLAN.md files (migration 0003 is FLAGGED — schema sign-off before apply; all three adversarial gates run in Stripe TEST mode).
