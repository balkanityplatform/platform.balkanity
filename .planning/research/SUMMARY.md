# Project Research Summary

**Project:** Balkanity Platform — Welcome Pickup (v1)
**Domain:** Prepaid airport-transfer booking + self-claim driver dispatch PWA (3-actor: Admin, Driver, Guest)
**Researched:** 2026-06-17
**Confidence:** HIGH

## Executive Summary

Welcome Pickup is the first module of a multi-module platform for a Bulgarian travel agency. Guests follow a per-destination link, fill a short form, and prepay an airport-to-property transfer via Stripe Checkout; Balkanity drivers self-claim paid transfers from a shared pool (first-to-claim owns it); an Admin console manages supply and operations. The project's hardest problems are not UI — they are correctness invariants: money state must be set only by a cryptographically verified Stripe webhook, the claim race must be won by exactly one driver under concurrency, and PII must be invisible to unclaimed drivers not just in the UI but in the API payload itself. All three are provable, testable definitions of done for the 10-transfer pilot.

The recommended approach follows a strict build/dependency order that mirrors hard data dependencies: shared platform foundations first (auth/roles, typed Supabase clients, the platform/module seam), then supply-side onboarding so a destination exists to book, then the payments trust spine (Checkout + webhook + webhook_events log), then the transfer entity and booking form wired to that spine, then the crown-jewel correctness work (RLS, masked pool view, atomic claim_transfer() RPC), then driver/admin views, and finally notifications and Platform Health as top-level observers. Skipping or reordering this chain causes rework; retrofitting the platform/module boundary after module code exists is called out explicitly in the brief as the highest-cost mistake.

The primary operating constraint for the pilot is the Resend free-tier daily cap of 100 emails. At ~4 emails per transfer (guest confirmation, driver-assigned, driver-arrived, admin alert) the cap is comfortable for ~25 transfers/day, but any per-transfer driver email blows it immediately. The strategy — driver in-app feed plus opt-in daily digest — is correct and must be enforced from the start. The second operating constraint is the Supabase free-tier 7-day inactivity pause, which silently stops pg_cron and therefore the reconciliation sweep. A lightweight external keep-alive (GitHub Actions or Vercel cron hitting the DB) must be deployed before the real-money pilot; otherwise the DoD condition (reconciliation catches a deliberately-dropped webhook) cannot be met. For live-money operation, upgrading to Supabase Pro is the lower-risk choice and should be a conscious decision before launch.

---

## Key Findings

### Verified Provider Facts

These were flagged for verification in PROJECT.md. All are now confirmed at HIGH confidence and must inform design, pricing, and operations decisions.

| Claim | Verified Finding | Impact |
|-------|-----------------|--------|
| Stripe BG fixed fee EUR 0.26 | **EUR 0.25** (not EUR 0.26) for EEA consumer cards on a BG account. BGN settlement shows lv0.50. Non-EEA: 3.25%+EUR 0.25. UK: 2.5%+EUR 0.25. +2% conversion surcharge applies for non-EUR currencies. | Update any pricing docs or admin UI that quote EUR 0.26. Choose settlement currency (EUR vs BGN) before building the refund display. |
| Stripe refunds return the original fee | **Confirmed non-return.** Processing, conversion, and Connect fees are retained by card networks/banks. | Admin refund UI must surface "this refund does not recover the ~EUR X processing fee" so refunds are a conscious, informed decision. |
| Resend 100/day cap | **Confirmed binding at 100 emails/day** (both sent + received; multiple recipients count separately). 3,000/month, 5 req/s rate limit. | Design driver notifications as in-app feed + opt-in digest from day one. Guest emails only on `claimed` and `arrived`. Email-cap gauge + email_log are non-optional. |
| Resend verified domain | **1 verified domain** on free tier (domain-count MEDIUM confidence from secondary sources; quota page confirmed 100/day + 3000/mo + 5 req/s). | Configure the sending domain before the first real email send; unverified domain = spam folder, which looks identical to "email didn't send" from the guest's perspective. |
| Supabase free-tier pause | **Confirmed: pauses after 7 days of DB inactivity.** Up to 2 active projects free. | External keep-alive required. Pause = pg_cron stops = reconciliation sweep stops = dropped webhooks go undetected during the real-money pilot. |
| Supabase pg_cron on free tier | **Available on free tier** ("limited only by resources on any tier"). Sub-minute to multi-minute intervals supported. Constraints: <=8 concurrent jobs, <=10 min per job. | Use pg_cron + pg_net + Edge Function for the 15-30 min reconciliation sweep. |
| Vercel Hobby cron | **1 cron job/day max, hour-imprecise** (`0 1 * * *` fires anywhere 01:00-01:59). | Vercel cron = daily backstop ONLY. Never the primary reconciliation scheduler. |
| PWA tooling for Next 16 | **Use `@serwist/next` `^9.5`** (not `next-pwa`). `next-pwa` is unmaintained against Next 15/16 and will cause build breakage. | Lock PWA library to Serwist; do not import `next-pwa` or `@ducanh2912/next-pwa`. |

### Recommended Stack (Pinned Versions)

The stack is locked by the brief. This research confirms current versions and integration shapes.

**Core (locked):**
- `next@^16.2` (16.2.9) — App Router; route handlers for Stripe webhook + Checkout session creation
- `react@^19.2` (19.2.7) — transitive dep of Next 16; React Server Components default
- `tailwindcss@^4` — CSS-first `@theme` config; map six brand tokens as CSS variables, no JS config object
- `@supabase/supabase-js@^2.108` (2.108.2) — DB/Auth/Storage client
- `@supabase/ssr@^0.12` (0.12.0) — App Router auth via `createServerClient`/`createBrowserClient`; **use `getAll/setAll` cookie API** (old `get/set/remove` is removed); never use the deprecated `@supabase/auth-helpers-nextjs`
- `stripe@^22.2` (22.2.1) — Checkout + webhook; pin `apiVersion: '2026-05-27.dahlia'` in the SDK constructor
- `resend@^6.12` (6.12.4) — transactional email; server-only; 5 req/s rate limit

**PWA (non-deferrable decision — Serwist, not next-pwa):**
- `@serwist/next@^9.5` (9.5.11) — service worker / precaching / offline shell; the maintained successor to `next-pwa`
- `serwist@^9.5` (9.5.11) — Workbox-based SW runtime; install alongside `@serwist/next`; keep both on the same major

**Supporting:**
- `zod@^3` or `^4` — server-side validation at booking route + webhook trust boundaries; never trust client
- `react-email` / `@react-email/components` — author the 6 email templates as React components; pairs natively with Resend
- `idb@^8` — optional; v1 offline scope is install shell + read-only cached pages, likely deferrable
- `server-only` package — import in every module that holds service-role or Stripe secret keys to make a client-import a build error

**Three distinct Supabase clients (never mix):**
- `lib/supabase/server.ts` — `createServerClient` (anon key + cookies) — RLS-scoped, per-request, user-context reads/writes
- `lib/supabase/browser.ts` — `createBrowserClient` (anon key) — client components
- `lib/supabase/admin.ts` — `createClient` (service_role key, NO cookies) — server-only; webhook `paid` writes + reconciliation only

**Always `auth.getUser()`, never `auth.getSession()` for authorization decisions** — `getSession()` trusts the cookie without re-validating the JWT.

### Expected Features

**Must have (table stakes — P1):**
- Verified idempotent webhook sets `paid` + `webhook_events` log (raw body + `constructEvent` + UNIQUE `event.id`)
- Slug-link booking form + code-created Stripe Checkout Session (metadata `transfer_id`)
- Admin onboarding: company / property / destination + price + commission per destination
- Atomic first-to-claim via `claim_transfer()` SECURITY DEFINER RPC + "already claimed" graceful loss UX
- PII masking enforced at data layer: masked `wp_pool` view pre-claim; full row via RLS to claiming driver + admin only
- Transfer lifecycle state machine: requested -> paid -> claimed -> en_route -> arrived -> picked_up -> completed (+ cancelled)
- Magic-link guest status page reflecting full lifecycle (including `en_route` which sends no email — status page is the only `en_route` surface for guests)
- Guest confirmation email + admin booking alert (on `paid`); driver-assigned email (on `claimed`); driver-arrived email (on `arrived`)
- Driver invite flow (closed pool; no open signup)
- Driver "My run" list sorted by arrival time ascending + per-state advancement controls (52px primary CTAs)
- In-app notification feed/bell (driver-primary) + opt-in daily driver digest
- Admin transfers list/detail + assign/reassign/cancel + manual Stripe refund (with non-recoverable-fee disclosure)
- Platform Health: reconciliation sweep (pg_cron + Edge Function, every 15-30 min) + email-cap gauge + stuck-transfer alerts
- PWA shell (installable, offline-aware) + brand tokens + Montserrat + EN/BG toggle
- Upfront non-refundable disclosure at checkout *(research-surfaced gap — cheap chargeback insurance)*
- Payment record visible on guest status page / in confirmation email *(research-surfaced gap — real-money proof)*
- Driver "My run" sorted by arrival time *(research-surfaced gap — fulfilment hazard without it)*

**Should have (competitive differentiators, can follow pilot validation):**
- Guest "driver on the way" reassurance via status page live reflection of `en_route` (already implied; lean into it)
- Named destination zone shown pre-claim (meaningful area name, not just lat/long)
- Reconciliation provability as operator trust signal

**Defer to v1.x after validation:**
- PWA web push (replace driver-arrived email if email latency proves painful on travel day)
- Guest 24h-before reminder email (cap-sensitive; only worthwhile if booking lead-times grow)
- Downloadable PDF/VAT receipt (only if business guests request it)

**Defer to v2+:**
- Stripe Connect commission payout (commission recorded in v1 only)
- Flight tracking / dynamic pickup time
- Property self-service portal
- SMS/WhatsApp channel
- Auto-dispatch
- Second platform module

### Architecture Approach

The decisive structural fact: this is the **first module of a multi-module platform**. Every boundary decision is simultaneously a decision about how the second module (tours, car rental) plugs in without rework. The seam must exist in three places at once — database (table prefix `wp_` or dedicated Postgres schema), server code (`platform/` vs `modules/welcome-pickup/`), and UI (shared design-system + shell vs module routes). A seam that exists in only one of those three leaks. The dependency arrow points ONE way: modules import `platform/*`; platform never imports module code. Enforce with an ESLint `no-restricted-imports` rule from commit one. Retrofitting this boundary after module code exists is the most expensive mistake in the brief.

**Major components and responsibilities:**

| Component | Layer | Responsibility |
|-----------|-------|---------------|
| Platform: auth & roles | `platform/auth/` | Identity, role assignment (admin/driver/guest), magic-link sessions |
| Platform: companies & properties | `platform/companies/` | Org/property/destination records; price + commission config; FK target for all modules |
| Platform: payments | `platform/payments/` | `createCheckoutSession()`, webhook verify, `webhook_events` log, refund hooks |
| Platform: notifications | `platform/notifications/` | In-app feed/bell, Resend wrapper, email_log, cap gauge, digest batching |
| Platform: health | `platform/health/` | Webhook log reader, reconciliation sweep, email-cap alarm, stuck-transfer alerts |
| Platform: design system | `platform/ui/` | Tokens (six brand colours + Montserrat), StatusDot, Button, logo/pictogram assets |
| Platform: PWA shell | `app/(platform)/layout.tsx` + `app/sw.ts` | Manifest, Serwist service worker, install prompt, offline shell |
| Module: booking | `modules/welcome-pickup/booking/` | Slug resolution, guest form, kicks off Checkout |
| Module: transfer entity | `modules/welcome-pickup/transfer/` | `wp_transfers` lifecycle state machine; `paid` set ONLY by webhook |
| Module: claim pool | `modules/welcome-pickup/claim/` | `wp_pool` masked view, `claim_transfer()` SECURITY DEFINER RPC |
| Module: transfer views | `modules/welcome-pickup/views/` | Pool, my-run, transfer-detail (driver); list/detail (admin) |

### Critical Pitfalls

**P1 — CRITICAL (any one of these fails the DoD or leaks money/PII):**

1. **Setting `paid` outside the verified webhook.** The success URL redirect is spoofable and may not fire. `paid` is set in exactly ONE code path: the signature-verified `checkout.session.completed` handler using `stripe.webhooks.constructEvent(rawBody, sig, secret)` where `rawBody = await req.text()` (never `.json()`), on the `nodejs` runtime (not Edge), writing via the service-role client. The success page is display-only. Enforce as a grep gate: no `UPDATE ... status = 'paid'` anywhere except the webhook module.

2. **Webhook body parsing corrupting the Stripe signature.** Calling `req.json()` before `constructEvent` re-serializes the body, making the HMAC fail. Devs then disable the check "to make it work" — opening forged-paid injection. Always `await req.text()` and pass the exact string to `constructEvent`. Return 400 on failure.

3. **Non-idempotent webhook double-processing Stripe retries.** Stripe delivers at-least-once for up to ~72h. Implement `webhook_events(event_id TEXT UNIQUE, ...)` — insert the event ID first; on unique-constraint conflict, return 200 immediately with no side effects. Do the insert and the `paid` transition in the same DB transaction.

4. **Double-claim via read-then-write instead of atomic conditional UPDATE.** The fix: a single statement `UPDATE wp_transfers SET status='claimed', driver_id=$1, claimed_at=now() WHERE id=$2 AND status='paid' RETURNING *`. Under Postgres READ COMMITTED, the second concurrent writer blocks on the row lock, re-evaluates the WHERE against the committed `status='claimed'`, matches 0 rows, and is a no-op. RLS alone does NOT prevent double-claims.

5. **UI-only PII masking — two distinct read paths are required.** The anon key ships to the browser; anyone inspecting the network tab reads the full JSON payload regardless of what React renders. Pre-claim drivers must query a view that physically omits PII columns (`wp_pool`). Full PII is available only via the base table's RLS, restricted to `driver_id = auth.uid()` and admin. Test: call pool endpoint with a non-claiming driver's JWT and assert zero PII keys in the payload.

**P2 — HIGH (silent operational failure during the pilot):**

6. **Supabase free-tier 7-day inactivity pause stops pg_cron.** The keep-alive must come from OUTSIDE Supabase. For a real-money pilot, Supabase Pro should be explicitly decided before launch.

7. **Resend 100/day cap exhaustion silently prevents guest confirmation delivery.** No per-transfer driver email path should exist. The email_log and cap gauge (alarm at ~80/day) are mandatory, not optional.

8. **Reconciliation sweep on Vercel Hobby cron is too coarse.** Hobby = 1/day max, hour-imprecise. Use Supabase pg_cron + pg_net + Edge Function for the 15-30 min sweep.

9. **Module/platform boundary erosion.** Use polymorphic `(entity_type TEXT, entity_id UUID)` references in shared tables. Every shared-foundation PR: "Would a car-rental module need to change this?"

---

## Non-Negotiable Correctness Invariants

These three invariants are the project's binary pass/fail definition of done for the 10-transfer pilot.

### Invariant 1: Paid-only-via-verified-webhook

The only path that may write `status='paid'`:
```
stripe.webhooks.constructEvent(await req.text(), sig, WEBHOOK_SECRET)  // signature first
  -> insert webhook_events(event_id) UNIQUE constraint                  // idempotency gate
  -> if conflict: return 200 immediately, zero side effects
  -> UPDATE wp_transfers SET status='paid' WHERE id=... AND status='requested'  // service-role only
```

Verified by: forge a success-URL request -> no state change; replay same event_id twice -> one effect; send unsigned POST -> 400.

### Invariant 2: Atomic claim concurrency-safety

```sql
UPDATE wp_transfers
   SET status='claimed', driver_id=auth.uid(), claimed_at=now()
 WHERE id=$1 AND status='paid'
RETURNING *;
-- 1 row = winner; 0 rows = already claimed (normal outcome, not an error)
```

RLS is NOT the concurrency control. The `WHERE status='paid'` predicate in the atomic UPDATE is. Postgres READ COMMITTED guarantees the second concurrent writer sees the committed `status='claimed'` and affects 0 rows. Verified by: N simultaneous HTTP claim requests -> exactly 1 wins, N-1 receive "already claimed". This test must be automated and must pass before the claim phase is considered done.

### Invariant 3: RLS/PII split — two distinct read paths (anon key ships to browser so UI masking is meaningless)

Pre-claim pool path: `SELECT [date, arrival_time, airport, zone, fare, pax, luggage] FROM wp_pool WHERE status='paid' AND driver_id IS NULL` — view physically omits all PII columns; any driver with the anon key can call this safely.

Post-claim detail path: `SELECT * FROM wp_transfers WHERE id=$1` — RLS policy: `driver_id = auth.uid() OR is_admin(auth.uid())`; returns full PII including name, contact, exact address, flight no., notes.

The two paths must be structurally distinct — not the same query with a UI filter. Verified by: call pool endpoint with non-claiming driver's JWT -> payload contains zero PII keys.

---

## Implications for Roadmap

The build order below is a hard dependency chain, not a preference. Each component is a precondition for the next.

### Phase 1: Platform Foundation — Seam, Auth, Design System, PWA Shell

**Rationale:** Everything else depends on identity, typed Supabase clients, and the platform/module directory seam. Establishing these in phase 1 means every subsequent phase writes code in the right place from commit one. The PWA library decision (Serwist) must also be locked here so it is never revisited. This phase is non-deferrable.

**Delivers:**
- `platform/` vs `modules/` directory structure + ESLint `no-restricted-imports` rule (modules import platform, never the reverse)
- Three Supabase clients (browser/server/admin) with `getAll/setAll` cookie contract; `server-only` enforced on admin client
- Supabase Auth + `app_users` + roles (admin/driver/guest); magic-link session handling; `middleware.ts` refreshing sessions
- `@serwist/next` + `serwist` installed; `app/sw.ts`; `manifest.webmanifest`; offline shell page; `withSerwist` wrapping `next.config`
- Tailwind v4 CSS-first `@theme` with all six brand tokens (teal, teal2, amber, coral, slate, grey) + Montserrat 400/500/600/700/800
- StatusDot component (coloured dot + text label, never colour alone), Button (52px primary), real logo/pictogram assets wired in
- EN/BG toggle scaffold

**Avoids:** Boundary erosion (Pitfall 9), service-role key leaking to client (Pitfall 7), stale auth HTML cached by service worker (Pitfall 12)

**Research flag:** Standard patterns — skip research phase during planning.

---

### Phase 2: Supply-Side Onboarding — Companies, Properties, Destinations

**Rationale:** The booking form reads destination + price from these records. Nothing can be booked until at least one destination with a slug and fare exists. This phase is also the first real test of admin-only RLS and the `platform/companies/` boundary (no transfer-specific types here).

**Delivers:**
- Admin console CRUD: company -> property -> destination + price (fare_cents) + commission per destination
- Per-destination `slug` field (unique, URL-safe) as the booking link entry point
- Admin-only RLS policies on company/property/destination tables
- Driver invite flow (invite -> magic-link -> driver role assignment; closed pool, no open signup)
- Schema migration: platform tables in `public` (companies, properties, destinations, app_users, roles) — sign-off required before applying

**Avoids:** Module-specific types leaking into platform tables

**Research flag:** Standard CRUD patterns — skip research phase.

---

### Phase 3: Payments Trust Spine — Checkout, Webhook, webhook_events Log

**Rationale:** `paid` is the precondition for the entire claim pool. Build and prove this path — including the `webhook_events` dedup table and the three invariant tests — before any claim or transfer-view code. Use the Stripe CLI to forward webhooks locally and to replay events for idempotency testing.

**Delivers:**
- `POST /api/checkout` route handler: zod-validate booking input, create `wp_transfers` row (`status='requested'`), create Stripe Checkout Session with `metadata.transfer_id` + `client_reference_id`, 303 server redirect to `session.url` (no `@stripe/stripe-js` needed)
- `POST /api/stripe/webhook` route handler: `export const runtime = 'nodejs'`; `await req.text()` raw body; `constructEvent`; UNIQUE `webhook_events(event_id)` insert-first dedup; `setTransferPaid()` via service-role client on `checkout.session.completed` where `payment_status === 'paid'`; return 200 fast
- `webhook_events` table: `event_id TEXT PRIMARY KEY`, `event_type`, `signature_valid BOOL`, `outcome TEXT`, `created_at`
- Guest success redirect page (display-only; polls/subscribes to transfer status; never writes `paid`)
- Stripe API version `2026-05-27.dahlia` pinned; `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Vercel env, never `NEXT_PUBLIC_`
- Processing fee recorded per transaction (EUR 0.25 fixed for EEA cards); refund non-recovery noted

**Avoids:** Pitfalls 1, 2, 3, 11 (paid-on-redirect, mangled body, duplicate processing, refund economics)

**Research flag:** Standard patterns confirmed. Verify raw-body handling in Next 16 App Router with a forged-POST test before marking done.

---

### Phase 4: Transfer Entity + Booking Form

**Rationale:** With payments proven, wire the booking form to the Checkout path and define the transfer lifecycle. First real user-visible feature. Schema is flagged/irreversible — sign-off required before the migration.

**Delivers:**
- `wp_transfers` table: full lifecycle fields (status, driver_id, guest_email, guest_phone, fare_cents, commission_cents, arrival_time, airport, destination_zone, exact_address, guest_name, guest_contact, flight_no, notes, stripe_session_id, created_at, claimed_at, etc.)
- Guest booking form at `/[destinationSlug]`: slug -> destination lookup, price display, non-refundable disclosure checkbox/line, form (email required, phone optional), submit -> Checkout
- Magic-link guest status page at `/status/[token]`: full lifecycle timeline (coloured dot + label for all states including `en_route`), driver first name + contact visible after `claimed`, "Paid EUR X on {date}" receipt line, Supabase Realtime subscription for live updates
- Transfer lifecycle state machine with server-side transition guards
- Schema migration: `wp_transfers` — sign-off gate before applying

**Avoids:** Pitfall 1 (success page never writes `paid`), Pitfall 12 (dynamic status data never served from SW cache)

**Research flag:** Standard Next.js + Supabase form patterns — skip research phase.

---

### Phase 5: Claim Correctness — RLS, Masked Pool View, Atomic Claim RPC

**Rationale:** Crown-jewel correctness phase. The remaining two DoD conditions live here: 0 double-claims under concurrency, and PII visible only to the claiming driver + admin. Build and test both before any driver UI that depends on them. Concurrency test is a mandatory gate before closing this phase.

**Delivers:**
- `wp_pool` view: physically omits all PII columns; `security_invoker = true`; `SELECT` grant to `authenticated`; filters `status='paid' AND driver_id IS NULL`
- `claim_transfer(p_transfer_id UUID)` SECURITY DEFINER RPC: validates driver role, atomic `UPDATE ... WHERE id=$1 AND status='paid' RETURNING *`; raises exception on 0 rows (already claimed)
- RLS policies on `wp_transfers`: drivers can SELECT where `driver_id = auth.uid()` (full PII for their own runs); admins always; guests see their own via token mapping
- Concurrency test: N simultaneous `claim_transfer()` calls on one transfer -> exactly 1 winner, N-1 exceptions; automated; must pass before phase closes
- PII boundary test: pool endpoint called with non-claiming driver JWT -> zero PII keys in response payload
- Schema migration: `wp_pool` view + RLS policies + `claim_transfer()` RPC — sign-off required before applying

**Avoids:** Pitfalls 4, 5, 6 (double-claim, UI-only masking, RLS-as-concurrency-control)

**Research flag:** Concurrency semantics confirmed (Postgres READ COMMITTED EvalPlanQual re-check). Requires explicit adversarial testing as a gate.

---

### Phase 6: Driver and Admin Views

**Rationale:** With the correct data layer in place, wire the driver-facing claim pool, "My run" list, and transfer detail, and the admin transfers list and operations. Correctness rests on the Phase 5 data layer.

**Delivers:**
- Driver claim pool: reads from `wp_pool` view; tap-to-claim calls `claim_transfer()` RPC; "already claimed" as graceful normal outcome (not error), pool refreshes via Realtime
- Driver "My run": transfers where `driver_id = auth.uid()`; sorted by `arrival_time ASC`; "next pickup" indicator; per-state advancement controls (52px CTAs); en_route -> arrived -> picked_up -> completed
- Driver transfer detail: full PII displayed post-claim; driver-arrived status trigger
- Admin transfers list: filter by lifecycle status; stuck/unclaimed highlighted (coral); sort by arrival time
- Admin transfer detail: assign/reassign (in-app notification to old + new driver); cancel; manual Stripe refund via `platform.payments.refund()` with non-recoverable-fee disclosure in the UI
- Brand design applied: coloured dot + text label for status (never colour alone), 44px min hit targets, warm light surfaces (guest/driver), slate console (admin)

**Avoids:** Pitfall 12 (claim/status data NetworkFirst, never SW-cached), Pitfall 4 (no read-then-write anywhere in the claim path)

**Research flag:** Standard Next.js RSC + client component patterns — skip research phase.

---

### Phase 7: Notifications — In-App Feed + Resend Wrapper + Guardrails

**Rationale:** Notifications observe lifecycle events from Phases 3-6. Building them here ensures the email templates and cap guardrails are wired to real lifecycle triggers. Must remain generic (polymorphic entity references, template-based email calls) — no `transfer_id` columns on shared tables — so the second module can reuse without changes.

**Delivers:**
- `notifications` table: `(id, user_id, entity_type TEXT, entity_id UUID, type TEXT, read BOOL, created_at)` — polymorphic, no `transfer_id` column
- Supabase Realtime subscription on `notifications` for driver bell/feed
- `platform/notifications/sendEmail()` wrapper: checks `email_log` before sending (idempotency), increments daily count, short-circuits above ~90/day with alarm, calls Resend at <=5 req/s
- `email_log` table: `(id, to_address, template, entity_type, entity_id, sent_at, success BOOL, error TEXT)`
- 6 email templates (react-email): guest confirmation, guest driver-assigned, guest driver-arrived, admin booking alert, driver invite, driver daily digest
- Opt-in daily driver digest: batches new-transfer + assigned/unassigned notifications into one email per driver per day; zero per-transfer driver email path
- Verified sending domain configured in Resend

**Avoids:** Pitfall 9 (cap exhaustion), Pitfall 3 (duplicate sends on webhook retry), Pitfall 13 (no transfer-specific types in the shared wrapper)

**Research flag:** Standard patterns — skip research phase.

---

### Phase 8: Platform Health — Reconciliation, Email-Cap Gauge, Stuck-Transfer Alerts, Keep-Alive

**Rationale:** Platform Health is the top-level observer — fully wirable only once all the things it observes exist. The reconciliation sweep catching a deliberately-dropped webhook is the third DoD condition. The external keep-alive preventing the Supabase free-tier pause is deployed here and must be in place before any live-money operation.

**Delivers:**
- Supabase Edge Function `/functions/reconcile`: lists recent Stripe `checkout.session.completed` sessions in a time window; joins to `wp_transfers`; flags any Stripe-paid session with no corresponding `paid` transfer (dropped-webhook case); re-applies `paid` idempotently (same `event_id` dedup); flags stuck-unclaimed transfers
- `pg_cron` schedule: `*/20 * * * *` -> `pg_net.http_post(reconcile URL, service-account header)`; jobs <10 min, <8 concurrent
- Vercel cron (`vercel.json`) as daily backstop only
- External keep-alive: GitHub Actions or Vercel cron making a lightweight DB touch to prevent 7-day pause
- Admin health console: webhook_events log (signature result, outcome, event type); reconciliation flag list; email-cap gauge (today's sends vs 100 cap, alarm at 80); stuck-transfer alert panel
- Deliberately-dropped-webhook test: ignore one webhook in staging -> assert sweep flags it and heals idempotently within one sweep window — mandatory gate

**Avoids:** Pitfalls 8, 9, 10 (pause kills cron, cap exhaustion, unreliable reconciliation)

**Research flag:** pg_cron + pg_net + Edge Function pattern confirmed at HIGH confidence. Verify pg_cron version (>=1.6.4) on the Balkanity Supabase project (`qyhdogajtmnvxphrslwm`) before scheduling jobs.

---

### Phase Ordering Rationale

- auth -> onboarding -> payments -> transfer -> claim -> views -> notifications -> health is a strict dependency chain; each is a hard precondition for the next
- Notifications and Health are observers; they can be stubbed during earlier phases and fully wired in Phases 7-8 without blocking the money/claim path
- The platform/module seam (Phase 1) is non-deferrable — costs nothing to establish first and is extremely expensive to retrofit
- Schema changes are flagged/irreversible per the brief; all migrations require sign-off before application

### Research Flags

**Phases needing adversarial testing (not deeper research, but explicit verification gates):**
- **Phase 3:** Forge success-URL request -> assert no `paid` write; send unsigned webhook POST -> assert 400; replay same `event_id` twice -> assert one effect
- **Phase 5:** N simultaneous `claim_transfer()` calls -> exactly 1 winner (automated concurrency test, mandatory gate); pool endpoint with non-claiming JWT -> zero PII keys in payload
- **Phase 8:** Deliberately drop a webhook -> sweep flags and heals within one 20-min window (mandatory DoD gate)

**Phases with standard patterns (skip research-phase):**
- All other phases: well-documented Next.js App Router + Supabase + Stripe + Resend patterns with high-confidence research already complete

---

## Open Questions — User Must Decide Before Pilot Launch

| Question | Options | Recommendation | Urgency |
|----------|---------|---------------|---------|
| **Supabase Pro vs free + keep-alive for the real-money pilot** | Free tier + external keep-alive (zero cost, residual pause risk) vs Pro (~USD 25/mo, no pause risk) | Pro for the live-money window — a paused project during an actual guest's transfer is a poor tradeoff for USD 25/mo. Decide before Phase 8 launch. | HIGH — before going live |
| **Settlement currency: EUR or BGN?** | EUR (EUR 0.25 fixed fee, international guests comfortable) vs BGN (lv0.50 fixed fee, local pricing) | EUR recommended for international guests and Stripe simplicity; confirm with Balkanity accountant. Affects fee display in admin refund UI and the EUR 0.25 vs EUR 0.26 discrepancy resolution. | MEDIUM — decide before Phase 3 |
| **PWA library lock (Serwist confirmed — any remaining doubt?)** | `@serwist/next@^9.5` (recommended, confirmed), hand-rolled SW (full control, more work) | Serwist. Only revisit if Vercel/Next 16 compatibility proves problematic in Phase 1. | LOW — addressed in Phase 1 |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (versions + integration patterns) | HIGH | All versions pinned from npm registry; Supabase `getAll/setAll` contract verified via Context7; Stripe webhook raw-body pattern verified against official docs |
| Verified Provider Facts (fees, caps, pause, cron) | HIGH (one MEDIUM) | Stripe BG fees HIGH (stripe.com/en-bg/pricing); Resend 100/day + 3000/mo HIGH, verified-domain count MEDIUM (corroborated by secondary sources but not explicit in the fetched quota page section); Supabase pause + pg_cron HIGH; Vercel Hobby cron HIGH |
| Features | MEDIUM-HIGH | Booking/email/notification patterns well-established and corroborated; self-claim driver-pool norms MEDIUM (fewer public sources, validated against courier model analogues) |
| Architecture (concurrency, RLS, seam) | HIGH | Postgres READ COMMITTED conditional UPDATE semantics verified against official PostgreSQL docs; Supabase column-level-security guidance verified (they recommend views over column privileges); platform/module seam pattern well-established |
| Pitfalls | HIGH | Stripe webhook, Postgres concurrency, Resend cap, Supabase pause all verified against official 2026 sources; Next.js PWA caching gotchas MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **Resend verified-domain count:** Confirmed as 1 from secondary sources but the official Resend quota docs page did not explicitly state the domain count in the fetched section. Verify directly in the Resend dashboard before sending the first production email.
- **Stripe fixed fee EUR 0.25 vs EUR 0.26 discrepancy:** The brief quotes EUR 0.26; verified current BG pricing shows EUR 0.25. Use EUR 0.25 in all admin UI and pricing docs. Confirm with Balkanity that existing materials (PRD.md, external comms) do not need updating.
- **pg_cron version on the Balkanity Supabase project:** pg_cron >=1.6.4 is recommended for reliability and auto-revive. Verify the installed version on `qyhdogajtmnvxphrslwm` before setting up the reconciliation schedule in Phase 8.
- **PRD.md and PRD-BG.md not in repo:** Referenced in PROJECT.md as companion docs. If available, ingest before roadmap is finalized — they may surface additional feature requirements or copy constraints for email templates and the EN/BG toggle.

---

## Sources

### Primary (HIGH confidence)
- `stripe.com/en-bg/pricing` — BG/EUR card fees (EEA 1.5%+EUR 0.25, non-EEA 3.25%+EUR 0.25, UK 2.5%+EUR 0.25, +2% conversion, refunds don't return original fee)
- `docs.stripe.com/webhooks` — at-least-once delivery, signature verify, idempotency on event.id
- `docs.stripe.com/sdks/versioning` + stripe-node CHANGELOG — API version `2026-05-27.dahlia`, SDK v22
- `resend.com/docs/knowledge-base/account-quotas-and-limits` — 100/day, 3000/mo, 5 req/s
- `supabase.com/docs/guides/cron` + `supabase.com/docs/guides/functions/schedule-functions` — pg_cron + pg_net, <=8 concurrent, <=10 min/job, free tier available
- `supabase.com/docs/guides/database/postgres/column-level-security` — Supabase recommends RLS-driven projections over column privileges
- `supabase.com/docs/guides/database/postgres/row-level-security` — RLS + `security_invoker` views (PG15+)
- `vercel.com/docs/cron-jobs/usage-and-pricing` — Hobby = 1/day, hour-imprecise
- `postgresql.org/docs/current/transaction-iso.html` — READ COMMITTED WHERE re-evaluation (EvalPlanQual) confirming atomic conditional UPDATE is concurrency-safe
- Context7 `/supabase/ssr` — `getAll/setAll` cookie contract for App Router
- Context7 `/vercel/next.js` — stable version line (16.2.x)
- npm registry (`npm view`) — pinned current versions

### Secondary (MEDIUM confidence)
- Serwist docs/npm + 2026 Next.js-16 PWA guides (LogRocket, buildwithmatija) — Serwist as `next-pwa` successor on App Router + Vercel
- `automationatlas.io` (May 2026) — Resend free tier 1 verified domain corroboration
- `github.com/travisvn/supabase-pause-prevention` — keep-alive pattern for 7-day inactivity pause
- `github.com/orgs/supabase/discussions/37405` — pg_cron available on free tier
- Supabase pricing pages + 2026 secondary writeups — 500MB DB, 1GB storage, 500k edge invocations, 7-day pause
- `hookray.com/blog/stripe-webhook-best-practices-2026` + `hooklistener.com` — raw body, dedup on event id, fast 200
- `kitson-broadhurst.medium.com` — Next.js App Router Stripe webhook raw-body handling
- `dispatchit.com`, `withpara.com`, `upperinc.com` — self-claim driver-pool feature norms
- `upvio.com`, `mailchimp.com`, `booking.com`, `nngroup.com`, `courier.com` — booking confirmation, cancellation policy, notification patterns

---
*Research completed: 2026-06-17*
*Ready for roadmap: yes*
