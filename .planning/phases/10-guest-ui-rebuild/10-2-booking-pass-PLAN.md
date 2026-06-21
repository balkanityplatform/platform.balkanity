---
phase: 10-guest-ui-rebuild
plan: 02
type: execute
wave: 2
depends_on: ["10-01"]
files_modified:
  - app/pickup/[slug]/page.tsx
  - app/pickup/[slug]/BookingForm.tsx
autonomous: true
requirements: [GUI-01, GUI-02, GUI-04]
must_haves:
  truths:
    - "The /pickup/[slug] booking screen renders as the boarding-pass Transfer Pass: airport->property route header (RouteMotif), a details grid for date/flight/pickup/guests, a payment-status row, the total prepaid, and a primary pay CTA"
    - "The booking form collects EXACTLY the same fields with EXACTLY the same validation as before — only styling changed (48/52px fields, teal focus ring, Montserrat labels)"
    - "The pay CTA reads 'Pay €{amount} & confirm' and a 'Secured payment · powered by Stripe' trust footer renders below it"
    - "The form submits NO amount/price input — only the hidden slug + guest fields (server re-reads price_cents, Pitfall 5)"
    - "The pay action drives the EXISTING createBooking -> Stripe Checkout flow unchanged; the client never writes paid"
  artifacts:
    - path: "app/pickup/[slug]/page.tsx"
      provides: "Booking page composed as the Transfer Pass (header + grid + payment row + CTA + trust footer)"
      contains: "TransferPass"
    - path: "app/pickup/[slug]/BookingForm.tsx"
      provides: "Restyled booking form island (same fields/validation/action)"
      contains: "createBooking"
  key_links:
    - from: "app/pickup/[slug]/page.tsx"
      to: "app/(guest)/_pass/TransferPass.tsx"
      via: "composition of the shared pass shell"
      pattern: "TransferPass|PassHeader|DetailsGrid"
    - from: "app/pickup/[slug]/BookingForm.tsx"
      to: "createBooking"
      via: "useActionState(createBooking) — unchanged action call"
      pattern: "useActionState\\(\\s*createBooking"
---

<objective>
Rebuild the guest booking screen `/pickup/[slug]` as the boarding-pass "Transfer Pass" by composing the Plan 10-1 shared pieces, and restyle the booking form to the design system — with ZERO change to the fields collected, the validation, or the `createBooking` -> Stripe Checkout flow.

This satisfies GUI-01 (pass identity), GUI-02 (restyled form, same fields/validation), and GUI-04 (Stripe-secured pay CTA + trust footer driving the existing Checkout). The pass FRAMES the form (UI-SPEC Decision 2): pass header on top, restyled inputs below, pay CTA + Stripe trust footer at the bottom.

Purpose: This is the primary guest entry point and the screen that most defines the new identity. It must look like a transfer pass while behaving identically to today's booking flow.

Output: A rebuilt `app/pickup/[slug]/page.tsx` (composition) and a restyled `BookingForm.tsx` (page chrome + re-worded CTA copy only).
</objective>

<phase_goal>
**As a** guest opening a destination link, **I want to** book and prepay my airport transfer on a screen that reads as a branded "Transfer Pass", **so that** I trust the booking and can pay with confidence.
</phase_goal>

<execution_context>
@/Users/balkanitytours/GitHub/platform.balkanity/.claude/gsd-core/workflows/execute-plan.md
@/Users/balkanitytours/GitHub/platform.balkanity/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/10-guest-ui-rebuild/10-UI-SPEC.md
@.planning/phases/10-guest-ui-rebuild/10-PATTERNS.md
@.planning/phases/10-guest-ui-rebuild/10-1-pass-foundation-PLAN.md
@.planning/phases/10-guest-ui-rebuild/10-01-SUMMARY.md
</context>

<artifacts_this_phase_produces>
No new shared symbols — this plan COMPOSES the Plan 10-1 artifacts (`TransferPass`, `PassHeader`, `DetailsGrid`, the line icons) and the Phase 9 components (`RouteMotif`, `StatusDot`/`stateLabel`, `Button`, `Card`, `TextField`, `PaxStepper`). It re-words the existing `bookingContinueCta`/`bookingContinuePending` usage (keys re-worded in 10-1) and adds the `payTrustFooter` + `passPaymentPending` copy into the page's flat copy prop.
</artifacts_this_phase_produces>

<tasks>

<task type="auto">
  <name>Task 1: Restyle the BookingForm island (page chrome + CTA copy only — same fields/validation/action)</name>
  <files>app/pickup/[slug]/BookingForm.tsx</files>
  <read_first>
    - app/pickup/[slug]/BookingForm.tsx (the WHOLE file — every field, the `BookingFormCopy` prop shape lines 24-50, the `useActionState(createBooking)` call lines 59-62, the inline-error mapping lines 73-85, the hidden slug input line 90 with NO amount input, the disclosure Card + checkbox gate lines 153-179, the disabled-until-acked CTA + aria-busy lines 190-196, the ghost Back button lines 200-202)
    - platform/ui/TextField.tsx (already ships h-[52px] + 2px teal focus ring + 14px/600 label — reuse as-is, no per-call style change)
    - platform/ui/PaxStepper.tsx (already brand-styled, ≥44px tap targets, hidden-input -> FormData)
    - platform/ui/Button.tsx (primary 52px teal + ghost variants — unchanged)
    - app/(guest)/_pass/icons.tsx (the LockIcon for the trust footer)
    - 10-PATTERNS.md "BookingForm.tsx (MODIFY)" section (RE-SKIN ONLY, CONTEXT D-02: same fields, order, validation, createBooking action, disclosure-gates-CTA logic; the visual upgrade is page-chrome + re-worded CTA, not field internals)
    - 10-UI-SPEC.md Component Inventory "Restyled booking form" + "Pay CTA + trust footer" rows (lines 142, 144); Copywriting Contract pay-CTA + trust-footer rows (lines 119-120)
  </read_first>
  <action>
    Restyle the form WITHOUT touching its behaviour. KEEP VERBATIM: `useActionState(createBooking, initialState)`, the full `BookingFormCopy` prop shape (extended only by adding `trustFooter` to it), the inline error mapping, the hidden `slug` input (NO amount input), the disclosure `Card` + checkbox acknowledgement gate, the disabled-until-acked + `aria-busy` CTA logic, the ghost Back button, all field names/types/required flags/order (name, email, phone, flight_no, arrival_date, arrival_time, pax, luggage_count, notes).
    Visual changes ONLY: (a) the CTA label now renders the re-worded `copy.continueCta` ("Pay €{amount} & confirm") — the amount token is already interpolated by the server page before being passed in (S2), so the form just renders the string; the pending label renders `copy.continuePending` ("Confirming…"). (b) Add a Stripe trust footer below the CTA: a centered `LockIcon` (teal) + the `copy.trustFooter` string ("Secured payment · powered by Stripe"), at the Label typography role. Add `trustFooter: string` to the `BookingFormCopy` type. Do NOT change the form `className` rhythm in a way that alters submitted data; spacing/Card grouping tweaks are fine. Add NO price/amount input.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - The field set is unchanged: `grep -oE 'name="(name|email|phone|flight_no|arrival_date|arrival_time|pax|luggage_count|notes|slug|ack)"' app/pickup/[slug]/BookingForm.tsx | sort -u` lists exactly those 11 names — NO `name="amount"` / `name="price"` appears
    - `grep -c 'useActionState(' app/pickup/[slug]/BookingForm.tsx` >= 1 referencing `createBooking` (action call unchanged): `grep -c "createBooking" app/pickup/[slug]/BookingForm.tsx` >= 1
    - The disclosure gate is intact: `grep -c "disabled={!acked" app/pickup/[slug]/BookingForm.tsx` >= 1 (CTA still gated by the acknowledgement)
    - The trust footer renders the copy prop: `grep -c "trustFooter" app/pickup/[slug]/BookingForm.tsx` >= 1 and a `LockIcon` import from `app/(guest)/_pass/icons` is present
    - TextField/PaxStepper still used (no new form library): `grep -c "TextField" app/pickup/[slug]/BookingForm.tsx` >= 1; `grep -iE "react-hook-form|formik|@mui" app/pickup/[slug]/BookingForm.tsx` returns nothing
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>BookingForm keeps every field, the same validation/error mapping, the same createBooking action, and the disclosure-gated CTA — with the re-worded pay CTA and a Stripe lock trust footer added. No amount input, no new form deps.</done>
</task>

<task type="auto">
  <name>Task 2: Compose /pickup/[slug] as the Transfer Pass (header + details grid + payment-status row + total + CTA wiring)</name>
  <files>app/pickup/[slug]/page.tsx</files>
  <read_first>
    - app/pickup/[slug]/page.tsx (the WHOLE file — the service-role dest read lines 35-40, the inactive-slug neutral state lines 42-54, the fill() interpolation lines 27-29, the `<BookingForm copy={…}/>` mount lines 76-105, runtime="nodejs" line 22; the bare h1 + fare Card lines 56-74 to be REPLACED by the pass composition)
    - app/(guest)/_pass/TransferPass.tsx, PassHeader.tsx, DetailsGrid.tsx, icons.tsx (the Plan 10-1 pieces to compose — read the SUMMARY for exact prop shapes)
    - platform/ui/RouteMotif.tsx (PassHeader composes it; start=Plane+airport label, end=Building+destination label, brand badge midpoint by default)
    - platform/ui/StatusDot.tsx (lines 49-51 stateLabel(); the payment-status row uses an amber dot pre-pay with `passPaymentPending`, and `stateLabel("paid")` once paid — always dot + worded label, WCAG 1.4.1)
    - platform/money/commission.ts (fmtEur — already imported; used for "Total prepaid €{amount}")
    - 10-PATTERNS.md "app/pickup/[slug]/page.tsx (MODIFY)" section (keep verbatim list + restyle list; the page-shell `<main className="mx-auto flex max-w-[480px] flex-col gap-[24px] px-[16px] py-[48px]">`; RouteMotif usage; OMIT the ref line on /pickup — no faked id)
    - 10-UI-SPEC.md Decision 2 (pass frames form), Decision 3 (details grid real fields only), Component Inventory rows for "Booking pass header" / "Details grid" / "Payment-status + total row" (lines 140-143)
  </read_first>
  <action>
    Replace the bare `<h1>` + fare `Card` (lines 56-74) with the Transfer Pass composition while KEEPING VERBATIM the service-role dest read, the inactive/unknown-slug neutral state (reuse `slugUnavailableHeading`/`slugUnavailableBody`, no form, no fare leak), `runtime = "nodejs"`, and the existing `fill()` helper.
    Compose: `<TransferPass header={<PassHeader eyebrow={t.passEyebrow} … />}>` where PassHeader gets the airport label (`dest.airport`) and destination label (`dest.label`) and OMITS `refLabel` (pre-insert — no faked id, Decision 1 / UI-SPEC line 121). Inside the pass body render: (a) `<DetailsGrid items={…}>` with the four real captions `passDate`/`passFlightNo`/`passGuests`/`passTime` and the matching line icons — booking-side these mirror what the form collects (the grid is the labelled overview; the form below is the input); (b) a payment-status row using `StatusDot` semantics — pre-pay shows an amber dot + `passPaymentPending` label; (c) the total: "Total prepaid €{fmtEur(dest.price_cents)}" at the Heading role (24px), with `bookingTotalToPay`/fees note lifted to the Label role. Then mount the restyled `<BookingForm slug={slug} copy={{ …existing keys…, continueCta: fill(t.bookingContinueCta, { amount: fmtEur(dest.price_cents) }), continuePending: t.bookingContinuePending, trustFooter: t.payTrustFooter }} />`. The amount in the CTA copy is interpolated SERVER-SIDE here via `fill()` (Pitfall 5 — never a form input). Keep passing every existing copy key the form already needs.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - The pass is composed: `grep -cE "TransferPass|PassHeader|DetailsGrid" app/pickup/[slug]/page.tsx` >= 3 (all three pieces used)
    - RouteMotif renders via PassHeader (airport->property): the page passes `dest.airport` and `dest.label` as the endpoint labels
    - The ref line is OMITTED on /pickup: `grep -c "passRefLabel" app/pickup/[slug]/page.tsx` == 0 (no faked id pre-insert) and `grep -iE "BK-2941|928374" app/pickup/[slug]/page.tsx` returns nothing
    - The pay CTA amount is server-interpolated: `grep -c "fill(t.bookingContinueCta" app/pickup/[slug]/page.tsx` >= 1 and the form is mounted with `trustFooter: t.payTrustFooter`
    - No amount input is introduced anywhere on the page: `grep -iE 'name="amount"|name="price"' app/pickup/[slug]/page.tsx` returns nothing; the service-role `price_cents` read at lines ~35-40 is still the only amount source
    - The inactive-slug guard is preserved: `grep -c "slugUnavailableHeading" app/pickup/[slug]/page.tsx` >= 1 and `grep -c 'runtime = "nodejs"' app/pickup/[slug]/page.tsx` == 1
    - Payment-status row uses StatusDot + worded label (never colour alone): `grep -cE "StatusDot|stateLabel|passPaymentPending" app/pickup/[slug]/page.tsx` >= 1
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>/pickup/[slug] renders as the Transfer Pass (header+grid+payment row+total) framing the restyled form with a server-interpolated pay CTA and trust footer; the inactive-slug guard, the service-role amount read, and the unchanged createBooking mount all remain.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| guest browser -> /pickup server page | Untrusted `slug` path param; the page does a service-role NON-PII read of label/zone/airport/price_cents/active |
| guest form -> createBooking server action | Untrusted form fields cross here; zod + server price re-read are the existing gates (unchanged) |
| client redirect -> Stripe Checkout | The pay CTA triggers the existing code-created Checkout session; the client never writes paid |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-04 | Tampering | A re-skin adding a price/amount form input the server would trust | mitigate | NO amount input is added; the server re-reads `price_cents` (existing read kept verbatim); the CTA amount is server-interpolated via fill(). Acceptance grep asserts no `name="amount"`/`name="price"` (Pitfall 5) |
| T-10-05 | Information disclosure | Fare/route leaking on an inactive/unknown slug | mitigate | The inactive-slug neutral state (no form, no fare) is kept verbatim; acceptance grep asserts `slugUnavailableHeading` remains |
| T-10-06 | Elevation of privilege | Client redirect writing `paid` directly | mitigate | The pay CTA only triggers the existing createBooking->Checkout flow; no `paid` write exists on this path (single-writer invariant); BookingForm action call unchanged |
| T-10-SC | Tampering | npm/pip/cargo installs | mitigate | This plan installs NO packages; all imports are existing in-repo modules. No package-legitimacy checkpoint required |
</threat_model>

<verification>
- `npx tsc --noEmit` passes.
- The existing guest test suite still passes (presentation-only guarantee): run the booking-relevant e2e (`npx playwright test --list` collects; any runnable booking assertions stay green). No field/validation/action change means existing booking behaviour is unaffected.
- Booking form field set is byte-identical in name/type/required/order (only chrome + CTA copy changed).
- No new `@theme` tokens (`git diff app/globals.css` empty); no `#00685a`, no Material Symbols, no barcode on the page.
</verification>

<success_criteria>
- GUI-01: /pickup renders as the Transfer Pass — route header (RouteMotif), details grid (date/flight/pickup/guests), payment-status row, total prepaid, primary pay CTA.
- GUI-02: form inputs restyled (48/52px fields, teal focus, Montserrat labels) with NO change to fields collected or validation applied.
- GUI-04: the pay CTA shows "Pay €{amount} & confirm" + "Secured payment · powered by Stripe" trust footer and triggers the EXISTING Checkout flow unchanged.
- No amount input; server re-reads price_cents; client never writes paid; inactive-slug guard intact.
</success_criteria>

<output>
Create `.planning/phases/10-guest-ui-rebuild/10-02-SUMMARY.md` when done.
</output>
