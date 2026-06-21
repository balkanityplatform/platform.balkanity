---
phase: 10-guest-ui-rebuild
verified: 2026-06-21T12:00:00Z
status: human_needed
score: 4/4
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Open /pickup/[slug] on a mobile viewport (375px) and visually confirm the boarding-pass layout: teal header band with 'Transfer Pass' eyebrow, RouteMotif airport→property with the brand Transfer Badge, DetailsGrid showing Date/Flight No./Guests/Time with em-dash placeholders, amber dot + 'Pending prepayment' row, total-prepaid amount in Heading role, restyled 48px form fields with teal focus ring, 'Pay €X & confirm' CTA (teal, 52px), teal LockIcon + 'Secured payment · powered by Stripe' trust footer, ghost Back button."
    expected: "The screen looks like a boarding pass — teal header, perforated dashed divider flanked by circular notch cutouts, consistent Montserrat typography, no barcode, no fake ref ID, no 'Est. Pickup' field."
    why_human: "Visual layout and CSS rendering cannot be verified by grep. Typography roles (text-display/text-heading/text-label/text-body) and Tailwind v4 token resolution (bg-teal = #029B87, not #00685a) require browser rendering to confirm."
  - test: "Open /status/[id] with a valid magic-link session. Confirm: (a) teal PassHeader with the real truncated transfer ID (first 8 chars of UUID, uppercased), (b) RouteMotif airport→zone, (c) DetailsGrid showing real Date/FlightNo/Guests/Time from the DB row, (d) horizontal LifecycleStepper with current step highlighted (not the old vertical timeline), (e) receipt Card (paid-guarded), (f) driver Card pre-claim shows the pre-claim note, post-claim shows first name + phone as plain text. NO map, NO ETA, NO call/chat, NO 'View Travel Vouchers', NO admin nav shells."
    expected: "Pass identity consistent with /pickup. Horizontal stepper (DS-04) renders completed/active/pending steps. PII boundary intact: driver name+phone visible only post-claim."
    why_human: "Requires a seeded DB row with a valid magic-link session. The LifecycleStepper's visual step-state encoding (teal check / amber active / grey outline) and the driver reveal boundary require a live browser with real data."
  - test: "Submit the booking form on /pickup/[slug]: fill all fields, check the non-refundable acknowledgement, click 'Pay €X & confirm'. Confirm it redirects to Stripe Hosted Checkout (not a custom payment page). Confirm back/cancel from Checkout lands on /pay/cancel with the DS-shell and a teal 'Track your booking' link."
    expected: "The form submits to the existing createBooking action; Stripe Checkout opens with the correct amount; /pay/cancel shows the DS-shell with getDict() copy, no inline styles, no hardcoded English."
    why_human: "Requires a live Stripe test-mode environment and a real destination slug. Cannot verify the Checkout redirect with grep. The /pay/cancel display-only status line also requires a real transfer row."
  - test: "Arrive at /pay/success?t=<paid-transfer-id> AFTER a verified Stripe webhook fires. Confirm: 'Paid €X on {date}' line is visible. Then hit /pay/success?t=<unpaid-id> directly without a webhook (spoof attempt). Confirm: the 'Paid' line does NOT appear."
    expected: "The spoof gate holds: 'Paid' only inside the status === 'paid' branch. The confirming state shows neutral copy and a status link. LockIcon + payTrustFooter visible on both paid and confirming branches."
    why_human: "The success-spoof e2e (tests/e2e/success-spoof.spec.ts) is declared passing, but running it requires a live browser or Playwright setup. The visual distinction between paid and confirming branches needs browser confirmation."
---

# Phase 10: Guest UI Rebuild — Verification Report

**Phase Goal:** The guest-facing surface is rebuilt to the boarding-pass "Transfer Pass" identity — the booking screen reads as a transfer pass, the form is restyled to the design system with no change to fields or validation, the magic-link status page shows the live lifecycle via the shared stepper, and the pay action carries a Stripe trust treatment — all driving the existing unchanged Checkout flow.
**Verified:** 2026-06-21T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | The guest booking screen renders as the boarding-pass "Transfer Pass": airport→property route header (with the infinity motif), a details grid for date/flight/pickup/guests, a payment-status row, the total prepaid, and a primary pay CTA | VERIFIED | `app/pickup/[slug]/page.tsx` composes `TransferPass` → `PassHeader` (RouteMotif wired) → `DetailsGrid` (Date/Flight/Guests/Time, no Est. Pickup) → amber payment-status row → `bookingTotalToPay` total → `BookingForm` CTA. All evidence confirmed by source read. |
| SC-2 | The booking form inputs are restyled to the design system (48px fields, teal focus ring, Montserrat labels) with no change to the fields collected or the validation applied | VERIFIED (automated) / UNCERTAIN (visual) | Field names confirmed unchanged: name, email, phone, flight_no, arrival_date, arrival_time, pax, luggage_count, notes, slug, ack (11 fields, 0 amount/price). `createBooking` action wired, disclosure-ack gate intact. Visual confirmation (48px height, teal focus ring render) requires human. |
| SC-3 | The magic-link status page renders as the pass and reflects the live transfer lifecycle state via the shared lifecycle stepper | VERIFIED | `app/status/[id]/page.tsx` imports and renders `<LifecycleStepper current={status} />` (LifecycleTimeline: 0 occurrences on page). `TransferPass` + `PassHeader` + `DetailsGrid` composed. Real DB data flows into DetailsGrid (arrival_at, flight_no, pax). |
| SC-4 | The pay action shows the Stripe-secured CTA and a "Secured payment · powered by Stripe" trust footer, and triggers the existing Checkout-session flow with no payment-path change | VERIFIED | `BookingForm.tsx` renders LockIcon + `copy.trustFooter` below the pay CTA. `useActionState(createBooking, …)` confirmed unchanged. `actions.ts` still calls `createCheckoutSession` with no amount input. Single-writer: no paid write on the form path. |

**Score: 4/4 truths verified (automated). Human visual confirmation outstanding.**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(guest)/_pass/TransferPass.tsx` | Boarding-pass shell: teal header slot, perforated dashed divider, notch cutouts, body slot | VERIFIED | Exists, substantive (47 lines). Renders dashed `border-grey/30` divider + two `rounded-full bg-[#f7f8f9]` notch cutouts. No barcode, no canvas. |
| `app/(guest)/_pass/PassHeader.tsx` | Teal header band + eyebrow + optional ref + RouteMotif | VERIFIED | Exists, substantive. `bg-teal text-white` band confirmed. `RouteMotif` imported and rendered (×5 references). No `#00685a`. |
| `app/(guest)/_pass/DetailsGrid.tsx` | 2-col grid, exactly 4 real fields, no Est. Pickup | VERIFIED | Exists, substantive. `grid grid-cols-2 gap-[16px]`. "estimated-pickup" appears only in a comment (explaining Decision 3 removal), not in rendered output. |
| `app/(guest)/_pass/icons.tsx` | 6 × 1.5px-stroke inline SVG icons | VERIFIED | Exists, substantive (84 lines). Exports PlaneIcon, BuildingIcon, CalendarIcon, ClockIcon, PeopleIcon, LockIcon. No Material Symbols, no external icon libs. |
| `platform/i18n/en.ts` | 11 new keys + 2 reworded keys | VERIFIED | `passEyebrow`, `passRefLabel`, `passDate`, `passFlightNo`, `passGuests`, `passTime`, `passPaymentPending`, `payTrustFooter`, `payCancelTitle`, `payCancelBody`, `payCancelTrackCta` all present. `bookingContinueCta` = "Pay €{amount} & confirm". |
| `platform/i18n/bg.ts` | Same 11 keys + 2 reworded in BG | VERIFIED | All 11 new keys confirmed in bg.ts. `bookingContinueCta` reworded in Bulgarian. EN/BG parity gate satisfied. |
| `app/pickup/[slug]/page.tsx` | Booking screen as Transfer Pass | VERIFIED | Composed with TransferPass/PassHeader/DetailsGrid. Ref line omitted on /pickup (no fake ID). Server-side amount interpolation via `fill()`. |
| `app/pickup/[slug]/BookingForm.tsx` | Restyled form, same fields/validation, trust footer | VERIFIED | 11 fields intact, 0 amount/price inputs. `useActionState(createBooking)`. Disclosure ack gate (`disabled={!acked || pending}`) present. LockIcon + trustFooter below CTA. |
| `app/status/[id]/page.tsx` | Status as Transfer Pass + LifecycleStepper | VERIFIED | TransferPass + PassHeader + real shortId (`id.slice(0,8).toUpperCase()`). LifecycleStepper wired with `current={status}`. LifecycleTimeline: 0 occurrences. |
| `app/pay/cancel/page.tsx` | DS shell, getDict(), teal /track link, display-only | VERIFIED | `max-w-[480px]` DS shell. `getDict()` called (×3). No inline `style={{}}`. No hardcoded English. `/track` link present. No write calls. `runtime = "nodejs"` preserved. |
| `app/pay/success/page.tsx` | Lighter DS restyle, spoof gate preserved | VERIFIED | `isPaid` guard: "Paid" literal inside `isPaid ? (…)` branch only. LockIcon + payTrustFooter on both paid and confirming branches. No `.update()` / `.insert()`. |
| `app/track/page.tsx` | DS type roles (text-display/text-body) | VERIFIED | `text-display font-semibold` title, `text-body` body. getDict() routes copy server-side. |
| `app/track/TrackForm.tsx` | Neutral action preserved, DS type roles | VERIFIED | `useActionState(requestStatusLink)`, `state.status === "ok"` neutral branch, `name="email"` + `type="email"` unchanged. `text-body` aligned. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/(guest)/_pass/PassHeader.tsx` | `platform/ui/RouteMotif.tsx` | `RouteMotif` composition (import + render) | WIRED | 5 RouteMotif references confirmed (import + render in JSX) |
| `app/pay/cancel/page.tsx` | `platform/i18n/dictionary` | `getDict()` server resolution | WIRED | 3 getDict() calls confirmed; `t.payCancelTitle`, `t.payCancelBody`, `t.payCancelTrackCta` used |
| `app/pickup/[slug]/page.tsx` | `app/(guest)/_pass/{TransferPass,PassHeader,DetailsGrid}` | Import + composition | WIRED | 5 references to TransferPass/PassHeader, 2 to DetailsGrid confirmed |
| `app/pickup/[slug]/BookingForm.tsx` | `./actions :: createBooking` | `useActionState(createBooking, …)` | WIRED | Confirmed in source |
| `app/status/[id]/page.tsx` | `platform/ui/LifecycleStepper.tsx` | `<LifecycleStepper current={status} />` | WIRED | Import confirmed; rendered at line 224; LifecycleTimeline: 0 on page |
| `app/status/[id]/page.tsx` | `app/(guest)/_pass/{TransferPass,PassHeader,DetailsGrid}` | Import + composition | WIRED | 5 references confirmed |
| `app/pay/success/page.tsx` | `app/(guest)/_pass/icons :: LockIcon` | Import + render | WIRED | Confirmed (lines 14, 98, 115) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `DetailsGrid` on `/status/[id]` | `items` array (Date, FlightNo, Guests, Time) | `row.arrival_at`, `row.flight_no`, `row.pax` from `wp_transfers` RLS query | Yes — real DB row | FLOWING |
| `DetailsGrid` on `/pickup/[slug]` | `items` array (empty string values) | Intentionally empty — guest enters data in the form below | N/A — pre-input placeholder | STATIC (intentional — UI-SPEC Decision 3 + confirmed by SUMMARY Decision note) |
| Payment status row on `/pickup/[slug]` | amber dot + `t.passPaymentPending` label | Hardcoded pre-payment state (always "Pending prepayment" pre-Checkout) | N/A — fixed pre-pay state | STATIC (intentional — transfer not created yet at this point) |
| Total prepaid on `/pickup/[slug]` | `dest.price_cents` | `admin.from("destinations").select("…price_cents…").eq("slug", slug)` | Yes — real DB read | FLOWING |
| Receipt on `/status/[id]` | `row.amount_cents`, `row.paid_at`, `isPaid` | Same `wp_transfers` RLS query | Yes — real DB row | FLOWING |
| Driver reveal on `/status/[id]` | `driverFirstName`, `driverPhone`, `revealDriver` | Service-role `driver_profiles {name,phone}` read, gated by `CLAIMED_OR_LATER` | Yes — real DB row, gated | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Verification Method | Result | Status |
|----------|--------------------|----|--------|
| No fake/invented transfer ID on /pickup | `grep -n "passRefLabel\|refLabel" app/pickup/[slug]/page.tsx` | 0 matches — prop not passed | PASS |
| Real shortId on /status | `grep "id.slice(0, 8).toUpperCase()" app/status/[id]/page.tsx` | Line 173 confirmed | PASS |
| No amount/price form input | `grep -c "name=\"amount\"\|name=\"price\"" BookingForm.tsx` | 0 matches | PASS |
| No writes on guest display pages | `grep -E "\.update\(|\.insert\(" pay/cancel, pay/success, status` | 0 write calls on all three pages | PASS |
| Disclosure ack gate intact | `grep "disabled.*acked" BookingForm.tsx` | `disabled={!acked || pending}` confirmed | PASS |
| No barcode/canvas in TransferPass | `grep -iE "barcode|<canvas" TransferPass.tsx` | 0 matches | PASS |
| No Material Symbols in icons.tsx | `grep -iE "material-symbols\|@mui\|lucide" icons.tsx` | 0 matches | PASS |
| No rejected mockup color | `grep -r "00685a" app/(guest)/_pass/ …` | 0 matches across all guest files | PASS |
| No getDict() in pass components | checked across all 4 `_pass/` files | 0 calls | PASS |
| globals.css unchanged in phase 10 | `git log --since="2026-06-20" -- app/globals.css` | Most recent commit is `f299dff` (Phase 9 — DS-01) | PASS |
| LifecycleTimeline absent from status page | `grep "LifecycleTimeline" app/status/[id]/page.tsx` | 0 matches | PASS |
| Neutral track action (no enumeration) | `grep "requestStatusLink\|status.*ok" track/actions.ts` | Neutral always-ok response confirmed | PASS |
| "Paid" literal inside isPaid branch only | `grep "isPaid" app/pay/success/page.tsx` | `isPaid ? (…)` branch structure confirmed | PASS |
| runtime = "nodejs" preserved | checked all 4 server pages | All 4 confirmed | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| GUI-01 | Guest booking screen renders as boarding-pass "Transfer Pass" (route header, details grid, payment-status row, total, pay CTA) | SATISFIED | `app/pickup/[slug]/page.tsx` fully composed; all elements present |
| GUI-02 | Booking form inputs restyled (48px fields, teal focus, Montserrat labels) with no field/validation change | SATISFIED (automated) | Field names/count unchanged, action unchanged. Visual styling (48px, focus ring) requires human confirmation. |
| GUI-03 | Magic-link status page renders as pass with live lifecycle via DS-04 stepper | SATISFIED | LifecycleStepper wired with real status; TransferPass/PassHeader/DetailsGrid composed; real data flowing |
| GUI-04 | Pay action shows Stripe-secured CTA + trust footer; drives existing Checkout-session flow unchanged | SATISFIED | LockIcon + payTrustFooter on /pickup CTA and /pay/success; createBooking action unchanged; single-writer invariant preserved |

---

### Security Invariant Checks

All five security invariants are confirmed UNBROKEN by phase 10:

| Invariant | Check | Result |
|-----------|-------|--------|
| `getSession` NOT used for authz on /status | `grep "getSession" app/status/[id]/page.tsx` | 0 matches. `auth.getUser()` used (×2). |
| Single-writer `paid` — never written outside webhook | `grep -E "\.update\(|\.insert\(" pay/cancel, pay/success, status, pickup` | 0 write calls on any guest-surface file. |
| Driver-reveal PII gate intact | `CLAIMED_OR_LATER` gate + narrow `{name,phone}` service-role read | Preserved verbatim; `revealDriver` condition confirmed. |
| Spoof gate on /pay/success | `statusReceiptPaidLine` inside `isPaid ? (…)` branch only | Confirmed; 0 `.update()` / `.insert()` / `paid` writes on this page. |
| No price/amount form input | `grep "name=\"amount\"\|name=\"price\"" BookingForm.tsx` | 0 matches. Server re-reads `price_cents`. |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `app/(guest)/_pass/DetailsGrid.tsx` line 6 | Comment contains "estimated-pickup" (appears in comment describing Decision 3 removal) | INFO | Not in rendered output; comment describes why Est. Pickup was removed. No behavioral issue. |
| `app/pickup/[slug]/page.tsx` lines 83-89 | DetailsGrid items have `value: ""` (empty string) | INFO | Intentional — pre-input state on /pickup. DetailsGrid renders graceful em-dash `"—"` for empty values. Not a stub — this is the correct pre-form-fill state per UI-SPEC Decision 3. |

No TBD, FIXME, or XXX markers found in any phase 10 modified files.

---

### Human Verification Required

#### 1. Booking screen visual layout

**Test:** Open `/pickup/[slug]` on a real mobile viewport (375px wide). Confirm teal header band, 'Transfer Pass' eyebrow, RouteMotif with brand Transfer Badge, DetailsGrid with em-dashes, amber dot + 'Pending prepayment', total amount in Heading role (24px/600), restyled 48px form fields with teal focus ring on tab/tap, 'Pay €X & confirm' CTA (teal, 52px), teal LockIcon + 'Secured payment · powered by Stripe' below CTA, ghost Back button below that. No barcode. No fake ref. No 'Est. Pickup'.
**Expected:** The screen matches the boarding-pass identity from the UI-SPEC — teal header, perforated divider + notch cutouts visible, Montserrat throughout, brand color #029B87 (not #00685a), correct spacing rhythm.
**Why human:** Tailwind v4 CSS-first token resolution (bg-teal → #029B87), rendered component sizes (48px fields, 52px CTA), and the decorative pass chrome (dashed border, circular cutouts) can only be confirmed in a live browser.

#### 2. Status page visual layout and lifecycle stepper

**Test:** Open `/status/[id]` with a valid magic-link session and a seeded transfer row. Confirm: (a) teal PassHeader with real truncated UUID prefix (first 8 chars, uppercase), (b) RouteMotif airport→zone, (c) DetailsGrid with real Date/FlightNo/Guests/Time from the row, (d) the horizontal LifecycleStepper with current step's state visually encoded (teal check for completed, amber for active, grey outline for pending) — not the old vertical timeline, (e) receipt Card, (f) driver block showing pre-claim note before claim. Then with a claimed transfer row: driver Card shows first name + phone as plain text, no call/chat buttons.
**Expected:** Horizontal stepper visible. Real trip data in grid. Driver PII visible only post-claim. No map, no ETA, no 'View Travel Vouchers', no admin nav shells.
**Why human:** Requires a live Supabase row with a valid magic-link session. LifecycleStepper's visual step state (shape encoding: teal/amber/grey) requires browser rendering.

#### 3. Booking form submission → Stripe Checkout redirect

**Test:** Fill the booking form on `/pickup/[slug]` with valid data, check the acknowledgement, click 'Pay €X & confirm'. Observe that the page redirects to Stripe's hosted Checkout (stripe.com/…) with the correct amount. Click Cancel/Back in Checkout. Confirm landing on `/pay/cancel` with the DS shell (Display title, Card body, teal 'Track your booking' link).
**Expected:** createBooking action fires, Stripe Checkout opens. /pay/cancel shows i18n copy from `payCancelTitle` / `payCancelBody` / `payCancelTrackCta` — no hardcoded English, no inline styles.
**Why human:** Live Stripe test-mode environment required. Cannot verify the HTTP 303 redirect to Stripe Checkout with grep.

#### 4. /pay/success spoof gate in a browser

**Test:** (a) With a paid transfer (webhook fired): open `/pay/success?t=<paid-transfer-id>` — confirm 'Paid €X on {date}' receipt line and LockIcon trust footer visible. (b) Without a webhook: open `/pay/success?t=<unpaid-id>` directly — confirm the 'Paid' line does NOT appear; instead a neutral confirming state is shown.
**Expected:** Spoof gate holds: 'Paid' only inside the real `status === "paid"` DB state. LockIcon + payTrustFooter on both branches.
**Why human:** The e2e spec `tests/e2e/success-spoof.spec.ts` was reported passing by the executor but requires a Playwright runtime to re-run. Browser confirmation of the four-branch render tree is required.

---

### Gaps Summary

No gaps found. All 4 success criteria are verified against the codebase with direct source evidence. All 13 artifact files are substantive and wired. All key links are confirmed. Security invariants are intact. No debt markers. No rejected tokens (#00685a = 0 matches). No new @theme tokens added (globals.css last modified in Phase 9). Four human verification items remain for visual and end-to-end confirmation.

---

_Verified: 2026-06-21T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
