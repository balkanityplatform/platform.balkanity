# Phase 3: Payments Trust Spine - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 9 (to create/modify)
**Analogs found:** 9 / 9 (every file has a strong in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0003_payments_spine.sql` | migration | transform (DDL) | `supabase/migrations/0002_supply_tables.sql` | exact |
| `platform/payments/stripe.ts` | config / client-factory | request-response | `platform/supabase/admin.ts` | exact (server-only factory) |
| `platform/payments/checkout.ts` | service | request-response | `app/admin/destinations/actions.ts` (zod + service-role write) + Research Pattern 5 | role-match |
| `platform/payments/fee.ts` | service / utility | transform | `platform/money/commission.ts` (integer-cents) + Research Pattern 4 | role-match |
| `app/api/stripe/webhook/route.ts` | route (API) | event-driven | `app/auth/confirm/route.ts` (route handler + `runtime='nodejs'`) | role-match (data flow differs: webhook vs auth-link) |
| `app/(checkout test trigger)` + `app/pay/success`,`app/pay/cancel` | route/action + component | request-response | `app/admin/destinations/actions.ts` (server action) / `app/auth/confirm/route.ts` | role-match |
| `platform/rls/payments-schema.test.ts` | test | (source-level) | `platform/rls/supply-rls.test.ts` | exact |
| `platform/payments/checkout.test.ts` + `fee.test.ts` | test | (unit, mock Stripe) | `platform/money/commission.test.ts` (dir exists) / `supply-rls.test.ts` | role-match |
| `platform/payments/single-writer.test.ts` + `app/api/stripe/webhook/route.contract.test.ts` | test | (source-level grep) | `platform/rls/supply-rls.test.ts` (reads source text) | exact |

> Seam (PLAT-01): `wp_transfers` = module table → **`wp_` prefix**. `webhook_events` = platform-generic → **UNPREFIXED** (like `companies`). Stripe client/checkout/fee helpers are platform-generic → `platform/payments/`.

## Pattern Assignments

### `platform/payments/stripe.ts` (config, server-only client factory)

**Analog:** `platform/supabase/admin.ts`

**Server-only boundary + factory shape** (`admin.ts` lines 1, 19-32) — copy this structure exactly:
```typescript
import "server-only"; // FIRST line — next build FAILS if a client component imports this
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only secret, never NEXT_PUBLIC_
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```
**Apply to Stripe factory** (Research Code Examples + Q2): `import "server-only"` first line; read `process.env.STRIPE_SECRET_KEY!`; pin `apiVersion: "2026-05-27.dahlia"`. Lazy-memoize OR new-per-call (admin.ts uses new-per-call; server.ts comments warn against module-global caching under Vercel Fluid-compute — prefer new-per-call or guard the memo). Planner-time `tsc` check that the `apiVersion` literal is accepted by installed `stripe@22.2.x` typings (Research Q2).

---

### `app/api/stripe/webhook/route.ts` (route, event-driven — the ONLY `paid` writer)

**Analog:** `app/auth/confirm/route.ts` (route-handler conventions) + `platform/supabase/admin.ts` (service-role write) + `app/admin/destinations/actions.ts` (23505 conflict precedent → reused as ON CONFLICT dedup).

**Route-handler imports + runtime lock** (`confirm/route.ts` lines 23-27):
```typescript
import { type NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";   // CONTEXT D-02 lock — never Edge for the webhook
```
**Raw-body + signature verify** (Research Pattern 1 — NOT in repo yet, this is the new contract):
```typescript
const body = await req.text();                       // RAW bytes — NOT req.json()
const sig = req.headers.get("stripe-signature");
if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });
try { event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!); }
catch { return NextResponse.json({ error: "invalid signature" }, { status: 400 }); } // forged → 400, zero state change
```
**Insert-first dedup** — reuse the Phase-2 `23505`/conflict idea (`destinations/actions.ts` line 38 `UNIQUE_VIOLATION = "23505"`), expressed as `ON CONFLICT DO NOTHING` via the service-role client (Research Pattern 2):
```typescript
const admin = createAdminClient(); // platform/supabase/admin.ts — bypasses RLS
const { data: inserted } = await admin.from("webhook_events")
  .insert({ event_id: event.id, type: event.type, signature_result: "valid", outcome: "received" })
  .select("event_id").maybeSingle();
if (!inserted) return NextResponse.json({ received: true, duplicate: true }); // replay → exactly one effect
```
**Single-writer `paid` UPDATE** (Research Pattern 3) — the ONLY `status='paid'` write in the repo:
```typescript
await admin.from("wp_transfers")
  .update({ status: "paid", paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntentId, fee_cents: feeCents })
  .eq("id", transferId).neq("status", "paid"); // backstop idempotency
```
> Authorization model differs from `confirm/route.ts`: the webhook authenticates the SENDER via HMAC (`constructEvent`), not a user session. Do NOT use the `@supabase/ssr` server client here — use `createAdminClient()` (service-role).

---

### `platform/payments/checkout.ts` (service, request-response)

**Analog:** `app/admin/destinations/actions.ts`

**zod trust-boundary validation + service-role write** (`destinations/actions.ts` lines 24-29, 43-52, 91-111): validate `transfer_id` (uuid) resolves to a real `wp_transfers` row before calling Stripe. Reuse `import { z } from "zod"` and the `safeParse` → generic-error pattern.
```typescript
import { z } from "zod";
import { createAdminClient } from "@/platform/supabase/admin";
// transfer_id: z.string().uuid(); resolve to a real wp_transfers row (D-03)
```
**Checkout Session creation** (Research Pattern 5 — new): `mode:"payment"`, `currency:"eur"` (D-01), `unit_amount: amount_cents` (integer minor units — see fee.ts / commission.ts convention, NO floats), `metadata:{ transfer_id }` (mirror onto `payment_intent_data.metadata` per Research Q3), `success_url`/`cancel_url` → `/pay/success?t=…`. Store `session.id` as `stripe_checkout_session_id`. Server 303-redirect to `session.url` (CLAUDE.md lock — no `@stripe/stripe-js`).

---

### `platform/payments/fee.ts` (service/utility, transform)

**Analog:** `platform/money/commission.ts`

**Integer-cents convention** (`commission.ts` lines 6-7, 13-15, 31-32) — copy: integer cents in, integer cents out, no floats; pure functions; `fmtEur` for display.
```typescript
export const fmtEur = (cents: number): string => (cents / 100).toFixed(2);
```
**Actual fee from balance transaction** (Research Pattern 4 — D-05, the recorded truth, NOT `estStripeFeeCents`):
```typescript
const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
  expand: ["latest_charge.balance_transaction"],
});
const bt = (pi.latest_charge as Stripe.Charge).balance_transaction as Stripe.BalanceTransaction;
const feeCents = bt.fee; // integer cents; guard for null (Pitfall 5) → record null, Phase 8 backfills
```
> `commission.ts` `estStripeFeeCents` (1.5% + €0.25) stays the DISPLAY estimate pre-payment. fee.ts produces the RECORDED truth post-payment. Do not conflate.

---

### `supabase/migrations/0003_payments_spine.sql` (migration — FLAGGED, schema sign-off before apply)

**Analog:** `supabase/migrations/0002_supply_tables.sql`

**Header guardrail** (`0002` lines 1-3) — copy verbatim shape (asserted by the schema test):
```sql
-- 0003_payments_spine.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
```
**Money columns** (`0002` lines 73-74 integer-cents + CHECK convention): `amount_cents integer not null check (amount_cents >= 0)`, `currency text`, `fee_cents integer`, `paid_at timestamptz`, `status text` (`paid` target), `stripe_checkout_session_id`, `stripe_payment_intent_id`, FK to `destinations` (so `metadata.transfer_id` resolves).
**RLS posture** (`0002` lines 99-122): `enable row level security` on BOTH `wp_transfers` and `webhook_events`; one `for select to authenticated using (public.is_admin())` admin-read policy each; **NO insert/update/delete policy** (writes via service-role only). Reuse the existing `public.is_admin()` helper from `0002` (lines 22-33) — do NOT redefine it.
**UNIQUE idempotency key:** mirror the `destinations_slug_key` unique-index pattern (`0002` line 83) → `create unique index webhook_events_event_id_key on public.webhook_events (event_id)` (or `unique` column). `webhook_events` columns: `event_id` (UNIQUE), `type`, `signature_result`, `outcome`, plus payload/timestamp at discretion (HLTH-01).

---

### `platform/rls/payments-schema.test.ts` (test, source-level migration contract)

**Analog:** `platform/rls/supply-rls.test.ts` — copy the whole structure.

**Read-source + strip-comments harness** (`supply-rls.test.ts` lines 9-29):
```typescript
const MIGRATION = readFileSync(join(process.cwd(), "supabase/migrations/0003_payments_spine.sql"), "utf8");
const CODE = MIGRATION.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
```
**Assertions to mirror** (lines 31-89): RLS enabled on both tables; exactly the admin-read SELECT policies; `not.toMatch(/for insert|for update|for delete/)` (no write policy — load-bearing); UNIQUE `event_id` index present; integer-cents CHECK present; Balkanity-ref guardrail (`expect(MIGRATION).toContain("Kalvia (utyatpadtibqqswsfvtr)")` and `"qyhdogajtmnvxphrslwm"`).

---

### `platform/payments/single-writer.test.ts` + `route.contract.test.ts` (source-level grep gates)

**Analog:** `platform/rls/supply-rls.test.ts` (reads source text, asserts via regex).

- single-writer: read source across `app/`, `platform/`, `modules/`; assert exactly one file contains a `status: "paid"` / `status='paid'` write (SC1 grep gate).
- route.contract: read `app/api/stripe/webhook/route.ts`; assert `export const runtime = "nodejs"` literal present AND `req.text()` used AND `req.json()` absent (Pitfall 1/2).

---

### `platform/payments/checkout.test.ts` + `fee.test.ts` (unit, mock Stripe)

**Analog:** pure-function tests under `platform/money/` + the vitest style in `supply-rls.test.ts`.
- checkout: mock `stripe.checkout.sessions.create`; assert called with `currency:"eur"`, integer `unit_amount`, `mode:"payment"`, `metadata.transfer_id` (SC5).
- fee: mock expanded PI; assert `fee_cents === bt.fee` (D-05).

## Shared Patterns

### Server-only secret boundary
**Source:** `platform/supabase/admin.ts` line 1 (`import "server-only"` FIRST line)
**Apply to:** `platform/payments/stripe.ts`, `checkout.ts`, `fee.ts`, the webhook route — any module touching `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/service-role. Never `NEXT_PUBLIC_`. Build failure on client import is the guarantee (mirrors `admin.ts` SC-4 / threat T-02-01).

### Service-role write (RLS-bypass) for the `paid` path
**Source:** `platform/supabase/admin.ts` `createAdminClient()`
**Apply to:** the webhook's `webhook_events` insert + `wp_transfers` `paid` UPDATE. RLS tables carry admin-read SELECT only and NO write policy — every write goes through service-role (Phase 2 lock).

### Integer cents end-to-end (no floats)
**Source:** `platform/money/commission.ts` lines 6-7, 13-15
**Apply to:** `wp_transfers.amount_cents`/`fee_cents`, Stripe `unit_amount`, `fee.ts`, the `0003` CHECK constraints. `unit_amount` passed directly (no ×100 at the boundary).

### Conflict-as-authority idempotency
**Source:** `app/admin/destinations/actions.ts` line 38 (`UNIQUE_VIOLATION = "23505"`) + `0002` `destinations_slug_key`
**Apply to:** `webhook_events.event_id` UNIQUE + insert-first `ON CONFLICT DO NOTHING` (replay → exactly one effect). DB constraint is the race-safe authority, not app logic.

### FLAGGED migration + Balkanity-ref guardrail
**Source:** `supabase/migrations/0002_supply_tables.sql` lines 1-3; asserted by `supply-rls.test.ts` lines 85-88
**Apply to:** `0003` header + `payments-schema.test.ts`. Apply via Supabase CLI/Management token (NOT MCP — MCP hits Kalvia). Human sign-off before apply.

### Route-handler shape + `runtime='nodejs'`
**Source:** `app/auth/confirm/route.ts` lines 23-29
**Apply to:** the webhook route (NextRequest/NextResponse imports; explicit `export const runtime = "nodejs"`).

### zod at the trust boundary
**Source:** `app/admin/destinations/actions.ts` lines 43-52, 91-111 (`safeParse` → generic errors)
**Apply to:** `checkout.ts` create-session input (`transfer_id` uuid → resolve to real row); narrow shape-checks on the verified event payload.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every Phase-3 file maps to an existing repo analog. The only genuinely NEW mechanics (raw-body `constructEvent`, balance-transaction `expand`, Checkout-session create) have no prior code path and come from Research Patterns 1/4/5 — the planner uses those excerpts directly. `app/api/` currently does not exist (must be created); `app/auth/confirm/route.ts` is the route-handler convention analog. |

## Metadata

**Analog search scope:** `platform/` (supabase, money, rls, slug, auth), `app/` (api, auth, admin/*/actions), `supabase/migrations/`
**Files scanned:** `admin.ts`, `server.ts`, `commission.ts`, `0001`/`0002` migrations, `supply-rls.test.ts`, `destinations/actions.ts`, `auth/confirm/route.ts`, `package.json`
**Pattern extraction date:** 2026-06-18
