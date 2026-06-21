---
phase: 10-guest-ui-rebuild
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - platform/i18n/en.ts
  - platform/i18n/bg.ts
  - app/(guest)/_pass/TransferPass.tsx
  - app/(guest)/_pass/PassHeader.tsx
  - app/(guest)/_pass/DetailsGrid.tsx
  - app/(guest)/_pass/icons.tsx
  - app/pay/cancel/page.tsx
autonomous: true
requirements: [GUI-01, GUI-03]
must_haves:
  truths:
    - "Every new pass copy key resolves in BOTH EN and BG (tsc Dict-parity gate passes)"
    - "A reusable TransferPass shell renders a teal header band, a perforated dashed divider, and decorative notch cutouts with NO barcode and NO fake digit string"
    - "PassHeader renders the 'Transfer Pass' eyebrow over a RouteMotif airport->property; the ref line is optional (shown only when a real shortId prop is passed)"
    - "DetailsGrid renders a 2-column grid of ONLY real fields (Date, Flight No., Guests, Time) each as caption + line pictogram + value"
    - "/pay/cancel renders on the design system through getDict() (no raw inline styles, no hardcoded English) and offers a teal /track link"
  artifacts:
    - path: "app/(guest)/_pass/TransferPass.tsx"
      provides: "Shared boarding-pass shell consumed by /pickup and /status"
      exports: ["TransferPass"]
    - path: "app/(guest)/_pass/PassHeader.tsx"
      provides: "Teal header band + eyebrow + RouteMotif"
      exports: ["PassHeader"]
    - path: "app/(guest)/_pass/DetailsGrid.tsx"
      provides: "2-col real-fields-only details grid"
      exports: ["DetailsGrid"]
    - path: "app/(guest)/_pass/icons.tsx"
      provides: "1.5px-stroke line pictograms (Plane, Building, Calendar, Clock, People, Lock)"
      exports: ["PlaneIcon", "BuildingIcon", "CalendarIcon", "ClockIcon", "PeopleIcon", "LockIcon"]
    - path: "platform/i18n/en.ts"
      provides: "New pass copy keys (EN)"
      contains: "passEyebrow"
    - path: "platform/i18n/bg.ts"
      provides: "New pass copy keys (BG)"
      contains: "passEyebrow"
  key_links:
    - from: "app/(guest)/_pass/PassHeader.tsx"
      to: "platform/ui/RouteMotif.tsx"
      via: "RouteMotif composition (start/end endpoints)"
      pattern: "RouteMotif"
    - from: "app/pay/cancel/page.tsx"
      to: "platform/i18n/dictionary"
      via: "getDict() server resolution"
      pattern: "getDict"
---

<objective>
Build the shared guest-surface "Transfer Pass" foundation that the booking and status screens consume, and prove it end-to-end on the one screen that is currently off the design system.

This plan ships: (1) the ~9 new EN/BG copy keys behind the tsc parity gate; (2) the three surface-local presentational pieces — `TransferPass` shell, `PassHeader`, `DetailsGrid` — plus the 1.5px-stroke line pictograms they need; and (3) a restyle of `/pay/cancel`, which today is raw inline-style markup with hardcoded English. The cancel screen is the demonstrable consumer that turns this foundation from "scaffolding" into a visible, shippable improvement (no half-rebranded screens — CONTEXT D-01).

Purpose: Without these shared pieces, the booking and status slices (Plans 10-2 / 10-3) would each re-implement the pass skeuomorphism. Extracting one `TransferPass` keeps the identity consistent (CONTEXT D-03) and lets the two big screens be pure composition.

Output: New copy keys in both dictionaries, three new components under `app/(guest)/_pass/`, an icons module, and a fully restyled `/pay/cancel` page.
</objective>

<phase_goal>
**As a** guest, **I want to** see a consistent branded "Transfer Pass" identity across every screen of my booking journey, **so that** the whole flow reads as one trustworthy product rather than a set of half-styled pages.
</phase_goal>

<execution_context>
@/Users/balkanitytours/GitHub/platform.balkanity/.claude/gsd-core/workflows/execute-plan.md
@/Users/balkanitytours/GitHub/platform.balkanity/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/10-guest-ui-rebuild/10-UI-SPEC.md
@.planning/phases/10-guest-ui-rebuild/10-PATTERNS.md
@.planning/phases/09-design-system-foundation/09-UI-SPEC.md
</context>

<artifacts_this_phase_produces>
This plan introduces the following NEW symbols / files (consumed by Plans 10-2 and 10-3):

| Symbol | File | Role |
|--------|------|------|
| `TransferPass` | `app/(guest)/_pass/TransferPass.tsx` | Boarding-pass shell (teal band slot + body slot + perforated divider + notch cutouts) |
| `PassHeader` | `app/(guest)/_pass/PassHeader.tsx` | Teal header band: eyebrow + optional ref + `RouteMotif` |
| `DetailsGrid` | `app/(guest)/_pass/DetailsGrid.tsx` | 2-col grid of real fields only |
| `PlaneIcon` `BuildingIcon` `CalendarIcon` `ClockIcon` `PeopleIcon` `LockIcon` | `app/(guest)/_pass/icons.tsx` | 1.5px-stroke line pictograms |
| New i18n keys | `platform/i18n/en.ts` + `platform/i18n/bg.ts` | `passEyebrow`, `passRefLabel`, `passDate`, `passFlightNo`, `passGuests`, `passTime`, `passPaymentPending`, `payTrustFooter`, `payCancelTitle`, `payCancelBody`, `payCancelTrackCta` |

Placement rule (CONTEXT D-03 + UI-SPEC line 136): these pieces are surface-local and live UNDER the guest routes (`app/(guest)/_pass/`), NEVER in `platform/ui/`.
</artifacts_this_phase_produces>

<tasks>

<task type="auto">
  <name>Task 1: Add the new pass + cancel copy keys to both dictionaries (EN/BG parity)</name>
  <files>platform/i18n/en.ts, platform/i18n/bg.ts</files>
  <read_first>
    - platform/i18n/en.ts (lines 125-220: the existing booking/status/pay/track block — add new keys adjacent, mirroring the `{token}` interpolation convention e.g. `statusReceiptPaidLine: "Paid €{amount} on {paidDate}"`)
    - platform/i18n/bg.ts (lines 1-10 for the `: Dict` parity annotation; lines 130-215 for the BG translations of the same block)
    - 10-PATTERNS.md S3 (the tsc EN/BG key-parity gate) and the exact new-key list
    - 10-UI-SPEC.md "Copywriting Contract" (lines 113-130 — exact English copy for each key)
  </read_first>
  <action>
    Add the following NEW keys to `en.ts` with the UI-SPEC English copy, then add the SAME keys to `bg.ts` (Bulgarian translations) so the `: Dict` annotation stays satisfied:
    `passEyebrow` = "Transfer Pass"; `passRefLabel` = "Ref: {shortId}" (uses the S2 fill() interpolation, NOT an i18n lib); `passDate` = "Date"; `passFlightNo` = "Flight No."; `passGuests` = "Guests"; `passTime` = "Time"; `passPaymentPending` = "Pending prepayment"; `payTrustFooter` = "Secured payment · powered by Stripe"; `payCancelTitle` = "Payment cancelled"; `payCancelBody` = "Your payment was not completed."; `payCancelTrackCta` = "Track your booking".
    Also RE-WORD two EXISTING keys per the Copywriting Contract: `bookingContinueCta` -> "Pay €{amount} & confirm" (was "Continue to payment"); `bookingContinuePending` -> "Confirming…" (was "Starting payment…"). Re-word both EN and BG. Do NOT rename the keys (Plan 10-2 consumes them by name). UPPERCASE treatment of grid/eyebrow captions is a styling concern in the components, NOT baked into the dictionary string.
    Add NO other keys; all field/validation/driver/expired/slug/receipt copy is reused verbatim (S3 reuse list).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c passEyebrow platform/i18n/en.ts` == 1 AND `grep -c passEyebrow platform/i18n/bg.ts` == 1 (each new key present in BOTH dictionaries)
    - The same dual-presence holds for `passRefLabel`, `passDate`, `passFlightNo`, `passGuests`, `passTime`, `passPaymentPending`, `payTrustFooter`, `payCancelTitle`, `payCancelBody`, `payCancelTrackCta`
    - `grep -F "Pay €{amount} & confirm" platform/i18n/en.ts` returns a match (bookingContinueCta re-worded)
    - `npx tsc --noEmit` exits 0 (the EN/BG Dict-parity gate passes — no missing/extra key)
  </acceptance_criteria>
  <done>All 11 new keys + 2 re-worded keys exist in both en.ts and bg.ts; tsc is green.</done>
</task>

<task type="auto">
  <name>Task 2: Create the surface-local pass components + line pictograms</name>
  <files>app/(guest)/_pass/icons.tsx, app/(guest)/_pass/TransferPass.tsx, app/(guest)/_pass/PassHeader.tsx, app/(guest)/_pass/DetailsGrid.tsx</files>
  <read_first>
    - platform/ui/RouteMotif.tsx (lines 39-79 — the in-source PlaneIcon/BuildingIcon line-icon pattern to mirror; lines 98-121 — RouteMotif props `start`/`end` `{icon,label}` that PassHeader passes through; the default endpoints already render Plane->Building + brand badge midpoint)
    - platform/ui/Card.tsx (the className-passthrough container pattern TransferPass mirrors)
    - app/status/[id]/page.tsx (lines 168-192 — the caption/value Card block that is the DetailsGrid analog: `text-[14px]…text-grey` caption over `text-[16px]…text-slate` value)
    - app/globals.css (lines 7-49 — the @theme tokens: bg-teal #029B87, text-white, text-slate, text-grey, rounded-lg(16)/rounded-xl(24); Phase 10 adds ZERO new tokens)
    - 10-UI-SPEC.md Decision 1 (pass metaphor: teal band, perforated dashed divider, notch cutouts, DROP barcode), Decision 3 (DetailsGrid real-fields-only), Component Inventory (lines 138-145), Color/Elevation (lines 107-109 — divider 2px dashed `#66676F`@~30% via `border-grey/30`-ish; ambient shadow `0 4px 12px rgba(47,72,88,0.08)`)
    - 10-PATTERNS.md S1 (server-resolved copy passed as props — these pieces take captions/labels as props, NEVER call getDict() themselves), S4 (brand-token-only, use bg-teal NOT #00685a)
  </read_first>
  <action>
    Create `icons.tsx`: export 1.5px-stroke inline-`<svg>` line pictograms `PlaneIcon`, `BuildingIcon` (may reuse the path data already in RouteMotif), plus NEW `CalendarIcon`, `ClockIcon`, `PeopleIcon`, `LockIcon` for the details grid + trust footer. `stroke="currentColor"`, `strokeWidth="1.5"`, `aria-hidden="true"`, literal path data only (no untrusted/raw-HTML injection — mirror the RouteMotif T-09-03-01 stance). NEVER Material Symbols, NEVER a re-drawn brand logo, NEVER an invented infinity loop.
    Create `TransferPass.tsx` (presentational, no data): a className-passthrough wrapper mirroring `Card`'s pattern. Render a `header` slot (the teal band area) followed by a 2px dashed divider (`border-grey/30`-ish) flanked by two page-background-coloured circular notch `<div>`s as PURE decoration, then a body `children` slot. Use `rounded-lg`/`rounded-xl` + the ambient shadow OR a 1px `#66676F`@20% border for the boarding-pass feel. NO `<canvas>`/barcode element, NO fake digit string anywhere. Prop shape is your discretion (e.g. `{ header: ReactNode; children: ReactNode; className?: string }`).
    Create `PassHeader.tsx` (presentational): a `bg-teal text-white` band rendering the `eyebrow` prop (Label role, UPPERCASE tracking permitted), an OPTIONAL `refLabel` prop (rendered only when truthy — omitted on /pickup), then `<RouteMotif start={…} end={…} />`. PassHeader takes already-translated strings as props (S1) — `eyebrow`, optional `refLabel`, and the two endpoint labels (airport, destination); it passes `PlaneIcon`/`BuildingIcon` as the endpoint icons and the labels through to RouteMotif. Do NOT re-draw the brand badge — RouteMotif already serves the committed `public/brand/transfer-badge.svg` midpoint.
    Create `DetailsGrid.tsx` (presentational): a 2-col grid (`grid grid-cols-2 gap-[16px]`) of EXACTLY four cells — Date, Flight No., Guests, Time (Decision 3, NO "Est. Pickup"). Each cell = a Label caption (`text-[14px] font-semibold…text-slate`, UPPERCASE permitted) with its line pictogram (Calendar/Plane/People/Clock) + a Body value (`text-[16px]…text-slate`). Accept an `items` prop array of `{ caption, value, icon }` (caption strings + values resolved by the server page; icons supplied by the page from `icons.tsx`). Render a value's empty string gracefully (no crash).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next lint --file "app/(guest)/_pass/TransferPass.tsx" --file "app/(guest)/_pass/PassHeader.tsx" --file "app/(guest)/_pass/DetailsGrid.tsx" --file "app/(guest)/_pass/icons.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - All four files compile: `npx tsc --noEmit` exits 0
    - `grep -c "bg-teal" "app/(guest)/_pass/PassHeader.tsx"` >= 1 (teal #029B87 header band) AND `grep -c "00685a" "app/(guest)/_pass/PassHeader.tsx"` == 0 (rejected mockup primary never appears)
    - `grep -iE "barcode|<canvas" "app/(guest)/_pass/TransferPass.tsx"` returns nothing (Decision 1: no barcode)
    - PassHeader imports and renders `RouteMotif` from `@/platform/ui/RouteMotif`: `grep -c "RouteMotif" "app/(guest)/_pass/PassHeader.tsx"` >= 2 (import + usage)
    - DetailsGrid renders exactly the four real captions and contains NO "Est. Pickup": `grep -iE "Est\.? *Pickup" "app/(guest)/_pass/DetailsGrid.tsx"` returns nothing
    - None of the four files call `getDict` (props-only copy — S1): `grep -c "getDict" "app/(guest)/_pass/"*.tsx` == 0
    - icons.tsx contains no Material Symbols / external icon import: `grep -iE "material-symbols|@mui|lucide|react-icons" "app/(guest)/_pass/icons.tsx"` returns nothing
  </acceptance_criteria>
  <done>TransferPass, PassHeader, DetailsGrid, and the icon set exist under app/(guest)/_pass/, compile, consume only @theme tokens + RouteMotif, take copy as props, and carry no barcode/Material-Symbols/#00685a.</done>
</task>

<task type="auto">
  <name>Task 3: Restyle /pay/cancel to the design system (the demonstrable foundation consumer)</name>
  <files>app/pay/cancel/page.tsx</files>
  <read_first>
    - app/pay/cancel/page.tsx (current state: lines 33-39 raw `style={{}}` markup with HARDCODED English "Payment cancelled" / "Your payment was not completed." — NOT i18n, NOT on the design system; lines 7-31 the service-role status read to KEEP)
    - app/pay/success/page.tsx (lines 70-75 — the `max-w-[480px] … px-[16px] py-[48px]` main shell + `Card` + Display `<h1>` + `text-grey` body + teal track-link class to copy as the DS structure analog)
    - 10-PATTERNS.md "app/pay/cancel/page.tsx (MODIFY — largest visual delta)" section (apply success-page patterns; route copy through getDict; neutral restyle UI-SPEC line 147)
    - platform/i18n/en.ts (the new `payCancelTitle` / `payCancelBody` / `payCancelTrackCta` keys added in Task 1)
  </read_first>
  <action>
    Replace the raw inline-style `<main style={{…}}>` block with the design-system shell copied from /pay/success: `<main className="mx-auto flex max-w-[480px] flex-col gap-[32px] px-[16px] py-[48px]">`, a Display `<h1>` (`text-[28px] font-semibold leading-[1.2] text-slate`), and a `Card` body. Resolve ALL copy via `getDict()` using the new keys `payCancelTitle`, `payCancelBody`, `payCancelTrackCta` — NO hardcoded English remains. Add a teal underlined link to `/track` (reuse the success-page `text-teal underline` link class). KEEP verbatim: `runtime = "nodejs"`, the service-role display-only status read (lines 7-31), and the display-only nature — this page writes NOTHING and never sets `paid`. The current-status line may be kept as a neutral `text-grey` body line or dropped (neutral restyle — your call), but it must remain display-only.
  </action>
  <verify>
    <automated>npx tsc --noEmit && grep -c "getDict" app/pay/cancel/page.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "style={{" app/pay/cancel/page.tsx` == 0 (no raw inline styles remain)
    - `grep -c "getDict" app/pay/cancel/page.tsx` >= 1 (copy resolved server-side)
    - `grep -iE "Payment cancelled|was not completed" app/pay/cancel/page.tsx` returns nothing (hardcoded English removed — strings now come from the dictionary keys)
    - `grep -c "max-w-\[480px\]" app/pay/cancel/page.tsx` >= 1 (on the guest page shell) AND `grep -c "/track" app/pay/cancel/page.tsx` >= 1 (teal track link present)
    - `grep -c "runtime = \"nodejs\"" app/pay/cancel/page.tsx` == 1 (runtime preserved)
    - `grep -iE "['\"]paid['\"]|status: *['\"]paid|\.update\(|\.insert\(" app/pay/cancel/page.tsx` shows no write (display-only / single-writer preserved)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>/pay/cancel renders through getDict() on the design-system shell with a teal /track link, no inline styles, no hardcoded English, still display-only with the service-role read intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| guest browser -> /pay/cancel server page | Untrusted `?t=<id>` query param crosses here; the page reads status display-only |
| dictionary build -> rendered copy | New EN/BG keys must stay in parity or the build (and thus the trust signals) break |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-01 | Tampering | /pay/cancel restyle accidentally introducing a write | mitigate | Keep the page display-only — no `.update`/`.insert`, no `paid` literal write; acceptance grep asserts zero write calls (single-writer invariant preserved) |
| T-10-02 | Information disclosure | TransferPass/PassHeader leaking PII or fare on a decorative surface | mitigate | These pieces are pure presentational shells taking only props the server page already cleared to render; they perform NO reads of their own |
| T-10-03 | Spoofing | Faked transfer reference shown as if authoritative | mitigate | `passRefLabel` is optional and only ever fed the REAL truncated id by the status page (Plan 10-3); /pickup omits it entirely — no invented "BK-2941-X" (Decision 1) |
| T-10-SC | Tampering | npm/pip/cargo installs | mitigate | This plan installs NO packages — all imports are existing in-repo modules (RouteMotif, Card, getDict). No package-legitimacy checkpoint required |
</threat_model>

<verification>
- `npx tsc --noEmit` passes (EN/BG Dict-parity gate green; all new components type-check).
- The full existing guest test suite still passes (presentation-only guarantee): `npx playwright test tests/e2e/guest-status.spec.ts tests/e2e/success-spoof.spec.ts --list` collects without error and any runnable assertions stay green (no new failures introduced — this plan does not touch /status, /pickup, or /pay/success).
- No new `@theme` tokens added: `git diff app/globals.css` is empty.
- `app/(guest)/_pass/` exists with the four files; none live in `platform/ui/`.
</verification>

<success_criteria>
- 11 new + 2 re-worded i18n keys present in BOTH en.ts and bg.ts; tsc green.
- `TransferPass`, `PassHeader`, `DetailsGrid`, and the line-pictogram set exist under `app/(guest)/_pass/`, compile, and consume Phase 9 components + @theme tokens only.
- `/pay/cancel` is fully restyled to the design system via getDict(), display-only, with a teal /track link — no inline styles, no hardcoded English.
- No backend/schema/auth/RLS/payment change; no new tokens; no barcode/Material-Symbols/#00685a anywhere.
</success_criteria>

<output>
Create `.planning/phases/10-guest-ui-rebuild/10-01-SUMMARY.md` when done. List every new symbol and file produced (the artifacts table above) so Plans 10-2 and 10-3 can compose them.
</output>
