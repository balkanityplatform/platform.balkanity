# Stack Research

**Domain:** Airport-transfer booking + driver-dispatch PWA (travel agency, Balkanity "Welcome Pickup")
**Researched:** 2026-06-17
**Confidence:** HIGH (stack is locked; this confirms current versions, integration patterns, and the brief's VERIFY list against official sources)

> Scope note: the stack is **locked by the brief**. This document does **not** propose alternatives to locked choices. It (a) pins current best-practice versions + integration shapes for the locked stack, and (b) answers every VERIFY item with a source and confidence. Where a real choice exists *within* the locked stack (e.g. which PWA helper), that is called out.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | `16.2.9` (`^16.2`) | Full-stack React framework; route handlers host the Stripe webhook + Checkout-session creation | Locked. App Router is the current paradigm; route handlers under `app/api/.../route.ts` give us first-class server-only endpoints for webhooks. Next 16 is current stable. |
| React | `19.2.7` (`^19.2`) | UI runtime | Locked transitive dep of Next 16. React 19 Server Components are the default in App Router. |
| Tailwind CSS | `4.x` (latest `4`) | Styling / design tokens (six brand colours + Montserrat) | Locked. Tailwind v4 uses the CSS-first `@theme` config — map the brand tokens (`--teal #029B87` etc.) directly as CSS variables, no `tailwind.config.js` JS object required. |
| Supabase Postgres | hosted (project ref `qyhdogajtmnvxphrslwm`) | System of record: users, companies, properties, destinations, transfers, webhook_events | Locked. RLS is the real PII boundary; atomic claim is a single conditional `UPDATE`. |
| `@supabase/supabase-js` | `2.108.2` (`^2.108`) | DB/Auth/Storage client | Locked. Used for both anon (RLS-scoped) and service-role (server-only) clients. |
| `@supabase/ssr` | `0.12.0` (`^0.12`) | App Router auth: cookie-based session via `createServerClient` / `createBrowserClient` | Locked + current. **Use this, never the deprecated `@supabase/auth-helpers-nextjs`.** Supports magic-link (passwordless) sessions for the guest status page. |
| Stripe (`stripe` node SDK) | `22.2.1` (`^22.2`) | Code-created Checkout Sessions + webhook signature verification | Locked. Pin API version `2026-05-27.dahlia` (latest) in the SDK constructor. |
| Resend (`resend` node SDK) | `6.12.4` (`^6.12`) | Transactional email (confirmation, driver-assigned, driver-arrived, admin alert, invite, daily digest) | Locked. Free tier cap (100/day) is the binding pilot constraint — see Verified Provider Facts. |
| Vercel | Hobby tier | Hosting + edge/CDN + (backstop) cron | Locked. Hobby cron is daily + imprecise — used only as a daily backstop, NOT for the 15–30 min sweep. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@serwist/next` | `9.5.11` (`^9.5`) | Service worker / precaching / offline shell for the PWA | **Recommended PWA helper.** Serwist is the maintained successor to `next-pwa` (which is unmaintained against Next 15/16). Works with App Router + Vercel. |
| `serwist` | `9.5.11` (`^9.5`) | Workbox-based SW runtime used by `@serwist/next` | Installed alongside `@serwist/next`; you author `app/sw.ts` against it. |
| `idb` | `^8` | Promise wrapper over IndexedDB | Only if you cache booking/claim data for offline read; v1 offline scope is the install shell + read-only cached pages, so this may be deferred. |
| `zod` | `^3` or `^4` | Validate booking-form input + webhook payload shape server-side | Use in the booking route handler and at trust boundaries. Keep validation server-side; never trust client. |
| `@stripe/stripe-js` | `^4`/`^5` | (Optional) client redirect to Checkout | Only needed if redirecting client-side; with code-created Sessions you can also 303-redirect from the server to `session.url` and skip this entirely. Prefer server redirect — fewer client deps. |
| `react-email` / `@react-email/components` | latest | Author transactional emails as React components, render to HTML for Resend | Recommended for the 6 email templates; pairs natively with Resend. Optional — plain HTML strings also work. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local stack, migrations, edge functions, types | Generate typed DB client (`supabase gen types typescript`) so RLS-scoped queries are type-safe. Treat schema as flagged/irreversible — sign-off before first migration (per brief). |
| Stripe CLI | Local webhook forwarding + event replay | `stripe listen --forward-to localhost:3000/api/stripe/webhook` to test `checkout.session.completed` and to deliberately drop/replay an event for the reconciliation acceptance test. |
| `vercel` CLI / env | Manage env vars + cron config (`vercel.json`) | Keep `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` server-only (never `NEXT_PUBLIC_`). |
| TypeScript | Type safety end-to-end | Use generated Supabase types + `Stripe.Event` discriminated unions in the webhook. |

---

## Installation

```bash
# Core (locked stack)
npm install next@^16.2 react@^19.2 react-dom@^19.2 \
  @supabase/supabase-js@^2.108 @supabase/ssr@^0.12 \
  stripe@^22.2 resend@^6.12

# PWA (Serwist — next-pwa successor)
npm install @serwist/next@^9.5 serwist@^9.5

# Styling
npm install tailwindcss@^4 @tailwindcss/postcss@^4

# Supporting (as needed)
npm install zod react-email @react-email/components idb

# Dev
npm install -D typescript @types/node @types/react supabase
```

---

## Integration Patterns (App Router shapes)

### 1. Supabase clients — anon (RLS) vs service-role (server-only)

Three distinct clients. **Never** ship the service-role key to the browser.

```
lib/supabase/server.ts    -> createServerClient (anon key + cookies) — RLS-scoped, per-request, for user-context reads/writes
lib/supabase/browser.ts   -> createBrowserClient (anon key) — client components
lib/supabase/admin.ts     -> createClient (service_role key, NO cookies) — server-only privileged ops (webhook writes 'paid', reconciliation)
```

Current `@supabase/ssr` cookie contract (verified via Context7 `/supabase/ssr`) uses **`getAll` / `setAll`** — the older single `get/set/remove` API is removed:

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // App Router: cookies() is async in Next 15+
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  );
}
```

- **`middleware.ts`** at repo root refreshes the session on every request (calls `supabase.auth.getUser()` with the same `getAll/setAll` pattern). Required so magic-link sessions stay valid.
- **Always call `auth.getUser()`** (re-validates the JWT server-side), never `getSession()`, for authorization decisions — `getSession()` trusts the cookie without revalidation.

### 2. RLS + field masking for per-row PII gating

- The atomic claim is a **single conditional UPDATE**, concurrency-safe by construction (not by RLS):
  `UPDATE transfers SET status='claimed', driver_id=auth.uid() WHERE id=$1 AND status='paid'` → loser updates 0 rows.
- **Pre-claim driver visibility** must NOT leak PII through the API. Two standard approaches; recommend **(b)** for clarity:
  - (a) RLS policies that allow drivers to `SELECT` only when `status='paid'` (pool) or `driver_id = auth.uid()` (their run), combined with a **`pool` view** that exposes only non-PII columns (date, arrival time, airport, zone, fare, pax, luggage). PII columns (name, contact, exact address, flight no., notes) live in the base table, gated.
  - (b) Split sensitive PII into a **`transfer_pii` child table** with its own RLS: `SELECT` allowed only to the claiming driver (`driver_id = auth.uid()`) or admin. The pool view never joins it. This makes the boundary explicit and audit-friendly.
- Enforce at the **RLS/query layer, not UI** (per brief Key Decision): UI-only masking leaks via the auto-generated REST/`supabase-js` API.
- The webhook's `paid` write uses the **service-role client** (bypasses RLS) — the only place `paid` is set.

### 3. Stripe: code-created Checkout Session

```typescript
// app/api/checkout/route.ts  (POST)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia', // pin explicitly
});

export async function POST(req: Request) {
  // validate booking input (zod), create a 'requested' transfer row first,
  // then create the session referencing it:
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: 'eur', unit_amount: fareCents,
      product_data: { name: 'Airport transfer' } }, quantity: 1 }],
    success_url: `${origin}/status/{CHECKOUT_SESSION_ID}`, // placeholder filled by Stripe
    cancel_url: `${origin}/book/${slug}?cancelled=1`,
    client_reference_id: transferId,          // ties session <-> transfer
    metadata: { transfer_id: transferId },    // available on the webhook event
    customer_email: guestEmail,
  });
  return Response.redirect(session.url!, 303); // server redirect; no client Stripe.js needed
}
```

### 4. Stripe webhook (the money-authoritative path)

```typescript
// app/api/stripe/webhook/route.ts  (POST)
export const runtime = 'nodejs';            // MUST be Node runtime (raw body + crypto)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();            // RAW body — do NOT JSON.parse first
  const sig = req.headers.get('stripe-signature')!;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  // IDEMPOTENCY: insert event.id into webhook_events with a UNIQUE constraint.
  // If insert conflicts -> already processed -> return 200 immediately.
  // Log signature result + outcome (Platform Health requirement).

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    // service-role client: UPDATE transfers SET status='paid' WHERE id = s.metadata.transfer_id AND status='requested'
    // then fire Resend guest confirmation + admin alert
  }
  return new Response(null, { status: 200 });
}
```

Critical: **raw body** (`await req.text()`, not `.json()`), **Node runtime** (Edge runtime lacks the crypto Stripe needs reliably), **idempotency keyed on `event.id`** via a UNIQUE column, **return 200 fast** (do heavy work async or keep it short to avoid Stripe retries/timeouts).

### 5. Resend send (server-only)

```typescript
// lib/email/send.ts  (called from webhook / route handlers / scheduled fn)
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY!);
await resend.emails.send({
  from: 'Balkanity <noreply@yourverifieddomain>', // must be a VERIFIED domain on free tier
  to: guestEmail, subject: '...', react: <ConfirmationEmail .../> });
```

- Wrap in a **send guardrail** that counts daily sends (Platform Health email-cap gauge) and short-circuits past ~90/day to protect the 100/day cap. Drivers use in-app feed + opt-in daily digest (1 email) instead of per-transfer email.
- Rate limit is **5 requests/second** on all accounts — batch/sequence sends if needed.

### 6. Reconciliation sweep — Supabase Cron (pg_cron + pg_net), NOT Vercel cron

```sql
-- runs in Postgres; resource-limited, available on free tier
select cron.schedule(
  'reconcile-stripe', '*/20 * * * *',  -- every 20 min
  $$ select net.http_post(
       url := 'https://<ref>.functions.supabase.co/reconcile',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='svc'))
     ); $$
);
```

The Edge Function lists recent Stripe `checkout.session.completed` (or queries Stripe for paid sessions) and flags any **Stripe-paid-but-no-paid-transfer** rows. This catches a deliberately-dropped webhook (acceptance criterion). Vercel Hobby cron (daily, hour-imprecise) is added only as a **once/day backstop**.

---

## Verified Provider Facts (the brief's VERIFY list)

| # | Claim to verify | Verified finding | Confidence | Source |
|---|-----------------|------------------|------------|--------|
| **Stripe — EEA cards** | 1.5% + €0.26 | **1.5% + €0.25** standard EEA consumer cards (Bulgaria account). *(Fixed fee is €0.25, not €0.26; for BG-lev settlement the fixed fee is shown as лв0.50.)* Premium EEA cards: 1.9% + €0.25. | HIGH | stripe.com/en-bg/pricing |
| **Stripe — non-EEA / intl** | 3.25% + €0.26 | **3.25% + €0.25** for international / non-EEA cards. | HIGH | stripe.com/en-bg/pricing |
| **Stripe — UK cards** | 2.5% + €0.26 | **2.5% + €0.25** for UK cards on an EEA/BG account. | HIGH | stripe.com/en-bg/pricing |
| **Stripe — currency conversion** | +2% | **+2%** currency-conversion surcharge when conversion is required (applies on UK + international). | HIGH | stripe.com/en-bg/pricing |
| **Stripe — refund fees** | refunds don't return the original fee | **Confirmed.** Issuing a refund is free, but the **original processing/conversion fee is NOT returned**. | HIGH | stripe.com/en-bg/pricing + Stripe support |
| **Resend — daily cap** | 100/day | **100 emails/day.** Both sent + received count; multiple recipients count separately. | HIGH | resend.com/docs/knowledge-base/account-quotas-and-limits |
| **Resend — monthly cap** | 3000/month | **3,000 emails/month.** | HIGH | resend.com docs |
| **Resend — verified domains** | 1 verified domain | **1 verified domain** on free tier (per multiple secondary sources reporting the May-2026 free tier). Official quota page confirms 100/day + 3000/mo + 5 req/s but did **not** explicitly state the domain count in the fetched section. | MEDIUM (caps HIGH, domain-count count MEDIUM) | resend.com docs + automationatlas.io free-tier writeup (May 2026) |
| **Supabase — DB size** | ~500MB | **500 MB database** + 1 GB file storage, free tier. | HIGH | Supabase pricing (multiple 2026 sources) |
| **Supabase — edge invocations** | 500k/mo | **500,000 Edge Function invocations/month.** | HIGH | Supabase pricing (2026 sources) |
| **Supabase — inactivity pause** | pause after 7 days | **Confirmed: free projects pause after 7 days of inactivity.** Up to 2 active projects on free tier. | HIGH | Supabase pricing (2026 sources) |
| **Supabase — keep-alive needed** | add keep-alive | **Confirmed required.** A paused project stops running pg_cron, so the reconciliation sweep would silently stop. Add a lightweight keep-alive (a tiny scheduled query/ping, or the Vercel daily backstop hitting the DB) to prevent the 7-day pause during the pilot. | HIGH (inference from pause behaviour; well-documented community pattern, e.g. supabase-pause-prevention) | github.com/travisvn/supabase-pause-prevention |
| **Supabase — pg_cron / scheduled functions on free tier** | confirm availability for 15–30 min sweep | **Available on free tier.** Supabase collaborator: "Cron is only limited by the resources it uses CPU/Memory/Disk wise on any tier." Min interval supports sub-minute → 15–30 min is fine. Combine with `pg_net` to invoke an Edge Function. Constraints: ≤8 concurrent jobs, ≤10 min per job. | HIGH | Supabase Cron docs + github.com/orgs/supabase/discussions/37405 |
| **Vercel Hobby cron** | ~once/day, imprecise → prefer Supabase | **Confirmed.** Hobby = **1 cron job run per day max**; deployment fails if expression is more frequent. Timing is **hour-imprecise** (`0 1 * * *` fires anytime 01:00–01:59). Therefore Supabase Cron is preferred for the 15–30 min sweep; Vercel cron is a daily backstop only. | HIGH | vercel.com/docs/cron-jobs/usage-and-pricing |
| **Next.js PWA tooling** | service worker / install / offline on current Next + Vercel | **Use Serwist (`@serwist/next` `^9.5`).** It is the maintained successor to `next-pwa`; works with App Router on Next 16 + Vercel. You author `app/sw.ts`, wrap `next.config` with `withSerwist`, and provide `manifest.webmanifest` for install. `next-pwa` is effectively unmaintained against Next 15/16 — avoid. | HIGH | Serwist docs/npm + multiple 2026 Next.js-16 PWA guides (LogRocket, buildwithmatija) |
| **Stripe API version** | (current) | **`2026-05-27.dahlia`** is the latest API version; `stripe-node` v22.x is current. Pin the version string in the SDK constructor. | HIGH | github.com/stripe/stripe-node CHANGELOG + docs.stripe.com/sdks/versioning |

> **Discrepancy to flag for downstream planning:** the brief's pricing list uses a **€0.26** fixed fee; the current published Stripe BG pricing shows **€0.25**. Use €0.25 (and note лв0.50 if settling in BGN). All percentages match the brief.

---

## Alternatives Considered (within the locked stack only)

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@serwist/next` (PWA) | Hand-rolled service worker | If offline needs stay trivial (install + manifest, no caching strategy), a hand-rolled SW gives full control with zero deps. Serwist still recommended for precaching the app shell + runtime caching. |
| `@serwist/next` | `next-pwa` / `@ducanh2912/next-pwa` | Do **not** use original `next-pwa` (unmaintained vs Next 16). `@ducanh2912/next-pwa` is a community fork but the author redirected effort into Serwist — prefer Serwist. |
| Server 303-redirect to `session.url` | `@stripe/stripe-js` client redirect | Use client redirect only if you need client-side Stripe.js features; otherwise server redirect removes a client dependency. |
| `transfer_pii` child table (PII split) | RLS column policies + non-PII view | Column-policy + view works; the child-table split is recommended for an explicit, auditable PII boundary. Pick one during schema design (flagged for review). |
| Supabase Cron for sweep | Vercel Hobby cron | Vercel cron only as a daily backstop — its daily/imprecise nature can't do a 15–30 min reconciliation. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated; replaced by `@supabase/ssr`. Uses the old cookie API incompatible with current App Router. | `@supabase/ssr` `^0.12` with `getAll/setAll`. |
| `supabase.auth.getSession()` for authz | Trusts the cookie without revalidating the JWT — spoofable for authorization. | `supabase.auth.getUser()` (revalidates server-side). |
| `next-pwa` (original) | Unmaintained against Next 15/16; build breakage. | `@serwist/next` `^9.5`. |
| Dashboard Stripe Payment Links | Brief forbids; not programmatically tied to a transfer row, no metadata/client_reference_id control. | Code-created `checkout.sessions.create` with `metadata.transfer_id`. |
| Parsing webhook body with `.json()` | Breaks signature verification (needs the exact raw bytes). | `await req.text()` + `stripe.webhooks.constructEvent`. |
| Edge runtime for the Stripe webhook | Raw-body + crypto handling is fragile on Edge. | `export const runtime = 'nodejs'`. |
| Setting `paid` from the success_url redirect / client | Redirects are spoofable; violates the core money invariant. | Set `paid` ONLY in the signature-verified webhook via service-role client. |
| Service-role key in any `NEXT_PUBLIC_` var or client component | Full RLS bypass leaks to browser. | Keep service-role + Stripe secret + webhook secret + Resend key server-only. |
| Vercel Hobby cron for the reconciliation sweep | Daily + hour-imprecise. | Supabase Cron (pg_cron + pg_net) every 15–30 min. |
| Per-transfer email to drivers | Blows the Resend 100/day cap. | In-app notification feed + opt-in daily digest (1 email/driver/day). |

---

## Stack Patterns by Variant

**If offline scope = install shell + read-only cached pages (v1 recommended):**
- Serwist precache the app shell + runtime-cache GET pages; skip `idb`.
- Because v1 is a pilot; offline *write* (queued claims) adds concurrency complexity that conflicts with the atomic-claim guarantee.

**If offline scope later grows to queued actions:**
- Add `idb` + a Background Sync strategy, but route all claims through the server's conditional UPDATE so first-to-claim semantics hold — never resolve claims optimistically offline.

**If the pilot stays on free tier (v1):**
- Keep the Supabase keep-alive active to avoid the 7-day pause stopping the sweep.
- Watch the Resend daily gauge; the ~4 emails/transfer math means ~25 transfers/day before the cap — comfortably above the ~10-transfer pilot, but the guardrail stays.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@^16.2` | `react@^19.2` | React 19 is the supported runtime for Next 16 App Router. |
| `@supabase/ssr@^0.12` | `@supabase/supabase-js@^2.108` | `ssr` wraps `supabase-js`; keep both current. Uses `getAll/setAll` cookie API. |
| `@serwist/next@^9.5` | `serwist@^9.5` + `next@^16` | Keep `@serwist/next` and `serwist` on the same major. Works on App Router + Vercel. |
| `stripe@^22.2` | API `2026-05-27.dahlia` | Pin `apiVersion` in the constructor; SDK v22 supports the dahlia line. |
| `tailwindcss@^4` | `@tailwindcss/postcss@^4` | v4 uses the PostCSS plugin + CSS-first `@theme`; no JS config object needed. |
| `resend@^6.12` | Node runtime route handlers | Send server-side only; 5 req/s rate limit. |

---

## Sources

- Context7 `/supabase/ssr` — current `createServerClient` `getAll/setAll` cookie contract, middleware session refresh — HIGH
- Context7 `/vercel/next.js` — current stable version line (v16.2.x) — HIGH
- npm registry (`npm view`) — pinned current versions: next 16.2.9, react 19.2.7, @supabase/ssr 0.12.0, @supabase/supabase-js 2.108.2, stripe 22.2.1, serwist/@serwist/next 9.5.11, resend 6.12.4 — HIGH
- stripe.com/en-bg/pricing — BG card fees (EEA 1.5%+€0.25, premium 1.9%, UK 2.5%, intl 3.25%, +2% conversion, refunds don't return original fee) — HIGH
- docs.stripe.com/sdks/versioning + github.com/stripe/stripe-node CHANGELOG — latest API version `2026-05-27.dahlia`, SDK v22 — HIGH
- resend.com/docs/knowledge-base/account-quotas-and-limits — 100/day, 3000/mo, 5 req/s — HIGH; verified-domain count corroborated by automationatlas.io (May 2026) — MEDIUM
- Supabase pricing pages + 2026 secondary writeups (uibakery, itpathsolutions, iloveblogs) — 500MB DB, 1GB storage, 500k edge invocations/mo, 7-day pause, 2 active projects — HIGH
- supabase.com/docs/guides/cron + supabase.com/docs/guides/functions/schedule-functions — pg_cron + pg_net scheduling, ≤8 concurrent / ≤10 min per job — HIGH
- github.com/orgs/supabase/discussions/37405 — pg_cron available on free tier ("limited only by resources on any tier") — HIGH
- github.com/travisvn/supabase-pause-prevention — keep-alive pattern for 7-day inactivity pause — MEDIUM (community)
- vercel.com/docs/cron-jobs/usage-and-pricing — Hobby = 1/day, hour-imprecise timing — HIGH
- Serwist docs/npm + 2026 Next.js-16 PWA guides (LogRocket, buildwithmatija, mikekubn) — Serwist as next-pwa successor on App Router + Vercel — HIGH

---
*Stack research for: airport-transfer booking + driver-dispatch PWA (Balkanity Welcome Pickup)*
*Researched: 2026-06-17*
