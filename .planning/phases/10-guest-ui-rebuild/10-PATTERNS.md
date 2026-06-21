# Phase 10: Guest UI Rebuild - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 9 (6 modified screens + 3 new surface-local pieces)
**Analogs found:** 9 / 9 (all in-repo — this is a re-skin, every file has a direct existing analog)

> **Presentation-only re-skin.** Every new/modified file copies patterns from existing guest screens (Phase 4) + Phase 9 design-system components. Phase 10 adds **zero** tokens and **zero** shared primitives. All analogs are in this repo; nothing falls back to RESEARCH.md.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/pickup/[slug]/page.tsx` (modify) | route (server page) | request-response (service-role read) | itself + `app/status/[id]/page.tsx` | exact (self) |
| `app/pickup/[slug]/BookingForm.tsx` (modify) | component (client island) | request-response (useActionState) | itself + `app/track/TrackForm.tsx` | exact (self) |
| `app/status/[id]/page.tsx` (modify) | route (server page) | request-response (RLS + service-role) | itself + `app/pickup/[slug]/page.tsx` | exact (self) |
| `app/pay/success/page.tsx` (modify) | route (server page) | request-response (display-only read) | itself | exact (self) |
| `app/pay/cancel/page.tsx` (modify) | route (server page) | request-response (display-only read) | `app/pay/success/page.tsx` | role-match (needs full DS restyle — currently raw inline-style) |
| `app/track/page.tsx` + `TrackForm.tsx` (modify) | route + component | request-response | itself | exact (self) |
| `TransferPass` shell (NEW, under `app/pickup/`/`app/status/` or shared guest dir) | component (presentational shell) | none (pure layout) | `platform/ui/Card.tsx` (container pattern) + `RouteMotif` composition | role-match |
| `PassHeader` (NEW, surface-local) | component | none (presentational) | `RouteMotif` consumers; header band = new markup | partial |
| `DetailsGrid` (NEW, surface-local) | component | none (presentational) | `Card`-grouped key/value blocks in `status/page.tsx` lines 169-192 | role-match |

**Placement rule (from CONTEXT D-03 + UI-SPEC line 136):** new pieces (`TransferPass`, `PassHeader`, `DetailsGrid`) live **under the guest routes**, NOT in `platform/ui/`. They are surface-local, not shared primitives.

---

## Shared Patterns (apply to all touched files)

### S1. Server-resolved copy, no client flash
**Source:** `app/pickup/[slug]/page.tsx:31-33,76-104`, `app/track/page.tsx:10-26`
**Apply to:** every server page + every new presentational piece that shows copy.

All user-facing strings are resolved server-side via `getDict()` and either rendered directly or passed into a client island as a flat `copy={{…}}` prop object (never imported into a `"use client"` file). New pieces (`PassHeader`, `DetailsGrid`) must receive their captions as props from the server page, NOT call `getDict()` themselves.

```typescript
import { getDict } from "@/platform/i18n/dictionary";
const t = await getDict();
// pass flat copy object into client islands:
<BookingForm slug={slug} copy={{ fullNameLabel: t.bookingFullNameLabel, /* … */ }} />
```

### S2. Server-side token interpolation
**Source:** `app/pickup/[slug]/page.tsx:27-29`, `app/status/[id]/page.tsx:47-49`, `app/pay/success/page.tsx:25-27`
**Apply to:** any new copy with `{token}` placeholders (`passRefLabel` "Ref: {shortId}", trust footer, pay CTA amount).

```typescript
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}
```
Reuse this verbatim — do NOT introduce an i18n interpolation library.

### S3. i18n EN/BG key-parity gate (tsc-enforced)
**Source:** `platform/i18n/en.ts:1-8` (`Dict = typeof en`), `platform/i18n/bg.ts:1-8` (`export const bg: Dict`)
**Apply to:** the ~8 NEW copy keys (UI-SPEC Copywriting Contract).

`Dict` is `typeof en`; `bg.ts` is annotated `: Dict`, so a missing/extra key fails `tsc`. **Every new key goes in BOTH `en.ts` AND `bg.ts`** or the build breaks.

New keys to add to BOTH dictionaries (per UI-SPEC):
- `passEyebrow` — "Transfer Pass"
- `passRefLabel` — "Ref: {shortId}" (status page only; omitted on `/pickup` pre-insert)
- `passDate`, `passFlightNo`, `passGuests`, `passTime` — details-grid captions
- `passPaymentPending` — "Pending prepayment" (amber dot label)
- `payTrustFooter` — "Secured payment · powered by Stripe"
- (re-word) `bookingContinueCta` → "Pay €{amount} & confirm"; `bookingContinuePending` → "Confirming…"

**Reuse verbatim (no new key):** `bookingFareCaption`, `bookingTotalToPay`, all field labels (`bookingFullNameLabel`…), all validation keys (`bookingFieldRequired`, `bookingInvalidEmail`, `bookingInvalidPhone`, `bookingArrivalPast`, `bookingPassengersRange`, `bookingFailed`, `disclosureBlockedError`), disclosure copy, `slugUnavailableHeading/Body`, all `status*` keys, `statusExpired`/`statusExpiredCta`, all `paySuccess*` keys, all `track*` keys.

### S4. Brand-token-only styling (Tailwind v4 @theme, no new tokens)
**Source:** `app/globals.css:7-49` (`@theme` block)
**Apply to:** all styling in every touched/new file.

Available utilities (generated from `@theme`): colors `bg-teal`(#029B87)/`text-slate`/`bg-amber`/`text-coral`/`bg-teal2`/`text-grey`/`bg-white`; type roles `text-display`/`text-heading`/`text-body`/`text-label` (paired line-heights); radii `rounded`(8)/`rounded-md`(12)/`rounded-lg`(16)/`rounded-xl`(24)/`rounded-full`; spacing `h-cta-height`(52)/`min-h-touch-target`(44)/`px-gutter`(16). Existing code uses literal `text-[28px]`/`gap-[24px]` arbitrary values — that convention is fine to continue, but use the `#029B87` brand teal via `bg-teal`/`text-teal`, NEVER the mockup's `#00685a`.

### S5. Single-writer / Pitfall guarantees — DO NOT TOUCH behaviour
**Source:** `app/pay/success/page.tsx:1-13,84-99` (spoof gate), `app/pickup/[slug]/page.tsx:11-14,63-74` (server-trusted amount), `BookingForm.tsx:14-20,89-90` (no amount input)
**Apply to:** all three server pages with reads.

- `paid`/"Paid" literal is emitted ONLY inside the real `status === "paid"` branch (success-spoof e2e gate). The restyle must keep the literal inside that branch.
- Booking amount is server-read from `price_cents`; the form submits NO amount input (only hidden `slug` + guest fields). Restyle wraps the form — must not add a price field or change the `createBooking` action call.
- Status page reads with the cookie-bound anon client (`createClient`) for RLS; only the narrow driver `{name, phone}` read uses service-role. Do not change the client choice.

---

## Pattern Assignments

### `app/pickup/[slug]/page.tsx` (route, request-response) — MODIFY

**Analog:** itself (keep all data logic) + compose new `TransferPass`/`PassHeader`/`DetailsGrid`.

**Keep verbatim:** the service-role read (lines 35-40), the inactive-slug neutral state (lines 42-54, reuse `slugUnavailableHeading/Body`), the `<BookingForm copy={…}/>` mount (lines 76-105), `runtime = "nodejs"`.

**Restyle:** replace the bare `<h1>` + fare `Card` (lines 56-74) with `TransferPass` composition per UI-SPEC Decision 2: (a) `PassHeader` (teal band + eyebrow + `RouteMotif`), (b) `DetailsGrid`, (c) restyled `BookingForm`, (d) payment-status + total row, (e) pay CTA + trust footer. On `/pickup` (pre-insert) **omit** the ref line (no faked id — UI-SPEC line 121).

**Page-shell pattern to keep** (line 57):
```tsx
<main className="mx-auto flex max-w-[480px] flex-col gap-[24px] px-[16px] py-[48px]">
```

**RouteMotif usage** (Plane→Building, real labels from the existing read):
```tsx
import { RouteMotif } from "@/platform/ui/RouteMotif";
// start defaults to Plane, end to Building; override labels with dest data:
<RouteMotif
  start={{ icon: <PlaneIcon/>, label: dest.airport ?? "" }}
  end={{ icon: <BuildingIcon/>, label: dest.label }}
/>
// NOTE: RouteMotif's default endpoints already render Plane/Building line icons
// (RouteMotif.tsx:78-79) — passing only labels via start/end is the intended path.
```

---

### `app/pickup/[slug]/BookingForm.tsx` (component, request-response) — MODIFY

**Analog:** itself. **Re-skin only** (CONTEXT D-02): same fields, same order, same validation, same `createBooking` action, same disclosure-gates-CTA logic.

**Keep verbatim:** `useActionState(createBooking, initialState)` (lines 59-62), the `BookingFormCopy` prop shape (lines 24-50), the inline-error mapping (lines 73-85), the hidden `slug` input (line 90, NO amount input), the disclosure `Card` + checkbox gate (lines 64-68, 153-179), the disabled-until-acked CTA + `aria-busy` (lines 190-196), the ghost Back button (lines 200-202).

**Restyle:** `TextField` already ships 52px height + 2px teal focus ring + 14px/600 label (`TextField.tsx:36-38, 29-32`) — reuse as-is, no per-call style change needed. `PaxStepper` already brand-styled (`PaxStepper.tsx:41-42`). The visual upgrade is page-chrome (pass framing) + re-worded CTA copy (`Pay €{amount} & confirm`), not field internals.

**Existing TextField field pattern (reuse):**
```tsx
<TextField name="email" type="email" label={copy.emailLabel} required error={emailError} />
<PaxStepper name="pax" label={copy.passengersLabel} helpText={copy.passengersHelp} min={1} max={8} defaultValue={1} />
```

---

### `app/status/[id]/page.tsx` (route, request-response) — MODIFY

**Analog:** itself. **One functional swap allowed:** vertical `LifecycleTimeline` → horizontal `LifecycleStepper` (CONTEXT D-04 / UI-SPEC Decision 4).

**Keep verbatim:** RLS anon read via `createClient()` + `auth.getUser()` (lines 96-101, NEVER getSession), the `ExpiredState` no-leak fallback (lines 70-89, 103-120), the service-role non-PII route read (lines 123-139), the driver-reveal gate (`CLAIMED_OR_LATER`, lines 141-158), `isPaid` derivation (line 160), the receipt block paid-guard (lines 202-225), the driver block + pre-claim note (lines 227-244).

**The swap** (replace import line 29 + usage line 199):
```tsx
// REMOVE: import { LifecycleTimeline } from "@/platform/ui/LifecycleTimeline";
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
// REMOVE: <LifecycleTimeline current={status} />
<LifecycleStepper current={status} />   // same prop: current={status as TransferState}
```
`LifecycleTimeline.tsx` stays in repo, untouched (CONTEXT D-04).

**Restyle:** wrap the header/trip block in `TransferPass`/`PassHeader` with `RouteMotif` (airport→zone) + real truncated id (`passRefLabel`, first 8 chars of UUID uppercased). The trip-summary `Card` (lines 168-192) is the analog for `DetailsGrid` content. Status page keeps its `gap-[48px]` rhythm (line 163).

---

### `app/pay/success/page.tsx` (route, request-response) — MODIFY

**Analog:** itself. Restyle to design system; **preserve the spoof gate** (lines 84-99 — "Paid" literal only inside `isPaid`).

**Keep verbatim:** the service-role display-only read (lines 51-63), the `!transferId`/`status===null`/`isPaid`/unpaid branch structure (lines 76-115), `runtime = "nodejs"`. Reuse `statusReceiptPaidLine`, `statusReceiptSubNote`, `paySuccess*` keys.

**Restyle:** lighter consistent restyle (CONTEXT D-01) — `Card` + Display title + teal track link. Already uses `Card` and the teal link class (lines 67-68); upgrade to a confirmation pass-lite treatment, no skeuomorphism required.

---

### `app/pay/cancel/page.tsx` (route, request-response) — MODIFY (largest visual delta)

**Analog:** `app/pay/success/page.tsx` (role-match — copy its DS structure).

**Current state:** raw inline `style={{}}` markup with **hardcoded English** strings (lines 33-39) — NOT on the design system, NOT through i18n. This is the one screen needing real restyle work.

**Apply success-page patterns:**
- `runtime = "nodejs"` + service-role status read (already present, lines 7-31 — keep).
- Wrap in the `max-w-[480px] … px-[16px] py-[48px]` main shell (copy from success line 71).
- Use `Card` + Display `<h1>` + `text-grey` body (copy success lines 70-75).
- Route copy through `getDict()` — the inline strings "Payment cancelled" / "Your payment was not completed." need i18n keys if not present (check `en.ts`; current strings are NOT keyed — they are hardcoded). Neutral restyle (UI-SPEC line 147). Add teal track link to `/track`.

---

### `app/track/page.tsx` + `app/track/TrackForm.tsx` (route + component) — MODIFY

**Analog:** itself. Lightest restyle (CONTEXT D-01).

**Keep verbatim:** `getDict()` + flat `copy` prop into `TrackForm` (page lines 10-26), `useActionState(requestStatusLink)` + neutral-success-replaces-form pattern (TrackForm lines 19-32), no-enumeration behaviour.

**Restyle:** `TextField` (already 48/52px + teal focus) + `Button` (already teal 52px). Upgrade page chrome to design-system tokens; behaviour unchanged.

---

### `TransferPass` shell (NEW — surface-local presentational) — CREATE

**Role:** component, no data flow (pure layout). **Placement:** under guest routes (e.g. `app/pickup/[slug]/TransferPass.tsx` or a shared `app/(guest)/` dir), NOT `platform/ui/`.

**Analog for the container pattern:** `platform/ui/Card.tsx` (className-passthrough wrapper).

```tsx
// Card.tsx pattern to mirror — className passthrough over a div:
export function Card({ className = "", children, ...rest }: CardProps) {
  return <div className={`rounded-md border border-grey/30 bg-white p-[24px] ${className}`} {...rest}>{children}</div>;
}
```

**Contract (UI-SPEC Decision 1 + Component Inventory):** teal `#029B87` header band (`bg-teal text-white`), perforated 2px dashed divider (`border-grey/30`-ish, UI-SPEC line 107), circular notch cutouts as PURE decoration. **NO barcode, NO fake digit string.** Radii `rounded-lg`(16)/`rounded-xl`(24) for the boarding-pass feel. Elevation = Phase 9 ambient shadow `0 4px 12px rgba(47,72,88,0.08)` or 1px `#66676F`@20% border (UI-SPEC line 107). Consumed by BOTH `/pickup` and `/status` (CONTEXT D-03). Prop shape is planner's discretion (slot children + `header` slot).

---

### `PassHeader` (NEW — surface-local presentational) — CREATE

**Role:** component, presentational. **Analog:** `RouteMotif` consumers (composes it).

**Contract:** teal header band + `passEyebrow` ("Transfer Pass", Label-uppercase) + optional `passRefLabel` (status only; omitted on `/pickup`) + `RouteMotif` (airport→property). Receives translated labels as props (S1). Use the committed brand Transfer Badge via `RouteMotif`'s midpoint — NEVER re-draw a logo (RouteMotif.tsx:107-116 already does this).

---

### `DetailsGrid` (NEW — surface-local presentational) — CREATE

**Role:** component, presentational. **Analog:** the trip-summary `Card` key/value block in `status/page.tsx:169-192`.

**Contract (UI-SPEC Decision 3):** 2-col grid, ONLY real fields — Date, Flight No., Guests, Time. Each cell = Label caption (14px/600, UPPERCASE permitted) + 1.5px-stroke line pictogram (Calendar/Clock/Plane/People — NEVER Material Symbols) + Body value. **NO "Est. Pickup".** Receives caption strings (`passDate`/`passFlightNo`/`passGuests`/`passTime`) and values as props.

**Status-page caption/value pattern to mirror** (lines 176-191):
```tsx
<p className="text-[14px] leading-[1.4] text-grey">{caption}</p>
<p className="text-[16px] leading-[1.5] text-slate">{value}</p>
```

---

## Component Consumption Map (Phase 9 — use VERBATIM, do not re-invent)

| Component | Path | How Phase 10 consumes it |
|-----------|------|--------------------------|
| `RouteMotif` | `platform/ui/RouteMotif.tsx` | `PassHeader` on both pass screens. Pass `start`/`end` `{icon,label}`; defaults already render Plane→Building + brand badge midpoint (lines 78-79, 107-116). |
| `LifecycleStepper` | `platform/ui/LifecycleStepper.tsx` | Replaces `LifecycleTimeline` on `/status` — `<LifecycleStepper current={status}/>`. Derives labels from `STEPPER_ORDER` + `stateLabel()`; cancelled short-circuits (lines 45-58). Do NOT hand-roll step labels. |
| `StatusDot` / `stateLabel` | `platform/ui/StatusDot.tsx` | Payment-status row on the booking pass: amber dot pre-pay (`passPaymentPending`), `paid` label via `stateLabel("paid")`. Always dot + worded label (WCAG 1.4.1). |
| `Button` | `platform/ui/Button.tsx` | Pay CTA (`variant="primary"`, 52px teal, lines 20-27) + ghost Back (`variant="ghost"`). Unchanged. |
| `Card` | `platform/ui/Card.tsx` | Receipt/driver/disclosure grouping + `TransferPass` container pattern source. |
| `TextField` | `platform/ui/TextField.tsx` | All booking + track fields (already 52px + 2px teal focus + 14px/600 label). |
| `PaxStepper` | `platform/ui/PaxStepper.tsx` | pax + luggage steppers (already brand-styled, hidden-input → FormData). |
| `@theme` tokens | `app/globals.css:7-49` | Sole style source. **Zero new tokens** (UI-SPEC line 41). |
| `STEPPER_ORDER` | `platform/transfers/lifecycle.ts:66` | Indirect (via `LifecycleStepper`). Never imported directly by guest screens. |

---

## No Analog Found

None. Every file maps to an in-repo analog. The three new pieces are thin compositions of existing primitives (`Card` container pattern + `RouteMotif` + token markup), so no RESEARCH.md fallback is needed.

The only genuinely-new visual treatment is the **boarding-pass skeuomorphism** (teal band, perforated dashed divider, notch cutouts) in `TransferPass` — these are token-driven decorative `<div>`s with no behavioural analog; the contract for them is fully specified in UI-SPEC Decision 1 + the Color/Elevation section (lines 107-109).

---

## Metadata

**Analog search scope:** `app/pickup/`, `app/status/`, `app/pay/`, `app/track/`, `platform/ui/`, `platform/i18n/`, `app/globals.css`, `platform/transfers/lifecycle.ts`
**Files scanned:** 14 read in full
**Pattern extraction date:** 2026-06-21
