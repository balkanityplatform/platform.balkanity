# Requirements: Balkanity Platform — Welcome Pickup (v1)

**Defined:** 2026-06-17
**Core Value:** A guest can prepay an airport transfer via a destination link, and a driver can reliably claim and fulfil it — with money only ever marked `paid` by a verified Stripe webhook, and zero double-claims under concurrency.

## v1 Requirements

Requirements for the pilot release (1 company + 3 properties; ~10 real-money transfers). Each maps to a roadmap phase.

### Platform Foundation

- [x] **PLAT-01**: Codebase enforces a one-way platform↔module seam (modules import platform, never the reverse) across DB schema, server modules, and UI
- [ ] **PLAT-02**: App is an installable, offline-aware PWA shell (Serwist) deployed to the Balkanity Vercel project
- [x] **PLAT-03**: Brand design tokens (six colours + white, Montserrat) and real logo/pictogram assets are wired as a reusable design system
- [x] **PLAT-04**: UI strings support an EN/BG toggle
- [x] **PLAT-05**: Supabase clients are split — anon client on the browser, service-role only on the server (never shipped to client)

### Authentication & Roles

- [x] **AUTH-01**: Users have an app role ∈ {admin, driver, guest} enforced across the app
- [ ] **AUTH-02**: Guest can view their transfer status via a passwordless Supabase magic link
- [ ] **AUTH-03**: Drivers are admin-invited contractors only (no open signup); invite flow creates a driver account
- [x] **AUTH-04**: Admin can sign in to the desktop console via **email + password** (classic credentials). _Decision change 2026-06-18: reverses D-01 (passwordless magic-link) for admin/driver LOGIN → email+password; accounts are admin-created with an invite-to-set-password email + self-service password reset. Magic-link/tokenized access is retained only for guest transfer status (AUTH-02). Role layer (AUTH-01) unchanged._

### Supply-Side Onboarding (Admin, no-code)

- [ ] **ONBD-01**: Admin can create, edit, and list companies
- [ ] **ONBD-02**: Admin can create, edit, and list properties under a company
- [ ] **ONBD-03**: Admin can create, edit, and list destinations (slug, label, address, zone, airport, active)
- [ ] **ONBD-04**: Admin sets price + commission per destination with a live "you keep" calculation
- [ ] **ONBD-05**: Admin can invite drivers from the console
- [ ] **ONBD-06**: A second company can be onboarded entirely through the UI (no code/DB edits)

### Booking & Payment (Guest)

- [ ] **BOOK-01**: Guest opens a per-destination slug page (`/pickup/<slug>`) showing the destination and fare
- [ ] **BOOK-02**: Guest completes a short booking form (email required; phone, flight no., pax, luggage, notes as applicable) — guestless checkout
- [ ] **BOOK-03**: Booking creates a transfer in `requested` and a code-created Stripe Checkout Session (not a dashboard Payment Link)
- [ ] **BOOK-04**: Checkout clearly states the booking is prepaid & non-refundable before payment
- [ ] **BOOK-05**: `paid` is set ONLY by a signature-verified Stripe webhook (raw body), idempotent on Stripe event id; the client success redirect never sets `paid`
- [ ] **BOOK-06**: On `paid`, the guest receives a booking confirmation email (Resend)
- [ ] **BOOK-07**: Guest status page shows a live lifecycle timeline and a visible payment record/receipt (proof of prepay)

### Transfer Lifecycle & Driver Claim

- [ ] **XFER-01**: Transfer follows the locked lifecycle: requested → paid → claimed → en_route → arrived → picked_up → completed (+ cancelled)
- [ ] **CLAIM-01**: Invited driver signs in and sees a limited-detail pool of `paid`, unclaimed transfers (date, arrival time, airport, destination zone/area — NOT exact address — fare, pax, luggage)
- [ ] **CLAIM-02**: Driver claims a transfer via an atomic conditional update (first-to-claim wins; loser gets "already claimed") — 0 double-claims under concurrency
- [ ] **CLAIM-03**: Full guest PII (name, contact, exact address, flight no., notes) unlocks only for the claiming driver and admin, enforced at the data layer (RLS + masked view/RPC), not UI-only
- [ ] **CLAIM-04**: A driver may hold multiple active claimed transfers and cannot un-claim (only admin can release/reassign)
- [ ] **CLAIM-05**: Driver advances status: claimed → en_route → arrived → picked_up → completed from the "My run" view
- [ ] **CLAIM-06**: "My run" lists the driver's active claimed transfers ordered by arrival time

### Notifications

- [ ] **NOTF-01**: Per-user in-app notification feed/bell (shared platform feature; primary channel for drivers)
- [ ] **NOTF-02**: Guest receives a "driver assigned" email on `claimed` and a "driver has arrived" email on `arrived` (no email on `en_route`)
- [ ] **NOTF-03**: Admin receives a booking alert email on new paid booking
- [ ] **NOTF-04**: Driver receives an invite email
- [ ] **NOTF-05**: Drivers get an opt-in daily digest at a self-chosen time instead of per-transfer email
- [ ] **NOTF-06**: An email send-guardrail + `email_log` track volume and alarm before the Resend daily cap

### Admin Operations

- [ ] **OPS-01**: Admin sees a transfers list with filter and search
- [ ] **OPS-02**: Admin opens a transfer detail page (lifecycle, trip/payment details)
- [ ] **OPS-03**: Admin can assign, reassign, release, and cancel a transfer
- [ ] **OPS-04**: Admin can issue a manual Stripe refund from the transfer detail page

### Platform Health (Admin)

- [ ] **HLTH-01**: `webhook_events` log records idempotency, signature result, and processing outcome for every Stripe event
- [ ] **HLTH-02**: A reconciliation sweep (Supabase pg_cron, ~15–30 min) flags Stripe-paid payments with no matching transfer; Vercel cron is a daily backstop only
- [ ] **HLTH-03**: An email-cap gauge shows usage against the Resend daily cap
- [ ] **HLTH-04**: Stuck-transfer alerts surface transfers that have not advanced as expected
- [ ] **HLTH-05**: A keep-alive prevents the Supabase project from pausing (which would stop pg_cron) during the pilot

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Payouts

- **PAY-01**: Stripe Connect (Express) onboarding for property companies
- **PAY-02**: Commission payout via `application_fee_amount` + `transfer_data[destination]` on the Checkout Session

### Growth

- **GROW-01**: Property company self-service portal
- **GROW-02**: Auto-dispatch of transfers to drivers
- **GROW-03**: Flight tracking integration
- **GROW-04**: SMS / WhatsApp notifications
- **GROW-05**: 24h-before guest reminder email (pending real-data decision vs email cap)
- **GROW-06**: Second platform module (tours, car rental, …)

## Out of Scope

Explicitly excluded for v1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Stripe Connect / commission payout | De-risk pilot; v1 records commission but settles all funds to Balkanity via plain Checkout |
| Auto-dispatch | v1 is self-claim only |
| Flight tracking | Not core to the pilot |
| Property self-service portal | Admin onboards on companies' behalf in v1 |
| SMS / WhatsApp | Email only in v1 |
| Full i18n framework | EN/BG toggle is sufficient for v1 |
| Second platform module | Welcome Pickup only |
| Automated / guest-facing refund flow | Bookings prepaid & non-refundable; admin issues manual refunds for exceptions |
| Pricing engine | Manual fixed price per destination |
| Guest accounts (mandatory) | Guestless checkout + magic-link status is lower friction |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 — Platform Foundation | Complete |
| PLAT-02 | Phase 1 — Platform Foundation | Pending |
| PLAT-03 | Phase 1 — Platform Foundation | Complete |
| PLAT-04 | Phase 1 — Platform Foundation | Complete |
| PLAT-05 | Phase 1 — Platform Foundation | Complete |
| AUTH-01 | Phase 1 — Platform Foundation | Complete |
| AUTH-04 | Phase 1 — Platform Foundation | Complete |
| ONBD-01 | Phase 2 — Supply-Side Onboarding | Pending |
| ONBD-02 | Phase 2 — Supply-Side Onboarding | Pending |
| ONBD-03 | Phase 2 — Supply-Side Onboarding | Pending |
| ONBD-04 | Phase 2 — Supply-Side Onboarding | Pending |
| ONBD-05 | Phase 2 — Supply-Side Onboarding | Pending |
| ONBD-06 | Phase 2 — Supply-Side Onboarding | Pending |
| AUTH-03 | Phase 2 — Supply-Side Onboarding | Pending |
| NOTF-04 | Phase 2 — Supply-Side Onboarding | Pending |
| BOOK-05 | Phase 3 — Payments Trust Spine | Pending |
| HLTH-01 | Phase 3 — Payments Trust Spine | Pending |
| BOOK-01 | Phase 4 — Transfer Entity + Booking Form | Pending |
| BOOK-02 | Phase 4 — Transfer Entity + Booking Form | Pending |
| BOOK-03 | Phase 4 — Transfer Entity + Booking Form | Pending |
| BOOK-04 | Phase 4 — Transfer Entity + Booking Form | Pending |
| BOOK-06 | Phase 4 — Transfer Entity + Booking Form | Pending |
| BOOK-07 | Phase 4 — Transfer Entity + Booking Form | Pending |
| XFER-01 | Phase 4 — Transfer Entity + Booking Form | Pending |
| AUTH-02 | Phase 4 — Transfer Entity + Booking Form | Pending |
| CLAIM-02 | Phase 5 — Claim Correctness | Pending |
| CLAIM-03 | Phase 5 — Claim Correctness | Pending |
| CLAIM-01 | Phase 6 — Driver & Admin Views | Pending |
| CLAIM-04 | Phase 6 — Driver & Admin Views | Pending |
| CLAIM-05 | Phase 6 — Driver & Admin Views | Pending |
| CLAIM-06 | Phase 6 — Driver & Admin Views | Pending |
| OPS-01 | Phase 6 — Driver & Admin Views | Pending |
| OPS-02 | Phase 6 — Driver & Admin Views | Pending |
| OPS-03 | Phase 6 — Driver & Admin Views | Pending |
| OPS-04 | Phase 6 — Driver & Admin Views | Pending |
| NOTF-01 | Phase 7 — Notifications | Pending |
| NOTF-02 | Phase 7 — Notifications | Pending |
| NOTF-03 | Phase 7 — Notifications | Pending |
| NOTF-05 | Phase 7 — Notifications | Pending |
| NOTF-06 | Phase 7 — Notifications | Pending |
| HLTH-02 | Phase 8 — Platform Health | Pending |
| HLTH-03 | Phase 8 — Platform Health | Pending |
| HLTH-04 | Phase 8 — Platform Health | Pending |
| HLTH-05 | Phase 8 — Platform Health | Pending |

**Coverage:**
- v1 requirements: 44 total (PLAT 5, AUTH 4, ONBD 6, BOOK 7, XFER 1, CLAIM 6, NOTF 6, OPS 4, HLTH 5)
- Mapped to phases: 44 ✓
- Unmapped: 0 ✓

> Note: the prior summary line cited "37 total" before the categories were fully enumerated; the actual v1 requirement count is 44. All 44 are mapped to exactly one phase, with no orphans or duplicates.

---
*Requirements defined: 2026-06-17*
*Last updated: 2026-06-17 after roadmap creation (traceability populated, count corrected to 44)*
