# Architecture Research

**Domain:** Multi-module PWA platform (first module: airport-transfer marketplace) on Next.js App Router + Supabase + Stripe
**Researched:** 2026-06-17
**Confidence:** HIGH (core concurrency + RLS mechanisms verified against Postgres + Supabase official docs; structure conventions are MEDIUM/opinionated)

## Standard Architecture

### System Overview

The decisive architectural fact for this project: it is the **first module of a platform**, so every boundary decision is really a decision about how the *second* module (tours, car rental) plugs in without rework. The seam must exist in three places simultaneously — the **database schema** (Postgres schemas / table prefixes), the **server code** (a `platform/` core vs `modules/welcome-pickup/`), and the **UI** (shared design-system + shell vs module routes). A seam that exists in only one of those three leaks.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENTS (PWA shell)                            │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                   │
│  │ Admin      │    │ Driver     │    │ Guest      │   shared shell:    │
│  │ (desktop)  │    │ (mobile)   │    │ (mobile)   │   tokens, i18n,    │
│  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘   install, offline │
├────────┼─────────────────┼─────────────────┼──────────────────────────┤
│        │   NEXT.JS APP ROUTER (Vercel)     │                          │
│  ┌─────┴───────────────────────────────────┴───────────────────────┐  │
│  │  Route Handlers / Server Actions / RSC                           │  │
│  │  ┌──────────────────────┐   ┌────────────────────────────────┐  │  │
│  │  │  platform/ (shared)  │   │  modules/welcome-pickup/        │  │  │
│  │  │  auth, companies,    │   │  booking, transfer lifecycle,   │  │  │
│  │  │  payments, notifs,   │◄──┤  claim pool, transfer views     │  │  │
│  │  │  health, design-sys  │   │  (depends on platform, never    │  │  │
│  │  └──────────┬───────────┘   │   the reverse)                  │  │  │
│  └─────────────┼───────────────└────────────────────────────────┘──┘  │
├────────────────┼───────────────────────────────────────────────────────┤
│        SUPABASE (Postgres + Auth + RLS + Edge Functions + pg_cron)      │
│  ┌─────────────┴────────────┐   ┌─────────────────────────────────┐     │
│  │ platform tables          │   │ module tables (transfers, etc.) │     │
│  │ users/roles, companies,  │◄──┤ FK → companies/properties/users │     │
│  │ properties, payments,    │   │ RLS + masked views + claim RPC  │     │
│  │ notifications, webhook_   │   └─────────────────────────────────┘     │
│  │ events                   │                                            │
│  └──────────────────────────┘                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  EXTERNAL: Stripe (Checkout + webhook → paid), Resend (email)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Platform: auth & roles | Identity, role assignment (admin/driver/guest), session | Supabase Auth + `app_users` table + role table; magic-link for guest/driver |
| Platform: companies & properties | Org/property/destination records, price + commission config | Postgres tables, admin-only RLS, FK target for modules |
| Platform: payments | Code-created Checkout Sessions, webhook verification, refund hooks | Route handler `POST /api/checkout`, route handler `POST /api/stripe/webhook`, `webhook_events` log |
| Platform: notifications | In-app feed/bell, Resend wrapper, send guardrails (cap/digest) | `notifications` table + realtime, `sendEmail()` wrapper with daily-cap gauge |
| Platform: health | Webhook log, reconciliation sweep, email-cap gauge, stuck-transfer alerts | `webhook_events` table, pg_cron → Edge Function sweep, admin dashboard |
| Platform: design system | Tokens, logo/pictogram assets, status-dot component, EN/BG toggle | Tailwind theme + shared component lib under `platform/ui` |
| Platform: PWA shell | Manifest, service worker, install prompt, offline shell | Next.js + `next-pwa`/manual SW, app-level layout |
| Module: booking | Per-destination slug link, guest form, kicks off checkout | RSC page `/[destinationSlug]`, server action → payments |
| Module: transfer entity | `transfers` lifecycle state machine, status transitions | `transfers` table + transition functions; `paid` set ONLY by webhook |
| Module: claim pool | Limited-detail pool view, atomic first-to-claim | Masked view/RPC for pool, `claim_transfer()` RPC for atomic UPDATE |
| Module: transfer views | Pool, my-run, transfer-detail (driver); list/detail (admin) | RSC + client components reading masked or full views by role |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router — thin routing layer only
│   ├── (platform)/               # shared shell, auth callbacks, health console
│   │   ├── layout.tsx            # PWA shell, design tokens, i18n provider
│   │   ├── admin/                # admin console routes (calls platform + module svcs)
│   │   └── api/
│   │       ├── checkout/route.ts # platform payments (creates Checkout Session)
│   │       └── stripe/webhook/route.ts  # THE only place `paid` is set
│   ├── (welcome-pickup)/         # module-owned routes
│   │   ├── [destinationSlug]/    # guest booking form
│   │   ├── status/[token]/       # guest magic-link status
│   │   └── driver/              # pool, my-run, transfer detail
│   └── manifest.ts               # PWA manifest
├── platform/                     # SHARED CORE — depends on nothing module-specific
│   ├── auth/                     # session, roles, guards
│   ├── companies/                # company/property/destination services
│   ├── payments/                 # createCheckoutSession(), webhook verify, refund
│   ├── notifications/            # feed + Resend wrapper + cap/digest guardrails
│   ├── health/                   # webhook log writer, reconciliation, alerts
│   ├── ui/                       # design system: tokens, StatusDot, Button, assets
│   └── supabase/                 # typed clients (browser, server, service-role)
├── modules/
│   └── welcome-pickup/           # MODULE — may import platform/*, never imported BY it
│       ├── booking/              # form logic, slug resolution → checkout
│       ├── transfer/            # lifecycle state machine, transitions
│       ├── claim/                # claim_transfer RPC wrapper, pool query
│       └── views/                # view-models for pool/my-run/detail
└── lib/                          # truly generic helpers (dates, money fmt) — no domain

supabase/
├── migrations/                   # ordered SQL — schema is the hard seam
│   ├── 0001_platform_auth.sql
│   ├── 0002_platform_companies.sql
│   ├── 0003_platform_payments_webhook_events.sql
│   ├── 0004_platform_notifications.sql
│   ├── 0010_wp_transfers.sql     # module tables prefixed `wp_` (or schema `welcome_pickup`)
│   ├── 0011_wp_rls_and_views.sql # masked pool view + RLS policies
│   └── 0012_wp_claim_rpc.sql     # claim_transfer() security definer fn
└── functions/
    └── reconcile/                # Edge Function invoked by pg_cron sweep
```

### Structure Rationale

- **`platform/` vs `modules/`:** The dependency arrow points ONE way — modules import platform, never the reverse. This is the single rule that makes a second module additive. Enforce it with an ESLint `no-restricted-imports` rule (forbid `platform/*` files from importing `modules/*`). When tours arrives, it is a new `modules/tours/` folder + `(tours)/` route group + `t_`-prefixed tables, touching zero platform code.
- **DB seam — schema vs prefix:** Either put module tables in a dedicated Postgres schema (`welcome_pickup.transfers`) or prefix them (`wp_transfers`). Prefix is simpler for Supabase (single exposed schema, fewer grant headaches) and is the recommended choice for the pilot; a dedicated schema is the cleaner long-term answer if module count grows. Platform tables stay in `public` with stable names because every module FKs into them.
- **`app/` is thin:** Route files should only wire HTTP/RSC to services in `platform/` or `modules/`. Business logic never lives in `app/` — that keeps routes swappable and logic testable.
- **Route groups `(platform)` / `(welcome-pickup)`:** Mirror the code seam in the URL/layout tree so the second module gets its own group without disturbing existing routes.

## Architectural Patterns

### Pattern 1: Webhook-as-sole-authority for money state

**What:** `transfers.status = 'paid'` is set in exactly one code path: the signature-verified `POST /api/stripe/webhook` handler, on `checkout.session.completed`. The client success redirect NEVER writes `paid` — it only reads status.
**When to use:** Always, for any money/trust-sensitive state transition.
**Trade-offs:** Adds a webhook dependency and an eventual-consistency gap (a few seconds between guest paying and seeing `paid`); eliminated risk of spoofed client redirects marking unpaid transfers as paid. The gap is handled by the guest status page polling/realtime.

**Example:**
```typescript
// app/(platform)/api/stripe/webhook/route.ts
const event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET); // verify FIRST
// idempotency: insert event.id with UNIQUE constraint; if conflict → already processed → 200
const inserted = await recordWebhookEvent(event.id, event.type); // returns false on conflict
if (!inserted) return new Response('ok (dup)', { status: 200 });
if (event.type === 'checkout.session.completed') {
  await setTransferPaid(session.metadata.transfer_id); // the ONLY paid writer
  await notifyGuestConfirmed(...); await notifyAdminBooking(...);
}
return new Response('ok', { status: 200 });
```

### Pattern 2: Atomic conditional UPDATE for first-to-claim (no locks, no RLS dependency)

**What:** Claiming is a single statement: `UPDATE wp_transfers SET status='claimed', driver_id=$1, claimed_at=now() WHERE id=$2 AND status='paid' RETURNING *`. The winner gets 1 row back; every loser gets 0 rows → "already claimed."
**When to use:** Any "exactly one actor acquires a resource" race.
**Trade-offs:** Dead simple, no advisory locks, no `SELECT ... FOR UPDATE`, no application-level transaction juggling. Correctness rests on Postgres semantics (validated below), so the team must NOT add a read-modify-write wrapper around it that reintroduces a TOCTOU gap.

**Why it is concurrency-safe (validated, HIGH confidence):** Under Postgres' default READ COMMITTED isolation, when two transactions issue this UPDATE on the same row simultaneously, the second blocks on the row lock held by the first. When the first commits (changing `status` to `'claimed'`), the second transaction **re-evaluates its WHERE clause against the now-updated row version** (Postgres EvalPlanQual re-check). Since `status` is no longer `'paid'`, the second UPDATE matches 0 rows and is a no-op. This is guaranteed by Postgres' documented READ COMMITTED behavior — see PostgreSQL "Transaction Isolation" docs: *"The search condition of the command (the WHERE clause) is re-evaluated to see if the updated version of the row still matches."* No explicit locking is required; the conditional UPDATE IS the lock.

**Example:**
```sql
-- claim_transfer(): SECURITY DEFINER so it runs the atomic UPDATE regardless of
-- the driver's row-write RLS, but it enforces the guard itself.
create or replace function public.claim_transfer(p_transfer_id uuid)
returns wp_transfers
language plpgsql security definer set search_path = public as $$
declare v_row wp_transfers; v_driver uuid := auth.uid();
begin
  if not is_driver(v_driver) then raise exception 'not a driver'; end if;
  update wp_transfers
     set status='claimed', driver_id=v_driver, claimed_at=now()
   where id=p_transfer_id and status='paid'
   returning * into v_row;
  if v_row.id is null then raise exception 'already_claimed_or_not_payable'; end if;
  return v_row; -- full row returned only to the winning driver
end; $$;
```

### Pattern 3: Two-tier visibility — masked pool view + RPC-returned full row on claim

**What:** Drivers query a **masked view** (`wp_pool`) that exposes only pre-claim fields (date, arrival time, airport, destination zone, fare, pax, luggage) for `status='paid'` rows — no name, contact, exact address, flight no., or notes. Full PII becomes readable only to the claiming driver and admins, enforced at the data layer, not the UI.
**When to use:** Per-row PII gating where the same physical table has a public-ish projection and a private projection keyed by row ownership.
**Trade-offs:** A view keeps the column list explicit and auditable (you can read the SQL and see exactly which columns leak pre-claim) and avoids Postgres column-privilege pitfalls. Supabase explicitly **does not recommend column-level privileges** for this use case; RLS-driven projections are the recommended path.

**Recommended concrete mechanism for Supabase (specific):**
1. **Pool listing = a dedicated view `wp_pool`** containing ONLY the safe columns, defined `WHERE status='paid' AND driver_id IS NULL`. Create it `with (security_invoker = true)` (Postgres 15+) so it honors the caller's RLS. Grant `select` to `authenticated`. Because the view physically omits PII columns, there is no column-masking to get wrong — unclaimed PII is simply not in the projection.
2. **Full-detail reads = RLS on `wp_transfers` itself.** Policy: `for select using (driver_id = auth.uid() or is_admin(auth.uid()))`. A driver can read the complete row (PII included) only for transfers they already won; admins always can. Guests read their own via the magic-link token mapping.
3. **The claim = `claim_transfer()` SECURITY DEFINER RPC** (Pattern 2). It performs the atomic guarded UPDATE and `RETURNING *`, so the winning driver receives the full PII in the same round-trip the instant they win — and the same SELECT RLS thereafter keeps it visible to them.

This three-part design means: (a) unclaimed PII never appears in any projection a non-owner can select, (b) the claim is enforced by the atomic UPDATE, NOT by RLS alone, and (c) RLS is the durable read boundary that survives any UI bug.

**Why RPC for the claim, not a direct server-route UPDATE:** Either works for correctness, but the SECURITY DEFINER RPC is preferred because (1) it co-locates the guard (`WHERE status='paid'`) with the data so it can't be bypassed by a future code path, (2) it lets the driver-facing RLS forbid arbitrary row writes while still permitting the one legal mutation, and (3) it returns the unlocked full row atomically. Calling it from a Next.js **server route / server action with the user's auth context** (so `auth.uid()` resolves) is the right wrapper — do NOT call it with the service-role key (that would bypass the driver-identity check). Reserve the service-role key for the webhook handler and reconciliation sweep only.

## Data Flow

### End-to-end transfer flow (booking → fulfilment)

```
Guest opens /[destinationSlug]
    ↓  reads price + commission from companies/destinations (platform)
Guest submits form (email req, phone opt)
    ↓  server action → platform.payments.createCheckoutSession()
    ↓  creates wp_transfers row status='requested', stripe session w/ metadata.transfer_id
Stripe Checkout (hosted) → guest pays
    ↓                                    ↘ client redirect → /status/[token]  (READS only)
Stripe → POST /api/stripe/webhook (signature verified)
    ↓  insert event.id (UNIQUE) → idempotent
    ↓  setTransferPaid(transfer_id)   ← THE ONLY 'paid' writer
    ↓  notify guest (confirmation) + admin (booking alert)  via Resend wrapper
status='paid', driver_id NULL  →  appears in wp_pool view
    ↓
Driver sees pool (masked) → taps Claim → claim_transfer() RPC
    ↓  atomic UPDATE ... WHERE status='paid'  (first wins, losers get 0 rows)
status='claimed', driver_id=winner  →  full PII unlocked to winner via RLS + RETURNING
    ↓  notify driver-assigned; guest gets 'claimed' email
Driver advances: en_route → arrived (guest 'arrived' email) → picked_up → completed
    ↓  (or admin cancel/reassign + manual Stripe refund via platform.payments)
```

### Reconciliation flow (Platform Health)

```
pg_cron (every 15–30 min)  →  Edge Function /functions/reconcile
    ↓  list Stripe sessions paid in window  ✕  join wp_transfers
    ↓  Stripe-paid but transfer not 'paid'  →  flag + alert (dropped webhook caught)
    ↓  also: stuck-transfer scan (paid > N min unclaimed; claimed > M min not advanced)
    ↓  email-cap gauge: count today's Resend sends vs 100/day
```

### State management (client)

```
Supabase Realtime (transfers, notifications)
    ↓ subscribe
Driver pool / my-run components  ←→  server actions (claim, advance)  →  Postgres
Notification bell  ←  realtime on notifications table
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Pilot (1 company, ~10 transfers) | Everything as designed; Supabase free tier fine. Add a keep-alive ping (project pauses after 7 days idle). |
| 0–1k transfers/mo | No change. Atomic claim and single-region Postgres handle this trivially. |
| 1k–100k | Add index on `wp_transfers(status, driver_id)` for pool view; move per-transfer emails fully to digest; consider Resend paid tier (100/day cap is the first wall, not the DB). |
| 100k+ / multi-module | Promote module tables to dedicated Postgres schemas; split reconciliation into per-module sweeps; revisit Edge Function cold-start latency. |

### Scaling Priorities

1. **First bottleneck: Resend 100/day free cap**, not the database. Mitigated by driver in-app feed + opt-in daily digest and firing guest emails only on `claimed` and `arrived`. This is a pilot-binding constraint, design around it from day one.
2. **Second bottleneck: Supabase free-tier project pause (7-day idle) and 500MB DB.** Add a scheduled keep-alive; webhook_events log is the table to watch for growth (add a retention/prune job).
3. **Pool query** only becomes hot at thousands of concurrent drivers; a single composite index resolves it.

## Anti-Patterns

### Anti-Pattern 1: Setting `paid` from the client success redirect

**What people do:** Mark the transfer paid in the `/success` redirect handler because it's faster than waiting for the webhook.
**Why it's wrong:** The redirect URL is guessable/spoofable; an attacker (or a guest who abandons payment) can trigger `paid` without money moving. It also silently breaks reconciliation's trust model.
**Do this instead:** `paid` is written ONLY in the signature-verified webhook. The success page reads status and shows "confirming payment…" until realtime/polling flips it.

### Anti-Pattern 2: Enforcing the claim with RLS instead of the atomic UPDATE

**What people do:** Write an RLS policy like "a driver may update a transfer only if it's unclaimed" and rely on that to prevent double-claims.
**Why it's wrong:** RLS gates *who may attempt* the write; it does not serialize two simultaneous writes. Two drivers both pass the RLS check, both UPDATE, and without the `WHERE status='paid'` guard you get a double-claim. RLS is a visibility/authorization boundary, not a concurrency primitive.
**Do this instead:** Concurrency safety comes from `UPDATE ... WHERE status='paid'` (Pattern 2). RLS additionally restricts who can call it. Both, not either.

### Anti-Pattern 3: UI-only PII masking

**What people do:** Fetch the full transfer row (PII included) and hide fields in the React component before claim.
**Why it's wrong:** The API/network response still contains the PII; anyone inspecting the request reads name, address, flight. The mask is cosmetic.
**Do this instead:** Pre-claim drivers query the `wp_pool` view that physically lacks PII columns; full rows are reachable only via RLS for the owner/admin (Pattern 3).

### Anti-Pattern 4: Leaking the platform→module dependency arrow

**What people do:** Have a platform service (e.g. notifications) import a `welcome-pickup` type or call into module code "just this once."
**Why it's wrong:** It welds the shared core to module #1; module #2 can't reuse the core without dragging Welcome Pickup along. This is the exact, most-expensive mistake the brief calls out.
**Do this instead:** Modules depend on platform; platform stays module-agnostic. Pass data INTO platform services as generic shapes (e.g. `sendEmail({to, template, vars})`), never module types. Enforce with an ESLint import-boundary rule.

### Anti-Pattern 5: Reconciliation on Vercel Hobby cron

**What people do:** Schedule the 15–30 min reconciliation sweep on Vercel cron.
**Why it's wrong:** Vercel Hobby cron is limited to roughly once/day and is imprecise — far too coarse to catch a dropped webhook promptly.
**Do this instead:** Use Supabase `pg_cron` → Edge Function for the frequent sweep (pg_cron supports sub-minute to multi-minute schedules; keep jobs <10 min, <8 concurrent). Use Vercel cron only as a once-daily backstop if desired.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe | Code-created Checkout Sessions (NOT dashboard Payment Links); webhook with `constructEvent` signature verify; refund via API | Put `transfer_id` in session metadata so the webhook can resolve the row. Verify BG/EUR fee model before pricing. Refunds don't return original fee. |
| Resend | `sendEmail()` platform wrapper with a daily-cap gauge + digest batching | 100/day free cap is the binding constraint; 1 verified domain. Wrapper must short-circuit / queue to digest when near cap. |
| Supabase Auth | Magic-link (passwordless) for guest status + driver; admin can use stronger auth | Guestless checkout; email is the only hard requirement. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| module → platform | Direct function import (one-way) | Modules import `platform/*`; never the reverse. ESLint-enforced. |
| platform.payments → module.transfer | Webhook handler calls a generic `setTransferPaid(id)` updater | Keep the writer narrow; it is the only `paid` author. |
| app/ → services | Thin — routes call services, hold no logic | Keeps routes swappable per module. |
| DB platform tables ← module tables | Foreign keys into `public` (companies, properties, users) | Stable platform table names are the contract modules build on. |

## Suggested Build / Dependency Order

Ordered so each component only depends on things already built. This directly informs roadmap phasing.

1. **Platform: Supabase clients + auth & roles + design tokens/PWA shell.** Foundation everything else needs; nothing works without identity and the typed Supabase clients. Establishes the `platform/` vs `modules/` seam from commit one.
2. **Platform: companies / properties / destinations (admin onboarding) + price/commission config.** The booking form reads from here; must exist before a guest can book. Admin CRUD + admin-only RLS.
3. **Platform: payments core — `createCheckoutSession()` + `/api/stripe/webhook` + `webhook_events` log + idempotency.** The trust spine. Build and prove webhook→`paid` (with a placeholder transfer) before any claim logic, because `paid` is the precondition for the entire pool.
4. **Module: `wp_transfers` table + lifecycle + booking form/slug link.** Depends on companies (price) and payments (checkout). Wire booking → checkout → webhook → `paid`. Schema is a flagged/irreversible change — sign-off before this migration.
5. **Module: RLS + `wp_pool` masked view + `claim_transfer()` RPC.** Depends on `wp_transfers` and roles. This is the crown-jewel correctness work (0 double-claims, PII gating). Test concurrency explicitly here.
6. **Module: transfer views (driver pool, my-run, detail; admin list/detail + reassign/cancel/refund).** Depends on view + RPC + payments refund hook.
7. **Platform: notifications (in-app feed + Resend wrapper + cap/digest guardrails).** Can be stubbed earlier but completed here; transfer lifecycle events are what it reports on.
8. **Platform: Health — reconciliation sweep (pg_cron → Edge Function), email-cap gauge, stuck-transfer alerts.** Last, because it observes everything above; needs `webhook_events`, transfers, and the email wrapper to exist.

**Critical-path rationale:** auth → onboarding → payments → transfer → claim is a strict chain (each is a hard precondition for the next). Notifications and Health are observers that ride on top and can be built last without blocking the money/claim path. The platform/module seam (step 1) is non-deferrable — retrofitting it after module code exists is the expensive failure mode the brief warns against.

## Sources

- PostgreSQL "Transaction Isolation" (READ COMMITTED WHERE re-evaluation / EvalPlanQual) — https://www.postgresql.org/docs/current/transaction-iso.html (HIGH — confirms atomic conditional UPDATE is concurrency-safe by construction)
- Supabase "Column Level Security" — https://supabase.com/docs/guides/database/postgres/column-level-security (HIGH — Supabase explicitly does NOT recommend column privileges; prefer RLS-driven projections)
- Supabase "Row Level Security" / "Securing your API" — https://supabase.com/docs/guides/database/postgres/row-level-security , https://supabase.com/docs/guides/api/securing-your-api (HIGH — RLS as the real API boundary; `security_invoker` views in PG15+)
- Supabase "Do I need to expose security definer functions in RLS policies?" — https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw (HIGH — security definer usage)
- Supabase Cron / Scheduling Edge Functions (pg_cron sub-minute, <8 concurrent, <10 min/job) — https://supabase.com/docs/guides/cron , https://supabase.com/docs/guides/functions/schedule-functions (HIGH)
- Stripe "Receive Stripe events in your webhook endpoint" (signature verify + at-least-once delivery → idempotency on event.id with UNIQUE constraint) — https://docs.stripe.com/webhooks (HIGH)
- PostgreSQL "Explicit Locking" / SELECT FOR UPDATE background — https://www.postgresql.org/docs/current/explicit-locking.html (MEDIUM — context; not needed for the chosen lock-free claim)
- Project brief: .planning/PROJECT.md (constraints, locked stack, boundary requirement)

---
*Architecture research for: multi-module PWA transfer platform (Welcome Pickup v1)*
*Researched: 2026-06-17*
