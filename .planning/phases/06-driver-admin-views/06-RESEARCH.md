# Phase 6: Driver & Admin Views - Research

**Researched:** 2026-06-19
**Domain:** Next.js 16 App Router UI surfaces consuming a locked Supabase RLS/RPC data layer (driver PWA claim/run + admin transfers console + manual Stripe refund)
**Confidence:** HIGH

## Summary

Phase 6 is a **pure consumption-and-wiring phase over a locked data layer** — it builds the driver and admin *surfaces* on top of the Phase 5 claim machinery (`wp_pool()`, `claim_transfer()`, the claiming-driver RLS) and the existing payments seam (`stripe.ts`, `fee.ts`). The design system, auth gate, i18n, lifecycle map, and claim wrapper already exist and are battle-tested; the UI-SPEC already locks every component, token, and copy string. There is essentially **no new framework research required** — the stack is fully locked and proven across five prior phases.

The single most consequential finding is an **architectural gap, not a stack question**: Phase 5 deliberately built a `wp_transfers` table with **no INSERT/UPDATE/DELETE policy whatsoever** (the "no-write-policy lock"). The *only* sanctioned write path that exists today is the `claim_transfer` SECURITY DEFINER RPC (paid→claimed) and the service-role webhook (→paid). Every other mutation this phase needs — **driver status-advance** (claimed→en_route→arrived→picked_up→completed) and **admin assign/reassign/release/cancel** — has **no write path yet**. The migration-0004 trigger explicitly states "actor legality is the Phase-6 app gate." This phase must therefore introduce those write paths, and the safest way that honours every locked invariant is **server-side mutations through the service-role client gated by an in-action `getCurrentRole()`/ownership check** (the established `actions.ts` pattern), NOT new RLS write policies (which would re-open surfaces Phase 5 closed) and NOT client-side writes.

**Primary recommendation:** Build two route trees — `app/driver/*` (warm light) and `app/admin/transfers/*` (slate) — each as a server-guarded `page.tsx` → client `*View.tsx` island mirroring `app/admin/drivers/`. Reads use the **anon cookie-bound client** (so RLS is exercised: driver sees pool via `wp_pool()` RPC + their own claimed rows; admin sees all via `wp_transfers_admin_read`). Writes use **Server Actions** (`"use server"`): the claim via the existing `claim.ts` (caller-auth, never service-role), and status-advance + all admin ops via **new service-role actions behind `getCurrentRole()` + an ownership/state guard**, relying on the migration-0004 trigger as the state-legality backstop. The refund is a **new server-only `platform/payments/refund.ts` hook** calling `stripe.refunds.create({ payment_intent, amount?, reason }, { idempotencyKey })` — verified against the pinned `stripe@22.2.1` typings. Pool "live" feel = refetch-on-focus + ~20–30s poll (D-01), never Realtime, never SW-cached.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Driver pool refresh & claim feedback**
- **D-01:** Pool stays current via **refetch-on-focus + a light interval poll** while open (NOT Supabase Realtime, NOT manual-only). Simplest approach satisfying SC1's "refreshes live" on the Supabase free tier; honours NetworkFirst (never SW-cached). Poll interval (≈20–30s) is planner discretion.
- **D-02:** On a **winning** claim, the driver lands on the **transfer detail** (full PII). The claim RPC returns the full row atomically (Phase 5 D-03) — no extra fetch to render detail.
- **D-03:** On a **lost** race, show a **neutral toast** ("Just claimed by another driver") and **auto-remove the card** from the pool. Graceful/expected, never an error state (consumes Phase 5's typed `ok=false, reason='already_claimed'`).

**Driver "My run" & status advance**
- **D-04:** Each run card carries an **inline single next-step 52px CTA** advancing the one next lifecycle edge in place (`claimed→en_route→arrived→picked_up→completed`). Advancing happens on the run card, not only on detail.
- **D-05:** Progress shown with the **existing read-only `LifecycleTimeline`** (compact) beside the next-step CTA. Timeline is display-only; the CTA drives the change.
- **D-06:** On reaching **completed**, the transfer **drops out of the active run** into a small **"Completed today" collapsed section**. Run stays ordered by arrival time (CLAIM-06); a driver may hold multiple active claims and cannot un-claim (CLAIM-04, Phase 5 D-05).

**Admin transfers list**
- **D-07:** Default landing sorts by **soonest arrival first**, with **"needs attention" rows pinned to top in coral**.
- **D-08:** Build for pilot: **status filter**, a **"needs attention" quick filter**, and **free-text search across guest name / flight no. / destination**. A **driver/company filter is DEFERRED**. Reuses `DataList` + slate-console pattern.
- **D-09:** **"Stuck" (coral) = unclaimed-near-arrival + arrived-not-picked-up.** Unclaimed is always coral; additionally coral when (a) `paid` + unclaimed and arrival approaching (within N hours), or (b) `status='arrived'` not advanced to `picked_up` after a while. Thresholds (N hours, arrived-stall window) are planner discretion — simple constants. **UI highlighting only** — alerts are Phase 8.

**Admin actions & manual refund**
- **D-10:** **Confirm dialog + reason note required** for **Cancel**, **Refund**, and **Reassign/Release** (audit trail). **Assign** stays a lighter **one-tap** action (no reason). Gate only these three.
- **D-11:** **Cancel and Refund are separate actions, with a refund shortcut.** A paid transfer can be cancelled WITHOUT a refund (prepaid/non-refundable default); cancelling a paid transfer *offers* an "also issue refund?" shortcut but **never auto-refunds**.
- **D-12:** **Manual refund supports full or partial** amounts — amount field pre-filled to full paid amount, editable down — and **always shows the "~EUR X processing fee is NOT recovered" disclosure** (reuse `platform/payments/fee.ts`). OPS-04 requires a **NEW server-side refund hook** (no refund code exists yet) calling `stripe.refunds.create`; MUST live in the platform payments layer (server-only), never client-side.

### Claude's Discretion
- Exact poll interval (D-01); concrete stuck-time thresholds (D-09); component naming/decomposition; driver pool **empty state** copy; admin **detail page layout**; whether reassign/assign share one driver-picker component. All planner/researcher territory provided D-01..D-12 hold.
- Offline behavior of the run beyond the NetworkFirst lock (no offline claim/advance — would conflict with the atomic-claim guarantee per CLAUDE.md "Stack Patterns by Variant").

### Deferred Ideas (OUT OF SCOPE)
- **Driver/company filter on the admin transfers list** — deferred for pilot (low volume); revisit if needed (D-08). Not a scope change.
- **Stuck-transfer ALERTS / reconciliation / email-cap gauge** — Phase 8. Phase 6 only highlights stuck rows in the list UI (D-09).
- **Notifications on claimed/arrived + admin booking alert** — Phase 7. Phase 6 builds the surfaces that emit lifecycle events but sends no email/in-app notification itself.
- **Per-driver hold cap / fairness throttle** — rejected in Phase 5 (D-05); re-open only as a later policy tweak.
- **Offline claim/advance (queued writes)** — out of scope; conflicts with the atomic-claim guarantee. Run stays NetworkFirst read-only offline at most.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLAIM-01 | Invited driver sees a limited-detail pool of `paid`, unclaimed transfers (date, arrival time, airport, zone — NOT address — flight no., fare, pax, luggage) | Consume `wp_pool()` via `.rpc("wp_pool")` on the **caller-auth** server client. The 9-column masked shape is already locked in migration-0005 (`id, status, arrival_at, airport, zone, flight_no, amount_cents, pax, luggage_count`). No new query design — the masked read structurally omits PII (Architectural Responsibility Map row 1). |
| CLAIM-04 | Driver may hold multiple active claimed transfers and cannot un-claim (only admin can release/reassign) | No hold-cap exists in `claim_transfer` (Phase 5 D-05) — multiple claims work for free. "Cannot un-claim" = **build no driver-facing release control**; only admin gets release/reassign (OPS-03). Driver writes are limited to forward status-advance edges. |
| CLAIM-05 | Driver advances status: claimed → en_route → arrived → picked_up → completed from "My run" | **GAP — no write path exists.** Needs a new driver status-advance Server Action. Next-edge resolved via `lifecycle.ts` `ALLOWED_TRANSITIONS`; the migration-0004 trigger is the DB state-legality backstop. See "Don't Hand-Roll" + "Pitfall 1". |
| CLAIM-06 | "My run" lists the driver's active claimed transfers ordered by arrival time | Read the driver's own rows (claiming-driver RLS `wp_transfers_claimed_driver_read`) filtered to active claimed states, `.order("arrival_at")`. `wp_transfers_arrival_at_idx` already backs this sort. |
| OPS-01 | Admin sees a transfers list with filter and search | Admin reads all rows via `wp_transfers_admin_read` (anon cookie-bound client). Filter (status) + search (name/flight/destination) is a **server-side query shape** — see "Pattern 3". |
| OPS-02 | Admin opens a transfer detail page (lifecycle, trip/payment details) | Server Component reads the single unmasked row + joined destination; renders `LifecycleTimeline` + trip/payment facts. |
| OPS-03 | Admin can assign, reassign, release, cancel a transfer | **GAP — no write path exists.** Four new admin Server Actions via service-role behind `getCurrentRole()==="admin"`, each respecting the trigger's state-legality. Assign/reassign set `driver_id`; release clears `driver_id` + reverts to `paid`; cancel sets `cancelled`. See "Pitfall 2". |
| OPS-04 | Admin can issue a manual Stripe refund from the detail page | **NEW server-only hook** `platform/payments/refund.ts` → `stripe.refunds.create({ payment_intent: <stripe_payment_intent_id>, amount?, reason }, { idempotencyKey })`. Full/partial (D-12). Always shows `fee.ts` non-recovered disclosure. Never sets `paid`; never client-side. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Masked pool read (pre-claim visibility) | Database (`wp_pool()` SECURITY DEFINER RPC) | Frontend Server (RSC calls `.rpc`) | PII boundary is *structural* in the DB — pool RPC physically omits PII columns. UI never masks; it only renders what the RPC returns (CLAIM-01/03). |
| Atomic claim (race resolution) | Database (`claim_transfer` RPC, one conditional UPDATE) | API/Server Action (thin `claim.ts` wrapper) | Concurrency correctness lives entirely in the DB. The server only invokes + branches on the typed result (CLAIM-02, proven Phase 5). |
| Post-claim PII reveal | Database (claiming-driver RLS + RPC `RETURNING *`) | Frontend Server (renders returned row) | Full row arrives in the claim RPC's return value (D-02) and via `wp_transfers_claimed_driver_read` RLS on subsequent reads. Never UI-gated. |
| Driver status-advance write | API/Server Action (service-role, owner+state gated) | Database (trigger = state-legality backstop) | **New.** Drivers have no RLS write policy; a gated server action is the only safe write path. The trigger guarantees legal edges even if the app slips. |
| Admin assign/reassign/release/cancel | API/Server Action (service-role, admin gated) | Database (trigger backstop) | **New.** Mirrors `app/admin/*/actions.ts`. Service-role bypasses RLS (no admin write policy exists), so the in-action `getCurrentRole()` check is the authz gate. |
| Manual Stripe refund | API/Server Action → server-only payments hook (`refund.ts`) | External (Stripe API) | **New.** Money-touching, secret-key path; must be server-only (`import "server-only"`). Never sets `paid`; idempotency-keyed. |
| Pool "live" refresh | Browser/Client (focus refetch + interval poll) | Frontend Server (the refetched RSC/route data) | D-01: polling client-side; data path stays NetworkFirst (never SW-cached). No Realtime socket. |
| Admin list filter/search/sort | Frontend Server (server-side query) | Browser/Client (filter chips, search box state) | Filter/search/sort computed against the DB read; client only holds the control state and triggers re-query. |

## Standard Stack

This phase introduces **zero new runtime dependencies**. Everything is already installed, locked, and proven across Phases 1–5. The "stack" here is the existing in-repo seam.

### Core (already installed — consume, do not add)
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------|---------|--------------|
| `next` | `16.2.9` | App Router pages + Server Actions for all mutations | Locked. Server Actions are the mutation primitive already used in every admin slice. |
| `react` | `19.2.7` | Client islands for pool polling + CTAs | Locked transitive dep. |
| `@supabase/ssr` | `0.12.0` | Cookie-bound anon client for RLS-exercising reads (`platform/supabase/server.ts`) | Locked. The caller-auth client is mandatory for `wp_pool()`/`claim_transfer` so `auth.uid()` resolves. |
| `@supabase/supabase-js` | `2.108.2` | Service-role client for admin/driver write actions (`platform/supabase/admin.ts`) | Locked. The only write tier for non-claim mutations (no RLS write policy exists). |
| `stripe` | `22.2.1` | `refunds.create` for the manual refund hook | Locked; `getStripe()` factory already exists in `platform/payments/stripe.ts`. |
| `zod` | `^4` (`4.4`) | Validate refund amount + reason + admin action inputs at the trust boundary | Locked; used in every existing action. |

### Supporting (in-repo primitives to reuse, not rebuild)
| Asset | Path | Purpose | When to Use |
|-------|------|---------|-------------|
| `claimTransfer()` | `platform/transfers/claim.ts` | Caller-auth claim wrapper, returns typed `{ok, reason, transfer}` | The driver "Claim" CTA calls this. NEVER reimplement the RPC call. |
| `ALLOWED_TRANSITIONS` / `canTransition` | `platform/transfers/lifecycle.ts` | Next-edge resolution for the driver advance CTA + app-layer guard | Resolve the single next state for the 52px CTA; pre-check before the write. |
| `getCurrentRole()` | `platform/auth/role.ts` | Server-side role gate (revalidates JWT) | Every `page.tsx` guard + every write action's authz gate. |
| `getStripe()` / `recordedFeeCents()` | `platform/payments/stripe.ts`, `fee.ts` | Stripe client + recorded-fee figure for the disclosure | The new refund hook + the D-12 fee disclosure. |
| `StatusDot`, `LifecycleTimeline`, `DataList`, `Card`, `Button`, `Select`, `TextField`, `Toggle`, `LanguageToggle` | `platform/ui/` | Design-system primitives | Compose all surfaces. UI-SPEC confirms only a **toast** + a **refund form** are genuinely new presentational pieces. |
| `getDict()` / `getLang()` | `platform/i18n/dictionary.ts` | Server-resolved EN/BG copy (no flash) | All new copy via dictionary keys (UI-SPEC lists every key). |
| `createAdminClient()` | `platform/supabase/admin.ts` | Service-role writes | Driver advance + admin ops write actions only. |
| `createClient()` (server) | `platform/supabase/server.ts` | Anon cookie-bound reads | Pool/run/admin-list/detail reads (exercises RLS). |

### Alternatives Considered (rejected)
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| Server Action service-role writes (gated) for status-advance & admin ops | New RLS write policies on `wp_transfers` | Phase 5 deliberately holds a **no-write-policy lock** (adversarially proven). Adding write policies re-opens the surface Phase 5 closed and complicates the PII boundary. Service-role-behind-app-gate is the established, lower-risk pattern (`app/admin/*/actions.ts`). |
| Server Action service-role for status-advance | A second SECURITY DEFINER RPC (`advance_transfer`) like `claim_transfer` | Viable and arguably more elegant (keeps writes in the DB, driver acts as caller-auth), BUT it is a **schema/RLS change requiring sign-off + a live migration to Balkanity** — heavier process, and CONTEXT explicitly says "do NOT design new schema; flag if missing." Recommend the service-role action for the pilot; flag the RPC as the cleaner long-term option in Open Questions. |
| Refetch-on-focus + poll (D-01) | Supabase Realtime `postgres_changes` | Explicitly rejected by D-01 (free-tier simplicity, NetworkFirst). Realtime also complicates RLS-masked pre-claim visibility. |
| Server 303-redirect for claim | Client `@stripe/stripe-js` | Not applicable here (claim is not a checkout); the claim returns the row directly (D-02). |

**Installation:** None. `npm install` is a no-op for this phase — all dependencies are present.

## Package Legitimacy Audit

> Not applicable in the strict sense — **this phase installs no external packages.** All dependencies (`next`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `stripe`, `zod`) were installed, audited, and slop-checked in Phases 1–5. No new registry surface is introduced.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| (none) | — | No new installs | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Runtime State Inventory

> This phase is **greenfield UI + new server actions** over an existing, live data layer. It is NOT a rename/refactor/migration. The relevant inventory is "what existing runtime state does this phase WRITE to?" — captured here because the writes touch live money and a live DB.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (live DB, Balkanity ref `qyhdogajtmnvxphrslwm`) | `wp_transfers` rows: this phase writes `status`, `driver_id` (advance/assign/reassign/release/cancel). The `claim_transfer` RPC + migration-0004 trigger are live. | New Server Actions write these via service-role; the trigger enforces legal transitions. **No schema change** — flag if any column is missing (none found: `status`, `driver_id`, `arrival_at`, `stripe_payment_intent_id`, `amount_cents`, `fee_cents` all exist). |
| Live service config (Stripe) | The manual refund calls the **live Stripe account** (`STRIPE_SECRET_KEY`). Refunds move real money during the pilot. | Refund hook must be idempotency-keyed (avoid double-refund on retry) and server-only. Test with Stripe CLI / test mode before real-money pilot. |
| OS-registered state | None — no cron/scheduler/OS registration in this phase (reconciliation is Phase 8). | None. |
| Secrets/env vars | Consumes existing `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`. No new secret introduced. | None — all already in Vercel env. (STATE.md notes a standing TODO to rotate the leaked `sbp_` token; out of this phase's scope but worth a flag.) |
| Build artifacts | None — no package rename, no compiled artifact. | None. |

## Architecture Patterns

### System Architecture Diagram

```
                          DRIVER PWA (warm light, app/driver/*)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  /driver (pool)  page.tsx [getCurrentRole()=='driver' guard]             │
  │     │  initial read: .rpc("wp_pool")  (caller-auth client → RLS)         │
  │     ▼                                                                     │
  │  PoolView.tsx (client island)                                            │
  │     ├─ focus-refetch + ~20-30s poll  ──► re-fetch wp_pool (NetworkFirst) │
  │     └─ [Claim] CTA ──► claimTransfer(id)  (Server Action → claim.ts)     │
  │            │                                                             │
  │            ├─ ok:true  → router.push(/driver/run/[id]) render from       │
  │            │             returned row (full PII, no extra fetch)  D-02   │
  │            └─ ok:false 'already_claimed' → neutral toast + drop card D-03│
  │                                                                          │
  │  /driver/run  My run  page.tsx                                          │
  │     read: own claimed rows (wp_transfers_claimed_driver_read RLS)        │
  │           filter active claimed states, .order(arrival_at)  CLAIM-06     │
  │     RunView.tsx: per card → LifecycleTimeline (read-only) + 52px CTA     │
  │          [advance] ──► advanceStatus(id)  (NEW Server Action)            │
  │              service-role UPDATE status=nextEdge  (trigger backstop)     │
  │              completed → moves card to "Completed today" section  D-06   │
  └─────────────────────────────────────────────────────────────────────────┘

                          ADMIN CONSOLE (slate, app/admin/transfers/*)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  /admin/transfers  page.tsx [getCurrentRole()=='admin' guard]           │
  │     read: ALL rows via wp_transfers_admin_read (anon cookie client)      │
  │           server-side filter(status)+search(name/flight/dest)+sort       │
  │     TransfersView.tsx: DataList, coral "needs attention" pinned top D-07 │
  │           (UI highlight only — no alerts)                                │
  │     │                                                                    │
  │     ▼ open row                                                           │
  │  /admin/transfers/[id]  detail  page.tsx                                │
  │     LifecycleTimeline + trip/payment facts                               │
  │     actions.ts (NEW Server Actions, service-role, getCurrentRole admin): │
  │       assign(id, driverId)         one-tap  D-10                         │
  │       reassign(id, driverId, reason)  confirm+reason  D-10               │
  │       release(id, reason)          → driver_id=null, status=paid  D-10   │
  │       cancel(id, reason)           → status=cancelled  D-11              │
  │       refund(id, amount, reason)   ──► platform/payments/refund.ts       │
  │                                          stripe.refunds.create(...)      │
  │                                          (NEVER sets paid) D-12 OPS-04   │
  └─────────────────────────────────────────────────────────────────────────┘

  Single `paid` writer remains the Stripe webhook (app/api/stripe/webhook). No
  path in this phase writes status='paid' — release reverts to 'paid' only via the
  trigger-legal claimed/.. → paid? NO: release goes claimed→paid is NOT a trigger
  edge — see Pitfall 2 (release semantics need explicit design).
```

### Recommended Project Structure
```
app/
├── driver/
│   ├── page.tsx              # pool — server guard (driver), reads wp_pool
│   ├── PoolView.tsx          # client island: poll + focus refetch + Claim CTA
│   ├── run/
│   │   ├── page.tsx          # My run — reads own claimed rows, ordered by arrival
│   │   ├── RunView.tsx       # client island: per-card advance CTA + timeline
│   │   └── [id]/page.tsx     # driver transfer detail (full PII post-claim)
│   ├── actions.ts            # NEW: claimAction (wraps claim.ts), advanceStatus
│   └── (toast component, shared)
├── admin/
│   └── transfers/
│       ├── page.tsx          # list — server guard (admin), filter/search/sort
│       ├── TransfersView.tsx # client island: filter chips, search, coral pinning
│       ├── [id]/
│       │   ├── page.tsx      # detail — lifecycle + trip/payment
│       │   └── TransferDetailView.tsx  # action buttons + confirm dialogs + refund form
│       └── actions.ts        # NEW: assign/reassign/release/cancel/refund actions
platform/
├── payments/
│   └── refund.ts             # NEW server-only: refundPayment(paymentIntentId, amountCents?, reason)
└── ui/
    └── Toast.tsx             # NEW presentational toast (lost-claim + action feedback)
```

### Pattern 1: Server-guarded page → client island (the locked console/PWA shape)
**What:** Every route is a Server Component `page.tsx` that (1) re-gates with `getCurrentRole()` and `redirect("/sign-in")`, (2) reads data through the **anon cookie-bound client** so RLS is exercised, (3) resolves dictionary copy server-side, (4) passes a typed prop bag to a client `*View.tsx` island.
**When to use:** All five Phase 6 surfaces (pool, run, driver detail, admin list, admin detail).
**Example:**
```typescript
// Source: app/admin/drivers/page.tsx (verbatim in-repo pattern)
export default async function TransfersPage() {
  if ((await getCurrentRole()) !== "admin") redirect("/sign-in");
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const supabase = await createClient();          // anon cookie-bound → RLS applies
  const { data } = await supabase.from("wp_transfers")
    .select("id,status,arrival_at,guest_name,flight_no,driver_id,...")
    .order("arrival_at", { ascending: true });     // soonest first (D-07)
  return <TransfersView rows={data ?? []} lang={lang} copy={{ /* dict keys */ }} />;
}
```

### Pattern 2: Claim path — caller-auth, no read-then-write, render from returned row
**What:** The driver "Claim" CTA invokes `claimTransfer(id)` (Server Action). On `ok:true`, navigate to detail and render **from `result.transfer`** (the RPC's `RETURNING *`). On `ok:false / 'already_claimed'`, neutral toast + remove the card. Never a follow-up PII fetch; never the service-role client on this path.
**When to use:** The single most security-sensitive interaction in the phase (CLAIM-01/02/03).
**Example:**
```typescript
// Source: platform/transfers/claim.ts (existing) — UI consumes it as:
const result = await claimTransfer(transferId);
if (result.ok) {
  // result.transfer is the FULL row (PII) — render detail directly (D-02, Pitfall 7)
} else if (result.reason === "already_claimed") {
  showToast(t.claimLostToast);      // neutral, NOT error (D-03)
  removeCardFromPool(transferId);
} else {
  showToast(t.claimFailedToast);    // genuine transport error only
}
```

### Pattern 3: Admin list filter + search + coral pinning (server-side query)
**What:** Read all rows (admin RLS). Apply **status filter** and **free-text search** (guest name / flight no. / destination) at the query layer; compute a `needsAttention` boolean per row (unclaimed always; near-arrival-unclaimed; arrived-stalled — D-09 simple constants); **sort with needs-attention pinned to top, then soonest arrival** (D-07).
**When to use:** Admin transfers list (OPS-01).
**Example:**
```typescript
// Server-side query shape (PostgREST). Search across columns uses .or() with ilike;
// destination name comes from a joined select. Status filter is a conditional .eq/.in.
let q = supabase
  .from("wp_transfers")
  .select("id,status,arrival_at,guest_name,flight_no,driver_id,amount_cents, destinations!inner(zone,airport,address)")
  .order("arrival_at", { ascending: true });
if (statusFilter) q = q.in("status", statusFilter);              // status filter (D-08)
if (search) q = q.or(`guest_name.ilike.%${s}%,flight_no.ilike.%${s}%`); // + dest filtered in JS or via rpc
// needsAttention computed in the RSC, then stable-sort coral rows to top (D-07).
```
> Note: PostgREST `.or()` cannot easily reach a joined table's column in one filter — search across the **destination** field is cleanest done by reading the joined `zone`/label and filtering/ranking in the RSC (pilot volume is tiny), or by a small search RPC. Either is acceptable; recommend in-RSC filtering for the pilot to avoid a new DB object.

### Pattern 4: New gated write Server Action (status-advance + admin ops)
**What:** A `"use server"` action that (1) re-gates authz in-action (`getCurrentRole()`), (2) for the driver advance, also verifies the caller **owns** the row (`driver_id === user.id`) and the requested edge is `canTransition`-legal, (3) writes via the **service-role** client, (4) relies on the migration-0004 trigger as the hard state-legality backstop, (5) `revalidatePath`.
**When to use:** `advanceStatus` (driver), `assign/reassign/release/cancel` (admin).
**Example:**
```typescript
// Source: mirrors app/admin/companies/actions.ts authz+service-role pattern
"use server";
export async function advanceStatus(transferId: string): Promise<ActionState> {
  const supabase = await createClient();                 // caller-auth to read identity
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (await getCurrentRole()) !== "driver") return { status: "error", message: t.saveFailed };
  const admin = createAdminClient();
  // read current status + ownership (service-role read is fine; ownership is the gate)
  const { data: row } = await admin.from("wp_transfers").select("status,driver_id").eq("id", transferId).single();
  if (!row || row.driver_id !== user.id) return { status: "error", message: t.saveFailed };
  const next = ALLOWED_TRANSITIONS[row.status].find(s => /* the single forward driver edge */);
  if (!next) return { status: "error", message: t.advanceFailedToast };
  const { error } = await admin.from("wp_transfers").update({ status: next }).eq("id", transferId)
    .eq("status", row.status);                            // optimistic-concurrency guard, NOT read-then-write race
  // trigger rejects any illegal edge regardless
  if (error) return { status: "error", message: t.advanceFailedToast };
  revalidatePath("/driver/run");
  return { status: "ok" };
}
```

### Pattern 5: Manual refund hook (new, server-only)
**What:** A new `platform/payments/refund.ts` with `import "server-only"` first line, calling `stripe.refunds.create`. Resolve `stripe_payment_intent_id` from the transfer row. Support full/partial via `amount` (omit for full). Pass an **`idempotencyKey`** (e.g. derived from transfer id + amount + a nonce) so a double-submit/retry never double-refunds. Never writes `status='paid'`; the refund is recorded but the single-`paid`-writer lock is untouched.
**When to use:** OPS-04 only.
**Verified API (from installed `stripe@22.2.1` typings):**
```typescript
// Source: node_modules/stripe/cjs/resources/Refunds.d.ts (RefundCreateParams) [VERIFIED: stripe@22.2.1 SDK typings]
import "server-only";
import { getStripe } from "@/platform/payments/stripe";
export async function refundPayment(opts: {
  paymentIntentId: string;
  amountCents?: number;            // omit → full refund (D-12 partial/full)
  reason?: "requested_by_customer";
  idempotencyKey: string;
}) {
  const stripe = getStripe();
  return stripe.refunds.create(
    { payment_intent: opts.paymentIntentId, amount: opts.amountCents, reason: opts.reason ?? "requested_by_customer" },
    { idempotencyKey: opts.idempotencyKey },     // [VERIFIED] RequestOptions.idempotencyKey exists in v22 typings
  );
}
```

### Anti-Patterns to Avoid
- **Service-role client on the claim path:** breaks `auth.uid()` (keys to NULL), defeating the atomic claim. Claim uses **caller-auth only** (`claim.ts` already enforces this).
- **UI-only PII masking:** the pool RPC already omits PII structurally; never re-introduce PII into the pool payload and hide it in CSS/JS (leaks via the API).
- **Follow-up `.select()` after a winning claim:** the row is already returned (D-02). A second fetch is a read-then-write smell and an extra RLS round-trip.
- **Setting `status='paid'` anywhere:** the webhook is the sole `paid` writer. Release must NOT casually write `paid` if it is not a trigger-legal edge — see Pitfall 2.
- **Auto-refund on cancel:** D-11 forbids it. Cancel only *offers* the refund shortcut.
- **Realtime / SW-caching the pool or claim data:** D-01 + NetworkFirst lock.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic claim / race resolution | A SELECT-then-UPDATE in the action, an optimistic client claim, a queue | `claim_transfer` RPC via `claim.ts` | Phase 5 proved one-winner under N=20×K=5 live concurrency. Any app-layer re-implementation re-opens double-claims (Pitfall 12). |
| Lifecycle transition legality | A hand-rolled state check as the enforcement boundary | `ALLOWED_TRANSITIONS` (friendly) + the migration-0004 **trigger** (hard backstop) | The trigger fires for every writer incl. service-role; the TS map is cosmetic. Trust the DB. |
| PII masking for the pool | Selecting full rows + hiding fields in the UI | `wp_pool()` RPC (structural omission) | UI masking leaks via the auto-generated API (CLAIM-03 enforced at data layer). |
| Post-claim PII fetch | A second query for the claimed row's PII | The claim RPC's `RETURNING *` (`result.transfer`) | D-02 — atomic, no read-then-write. |
| Refund fee math / "fee not recovered" figure | Recomputing the Stripe fee | `recordedFeeCents()` from `fee.ts` | Recorded truth; CLAUDE.md verified fact that refunds don't return the fee. |
| Status dot / lifecycle timeline / list rows | New components | `StatusDot`, `LifecycleTimeline`, `DataList`, `Card`, `Button`, `Select`, `TextField` | Locked design system; UI-SPEC confirms only a toast + refund form are new. |
| EN/BG copy | Hard-coded JSX strings | `getDict()` keys (UI-SPEC lists every key) | tsc Dict-parity gate (PLAT-04). |
| Role gating | `getSession()` / UI-only hiding | `getCurrentRole()` (revalidates JWT) | Established authz primitive; `getSession()` is forbidden for authz (CLAUDE.md). |

**Key insight:** Phase 6 is where a plausible-but-wrong instinct ("just write the claim logic in the action / mask PII in the component / re-check the status before updating") would silently undo Phase 5's adversarially-proven guarantees. The correct posture is **thin UI over fat, locked data primitives** — the UI decides *presentation and navigation*, never *correctness*.

## Common Pitfalls

### Pitfall 1: No driver write path exists — naive "just UPDATE the status" fails or needs the wrong client
**What goes wrong:** A developer wires the advance CTA to an anon-client `.update()` on `wp_transfers` → **0 rows / RLS denies** (drivers have only a SELECT policy). Switching to service-role works but drops the ownership check, letting a crafted action advance *another* driver's transfer.
**Why it happens:** The "no-write-policy lock" is invisible unless you read migration-0005's comments. The trigger note "actor legality is the Phase-6 app gate" is the explicit handoff.
**How to avoid:** Use the gated service-role Server Action (Pattern 4): re-gate role, **verify `driver_id === auth user id`**, resolve the next edge via `lifecycle.ts`, write with a `.eq("status", currentStatus)` optimistic guard, trust the trigger for legality.
**Warning signs:** An `.update()` on `wp_transfers` from `server.ts` (anon) client; a service-role write with no ownership check.

### Pitfall 2: `release` semantics — reverting a claimed transfer to `paid` is NOT a trigger-legal edge
**What goes wrong:** Admin "release" intends to put a claimed transfer back in the pool (`status` back to `paid`, `driver_id` null). But the migration-0004 trigger's allowed map has **no `claimed→paid` / `en_route→paid` edge** — only forward edges + `→cancelled`. A naive `update status='paid'` raises `illegal transfer transition`. Worse, `paid` is the webhook's sole-writer status.
**Why it happens:** The lifecycle was designed forward-only + cancel; "release back to pool" is a Phase-6 operational need the trigger didn't anticipate.
**How to avoid:** **Flag this as a design decision for the planner (Open Question 1).** Options: (a) release only **clears `driver_id`** and the pool query keys on `driver_id IS NULL AND status='paid'` — but a *claimed* row has `status='claimed'`, so clearing driver_id alone leaves it out of `wp_pool()` (which requires `status='paid'`); (b) introduce a trigger-legal backward edge or a dedicated `release_transfer` RPC (schema change → sign-off); (c) restrict release to only-`claimed` (pre-`en_route`) and define the exact target state. **This needs an explicit decision before planning the release action** — it is the one place the locked data layer does not already accommodate the required operation. (Does NOT block assign/reassign/cancel, which are clean: assign/reassign set `driver_id` on a `paid`/`claimed` row without a status regression; cancel is a trigger-legal edge from any pre-pickup state.)
**Warning signs:** A `release` action that writes `status='paid'` — it will either be rejected by the trigger or violate the single-writer principle.

### Pitfall 3: Refund double-submit double-refunds real money
**What goes wrong:** Admin double-clicks "Refund", or the Server Action retries, and two `stripe.refunds.create` calls issue two refunds.
**Why it happens:** No idempotency key + no DB record of "already refunded".
**How to avoid:** Pass a stable `idempotencyKey` (verified to exist in v22 typings) AND/OR record refund state on the transfer/an audit row and short-circuit a second attempt. Disable the confirm button on submit (UI-SPEC confirm-dialog pattern).
**Warning signs:** `refunds.create` with no `{ idempotencyKey }`; no post-refund state recorded.

### Pitfall 4 (roadmap-called): Stale claim/status data served from the SW cache
**What goes wrong:** The pool or run shows a transfer as claimable that was claimed seconds ago (or vice versa) because a service worker served a cached response → double-claim attempts, confusing UX.
**Why it happens:** Default Serwist precache/runtime-cache strategies can cache GET responses.
**How to avoid:** Claim/status/pool data is **NetworkFirst, never precached** (D-01, CLAUDE.md). Ensure the pool/run/detail data routes are excluded from SW caching or explicitly NetworkFirst. The graceful `already_claimed` handling (D-03) is the second line of defence — even a stale pool resolves correctly because the *claim itself* is atomic.
**Warning signs:** Pool data loading instantly offline; a claimed transfer reappearing in the pool.

### Pitfall 11 (roadmap-called): Leaking guest PII to unclaimed/non-owning drivers
**What goes wrong:** The pool or run accidentally exposes name/contact/exact address before claim.
**Why it happens:** Selecting full rows for the pool, or rendering the run from a broad read.
**How to avoid:** Pool reads **only** `wp_pool()` (structurally PII-free). Run reads are scoped by `wp_transfers_claimed_driver_read` (own rows only). Never select PII columns into a pre-claim payload.
**Warning signs:** `guest_name`/`guest_phone`/`address`/`notes` appearing in any pool query.

### Pitfall 12 (roadmap-called): Double-claim under concurrency via app-layer claim logic
**What goes wrong:** Re-implementing claim as read-then-write in the action allows two drivers to both pass the read and both write.
**Why it happens:** Not trusting the RPC; "checking if claimable first."
**How to avoid:** Call `claim_transfer` (one atomic UPDATE) exclusively via `claim.ts`. Never pre-check claimability then claim.
**Warning signs:** A `select ... where status='paid'` immediately followed by an `update` in the claim flow.

## Code Examples

### Reading the masked pool (driver)
```typescript
// Source: migration-0005 wp_pool() contract + claim.ts caller-auth client pattern
const supabase = await createClient();                  // caller-auth — auth.uid() resolves
const { data: pool, error } = await supabase.rpc("wp_pool"); // returns the 9 masked cols only
// pool rows: { id, status, arrival_at, airport, zone, flight_no, amount_cents, pax, luggage_count }
// NO PII present — render directly. Sort/keep order by arrival_at as desired.
```

### Reading "My run" (own active claimed transfers, ordered)
```typescript
// Source: wp_transfers_claimed_driver_read RLS + wp_transfers_arrival_at_idx (migration 0004/0005)
const { data: run } = await supabase
  .from("wp_transfers")
  .select("id,status,arrival_at,guest_name,guest_phone,flight_no,notes,destinations(address,zone,airport)")
  .in("status", ["claimed", "en_route", "arrived", "picked_up"])   // active run (D-06 drops completed)
  .order("arrival_at", { ascending: true });                        // CLAIM-06
// RLS limits this to the caller's own claimed rows — full PII is legitimately visible post-claim.
```

### Manual refund Server Action wiring (admin)
```typescript
// Source: app/admin/*/actions.ts authz pattern + platform/payments/refund.ts (new) + fee.ts disclosure
"use server";
export async function refundTransfer(_prev, formData): Promise<RefundState> {
  const t = await getDict();
  if ((await getCurrentRole()) !== "admin") return { status: "error", message: t.saveFailed };
  const parsed = refundSchema.safeParse({ id: formData.get("id"), amount: formData.get("amount"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: t.fieldRequired };       // reason required (D-10)
  const admin = createAdminClient();
  const { data: row } = await admin.from("wp_transfers")
    .select("stripe_payment_intent_id, amount_cents").eq("id", parsed.data.id).single();
  if (!row?.stripe_payment_intent_id) return { status: "error", message: t.saveFailed };
  await refundPayment({
    paymentIntentId: row.stripe_payment_intent_id,
    amountCents: parsed.data.amount,                 // omit/undefined → full (D-12)
    idempotencyKey: `refund:${parsed.data.id}:${parsed.data.amount ?? "full"}`,
  });
  // record the refund reason/amount for audit (D-10); NEVER touch status='paid'.
  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "ok" };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs`, `getSession()` for authz | `@supabase/ssr` + `getCurrentRole()`/`getUser()` | Locked since Phase 1 | Already adopted — no migration needed. |
| Polling vs Realtime debate | Refetch-on-focus + light poll (D-01) | This phase | Avoids a Realtime socket + RLS-masked-stream complexity on free tier. |
| Stripe `charge`-based refunds | `payment_intent`-based `refunds.create` | Current SDK (v22) | Use `payment_intent` (we store `stripe_payment_intent_id`); both are still supported but PI is the modern path. |

**Deprecated/outdated:**
- Do not use `@stripe/stripe-js` client redirect anywhere in this phase — refund is server-only; claim returns its row directly.
- Do not add a `tailwind.config.js` — v4 CSS-first `@theme` is locked.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest write path for status-advance + admin ops is a **gated service-role Server Action** (not a new RPC/RLS policy), to avoid a sign-off-gated schema change | Standard Stack (Alternatives), Pattern 4 | If the team prefers writes-stay-in-DB, a `advance_transfer`/`release_transfer` RPC is the alternative — a schema change needing sign-off + live migration. Planner should confirm the chosen path. |
| A2 | `release` requires an explicit lifecycle decision because `claimed→paid` is not a trigger-legal edge | Pitfall 2, Open Q1 | If release just means "clear driver_id, leave status", the released row will NOT appear in `wp_pool()` (which requires `status='paid'`) — the transfer becomes invisible/un-poolable. Must be resolved before planning the release action. |
| A3 | Admin search across the **destination** field is best done in the RSC (pilot volume) rather than a new search RPC | Pattern 3 | If volume grows, a DB-side search index/RPC is warranted — but that is a Phase-6-discretion/Phase-8 concern, not pilot-blocking. |
| A4 | The refund `reason` enum maps to Stripe's `requested_by_customer` for admin-initiated refunds | Pattern 5, refund example | Stripe only accepts `duplicate`/`fraudulent`/`requested_by_customer`. The D-10 free-text "reason (recorded)" is stored locally for audit; it is NOT the Stripe `reason` param. Planner should keep them distinct. |
| A5 | No new DB column is needed to record the refund/cancel/release reason for audit | Runtime State, Pattern 5 | If audit requires persistence, an `audit`/reason column or table is a **schema change** (sign-off). CONTEXT says "do NOT design new schema" — so for the pilot, the reason may be logged/emailed (Phase 7) rather than persisted, OR a minimal audit column is flagged for sign-off. Planner must decide where the D-10 "recorded reason" actually lands. |

## Open Questions (RESOLVED)

> All three open questions were resolved during `/gsd-discuss-phase` (CONTEXT.md D-14/D-15) and in Phase-6 planning. Annotations record where each resolution landed.

1. **`release` lifecycle target state (BLOCKING for the release action only)** — **RESOLVED by D-14 (CONTEXT.md).**
   - What we know: assign/reassign/cancel map cleanly onto existing columns + trigger edges. `wp_pool()` requires `status='paid' AND driver_id IS NULL`.
   - What's unclear: releasing a `claimed` transfer back to the pool requires `status` to return to `paid` (so it re-appears in `wp_pool()`), but `claimed→paid` is not a trigger-legal edge and `paid` is the webhook's sole-writer status.
   - **Resolution (D-14):** Option (b) chosen — restrict release to `status='claimed'` only and add an explicit, sign-off-gated trigger-legal `claimed→paid` backward edge via the minimal migration `0006_release_and_audit.sql`. A gated service-role release action clears `driver_id` and sets `status='paid'` (the row reappears in `wp_pool()`); the single-`paid`-writer contract is widened to exactly {webhook, the gated release action} (D-15). Planned in 06-01 (author migration + lifecycle edge + single-writer widening) and 06-05 (live apply + the release action). Implemented, not open.

2. **Where does the D-10 "recorded reason" persist?** — **RESOLVED by D-15 (CONTEXT.md).**
   - What we know: D-10 requires a reason note for cancel/refund/reassign/release "(audit trail of why)". No audit column/table exists.
   - What's unclear: persisting it is a schema change; CONTEXT forbids new schema in this phase.
   - **Resolution (D-15):** A minimal new `last_action_reason text` (+ `last_action_by uuid`, `last_action_at timestamptz`) column set is added to `wp_transfers` in the SAME sign-off-gated migration `0006` as the release edge. Cancel/refund/reassign/release persist the reason here; `paid` is still only ever set by the webhook (the release edge is the sole, narrow exception, written by the gated service-role action — never a client). Planned in 06-01 (author the columns in migration 0006) and 06-05 (live apply + the admin actions write the audit fields). Implemented, not open.

3. **Stripe test-mode coverage before real-money pilot** — **RESOLVED: covered by a plan task (06-05).**
   - What we know: refunds touch the live Stripe account.
   - **Resolution:** A Stripe **test-mode** refund smoke is now an explicit acceptance criterion on the refund-hook task in `06-05-PLAN.md` (Task 1): using a Stripe **test** secret key, create a test PaymentIntent and assert `stripe.refunds.create` returns a refund with `status: 'succeeded'` (full + partial), with the `idempotencyKey` verified to prevent a double-refund — and this MUST pass BEFORE the live migration apply / any real-money refund. Q3 is therefore covered by a plan, not left dangling. (Validation Architecture above lists `platform/payments/refund.test.ts` as the home for the hook-shape/idempotency assertions; the test-mode smoke is the live-key complement gated on the Stripe TEST env.)

## Environment Availability

> This phase is primarily code + already-provisioned services. External dependencies are all live and used in prior phases.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js 16 / Node runtime | All surfaces + Server Actions | ✓ | 16.2.9 | — |
| Supabase (Balkanity `qyhdogajtmnvxphrslwm`) | All reads/writes; `wp_pool`/`claim_transfer` live | ✓ (migration 0005 live) | hosted | — |
| Stripe SDK + live account | Refund hook (OPS-04) | ✓ | stripe@22.2.1, API `2026-05-27.dahlia` | Stripe CLI test mode for pre-pilot verification |
| `stripe.refunds.create` + idempotencyKey | OPS-04 | ✓ verified in installed typings | v22 | — |
| Design system / i18n / lifecycle / claim wrapper | All UI | ✓ in-repo | — | — |

**Missing dependencies with no fallback:** none — the data layer (`wp_pool`, `claim_transfer`, claiming-driver RLS) is live on Balkanity.
**Missing dependencies with fallback:** Stripe refund testing → Stripe CLI test mode before real-money refunds.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`). This phase warrants validation for claim correctness under concurrency, status-transition integrity, PII boundary, and the refund disclosure/single-`paid`-writer invariant.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) for unit/component; Playwright (chromium) for e2e — established Phase 1 Wave 0 baseline |
| Config file | (in repo since Phase 1; `vitest` + `@playwright/test`) |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLAIM-01 | Pool query returns only the 9 masked columns; no PII keys present | unit | `npx vitest run platform/transfers/pool.masking.test.ts` | ❌ Wave 0 |
| CLAIM-02/12 | Concurrent claims yield exactly one winner; loser is graceful `already_claimed` (consumes existing Phase 5 gate) | integration (live RPC) | reuse Phase 5 concurrency gate / `npx vitest run platform/transfers/claim.concurrency.test.ts` | ⚠️ Phase 5 gate exists; add a UI-path assertion |
| CLAIM-04 | Driver advance action rejects a non-owned transfer; no un-claim control exists | unit | `npx vitest run app/driver/advance.ownership.test.ts` | ❌ Wave 0 |
| CLAIM-05 | `advanceStatus` only writes a `canTransition`-legal next edge; illegal edge rejected by trigger | unit + integration | `npx vitest run app/driver/advance.lifecycle.test.ts` | ❌ Wave 0 |
| CLAIM-06 | Run is ordered by `arrival_at` ascending; completed drops out of active run | component | `npx vitest run app/driver/run/RunView.test.tsx` | ❌ Wave 0 |
| OPS-01 | List filter(status)+search(name/flight/dest) + coral needs-attention pinned top | component | `npx vitest run app/admin/transfers/TransfersView.test.tsx` | ❌ Wave 0 |
| OPS-03 | assign/reassign/release/cancel actions re-gate admin role; cancel is trigger-legal; release target state correct | unit | `npx vitest run app/admin/transfers/actions.test.ts` | ❌ Wave 0 |
| OPS-04 | Refund hook calls `refunds.create` with `payment_intent` + idempotencyKey; never sets `paid`; fee disclosure always rendered | unit + component | `npx vitest run platform/payments/refund.test.ts app/admin/transfers/RefundForm.test.tsx` | ❌ Wave 0 |
| INV (single-writer) | No Phase-6 path writes `status='paid'` (grep/contract gate) | contract | `npx vitest run platform/payments/single-writer.test.ts` (extend existing) | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npx vitest run` (full unit/component suite)
- **Phase gate:** `npx vitest run && npx playwright test` green + the live claim-concurrency gate green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `platform/transfers/pool.masking.test.ts` — asserts `wp_pool()` result has no PII keys (CLAIM-01)
- [ ] `app/driver/advance.ownership.test.ts` + `advance.lifecycle.test.ts` — ownership + legal-edge (CLAIM-04/05)
- [ ] `app/driver/run/RunView.test.tsx` — arrival sort + completed-drop (CLAIM-06)
- [ ] `app/admin/transfers/TransfersView.test.tsx` — filter/search/coral pinning (OPS-01)
- [ ] `app/admin/transfers/actions.test.ts` — admin re-gate + assign/reassign/release/cancel semantics (OPS-03)
- [ ] `platform/payments/refund.test.ts` + `RefundForm.test.tsx` — refund hook shape + idempotency + disclosure-always-shown (OPS-04)
- [ ] Extend `platform/payments/single-writer.test.ts` — no new `status='paid'` writer in Phase 6
- [ ] Shared fixtures: a driver JWT + an admin JWT caller-auth fixture (reuse the Phase 5 two-identity split)

## Security Domain

> `security_enforcement: true`, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentRole()` (revalidates JWT via `getUser()`) on every page + every write action; never `getSession()` for authz. |
| V3 Session Management | yes | `proxy.ts` refreshes the session; cookie-bound `@supabase/ssr` client. No change needed. |
| V4 Access Control | **yes (central)** | Driver advance: ownership check (`driver_id === auth.uid()`) + role gate. Admin ops: in-action `getCurrentRole()==="admin"` (service-role bypasses RLS, so the action check is THE gate). Pool: `wp_pool` restricted to drivers/admins; claiming-driver RLS for run reads. |
| V5 Input Validation | yes | zod at every trust boundary: refund amount (positive int ≤ paid amount), reason note, transfer id (uuid), driver id (uuid) for assign/reassign. Generic dictionary-keyed errors (no provider-detail leak). |
| V6 Cryptography | no (none hand-rolled) | Stripe handles refund crypto; Supabase handles JWT. |
| V7 Error Handling/Logging | yes | Distinguish transport error from graceful `already_claimed` (already in `claim.ts`); generic user-facing errors; no PII in logs. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Driver advances/cancels a transfer they don't own (forged action call) | Elevation of Privilege | Ownership check (`driver_id === auth.uid()`) + role gate in the advance action; admin-only for assign/reassign/release/cancel. |
| Non-admin invokes an admin op action directly (not via UI) | Elevation of Privilege | In-action `getCurrentRole()==="admin"` (service-role bypasses RLS — the action check is the only gate). |
| PII leak to unclaimed driver via pool/run | Information Disclosure | `wp_pool()` structural omission + claiming-driver RLS; never select PII into pre-claim payloads (Pitfall 11). |
| Double-claim under concurrency | Tampering | `claim_transfer` atomic UPDATE only (Pitfall 12). |
| Setting `paid` outside the webhook (refund/cancel path) | Tampering / money integrity | No Phase-6 path writes `paid`; single-writer contract test extended (Pitfall 2). |
| Double-refund on retry/double-click | Tampering / financial | Stripe `idempotencyKey` + recorded refund state + disable-on-submit (Pitfall 3). |
| Stale SW cache shows wrong claim state | Information Disclosure / integrity | NetworkFirst, never SW-cache claim/status data (Pitfall 4); atomic claim is the backstop. |

## Sources

### Primary (HIGH confidence)
- **In-repo migration `supabase/migrations/0005_claim_correctness.sql`** — `wp_pool()` 9-column masked contract, `claim_transfer(uuid)` typed result, claiming-driver RLS, no-write-policy lock — HIGH (live on Balkanity).
- **In-repo `supabase/migrations/0004_transfer_entity.sql`** — `wp_transfers` columns (incl. `arrival_at`, `driver_id`, `stripe_payment_intent_id`, PII), the BEFORE-UPDATE transition trigger + its "actor legality is the Phase-6 app gate" note, allowed-transition map — HIGH.
- **In-repo `platform/transfers/claim.ts`, `lifecycle.ts`** — caller-auth claim wrapper + `ALLOWED_TRANSITIONS` — HIGH.
- **In-repo `platform/payments/stripe.ts`, `fee.ts`** — server-only Stripe client + recorded-fee figure — HIGH.
- **In-repo `app/admin/{drivers,companies}/{page,actions}.tsx`** — the server-guard → island + gated-service-role-action pattern — HIGH.
- **Installed `stripe@22.2.1` typings** (`node_modules/stripe/cjs/resources/Refunds.d.ts`, `lib.d.ts`) — `refunds.create({ payment_intent, amount?, reason?, metadata? }, { idempotencyKey })` — HIGH (verified against the pinned SDK, not training data).
- **Phase 5 `05-GATES-EVIDENCE.md`** — proven concurrency one-winner + zero-PII invariants the UI must not undermine — HIGH.
- **CONTEXT.md + UI-SPEC.md** — D-01..D-12 decisions, copy keys, interaction contracts — HIGH (locked).
- **CLAUDE.md** — locked stack, single-`paid`-writer, server-only secrets, refund-fee-not-recovered fact — HIGH.

### Secondary (MEDIUM confidence)
- Pattern inference for `release` lifecycle gap (Pitfall 2 / Open Q1) — MEDIUM (derived from the trigger map; needs a human decision).

### Tertiary (LOW confidence)
- None — this phase required no unverified web search; all findings are grounded in the live repo + installed SDK.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; everything verified in-repo + against installed SDK.
- Architecture (consume Phase 5 layer + new gated write actions): HIGH — patterns mirror four existing admin slices; the one genuine gap (`release` lifecycle) is explicitly flagged, not guessed.
- Refund hook: HIGH — API shape verified against the pinned `stripe@22.2.1` typings, not training data.
- Pitfalls: HIGH — derived from the live migrations + Phase 5 gates + roadmap-named pitfalls.
- Open questions: the two design decisions (release target state, reason persistence) are HIGH-confidence *that they need a decision*, and intentionally left to discuss-phase/planner.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable — locked stack; revisit only if Stripe SDK or Supabase data layer changes).
