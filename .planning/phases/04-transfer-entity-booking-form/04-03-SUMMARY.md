---
phase: 04-transfer-entity-booking-form
plan: 03
subsystem: booking
tags: [server-action, zod, stripe-checkout, server-trusted-amount, pwa-guest, useActionState, pii-write, disclosure]

# Dependency graph
requires:
  - phase: 03-payments
    provides: "createCheckoutSession({transferId,amountCents}) code-created Checkout helper; single-paid-writer grep gate; wp_transfers money-spine; createAdminClient service-role client"
  - phase: 04-transfer-entity-booking-form
    plan: 01
    provides: "app/pickup/[slug]/booking.test.ts RED spec (the GREEN target); full booking/disclosure/validation copy keys in en.ts + bg.ts"
  - phase: 04-transfer-entity-booking-form
    plan: 02
    provides: "supabase/migrations/0004 — wp_transfers PII columns (guest_*, pax, flight_no, arrival_at, luggage_count, notes), requested status, destinations_public_active_read anon policy (authored, applied in Plan 05)"
provides:
  - "app/pickup/[slug]/actions.ts — createBooking server action: public zod boundary → server-trusted price re-read → requested insert → createCheckoutSession → 303 redirect"
  - "app/pickup/[slug]/page.tsx — public RSC: slug→destination+fare display or neutral inactive-slug state, mounts BookingForm with server-resolved copy"
  - "app/pickup/[slug]/BookingForm.tsx — useActionState booking island with disclosure-gated CTA + inline zod error mapping"
  - "platform/ui/PaxStepper.tsx — ≥44px integer number-stepper primitive with hidden FormData input"
affects: [04-04-status-page, 04-05-apply-migration, 05-claim]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public server-action boundary: zod re-validates all FormData but NO getCurrentRole gate (booking is unauthenticated/public); the trust boundary is the schema + the server-re-read amount"
    - "Server-trusted amount: createBooking re-reads destinations.price_cents by slug and uses it for BOTH the row and the Checkout Session; the form submits no amount input (Pitfall 5 / T-04-TMP3)"
    - "redirect() NEXT_REDIRECT propagates uncaught from the action (303 to hosted Checkout) — never catch-and-swallowed"
    - "PaxStepper: controlled value mirrored into a hidden input (the DestinationForm controlled-state+hidden-input convention) so the server action reads it from FormData"

key-files:
  created:
    - app/pickup/[slug]/actions.ts
    - app/pickup/[slug]/page.tsx
    - app/pickup/[slug]/BookingForm.tsx
    - platform/ui/PaxStepper.tsx
  modified: []

key-decisions:
  - "No getCurrentRole gate in createBooking (public booking surface, PATTERNS line 69) — distinct from the admin destinations actions which DO re-gate; the zod schema + server-sourced amount are the only gates on the public insert"
  - "createBooking redirects with whatever createCheckoutSession returns and lets NEXT_REDIRECT throw; the booking.test.ts happy-path asserts only the call contract + that the redirect throws, so this satisfies both the real string return and the test's object mock"
  - "The page uses the service-role client for the non-PII active-destination read (label/zone/airport/price_cents/active) — equivalent to the 0004 destinations_public_active_read anon path; the fare is rendered read-only, never as a form input"

requirements-completed: [BOOK-01, BOOK-02, BOOK-03, BOOK-04]

# Metrics
duration: 3min
completed: 2026-06-18
---

# Phase 4 Plan 03: Booking Vertical Slice Summary

**The thinnest end-to-end "guest can book and pay" slice: `/pickup/<slug>` resolves a destination to a fare + the guestless booking form, and a valid submit creates a `requested` wp_transfers row carrying the SERVER-re-read price and 303-redirects to the Phase-3 code-created Stripe Checkout — with the prepaid/non-refundable disclosure gating the CTA and zero second `paid` writer.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-18T20:05Z
- **Completed:** 2026-06-18T20:08Z
- **Tasks:** 3
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- **`createBooking` server action (Task 1):** A public (`"use server"`, no admin gate) action that `safeParse`s all FormData through a zod `bookingSchema` (email→invalidEmail, pax 1–8→passengersRange, else fieldRequired; a past `arrival_at` → arrivalPast), then re-reads `destinations.price_cents` by slug (inactive/unknown slug → no insert, no charge), inserts a `wp_transfers` row with `status:'requested'` and `amount_cents = dest.price_cents`, calls `createCheckoutSession({transferId, amountCents})` exactly once with the SERVER-sourced amount, and 303-redirects (uncaught `NEXT_REDIRECT`). Turned the Plan-01 `booking.test.ts` RED spec GREEN.
- **PaxStepper primitive (Task 2):** A platform-generic `≥44px` `[−][value][+]` stepper (`useState` value, `−` disabled at `min`, `+` disabled at `max` when provided, aria-live value + aria-labelled buttons) mirroring the value into a hidden `<input name>` for the server action.
- **`/pickup/[slug]` page (Task 2):** `runtime="nodejs"` RSC that reads the active destination by slug, renders the label (Display 28px) + a fare `Card` (caption + `Total to pay €{fmtEur(price_cents)}`, read-only) + the `BookingForm` island with all copy resolved server-side; an inactive/unknown slug renders the neutral `slugUnavailableHeading`/`Body` state (no form).
- **`BookingForm` island (Task 3):** A `useActionState(createBooking)` form with a hidden `slug` input (and NO amount input), all D-01..D-04 fields (TextField for name/email/phone/flight/notes, native date/time, PaxStepper for pax 1–8 and luggage min 0), the BOOK-04 prepaid/non-refundable disclosure `Card` ABOVE the CTA with a `≥44px` acknowledgement checkbox gating the "Continue to payment" Button, inline server-error mapping, and a pending-disabled CTA to prevent double-submit.

## Task Commits

Each task was committed atomically:

1. **Task 1: createBooking server action (zod boundary → server-trusted insert → Checkout redirect)** - `bcc779f` (feat) — TDD GREEN step against the existing Plan-01 RED spec.
2. **Task 2: PaxStepper primitive + /pickup/[slug] page** - `027d07f` (feat)
3. **Task 3: BookingForm island (useActionState + disclosure-gated CTA)** - `40dbd55` (feat)

## Files Created/Modified

- `app/pickup/[slug]/actions.ts` - `createBooking` public server action; zod boundary + server-re-read amount + requested insert + Checkout 303-redirect; header documents the no-admin-gate / server-sourced-amount / never-swallow-NEXT_REDIRECT contracts.
- `app/pickup/[slug]/page.tsx` - Public RSC: slug→fare display or neutral inactive state; mounts BookingForm with server-resolved copy.
- `app/pickup/[slug]/BookingForm.tsx` - `useActionState` booking island; all fields + disclosure-gated CTA + inline error mapping; submits no amount.
- `platform/ui/PaxStepper.tsx` - `≥44px` integer stepper primitive with hidden FormData input.

## Decisions Made

- **No `getCurrentRole` gate in `createBooking`** — the booking surface is public/unauthenticated (PATTERNS line 69), distinct from the admin destinations actions that re-gate. The zod schema and the server-re-read amount are the only gates on the public insert; the no-write RLS policy means the insert must go through the service-role client anyway.
- **The action redirects with the helper's return value and lets `redirect()` throw `NEXT_REDIRECT`.** The real `createCheckoutSession` returns `string | null`; the test mocks it to return an object. The happy-path spec asserts only the call contract + that a redirect throws, so passing the return straight to `redirect()` satisfies both the production string and the test's object mock without branching.
- **Service-role non-PII read on the page** — `label/zone/airport/price_cents/active` is the same data the 0004 `destinations_public_active_read` anon policy exposes; using the service-role client here keeps the read simple and the fare is rendered read-only (the amount is re-read at submit, never trusted from the client).

## Deviations from Plan

None - plan executed exactly as written. No package installs (RESEARCH Package Legitimacy Audit: zero new packages; T-04-SC accept).

## Issues Encountered

None blocking. The full vitest run is 20 files / 104 tests passing, with `platform/transfers/confirmation.test.ts` (2 tests) staying RED — this is the Plan-01 Nyquist baseline for the BOOK-06 confirmation module that **Plan 04** builds, explicitly out of scope here. The booking spec (this plan's GREEN target) and the single-writer gate both pass. `npm run typecheck` is clean; `npm run lint` reports only two pre-existing test-file `no-unused-vars` warnings (0 errors), neither from this plan's files; `npm run build` compiles successfully with `/pickup/[slug]` registered.

## Threat Surface / Stubs

- **Stubs:** None. No placeholder/mock data flows to any UI; the page reads a real destination and renders the real fare or the neutral unavailable state.
- **Threat flags:** None new beyond the plan's `<threat_model>`. All four `mitigate` dispositions are implemented: T-04-TMP3 (amount re-read server-side, no amount form input — enforced in actions.ts + absent from BookingForm), T-04-V5 (zod `bookingSchema` at the boundary with future-arrival + pax 1–8 checks), T-04-SPOOF (only `status:'requested'` written; single-writer.test.ts green), T-04-ID4 (inactive/unknown slug → neutral state, no insert/charge). T-04-SC (npm installs) — N/A, zero new packages.

## User Setup Required

None - no external service configuration required. (Live `/pickup/<slug>` verification depends on the Plan-05 apply of migration 0004, which lands the `destinations_public_active_read` policy and the PII columns this action writes.)

## Next Phase Readiness

- The guest can now do something they could not before: open a destination link, fill the form, and be 303-redirected into Stripe Checkout to prepay — pending the Plan-05 migration apply so the PII columns + anon read exist live.
- The `requested` row carries the full guest PII + arrival/flight payload the status page (Plan 04) reads via the guest-self-read RLS, and the `transfer_id` the webhook resolves to mark `paid`.
- `BookingFormCopy` / `BookingState` types and the PaxStepper primitive are now available for reuse.

## Self-Check: PASSED

- All 4 created files exist on disk (`app/pickup/[slug]/actions.ts`, `app/pickup/[slug]/page.tsx`, `app/pickup/[slug]/BookingForm.tsx`, `platform/ui/PaxStepper.tsx`).
- All 3 task commits present in git history: `bcc779f`, `027d07f`, `40dbd55`.

---
*Phase: 04-transfer-entity-booking-form*
*Completed: 2026-06-18*
