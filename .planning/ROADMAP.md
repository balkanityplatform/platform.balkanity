# Roadmap: Balkanity Platform — Welcome Pickup (v1)

## Overview

This roadmap delivers the first module of the Balkanity Platform — Welcome Pickup — as a vertical MVP built along a strict dependency chain. We start by establishing the non-negotiable platform/module seam, auth/roles, the typed Supabase client split, the design system, and the PWA shell (Phase 1). Then supply exists to book against (Phase 2: companies/properties/destinations + driver invites), the money trust spine is proven before any claim logic (Phase 3: Checkout + verified webhook + webhook_events), the guest can actually book and track (Phase 4: transfer entity + booking form + magic-link status), the crown-jewel correctness work lands (Phase 5: masked pool view + atomic claim RPC + RLS, with adversarial concurrency and PII tests as gates), the driver and admin surfaces consume that correct data layer (Phase 6), notifications observe lifecycle events under the Resend cap (Phase 7), and finally Platform Health closes the loop with reconciliation that catches a deliberately-dropped webhook plus the keep-alive that keeps cron alive during the pilot (Phase 8). Each phase is an end-to-end, user-observable capability and a hard precondition for the next.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Platform Foundation** - Platform/module seam, auth & roles, typed Supabase clients, design system, EN/BG toggle, installable PWA shell (completed 2026-06-17)
- [x] **Phase 2: Supply-Side Onboarding** - Admin no-code CRUD for companies/properties/destinations + price/commission, slug links, and driver invites
- [ ] **Phase 3: Payments Trust Spine** - Code-created Checkout Session + signature-verified idempotent webhook as the sole `paid` author, with webhook_events log
- [ ] **Phase 4: Transfer Entity + Booking Form** - Guest books & prepays via slug link, lifecycle state machine, confirmation email, and magic-link status page
- [ ] **Phase 5: Claim Correctness** - Masked pool view, atomic claim RPC (0 double-claims), and data-layer PII gating via RLS
- [ ] **Phase 6: Driver & Admin Views** - Driver pool/my-run/detail and admin transfers list/detail with assign/reassign/cancel/refund
- [ ] **Phase 7: Notifications** - In-app feed/bell, Resend wrapper with cap guardrails + email_log, guest/admin emails, opt-in driver digest
- [ ] **Phase 8: Platform Health** - Reconciliation sweep (catches dropped webhook), email-cap gauge, stuck-transfer alerts, keep-alive

## Phase Details

### Phase 1: Platform Foundation

**Goal**: A deployed, installable PWA on the Balkanity Vercel project with the platform/module seam, role-aware auth, the three-way Supabase client split, design tokens, and an EN/BG toggle established — so every later phase writes code in the right place from commit one.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, AUTH-01, AUTH-04
**Success Criteria** (what must be TRUE):

  1. The app is installable as a PWA on mobile and serves an offline-aware shell, deployed to the Balkanity Vercel project (Supabase ref `qyhdogajtmnvxphrslwm`, never Kalvia)
  2. A `platform/` import from `modules/*` fails lint (ESLint `no-restricted-imports`); the one-way seam holds across DB-naming convention, server modules, and UI
  3. The admin can sign in to the desktop console; an authenticated user resolves to exactly one app role ∈ {admin, driver, guest} enforced server-side via `auth.getUser()`
  4. A build that imports the service-role or Stripe secret key into client-reachable code fails (`server-only` enforced); the browser only ever holds the anon key
  5. Brand tokens (six colours + white, Montserrat) and real logo/pictogram assets render via shared components (StatusDot = coloured dot + text label, 52px primary CTA); UI text flips between EN and BG

**Plans**: 5 plansPlans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Next 16 + platform/modules seam (ESLint) + Vitest/Playwright Wave 0

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Three-way Supabase client split + server-only boundary + flagged app_users migration (SIGN-OFF)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Magic-link admin sign-in + role resolution + role-based redirect + placeholder console

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Brand tokens + Montserrat + StatusDot/Button/LanguageToggle + EN/BG dictionary

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — Serwist PWA shell + offline fallback + real brand assets (D-09) + Vercel deploy

**Notes**: REVIEW/SIGN-OFF REQUIRED — touches auth and the first schema migration (`app_users` + roles). First migration is the flagged/irreversible schema gate; sign off before applying. Lock PWA library to `@serwist/next` (never `next-pwa`). Avoids Pitfalls 7 (key leak), 9/13 boundary erosion, 12 (SW caching stale auth).
**UI hint**: yes

### Phase 2: Supply-Side Onboarding

**Goal**: An admin can stand up real supply entirely through the UI — create a company, its properties, and bookable destinations with price + commission — and invite drivers, so a guest has a real slug link to book against and a closed driver pool exists.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, AUTH-03, NOTF-04
**Success Criteria** (what must be TRUE):

  1. Admin can create, edit, and list companies, properties under a company, and destinations (slug, label, address, zone, airport, active) — all no-code through the console
  2. Admin sets price + commission per destination and sees a live "you keep" calculation
  3. A second company can be onboarded end-to-end through the UI with zero code or DB edits
  4. Admin invites a driver from the console; the driver receives an invite, signs in via magic link, and lands with the driver role assigned (no open signup exists)
  5. Company/property/destination records are readable/writable only by admins (admin-only RLS), and a unique URL-safe slug resolves to its destination

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — slugify + commission utilities (Wave 0 TDD) + full EN/BG dictionary keys

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — [BLOCKING/SIGN-OFF] migration 0002 (supply tables + admin-only RLS + unique slug) + UI primitives + Companies CRUD

**Wave 3** *(blocked on Wave 2; 03 + 05 run in parallel)*

- [x] 02-03-PLAN.md — Properties CRUD under a company (D-12 bottom-up deactivation)
- [x] 02-05-PLAN.md — [SIGN-OFF] Driver invite (generateLink, no email) + Redirect-URLs allowlist checkpoint (project config applied; 1 manual UAT open)

**Wave 4** *(blocked on Wave 3 / 02-03)*

- [x] 02-04-PLAN.md — Destinations CRUD (slug auto-fill + "you keep" panel) + second-company e2e (ONBD-06)
**Notes**: REVIEW/SIGN-OFF REQUIRED — schema migration (platform companies/properties/destinations + invite handling) and admin-only RLS policies. Keep these tables platform-generic (no transfer-specific columns). Driver-invite email send may be stubbed here and fully wired to the Resend wrapper in Phase 7.
**UI hint**: yes

### Phase 3: Payments Trust Spine

**Goal**: The money path is built and adversarially proven before any claim or booking-UI code: a code-created Stripe Checkout Session, and a signature-verified, raw-body, event.id-idempotent webhook that is the ONLY writer of `paid`, backed by a `webhook_events` log.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BOOK-05, HLTH-01
**Success Criteria** (what must be TRUE):

  1. `paid` is set in exactly one code path — the signature-verified `checkout.session.completed` handler on the `nodejs` runtime reading the raw body (`req.text()`), writing via the service-role client; a grep confirms no other `status='paid'` writer exists
  2. ADVERSARIAL GATE: a forged/unsigned webhook POST is rejected with 400 and causes zero state change; a spoofed success-URL request never writes `paid`
  3. ADVERSARIAL GATE: replaying the same Stripe `event.id` twice produces exactly one effect (UNIQUE constraint on `webhook_events.event_id`, insert-first dedup in the same transaction as the `paid` transition)
  4. Every Stripe event is recorded in `webhook_events` with its idempotency key, signature result, and processing outcome
  5. A code-created Checkout Session (not a dashboard Payment Link) carries `metadata.transfer_id`; the per-transaction processing fee is recorded (EUR 0.25 fixed for EEA cards), with refund non-recovery noted

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Wave 0 test baseline (5 vitest + 2 Playwright specs) + install stripe@^22.2 + replay runbook

**Wave 2** *(blocked on Wave 1; 02 + 03 run in parallel)*

- [x] 03-02-PLAN.md — [BLOCKING/SIGN-OFF] migration 0003 (minimal wp_transfers + webhook_events + admin-read RLS + UNIQUE event_id) — file authoring only
- [x] 03-03-PLAN.md — platform/payments seam: server-only stripe.ts (apiVersion pin) + checkout.ts (EUR/metadata session) + fee.ts (balance-transaction fee)

**Wave 3** *(blocked on Wave 2)*

- [ ] 03-04-PLAN.md — Stripe webhook route (the single idempotent paid writer, nodejs/raw-body) + minimal checkout trigger + display-only success/cancel pages

**Wave 4** *(blocked on Wave 3)*

- [ ] 03-05-PLAN.md — [BLOCKING/SIGN-OFF] apply migration 0003 to Balkanity + the three TEST-mode adversarial gates (forged→400, replay→one effect, success-spoof→no paid) + grep single-writer gate

**Notes**: REVIEW/SIGN-OFF REQUIRED — payment path and `webhook_events` schema migration. Stripe API version pinned `2026-05-27.dahlia`; `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` server-only, never `NEXT_PUBLIC_`. Verify Next 16 App Router raw-body handling with the forged-POST test before marking done. Settlement currency (EUR vs BGN) must be decided before this phase. Avoids Pitfalls 1, 2, 3, 11.

### Phase 4: Transfer Entity + Booking Form

**Goal**: A guest can open a per-destination link, complete a short prepaid-and-non-refundable booking, pay via the Phase 3 spine, receive a confirmation email on `paid`, and track the full transfer lifecycle live via a passwordless magic-link status page.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-06, BOOK-07, XFER-01, AUTH-02
**Success Criteria** (what must be TRUE):

  1. Guest opens `/pickup/<slug>`, sees the destination and fare, and completes a short guestless form (email required; phone, flight no., pax, luggage, notes as applicable)
  2. Submitting creates a `wp_transfers` row in `requested` and a Stripe Checkout Session; checkout clearly states the booking is prepaid & non-refundable before payment
  3. After a verified webhook flips the transfer to `paid`, the guest receives a booking confirmation email
  4. Guest can view a passwordless magic-link status page showing a live lifecycle timeline (coloured dot + label for every state incl. `en_route`) and a visible payment record/receipt ("Paid EUR X on {date}")
  5. The transfer advances only through the locked lifecycle requested → paid → claimed → en_route → arrived → picked_up → completed (+ cancelled), enforced by server-side transition guards; the success page is display-only and never writes `paid`

**Plans**: TBD
**Notes**: REVIEW/SIGN-OFF REQUIRED — `wp_transfers` schema migration (lifecycle fields + PII columns) is flagged/irreversible; sign off before applying. Status/booking data must never be served stale from the SW cache (NetworkFirst / Realtime). Confirmation email may call a stubbed wrapper, fully guarded in Phase 7. Avoids Pitfalls 1, 12.
**UI hint**: yes

### Phase 5: Claim Correctness

**Goal**: The two remaining definition-of-done correctness invariants are built and adversarially proven at the data layer: exactly one driver wins any claim under concurrency, and full guest PII is invisible to non-owning drivers in the API payload itself — not just the UI.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CLAIM-02, CLAIM-03
**Success Criteria** (what must be TRUE):

  1. A masked `wp_pool` view (security_invoker) physically omits all PII columns and exposes only pre-claim fields (date, arrival time, airport, destination zone, fare, pax, luggage) for `status='paid' AND driver_id IS NULL`
  2. ADVERSARIAL GATE: N simultaneous `claim_transfer()` calls on one transfer yield exactly one winner and N−1 graceful "already claimed" outcomes (automated concurrency test; atomic `UPDATE ... WHERE status='paid'`, not RLS, is the concurrency control)
  3. ADVERSARIAL GATE: calling the pool endpoint with a non-claiming driver's JWT returns a payload containing zero PII keys
  4. Full guest PII (name, contact, exact address, flight no., notes) is readable only by the claiming driver (`driver_id = auth.uid()`) and admins, enforced by RLS on `wp_transfers`; the winning driver receives the full row atomically via the claim RPC's `RETURNING *`

**Plans**: TBD
**Notes**: REVIEW/SIGN-OFF REQUIRED — `wp_pool` view + RLS policies + `claim_transfer()` SECURITY DEFINER RPC schema migration. Crown-jewel phase: both adversarial gates MUST pass before the phase closes. The claim RPC is called with the user's auth context (never the service-role key). Avoids Pitfalls 4, 5, 6.

### Phase 6: Driver & Admin Views

**Goal**: Drivers can see the masked pool, claim atomically, work their sorted "My run", and advance status; admins can list/search transfers, open detail, and assign/reassign/release/cancel plus issue a manual Stripe refund — all riding the correct Phase 5 data layer.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: CLAIM-01, CLAIM-04, CLAIM-05, CLAIM-06, OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):

  1. An invited driver sees the limited-detail pool of `paid`, unclaimed transfers and taps to claim; "already claimed" is shown as a graceful normal outcome (not an error) and the pool refreshes live
  2. Driver "My run" lists their active claimed transfers ordered by arrival time and advances each through claimed → en_route → arrived → picked_up → completed (52px CTAs); a driver may hold multiple claims and cannot un-claim
  3. Driver transfer detail shows full PII only post-claim; the arrived transition is available from the run
  4. Admin sees a transfers list with filter and search (stuck/unclaimed highlighted in coral) and opens a transfer detail with lifecycle and trip/payment details
  5. Admin can assign, reassign, release, and cancel a transfer, and issue a manual Stripe refund from the detail page with a clear "this does not recover the ~EUR X processing fee" disclosure

**Plans**: TBD
**Notes**: Brand rules apply — status is always coloured dot + text label, ≥44px hit targets, warm light surfaces (driver), slate console (admin). Claim/status data is NetworkFirst (never SW-cached). No read-then-write anywhere on the claim path. Refund uses the platform payments hook. Avoids Pitfalls 4, 11, 12.
**UI hint**: yes

### Phase 7: Notifications

**Goal**: Lifecycle events from Phases 3–6 drive a per-user in-app feed/bell and a Resend email wrapper with hard cap guardrails, delivering the right guest/admin emails while keeping drivers on in-app + an opt-in daily digest so the pilot stays under the 100/day cap.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-05, NOTF-06
**Success Criteria** (what must be TRUE):

  1. Each user has an in-app notification feed/bell (polymorphic `entity_type`/`entity_id`, no `transfer_id` column on shared tables) updating live via Realtime; this is the drivers' primary channel
  2. Guest receives a "driver assigned" email on `claimed` and a "driver has arrived" email on `arrived` (and none on `en_route`); admin receives a booking alert on each new paid booking
  3. Drivers receive an opt-in daily digest at a self-chosen time and have zero per-transfer email path
  4. The `sendEmail()` wrapper checks `email_log` before sending (idempotent against webhook retries), records every send (success/failure), respects ≤5 req/s, and short-circuits with an alarm as it approaches the daily cap
  5. The verified Resend sending domain is configured so production emails do not land in spam

**Plans**: TBD
**Notes**: REVIEW/SIGN-OFF REQUIRED — touches the shared notifications schema (keep it module-agnostic). Confirm Resend verified-domain count in the dashboard before the first production send. This phase fully wires the stubs left in Phases 2 (driver invite) and 4 (guest confirmation). Avoids Pitfalls 3, 9, 13.

### Phase 8: Platform Health

**Goal**: Close the operational loop: a reliable reconciliation sweep that catches a deliberately-dropped webhook and self-heals idempotently, an email-cap gauge, stuck-transfer alerts, and an external keep-alive that prevents the Supabase pause from silently stopping cron during the real-money pilot.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: HLTH-02, HLTH-03, HLTH-04, HLTH-05
**Success Criteria** (what must be TRUE):

  1. ADVERSARIAL GATE: deliberately dropping one webhook in staging is flagged by the reconciliation sweep and healed idempotently within one sweep window (Stripe-paid session with no matching `paid` transfer is detected and re-applied via the same event.id dedup)
  2. The reconciliation sweep runs every ~15–30 min via Supabase pg_cron + pg_net → Edge Function (jobs <10 min, <8 concurrent); Vercel Hobby cron exists only as a once-daily backstop
  3. An admin health console shows the webhook_events log (signature result/outcome), the reconciliation flag list, an email-cap gauge (today's sends vs 100, alarm at 80), and a stuck-transfer alert panel
  4. An external keep-alive (independent of user traffic) touches the DB on a schedule so the Supabase project does not pause and stop pg_cron during the pilot

**Plans**: TBD
**Notes**: REVIEW/SIGN-OFF REQUIRED — scheduling/infra on the Balkanity Supabase project only (`qyhdogajtmnvxphrslwm`). Verify pg_cron ≥1.6.4 before scheduling. The dropped-webhook test is a DoD gate. Decide Supabase Pro vs free+keep-alive before going live. Avoids Pitfalls 8, 9, 10.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Foundation | 5/5 | Complete   | 2026-06-17 |
| 2. Supply-Side Onboarding | 5/5 | Complete   | 2026-06-18 |
| 3. Payments Trust Spine | 3/5 | In Progress|  |
| 4. Transfer Entity + Booking Form | 0/TBD | Not started | - |
| 5. Claim Correctness | 0/TBD | Not started | - |
| 6. Driver & Admin Views | 0/TBD | Not started | - |
| 7. Notifications | 0/TBD | Not started | - |
| 8. Platform Health | 0/TBD | Not started | - |
