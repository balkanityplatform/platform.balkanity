---
phase: 4
slug: transfer-entity-booking-form
audited: 2026-06-19
baseline: 04-UI-SPEC.md (approved)
screenshots: not captured (no dev server; code-only audit)
---

# Phase 4 — UI Review

**Audited:** 2026-06-19
**Baseline:** 04-UI-SPEC.md (approved)
**Screenshots:** not captured (no dev server — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | All i18n keys present and verbatim; Back button copy defined but never rendered |
| 2. Visuals | 2/4 | Back/ghost CTA missing; disclosure blocked-error shown on page load before any user action; pay/success is entirely unstyled |
| 3. Color | 3/4 | 60/30/10 broadly correct; pay/success bypasses the token system with inline styles |
| 4. Typography | 2/4 | Three off-spec sizes (18px, 20px in stepper buttons, 16px for section headings); two off-spec line-heights (1.3) |
| 5. Spacing | 2/4 | gap-[12px] used repeatedly — not in declared scale; status page major-section gap is 32px not 48px (spec 2xl); pay/success uses arbitrary inline margin/padding |
| 6. Experience Design | 3/4 | Pending/disabled double-submit guard present; disclosure error bleeds pre-submission; no visible loading indicator on submit; status page lacks Card wrapping on sections |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Back button ("Back" / ghost variant) is declared in copy and passed to BookingForm but never rendered** — the guest has no navigation escape from the booking form; on a mobile PWA where browser back behaviour is unpredictable this is a functional gap. Fix: add `<Button variant="ghost" type="button" onClick={() => history.back()}>{copy.backCta}</Button>` below or above the primary CTA in `BookingForm.tsx`.

2. **Section headings on the status page use 16px (body size) instead of the specified 20px Heading role** — all four `h2` elements in `app/status/[id]/page.tsx` (lines 169, 195, 203, 228) use `text-[16px]` instead of `text-[20px]`. The spec explicitly places "Card titles" and "section headings" in the 20px/600/1.2 Heading role. This collapses visual hierarchy across the most information-dense guest screen. Fix: change all four `h2` class strings to `text-[20px] font-semibold leading-[1.2] text-slate`.

3. **pay/success page is completely outside the design system** — `app/pay/success/page.tsx` line 51 uses a raw `style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}` attribute, hard-coded English strings ("Transfer payment", "No transfer reference provided.", "We could not find that transfer.", "Paid EUR … on …") that are NOT in the i18n dictionary, and `<h1>`/`<p>` elements with no Tailwind token classes. The page the guest lands on after paying is unbranded. Fix: replace with `<main className="mx-auto flex max-w-[480px] flex-col gap-[32px] px-[16px] py-[48px]">`, move all copy into `en.ts`/`bg.ts`, and apply the Display/Body typography token classes.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING — Back button copy defined but the element is never rendered.**
`platform/i18n/en.ts` line 143 defines `bookingBackCta: "Back"`. The page resolves it and passes it as `copy.backCta` into `BookingForm` (`app/pickup/[slug]/page.tsx` line 92). The `BookingFormCopy` type declares `backCta: string` (`BookingForm.tsx` line 37). But `BookingForm.tsx` has no element that reads or renders `copy.backCta` — the prop is consumed nowhere. The UI-SPEC Copywriting Contract lists "Back" as a secondary CTA for this surface. Score penalty: the copy key is correctly authored and is i18n-compliant; the rendering gap falls primarily on Pillar 2 (Visuals), but it does mean a spec-declared string is dead copy.

**PASS — All spec-mandated copy keys land verbatim in `en.ts`:**
Booking page (BOOK-01/02/04), disclosure, validation errors, inactive-slug, confirmation email, status page, track page — all 40+ keys match the UI-SPEC Copywriting Contract exactly, including `{placeholder}` tokens, character-level punctuation, and the always-neutral `/track` success message (no enumeration: `trackSuccessNeutral`). BG parity enforced by the tsc Dict gate.

**WARNING — pay/success contains hard-coded English strings not in the dictionary** (see Pillar 2/3 for the styling dimension): "Transfer payment", "No transfer reference provided.", "We could not find that transfer." These are not in `en.ts`/`bg.ts` and cannot be translated.

**PASS — Disclosure blocked-error copy is correct** (`"Please confirm you understand the booking is non-refundable."`) and routes through the dictionary key. The UX timing issue (shown on load rather than post-submit-attempt) is an interaction defect, not a copy defect.

---

### Pillar 2: Visuals (2/4)

**BLOCKER — Back / ghost secondary CTA is absent from BookingForm.**
The UI-SPEC explicitly declares `Back` as a secondary CTA and the `ghost` variant for it. `BookingForm.tsx` renders only the primary `<Button>` (line 181). There is no escape affordance. On a mobile PWA with variable browser history (deep link from email, custom in-app browser), the guest can get stranded on a form they cannot exit without closing the tab.

**BLOCKER — pay/success page (`app/pay/success/page.tsx`) is completely unstyled.**
The page uses `<h1>Transfer payment</h1>` (no classes), `<p>` elements (no classes), and a raw inline `style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}` attribute. From a guest's perspective, the page they land on immediately after paying renders raw HTML with no brand treatment, no Montserrat font, no colour tokens. This is the highest-stakes screen in the guest flow (first thing seen after Stripe Checkout) and it contradicts the spec's Display/Heading/Body roles and the Card/section layout contract.

**WARNING — Disclosure blocked-error shown on page load before any interaction.**
`BookingForm.tsx` line 167–170: `{!acked ? <p className="text-[14px] leading-[1.4] text-grey">{copy.disclosureBlockedError}</p> : null}`. The condition fires immediately on mount (acked = false). The spec says this error appears on "an unchecked submit attempt" — the intent is to prompt only after the guest tries to proceed without ticking. Rendering it on load reads as a pre-emptive warning that may cause confusion ("have I already done something wrong?"). Additionally the error text uses `text-grey` not `text-coral` — the spec places errors in the coral / destructive colour.

**WARNING — Status page sections rendered as bare `<section>` elements without Card wrapping.**
The UI-SPEC says Card groups "the fare summary, the disclosure panel, the receipt, and each timeline section". The status page renders four bare `<section>` elements with no Card border/background, which flattens visual hierarchy on the most information-dense guest screen.

**PASS — Disclosure panel placement (above CTA), PaxStepper layout, aria-live, aria-current, StatusDot dot+label, LifecycleTimeline cancelled-as-terminal-row, and the neutral session-expired state with `/track` CTA are all correctly implemented.**

---

### Pillar 3: Color (3/4)

**PASS — Brand palette correctly tokenised in `app/globals.css`** with all six colours + white as CSS custom properties. All Phase 4 JSX uses token utility classes (`text-slate`, `text-teal`, `text-grey`, `text-coral`, `bg-teal`, etc.) — no hard-coded hex or rgb() literals anywhere in the audited files.

**PASS — 60/30/10 distribution broadly correct.** White page backgrounds (`bg-white` via Card and the page default), slate for headings and body text (dominant secondary), teal reserved for the primary CTA, focus rings, active checkbox, and links (`text-teal underline` on the "Get a new link" CTA in `app/status/[id]/page.tsx` line 82).

**WARNING — pay/success bypasses the colour system entirely.** The inline style attribute and class-free elements mean none of the token utilities apply to this page.

**WARNING — Disclosure blocked-error rendered in `text-grey` instead of `text-coral`.**
`BookingForm.tsx` line 168: `className="text-[14px] leading-[1.4] text-grey"`. All other validation/error messages in the codebase use `text-coral`. The UI-SPEC places "Blocked-submit error (checkbox)" in the Destructive / error colour (`#e44b4b` coral). This is a silent colour contract violation — the error looks like a help note, not a warning.

**PASS — StatusDot colour map matches the spec exactly** (teal2 for paid, teal for claimed/picked_up, amber for en_route/arrived, grey for requested/completed, coral for cancelled). WCAG 1.4.1 satisfied: label always present alongside dot.

---

### Pillar 4: Typography (2/4)

**BLOCKER — `BookingForm.tsx` line 88 uses `text-[18px] leading-[1.3]` for the "Your details" section heading.**
The spec declares exactly four sizes: 14px (Label), 16px (Body), 20px (Heading), 28px (Display). No 18px exists. The line-height `1.3` is also off-spec (allowed: 1.2 for headings/display, 1.4 for labels, 1.5 for body). This off-spec size sits between Body and Heading, collapsing the hierarchy between field labels (14px) and the section title (should be 20px).

**BLOCKER — All four `h2` section headings on the status page use `text-[16px]` instead of `text-[20px]`.**
`app/status/[id]/page.tsx` lines 169, 195, 203, 228: `text-[16px] font-semibold leading-[1.4]`. The spec's Heading role is `20px / 600 / 1.2`. Using 16px makes section headings identical in size to body text — hierarchy is conveyed by weight alone, which the spec does not intend for section headings.

**WARNING — Disclosure Card heading (`BookingForm.tsx` line 151) uses `text-[16px]` for an `<h3>`.**
"Prepaid & non-refundable" is called out in the spec as a Card title, which maps to the Heading role (20px). At 16px it is visually indistinguishable from body text.

**WARNING — PaxStepper `−`/`+` button characters rendered at `text-[20px]`** (`PaxStepper.tsx` line 40). While 20px is a declared size (Heading), using it for operator symbols in a control is not listed in the Typography usage table. Minor; the visual result is fine, but it's an unspecified application of the Heading scale.

**PASS — Weights are strictly 400 (implicit) and 600 (`font-semibold`). No font-medium, font-bold, font-[500], or font-[700] found in any Phase 4 file. Montserrat loaded via CSS custom property `--font-montserrat` and applied as `--font-sans` in `@theme`. All inputs at 16px (prevents iOS Safari zoom-on-focus). Fare amount at 16px/semibold/slate (not accent colour).**

---

### Pillar 5: Spacing (2/4)

**WARNING — `gap-[12px]` used in three places; it is not in the declared spacing scale.**
The spec declares: 4px (xs), 8px (sm), 16px (md), 24px (lg), 32px (xl), 48px (2xl), 64px (3xl). 12px appears at:
- `BookingForm.tsx` line 150: disclosure Card internal gap (`gap-[12px]`)
- `LifecycleTimeline.tsx` line 30: timeline row gap (`gap-[12px]`)
- `status/[id]/page.tsx` line 194: timeline section internal gap (`gap-[12px]`)
- `PaxStepper.tsx` line 50: stepper button/value gap (`gap-[12px]`)

12px is halfway between sm (8px) and md (16px) — an off-scale value that was likely a practical choice for tighter control spacing, but it violates the "multiples of 4 only" + declared-token contract.

**WARNING — Status page major-section gap is `gap-[32px]` (xl) not `gap-[48px]` (2xl).**
`app/status/[id]/page.tsx` line 162: `gap-[32px]` on the main container. The spec states: "48px — Major surface breaks on the status page (timeline ↔ receipt ↔ driver-contact block)". The implemented 32px is the wrong scale step.

**BLOCKER — pay/success page uses inline style `margin: "4rem auto"` and `padding: "0 1rem"`.**
`4rem` = 64px and `1rem` = 16px — these values happen to correspond to the 3xl and md tokens, but they are not applied via Tailwind utilities and bypass the token system entirely.

**PASS — Declared scale used correctly throughout the booking form:** `px-[16px]` (md) side padding, `py-[48px]` (2xl) vertical page breathing room, `p-[24px]` (lg) Card padding (locked), `gap-[16px]` (md) between form fields, `gap-[8px]` (sm) within field groups, `gap-[24px]` (lg) between form sections on `/pickup/[slug]`. `max-w-[480px]` mobile container consistent across all guest pages.

---

### Pillar 6: Experience Design (3/4)

**PASS — Double-submit prevention:** `pending` state from `useActionState` disables the primary CTA (`BookingForm.tsx` line 181, `TrackForm.tsx` line 44). No duplicate inserts possible via the UI.

**PASS — Disclosure gate (BOOK-04):** CTA disabled until `acked === true`. Cannot submit without checking the acknowledgement.

**PASS — Error states:** Inline zod error mapping routes server errors to the correct field (email, phone, pax, generic). `role="alert"` on error paragraphs (`BookingForm.tsx` lines 135, 175; `TextField.tsx` line 43).

**PASS — Empty/session-expired states:** The `ExpiredState` component handles no-user and no-row cases with the neutral copy and a `/track` CTA — no PII leakage.

**PASS — NetworkFirst enforced** via `app/sw.ts` regex for `status|pickup|track` — status page never served stale.

**WARNING — No visible in-progress affordance during form submission.**
`disabled={!acked || pending}` greys out the CTA during the server action, but there is no spinner, progress indicator, or text change (e.g. "Continuing…"). The action involves a Supabase INSERT + Stripe API call and can take 2–4 seconds on a mobile network. The guest sees a greyed button with no feedback that work is happening. This creates a perceived hang.

**WARNING — Disclosure blocked-error shown before user attempts to submit** (also flagged in Pillar 2). UX contract says "unchecked submit attempt" triggers the error. The current implementation treats the unchecked state on page load as error-worthy, which misuses the error/coral affordance.

**WARNING — Status page sections lack Card wrapping.** The spec groups receipt and driver-contact into Card surfaces. Without the border/background, the sections bleed together on white — no visual containment to anchor the guest's eye during the lifecycle-scan.

---

## Files Audited

- `app/pickup/[slug]/page.tsx`
- `app/pickup/[slug]/BookingForm.tsx`
- `platform/ui/PaxStepper.tsx`
- `platform/ui/LifecycleTimeline.tsx`
- `platform/ui/StatusDot.tsx`
- `app/status/[id]/page.tsx`
- `app/track/page.tsx`
- `app/track/TrackForm.tsx`
- `app/pay/success/page.tsx`
- `platform/i18n/en.ts`
- `platform/ui/Button.tsx`
- `platform/ui/Card.tsx`
- `platform/ui/TextField.tsx`
- `app/globals.css`

## Registry Safety

Registry audit: shadcn not initialised; no third-party blocks declared. Not applicable per UI-SPEC §Registry Safety. No registry audit required.
