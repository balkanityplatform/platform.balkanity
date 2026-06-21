---
phase: 10-guest-ui-rebuild
plan: 02
subsystem: guest-ui
tags: [ui, transfer-pass, presentation-only, booking, stripe-cta]
dependency_graph:
  requires:
    - "app/(guest)/_pass/TransferPass.tsx :: TransferPass (Plan 10-1)"
    - "app/(guest)/_pass/PassHeader.tsx :: PassHeader (Plan 10-1)"
    - "app/(guest)/_pass/DetailsGrid.tsx :: DetailsGrid (Plan 10-1)"
    - "app/(guest)/_pass/icons.tsx :: PlaneIcon, CalendarIcon, ClockIcon, PeopleIcon, LockIcon (Plan 10-1)"
    - "platform/ui/RouteMotif.tsx (composed by PassHeader)"
    - "platform/money/commission.ts :: fmtEur"
    - "reworded bookingContinueCta / bookingContinuePending + payTrustFooter + passPaymentPending keys (Plan 10-1)"
    - "./actions :: createBooking (unchanged BOOK-02/04 server action)"
  provides:
    - "app/pickup/[slug]/page.tsx — booking screen composed as the Transfer Pass"
    - "app/pickup/[slug]/BookingForm.tsx — restyled island with Stripe trust footer (BookingFormCopy.trustFooter)"
  affects:
    - "Plan 10-3 (status pass) — same TransferPass shell, adds passRefLabel on /status"
tech_stack:
  added: []
  patterns:
    - "The booking screen IS the pass (UI-SPEC Decision 2) — header + grid + payment row + total frame the form"
    - "Pay-CTA amount interpolated SERVER-SIDE via fill() (Pitfall 5) — never a form input"
    - "Brand-token-only styling (bg-amber/bg-teal); zero new @theme tokens"
key_files:
  created:
    - ".planning/phases/10-guest-ui-rebuild/10-02-SUMMARY.md"
  modified:
    - "app/pickup/[slug]/BookingForm.tsx"
    - "app/pickup/[slug]/page.tsx"
decisions:
  - "Trust footer placed directly below the pay CTA (above the ghost Back), at the Label role: teal LockIcon + payTrustFooter — the reassurance sits with the pay action, not the page foot"
  - "Payment-status row hand-rendered as an amber dot + worded passPaymentPending label (StatusDot has no pre-pay state; requested is grey) — matches StatusDot dot+label markup, WCAG 1.4.1 worded"
  - "DetailsGrid values are empty pre-input on /pickup (guest enters them in the form below) — DetailsGrid renders the graceful em-dash; the grid is the labelled overview per Decision 3"
metrics:
  duration: 3min
  completed: "2026-06-21"
  tasks: 2
  files: 3
---

# Phase 10 Plan 02: Booking Pass Summary

Rebuilt the guest booking screen `/pickup/[slug]` as the boarding-pass "Transfer
Pass" by composing the Plan 10-1 shared pieces, and restyled the booking form with
a Stripe trust footer — with ZERO change to the fields collected, the validation,
or the `createBooking` → Stripe Checkout flow (presentation-only, GUI-01/02/04).

## What Was Built

| Artifact | File | Role |
|----------|------|------|
| Transfer Pass composition | `app/pickup/[slug]/page.tsx` | `TransferPass` shell → `PassHeader` (RouteMotif airport→property, ref line omitted) → `DetailsGrid` (Date/Flight/Guests/Time) → amber-dot payment-status row → Total prepaid (Heading role) → restyled `BookingForm` |
| Restyled booking form | `app/pickup/[slug]/BookingForm.tsx` | Same fields/validation/error mapping/disclosure-gated CTA + new Stripe trust footer (teal `LockIcon` + `payTrustFooter`) below the pay CTA; `BookingFormCopy` extended with `trustFooter` |

## Tasks

1. **Task 1** — Restyled `BookingForm`: added `trustFooter` to `BookingFormCopy`, imported `LockIcon` from `app/(guest)/_pass/icons`, rendered a centered teal lock + secured-payment line below the pay CTA. The 11 field names, validation, error mapping, `useActionState(createBooking)`, disclosure checkbox gate, and ghost Back all kept verbatim; no amount/price input. Commit `75439cf`.
2. **Task 2** — Composed `/pickup/[slug]` as the `TransferPass`: replaced the bare `<h1>` + fare `Card` with `PassHeader` + `DetailsGrid` + amber payment-status row + Total prepaid, then mounted `BookingForm` with the server-interpolated `continueCta` (`fill(t.bookingContinueCta, { amount })`) and `trustFooter: t.payTrustFooter`. Kept the service-role `price_cents` read, the inactive-slug neutral state, `runtime = "nodejs"`, and the `fill()` helper verbatim; ref line omitted (no faked id). Commit `a7e80bd`.

## Deviations from Plan

None — plan executed exactly as written. Each file type-checks against its partner: after Task 1 the form referenced a new required `trustFooter` prop, so the standalone `tsc` was red until Task 2 supplied it on the page mount (expected interdependent-file ordering; full `tsc --noEmit` exits 0 after both tasks). No behaviour, field, validation, or action change.

## Verification

- `npx tsc --noEmit` exits 0 (both files type-check together).
- `npx eslint` on both files clean.
- Field set byte-identical: `name="(name|email|phone|flight_no|arrival_date|arrival_time|pax|luggage_count|notes|slug|ack)"` — exactly 11, NO `name="amount"`/`name="price"` on page or form.
- `createBooking` action call unchanged; disclosure CTA gate (`disabled={!acked`) intact.
- Pass composed: `TransferPass|PassHeader|DetailsGrid` ×7 on the page; ref line omitted (`passRefLabel` ×0, no `BK-2941`/`928374`).
- Pay-CTA amount server-interpolated: `fill(t.bookingContinueCta` ×1; form mounted with `trustFooter: t.payTrustFooter`.
- Inactive-slug guard preserved (`slugUnavailableHeading` ×1); `runtime = "nodejs"` ×1; service-role `price_cents` read still the only amount source.
- Payment-status row uses worded label (`passPaymentPending`), never colour alone (WCAG 1.4.1).
- `git diff app/globals.css` empty — zero new @theme tokens; no `#00685a`, no Material Symbols, no barcode.
- e2e suite collects: 22 tests in 10 files (no field/validation/action change → booking behaviour unaffected).

## Threat Surface

- **T-10-04 (Tampering — price input):** mitigated — NO amount/price form input added; server re-reads `price_cents` (read kept verbatim); CTA amount server-interpolated via `fill()`. Greps assert no `name="amount"`/`name="price"`.
- **T-10-05 (Info disclosure — inactive slug):** mitigated — inactive/unknown-slug neutral state (no form, no fare) kept verbatim; `slugUnavailableHeading` retained.
- **T-10-06 (EoP — client writes paid):** mitigated — the pay CTA only triggers the existing `createBooking`→Checkout flow; no `paid` write on this path (single-writer invariant). BookingForm action call unchanged.
- **T-10-SC (package installs):** mitigated — zero packages installed; all imports are existing in-repo modules.

No new trust boundaries introduced.

## Self-Check: PASSED
