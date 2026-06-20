# Requirements: Balkanity Platform — v1.1 UI Rebuild

**Defined:** 2026-06-20
**Core Value:** A guest can prepay an airport transfer via a destination link, and a driver can reliably claim and fulfil it — with money only ever marked `paid` by a verified Stripe webhook, and zero double-claims under concurrency.

> v1.0 requirements (PLAT/AUTH/ONBD/BOOK/CLAIM/NOTF/HLTH) shipped across Phases 1–8 and are
> recorded in PROJECT.md (Validated) and the phase artifacts. This file scopes the **v1.1
> presentation-layer rebuild**.

> **Milestone scope:** presentation-layer ONLY. Every requirement below is a UI/visual change.
> No backend, schema, auth, RLS, or payment-path changes. All existing wiring (atomic claim
> RPC, masked pool view, single-writer `paid`, magic-link auth) is preserved as-is. Source of
> truth for visuals: the Stitch mockups + `DESIGN.md` ("Balkanity Path"), brand primary
> **`#029B87`** (DESIGN.md's `#00685a` token is rejected).

## v1.1 Requirements

### Design System (shared foundation)

- [ ] **DS-01**: The "Balkanity Path" design tokens (colors with `#029B87` primary, Montserrat type scale, 8px spacing, radii) are mapped into the app's Tailwind v4 CSS-first `@theme` and used app-wide (no JS `tailwind.config`).
- [ ] **DS-02**: Every status is shown as a colored dot/badge **plus** a worded label (Unclaimed=coral, Claimed=teal, En route=amber, Completed=grey, Cancelled=hollow coral ring) — never color alone.
- [ ] **DS-03**: The infinity/route motif renders as the connective element between departure and arrival points on route visualizations.
- [ ] **DS-04**: A reusable lifecycle stepper component renders the transfer states (Paid → Claimed → En route → Arrived → Picked up → Completed) with completed/active/pending styling.

### Guest UI

- [ ] **GUI-01**: The guest booking screen renders as the boarding-pass "Transfer Pass" (airport→property route header, details grid for date/flight/pickup/guests, payment-status row, total prepaid, pay CTA).
- [ ] **GUI-02**: The booking form inputs are restyled to the design system (48px fields, teal focus, Montserrat labels) with no change to the fields collected or validation.
- [ ] **GUI-03**: The magic-link status page renders as the pass with the live lifecycle state reflected via the DS-04 stepper.
- [ ] **GUI-04**: The pay action shows the Stripe-secured CTA and a "Secured payment · powered by Stripe" trust footer; it drives the existing Checkout-session flow unchanged.

### Driver PWA

- [ ] **DUI-01**: Available transfers render as claim cards (pickup time, pax count, "Unclaimed" badge, route with infinity motif, date, price, Claim CTA) showing **no guest PII** pre-claim.
- [ ] **DUI-02**: A bottom navigation bar provides Available / My Trips / Profile with the active tab highlighted.
- [ ] **DUI-03**: My Trips renders the driver's claimed/past transfers as trip cards (date, status, route, pax, duration, details link) — no earnings or ratings shown.
- [ ] **DUI-04**: The en-route trip detail renders the claimed passenger info, route card, the DS-04 trip-progress stepper, the passenger note, and a Confirm-Arrival CTA wired to the existing advance-status action — no live map.
- [ ] **DUI-05**: The Claim action on a card invokes the existing atomic claim RPC and reflects first-to-claim-wins / already-claimed outcomes in the UI.

### Admin Console

- [ ] **AUI-01**: A persistent left sidebar provides the admin nav (Dashboard, Transfers, Drivers, Settings) with the active item highlighted.
- [ ] **AUI-02**: The Transfer Pool dashboard shows KPI cards (Unclaimed, Claimed, En route, Total today) computed from real transfer data.
- [ ] **AUI-03**: The transfers list renders as the pending-transmissions table (time/ID, passenger, route, lifecycle bar, status, assigned driver, row actions: view / assign / cancel) with filter + sort.
- [ ] **AUI-04**: The transfer detail view is restyled to the design system with the existing assign / reassign / cancel / refund actions intact.
- [ ] **AUI-05**: A top bar shows the search field (client-side filter of loaded transfers), the notifications bell (existing feed), and the signed-in admin identity.

## Out of Scope

Mockup elements with no backing data — excluded to keep the UI truthful (revisit when backend exists).

| Feature | Reason |
|---------|--------|
| Driver live GPS map / route tracking | No location backend; mockup map is illustrative only |
| Driver ratings (e.g. 4.9★) | No rating system in the data model |
| Driver earnings dashboard (totals, +12% trends) | No earnings/payout ledger yet (Connect deferred) |
| Admin "Analytics" nav page | No analytics backend; nav item omitted until built |
| Admin "Download Manifest" export | No export endpoint; deferred |
| KPI "daily goal %" progress | Invented metric with no source of truth |
| Any backend / schema / RLS / payment change | Milestone is presentation-only by definition |

## Traceability

Every v1.1 requirement maps to exactly one phase (9–12). 18/18 mapped — no orphans.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 9 | Pending |
| DS-02 | Phase 9 | Pending |
| DS-03 | Phase 9 | Pending |
| DS-04 | Phase 9 | Pending |
| GUI-01 | Phase 10 | Pending |
| GUI-02 | Phase 10 | Pending |
| GUI-03 | Phase 10 | Pending |
| GUI-04 | Phase 10 | Pending |
| DUI-01 | Phase 11 | Pending |
| DUI-02 | Phase 11 | Pending |
| DUI-03 | Phase 11 | Pending |
| DUI-04 | Phase 11 | Pending |
| DUI-05 | Phase 11 | Pending |
| AUI-01 | Phase 12 | Pending |
| AUI-02 | Phase 12 | Pending |
| AUI-03 | Phase 12 | Pending |
| AUI-04 | Phase 12 | Pending |
| AUI-05 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 18 total
- Mapped to phases: 18 (Phase 9: 4 · Phase 10: 4 · Phase 11: 5 · Phase 12: 5)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-06-20 after roadmap creation (v1.1 phases 9–12, 18/18 mapped)*
