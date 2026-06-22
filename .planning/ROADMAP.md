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
- [x] **Phase 3: Payments Trust Spine** - Code-created Checkout Session + signature-verified idempotent webhook as the sole `paid` author, with webhook_events log; migration 0003 live on Balkanity, all 5 success criteria verified incl. live Stripe-CLI replay (completed 2026-06-18)
- [x] **Phase 4: Transfer Entity + Booking Form** - Guest books & prepays via slug link, lifecycle state machine, confirmation email, and magic-link status page (completed 2026-06-18)
- [x] **Phase 5: Claim Correctness** - Masked pool view, atomic claim RPC (0 double-claims), and data-layer PII gating via RLS (completed 2026-06-19)
- [ ] **Phase 6: Driver & Admin Views** - Driver pool/my-run/detail and admin transfers list/detail with assign/reassign/cancel/refund (implementation + automated verification complete 2026-06-19; 5 UAT items pending — run /gsd-verify-work 6)
- [ ] **Phase 7: Notifications** - In-app feed/bell, Resend wrapper with cap guardrails + email_log, guest/admin emails, opt-in driver digest
- [x] **Phase 8: Platform Health** - Reconciliation sweep (catches dropped webhook), email-cap gauge, stuck-transfer alerts, keep-alive — all 3 DoD gates green live (email delivery pending Resend DNS)

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

- [x] 03-04-PLAN.md — Stripe webhook route (the single idempotent paid writer, nodejs/raw-body) + minimal checkout trigger + display-only success/cancel pages

**Wave 4** *(blocked on Wave 3)*

- [x] 03-05-PLAN.md — [BLOCKING/SIGN-OFF] apply migration 0003 to Balkanity + the three TEST-mode adversarial gates (forged→400, replay→one effect, success-spoof→no paid) + grep single-writer gate

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

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Wave 0 RED specs (lifecycle/booking/confirmation/guest-status) + TS lifecycle transition map + full EN/BG copy keys

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — [FLAGGED] migration 0004 file authoring: wp_transfers PII+lifecycle ALTER + BEFORE-UPDATE transition trigger + guest-self-read RLS (auth.jwt email) + active-destination anon read

**Wave 3** *(blocked on Wave 2; 03 + 04 run in parallel)*

- [x] 04-03-PLAN.md — Booking slice: /pickup/[slug] page + BookingForm + PaxStepper + createBooking action → Stripe Checkout (BOOK-01/02/03/04)
- [x] 04-04-PLAN.md — Status/track slice: confirmation-email stub off paid + LifecycleTimeline + /status/[id] RLS read + /track + /auth/confirm next-threading + sw.ts NetworkFirst (BOOK-06/07, AUTH-02)

**Wave 4** *(blocked on Wave 3)*

- [x] 04-05-PLAN.md — [BLOCKING/SIGN-OFF] apply migration 0004 to Balkanity + adversarial DB-trigger/RLS runbook + full booking→pay→confirm→track end-to-end smoke

**Notes**: REVIEW/SIGN-OFF REQUIRED — `wp_transfers` schema migration (lifecycle fields + PII columns) is flagged/irreversible; sign off before applying. Status/booking data must never be served stale from the SW cache (NetworkFirst / Realtime). Confirmation email may call a stubbed wrapper, fully guarded in Phase 7. Avoids Pitfalls 1, 12.
**UI hint**: yes

### Phase 5: Claim Correctness

**Goal**: The two remaining definition-of-done correctness invariants are built and adversarially proven at the data layer: exactly one driver wins any claim under concurrency, and full guest PII is invisible to non-owning drivers in the API payload itself — not just the UI.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CLAIM-02, CLAIM-03
**Success Criteria** (what must be TRUE):

  1. A masked `wp_pool` view (security_invoker) physically omits all PII columns and exposes only pre-claim fields (date, arrival time, airport, destination zone, flight no., fare, pax, luggage) for `status='paid' AND driver_id IS NULL`. (Flight no. is reclassified as operational/non-PII for v1 — it is route context drivers use to size up a job, exposed pre-claim.)
  2. ADVERSARIAL GATE: N simultaneous `claim_transfer()` calls on one transfer yield exactly one winner and N−1 graceful "already claimed" outcomes (automated concurrency test; atomic `UPDATE ... WHERE status='paid'`, not RLS, is the concurrency control)
  3. ADVERSARIAL GATE: calling the pool endpoint with a non-claiming driver's JWT returns a payload containing zero PII keys (PII = name, contact, exact address, notes — flight no. is operational, not PII)
  4. Full guest PII (name, contact, exact address, notes) is readable only by the claiming driver (`driver_id = auth.uid()`) and admins, enforced by RLS on `wp_transfers`; the winning driver receives the full row atomically via the claim RPC's `RETURNING *`

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Nyquist baseline: source-level 0005 contract test + N-parallel concurrency gate + non-claiming-driver PII gate + service-role seed/teardown fixtures (all RED)

**Wave 2** *(blocked on Wave 1)*

- [x] 05-02-PLAN.md — [FLAGGED] author migration 0005 (masked wp_pool SECURITY DEFINER read + atomic claim_transfer() RPC + claiming-driver RLS) — file authoring only — + thin caller-auth claim wrapper

**Wave 3** *(blocked on Wave 2)*

- [x] 05-03-PLAN.md — [BLOCKING/SIGN-OFF] apply 0005 to Balkanity (Management API) + both live adversarial gates (N-parallel → one winner; non-claiming-JWT → zero PII) + 05-GATES-EVIDENCE.md

**Notes**: REVIEW/SIGN-OFF REQUIRED — `wp_pool` view + RLS policies + `claim_transfer()` SECURITY DEFINER RPC schema migration. Crown-jewel phase: both adversarial gates MUST pass before the phase closes. The claim RPC is called with the user's auth context (never the service-role key). Open Q1 resolved: the masked pool is implemented as a SECURITY DEFINER read (not a security_invoker view) so the base table stays 0-rows for non-claiming drivers (SC4) — confirmed at the FLAGGED sign-off. Avoids Pitfalls 4, 5, 6.

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

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 06-01-PLAN.md — [SIGN-OFF] Dictionary keys + lifecycle release edge (claimed->paid) + author migration 0006 (file only) + Wave-0 Nyquist RED specs + single-writer widening

**Wave 2** *(blocked on Wave 1; 02 + 04 run in parallel)*

- [x] 06-02-PLAN.md — Driver pool slice: /driver masked wp_pool read + claim (win->detail / lose->neutral toast) + focus/poll refresh + Toast + NetworkFirst
- [x] 06-04-PLAN.md — Admin transfers list (filter/search/coral triage) + detail page + console nav (OPS-01/02)

**Wave 3** *(blocked on Wave 2; 03 + 05 run in parallel)*

- [x] 06-03-PLAN.md — Driver "My run": sorted active claims + inline advance CTA (D-13 gated service-role advanceStatus) + Completed today + driver detail (CLAIM-04/05/06)
- [x] 06-05-PLAN.md — [BLOCKING/SIGN-OFF] apply migration 0006 LIVE + admin assign/reassign/release/cancel + server-only refund hook + refund form (OPS-03/04)
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

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Foundation + Nyquist: install resend (checkpoint) + author migration 0007 (notifications + email_log + wp_transfers.locale + digest cols, FILE ONLY) + getDictFor accessor & all EN/BG keys + createBooking locale capture + 8 Wave-0 RED specs (Resend mocked)

**Wave 2** *(blocked on Wave 1)*

- [x] 07-02-PLAN.md — Engine: sendEmail() single Resend call-site (cap/idempotency/≤5 req/s guard) + notify.ts (insertNotification + gated markRead/markAllRead) + plain-HTML templates.ts

**Wave 3** *(blocked on Wave 2; 03 + 05 run in parallel)*

- [x] 07-03-PLAN.md — In-app bell slice: own-rows feed read + NotificationBell poll-on-focus island (NOT Realtime, D-04) + mounted in driver (warm-light) & admin (slate) chromes (NOTF-01)
- [x] 07-05-PLAN.md — Digest slice: buildDigest (masked pool + own runs, zero PII) + sendDueDigests invokable + opt-in preference UI (Toggle off-by-default + send-hour Select) + gated save action (NOTF-05; cron trigger = Phase 8)

**Wave 4** *(blocked on Wave 3; shares DriversView with 07-03)*

- [x] 07-04-PLAN.md — Lifecycle fan-out + un-stub seams: confirmation (un-stub) + email-only invite (D-14) + paid/claimed/arrived/admin-ops emails & in-app notifications, all log-and-continue (NOTF-02/03/04)

**Wave 5** *(blocked on Wave 4)*

- [ ] 07-06-PLAN.md — [BLOCKING/SIGN-OFF] apply migration 0007 LIVE to Balkanity (Management API) + verified send.balkanity.com subdomain + RESEND_API_KEY + D-15 live-delivery & end-to-end fan-out UAT

**Notes**: REVIEW/SIGN-OFF REQUIRED — touches the shared notifications schema (keep it module-agnostic). Confirm Resend verified-domain count in the dashboard before the first production send. This phase fully wires the stubs left in Phases 2 (driver invite) and 4 (guest confirmation). Avoids Pitfalls 3, 9, 13. NOTE: SC#1's "via Realtime" wording is superseded by CONTEXT D-04 (poll-on-focus + interval); the polymorphic entity_type/entity_id + no-transfer_id parts of SC#1 still hold.

### Phase 8: Platform Health

**Goal**: Close the operational loop: a reliable reconciliation sweep that catches a deliberately-dropped webhook and flags it for human-driven idempotent replay (never auto-setting `paid` — the verified webhook stays the sole `paid` author), an email-cap gauge, stuck-transfer alerts, and an external keep-alive that prevents the Supabase pause from silently stopping cron during the real-money pilot.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: HLTH-02, HLTH-03, HLTH-04, HLTH-05
**Success Criteria** (what must be TRUE):

  1. ADVERSARIAL GATE: deliberately dropping one webhook in staging is detected by the reconciliation sweep within one sweep window and surfaced as an admin alert (in-app + critical email) — a Stripe-paid session with no matching `paid` transfer is flagged for human-driven replay through the signature-verified webhook (idempotent via the existing `webhook_events.event_id` dedup). The sweep itself MUST NOT set `paid` (D-01 + money single-writer lock).
  2. The reconciliation sweep runs every ~15–30 min via Supabase pg_cron + pg_net → Edge Function (jobs <10 min, <8 concurrent); Vercel Hobby cron exists only as a once-daily backstop
  3. An admin health console shows the webhook_events log (signature result/outcome), the reconciliation flag list, an email-cap gauge (today's sends vs the Resend 100/day cap, warning at ~90/day to match the send-guardrail soft cap, D-07), and a stuck-transfer alert panel
  4. An external keep-alive (independent of user traffic) touches the DB on a schedule so the Supabase project does not pause and stop pg_cron during the pilot

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 08-01-PLAN.md — Foundation + Nyquist: author migration 0008 (extensions + health_events + 2 cron schedules, FILE ONLY) + 5 Wave-0 RED specs + EN/BG health keys

**Wave 2** *(blocked on Wave 1; 02 + 03 + 04 run in parallel — disjoint files)*

- [x] 08-02-PLAN.md — Reconciliation (Stripe-API source of truth, D-03) + stuck + keep-alive detection + the x-cron-secret-gated 15-min health route (detect+alert only, never paid)
- [x] 08-03-PLAN.md — Admin Platform-health console: email-cap gauge (D-07) + reconciliation list + stuck list (read-only RSC, admin-gated) + landing nav link
- [x] 08-04-PLAN.md — Hourly digest cron route (fires sendDueDigests, D-10) + Vercel daily backstop (HLTH-05)

**Wave 3** *(blocked on Wave 2)*

- [x] 08-05-PLAN.md — [BLOCKING/SIGN-OFF] apply 0008 LIVE to Balkanity (Management API) + Vault/Vercel cron secret + 3 live DoD gates ALL GREEN (dropped-webhook caught/no paid write + replay remediates, cron fires, keep-alive); critical-email delivery pending send.balkanity.com DNS

**Notes**: REVIEW/SIGN-OFF REQUIRED — scheduling/infra on the Balkanity Supabase project only (`qyhdogajtmnvxphrslwm`). Verify pg_cron ≥1.6.4 before scheduling. The dropped-webhook test is a DoD gate. Decide Supabase Pro vs free+keep-alive before going live. Avoids Pitfalls 8, 9, 10.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Foundation | 5/5 | Complete   | 2026-06-17 |
| 2. Supply-Side Onboarding | 5/5 | Complete   | 2026-06-18 |
| 3. Payments Trust Spine | 5/5 | Complete    | 2026-06-18 |
| 4. Transfer Entity + Booking Form | 5/5 | Complete   | 2026-06-18 |
| 5. Claim Correctness | 3/3 | Complete    | 2026-06-19 |
| 6. Driver & Admin Views | 5/5 | UAT pending | - |
| 7. Notifications | 5/6 | In Progress|  |
| 8. Platform Health | 4/5 | In Progress|  |

---

## Milestone v1.1: UI Rebuild

### Overview

v1.1 rebuilds the **presentation layer of all three surfaces** (guest, driver, admin) to match the Stitch mockups + the `DESIGN.md` ("Balkanity Path") design system, while preserving the current minimalist feel — with **zero backend, schema, auth, RLS, or payment-path changes**. Every existing wiring stays exactly as shipped in Phases 1–8: the atomic `claim_transfer` RPC, the masked `wp_pool` SECURITY DEFINER read (no guest PII to drivers pre-claim), the single-writer `paid` invariant (verified Stripe webhook is still the sole `paid` author), and magic-link / email-password auth. Brand primary stays **`#029B87`** — `DESIGN.md`'s `#00685a` token is rejected and corrected on contact.

The work is a strict, user-locked dependency chain: the shared **Design System foundation (Phase 9)** must land first — it maps the "Balkanity Path" tokens into the Tailwind v4 CSS-first `@theme`, and ships the reusable status badge, infinity/route motif, and lifecycle stepper that every surface consumes. Then surfaces rebuild in order **Guest (Phase 10) → Driver (Phase 11) → Admin (Phase 12)**. Each surface phase is **design-contract-first**: a `/gsd:ui-phase` UI-SPEC precedes planning so the visual contract is fixed before any screen is built. Mockup features with no backing data (live GPS map, driver ratings, earnings analytics, an Analytics nav page, "Download Manifest" export, invented KPI goal %) are **omitted** to keep the UI truthful to current capabilities.

### Phases

- [x] **Phase 9: Design System Foundation** - "Balkanity Path" tokens in Tailwind v4 @theme + status badge, infinity/route motif, and lifecycle stepper components (prerequisite for all surfaces) (completed 2026-06-20)
- [x] **Phase 10: Guest UI Rebuild** - Boarding-pass "Transfer Pass" booking screen + restyled form + magic-link status page with live stepper + Stripe trust CTA (completed 2026-06-21)
- [x] **Phase 11: Driver PWA Rebuild** - Claim cards (no pre-claim PII), bottom nav, My Trips, and en-route trip detail with progress stepper + Confirm-Arrival, riding the existing atomic claim (completed 2026-06-21)
- [ ] **Phase 12: Admin Console Rebuild** - Left sidebar nav, Transfer Pool KPI cards, pending-transmissions transfers table + restyled detail, and top bar with search / notifications bell / admin identity

### Phase Details

#### Phase 9: Design System Foundation

**Goal**: The shared "Balkanity Path" design system is live in the codebase — brand tokens are mapped into the Tailwind v4 CSS-first `@theme` and the three reusable building blocks every surface needs (status badge, infinity/route motif, lifecycle stepper) exist as components — so the Guest, Driver, and Admin rebuilds all consume one consistent, correct visual foundation.
**Mode:** mvp
**Depends on**: Phase 8 (v1.0 complete); first phase of the v1.1 milestone
**Requirements**: DS-01, DS-02, DS-03, DS-04
**Context / Non-goals (presentation-only)**: NO backend, schema, auth, RLS, or payment changes. This phase touches only `globals.css` / `@theme` tokens and shared presentational components. Brand primary is **`#029B87`** (correct `DESIGN.md`'s `#00685a` on sight). Tailwind v4 CSS-first `@theme` only — no JS `tailwind.config`. Status is always a coloured dot/badge **plus** a worded label (never colour alone). This is the hard prerequisite ordered before any Guest/Driver/Admin screen — no surface work begins until these tokens and components exist. Design-contract-first: a `/gsd:ui-phase` UI-SPEC precedes planning.
**Success Criteria** (what must be TRUE):

  1. The "Balkanity Path" tokens (colors with `#029B87` primary, the full Montserrat type scale, 8px spacing scale, radii) are defined in the Tailwind v4 `@theme` and resolve app-wide; no `#00685a` and no JS `tailwind.config` exist anywhere
  2. A reusable status badge renders every transfer status as a coloured dot/badge plus its worded label — Unclaimed=coral, Claimed=teal, En route=amber, Completed=grey, Cancelled=hollow coral ring — and never communicates state by colour alone
  3. A reusable lifecycle stepper renders the transfer states (Paid → Claimed → En route → Arrived → Picked up → Completed) with distinct completed / active / pending styling, driven by a passed-in current state
  4. The infinity/route motif renders as the connective element between a departure and an arrival point on a route visualization, using the real brand pictogram assets (never re-drawn)

**Plans**: 5 plans (4 waves)
Plans:
**Wave 1**

- [x] 09-01-PLAN.md — DS-01 named @theme tokens (typography/radii/spacing) + DS-04 STEPPER_ORDER const
**Wave 2** *(blocked on Wave 1; 02 + 03 run in parallel — disjoint files)*

- [x] 09-02-PLAN.md — DS-02 StatusDot variant prop (dot/pill) + cancelled hollow coral ring + tests
- [x] 09-03-PLAN.md — DS-03 RouteMotif (configurable endpoints + committed brand Transfer Badge midpoint)
**Wave 3** *(blocked on Wave 2)*

- [x] 09-04-PLAN.md — DS-04 horizontal LifecycleStepper (STEPPER_ORDER-driven, shape-encoded states, cancelled terminal) + tests
**Wave 4** *(blocked on Wave 3)*

- [x] 09-05-PLAN.md — D-11 dev-only design-system showcase route + EN/BG showcase keys
**UI hint**: yes

#### Phase 10: Guest UI Rebuild

**Goal**: The guest-facing surface is rebuilt to the boarding-pass "Transfer Pass" identity — the booking screen reads as a transfer pass, the form is restyled to the design system with no change to fields or validation, the magic-link status page shows the live lifecycle via the shared stepper, and the pay action carries a Stripe trust treatment — all driving the existing unchanged Checkout flow.
**Mode:** mvp
**Depends on**: Phase 9 (consumes the tokens, status badge, infinity motif, and lifecycle stepper)
**Requirements**: GUI-01, GUI-02, GUI-03, GUI-04
**Context / Non-goals (presentation-only)**: NO backend, schema, auth, RLS, or payment changes. The booking form collects exactly the same fields with exactly the same validation as today — only styling changes. The pay action drives the existing code-created Checkout-session flow unchanged; the client redirect never sets `paid` (single-writer invariant preserved). Magic-link auth for the status page is preserved as-is. Brand primary `#029B87`. Design-contract-first: a `/gsd:ui-phase` UI-SPEC precedes planning.
**Success Criteria** (what must be TRUE):

  1. The guest booking screen renders as the boarding-pass "Transfer Pass": airport→property route header (with the infinity motif), a details grid for date/flight/pickup/guests, a payment-status row, the total prepaid, and a primary pay CTA
  2. The booking form inputs are restyled to the design system (48px fields, teal focus ring, Montserrat labels) with no change to the fields collected or the validation applied
  3. The magic-link status page renders as the pass and reflects the live transfer lifecycle state via the shared lifecycle stepper
  4. The pay action shows the Stripe-secured CTA and a "Secured payment · powered by Stripe" trust footer, and triggers the existing Checkout-session flow with no payment-path change

**Plans**: 4 plans (2 waves)
Plans:
**Wave 1** *(foundation slice — unblocks the screen slices)*

- [ ] 10-1-pass-foundation-PLAN.md — New EN/BG pass copy keys + surface-local TransferPass/PassHeader/DetailsGrid + line pictograms + restyle /pay/cancel (the demonstrable consumer)

**Wave 2** *(blocked on Wave 1; 02 + 03 + 04 run in parallel — disjoint files)*

- [ ] 10-2-booking-pass-PLAN.md — /pickup/[slug] composed as the Transfer Pass + restyled BookingForm + pay CTA + Stripe trust footer (GUI-01/02/04)
- [ ] 10-3-status-pass-PLAN.md — /status/[id] composed as the pass + horizontal LifecycleStepper swap (GUI-03)
- [ ] 10-4-supporting-screens-PLAN.md — /pay/success + /track lighter DS restyle, spoof gate + neutral-action preserved (GUI-04 journey)
**UI hint**: yes

#### Phase 11: Driver PWA Rebuild

**Goal**: The driver PWA is rebuilt to the mockup identity — Available transfers as claim cards that show no guest PII pre-claim, a bottom navigation bar, a My Trips list, and an en-route trip detail with the shared progress stepper and a Confirm-Arrival CTA — with the Claim action still invoking the existing atomic claim RPC and honouring first-to-claim-wins.
**Mode:** mvp
**Depends on**: Phase 9 (tokens, status badge, infinity motif, lifecycle stepper); Phase 10 (Guest) precedes it per the locked surface order
**Requirements**: DUI-01, DUI-02, DUI-03, DUI-04, DUI-05
**Context / Non-goals (presentation-only)**: NO backend, schema, auth, RLS, or payment changes. Claim cards read the existing masked `wp_pool` and show **no guest PII pre-claim** (the data-layer boundary is preserved, not re-implemented in UI). The Claim action calls the existing atomic `claim_transfer` RPC — first-to-claim-wins / already-claimed semantics are unchanged. Confirm-Arrival is wired to the existing advance-status action. **Omit** the live GPS map, driver ratings, and the earnings dashboard (no backend). Warm light surfaces, ≥44px hit targets, 52px primary CTAs. Design-contract-first: a `/gsd:ui-phase` UI-SPEC precedes planning.
**Success Criteria** (what must be TRUE):

  1. Available transfers render as claim cards (pickup time, pax count, "Unclaimed" badge, route with the infinity motif, date, price, Claim CTA) showing zero guest-PII keys pre-claim
  2. A bottom navigation bar provides Available / My Trips / Profile with the active tab highlighted
  3. My Trips renders the driver's claimed/past transfers as trip cards (date, status badge, route, pax, duration, details link) with no earnings or ratings shown
  4. The en-route trip detail renders the claimed passenger info, a route card, the shared trip-progress stepper, the passenger note, and a Confirm-Arrival CTA wired to the existing advance-status action — and shows no live map
  5. Tapping Claim on a card invokes the existing atomic claim RPC and reflects the first-to-claim-wins / already-claimed outcome gracefully in the UI

**Plans**: 5 plans (2 waves)
Plans:
**Wave 1** *(foundation slice — unblocks the four surface slices)*

- [x] 11-01-PLAN.md — Driver shell: shared `app/driver/layout.tsx` + `DriverBottomNav` (DUI-02) + surface-local line icons + all new EN/BG keys

**Wave 2** *(blocked on Wave 1; 02 + 03 + 04 + 05 run in parallel — disjoint files)*

- [x] 11-02-PLAN.md — Available claim cards: masked `wp_pool` read + coral Unclaimed badge + RouteMotif + 52px Claim CTA, claim/poll/PII verbatim (DUI-01/DUI-05)
- [x] 11-03-PLAN.md — My Trips: trip cards with per-row StatusDot + route + details link; arrival ASC + Completed-today + advance preserved (DUI-03)
- [x] 11-04-PLAN.md — En-route trip detail: LifecycleTimeline→LifecycleStepper swap + dictionary captions + new DetailView Confirm-Arrival CTA → advanceStatus (DUI-04)
- [x] 11-05-PLAN.md — Profile rebuild: identity header + restyled digest card + language row + sign-out (new `signOutAction`, D-03/D-04/D-05)
**UI hint**: yes

#### Phase 12: Admin Console Rebuild

**Goal**: The admin desktop console is rebuilt to the "Transfer Pool" identity — a persistent left sidebar, KPI cards computed from real transfer data, the pending-transmissions transfers table with filter/sort and row actions, a restyled transfer detail keeping all existing operations intact, and a top bar with client-side search, the notifications bell, and the signed-in admin identity.
**Mode:** mvp
**Depends on**: Phase 9 (tokens, status badge, infinity motif, lifecycle stepper); Phases 10–11 precede it per the locked surface order (Guest → Driver → Admin)
**Requirements**: AUI-01, AUI-02, AUI-03, AUI-04, AUI-05
**Context / Non-goals (presentation-only)**: NO backend, schema, auth, RLS, or payment changes. KPI cards and the transfers table read the existing admin transfer queries; the search field is a client-side filter of already-loaded transfers (no new endpoint). The detail view keeps the existing assign / reassign / cancel / refund actions wired exactly as today (refund still records `last_action_*` only and never sets `paid`). The notifications bell reuses the existing feed. **Omit** the "Analytics" nav page, the "Download Manifest" export, and the invented KPI daily-goal %. Slate console surfaces. Design-contract-first: a `/gsd:ui-phase` UI-SPEC precedes planning.
**Success Criteria** (what must be TRUE):

  1. A persistent left sidebar provides the admin nav (Dashboard, Transfers, Drivers, Settings) with the active item highlighted, and no Analytics item is present
  2. The Transfer Pool dashboard shows KPI cards (Unclaimed, Claimed, En route, Total today) computed from real transfer data, with no invented daily-goal metric
  3. The transfers list renders as the pending-transmissions table (time/ID, passenger, route, lifecycle bar, status badge, assigned driver, row actions view / assign / cancel) with working filter and sort
  4. The transfer detail view is restyled to the design system with the existing assign / reassign / cancel / refund actions intact and behaving identically (refund never sets `paid`)
  5. A top bar shows the search field (client-side filter of loaded transfers), the notifications bell (existing feed), and the signed-in admin identity

**Plans**: 5 plans (2 waves)
Plans:
**Wave 1** *(foundation slice — unblocks the four surface slices)*

- [x] 12-01-PLAN.md — Admin shell: shared `app/admin/layout.tsx` + sidebar (`AdminSidebar`/`tabs`/4 line icons) + top bar (search/identity/single bell) + all new EN/BG keys (AUI-01, AUI-05 top bar)

**Wave 2** *(blocked on Wave 1; 02 + 03 + 04 + 05 run in parallel — disjoint files)*

- [ ] 12-02-PLAN.md — Dashboard: 4 KPI cards (Unclaimed/Claimed/En route/Total today) from the existing transfer read + Recent-transfers top-5 (AUI-02, D-05)
- [ ] 12-03-PLAN.md — Transfers table: `<ul>`→`<table>` + mobile cards + client search over loaded rows + client sort (Needs attention default), retire server `q` (AUI-03, AUI-05, D-01/D-02/D-04)
- [ ] 12-04-PLAN.md — Transfer detail: `LifecycleTimeline`→`LifecycleStepper` swap + DS restyle, all five ops + RefundForm verbatim (refund never sets `paid`) (AUI-04)
- [ ] 12-05-PLAN.md — Settings hub `/admin/settings` + drop per-page headers/bell across drivers/companies/properties/destinations/health, behaviour verbatim (AUI-01, D-03)
**UI hint**: yes

### Progress (v1.1)

**Execution Order:**
v1.1 phases execute in numeric order after v1.0: 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Design System Foundation | 5/5 | Complete   | 2026-06-20 |
| 10. Guest UI Rebuild | 4/4 | Complete   | 2026-06-21 |
| 11. Driver PWA Rebuild | 5/5 | Complete   | 2026-06-21 |
| 12. Admin Console Rebuild | 1/5 | In Progress|  |
