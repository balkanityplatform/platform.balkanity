---
phase: 09-design-system-foundation
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/dev/design-system/page.tsx
  - app/globals.css
  - platform/i18n/bg.ts
  - platform/i18n/en.ts
  - platform/transfers/lifecycle.ts
  - platform/ui/LifecycleStepper.test.tsx
  - platform/ui/LifecycleStepper.tsx
  - platform/ui/RouteMotif.tsx
  - platform/ui/StatusDot.test.tsx
  - platform/ui/StatusDot.tsx
  - public/brand/transfer-badge.svg
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 9 is a presentation-only design-system foundation: token definitions in `globals.css`, the `StatusDot` (dot/pill + cancelled-ring) and `LifecycleStepper` components, a `RouteMotif`, i18n additions, and a dev-only showcase route. The work is well-documented and the security posture of the showcase route (prod-gated `notFound()`, no DB/PII/secrets) holds up.

No BLOCKERs were found: no injection vectors, no secret exposure, no auth changes, no `paid`-write paths, and the i18n EN/BG key parity is intact (240 keys both sides, zero diff). The findings below are correctness/consistency and quality issues — the most material being a brand-colour mismatch between the committed Transfer Badge asset and the locked palette, a dead `getLang()` call, and a stepper-shape data attribute that contradicts the component's own visual classification for the terminal `completed` state.

## Warnings

### WR-01: Transfer Badge SVG uses `#009B87`, not the locked brand teal `#029B87`

**File:** `public/brand/transfer-badge.svg:7`
**Issue:** The committed brand asset fills with `.st1{fill:#009B87;}`. The locked brand primary (CLAUDE.md, UI-SPEC Color contract, and `app/globals.css:8`) is `#029b87`. `RouteMotif` renders this exact file verbatim via `next/image` (`RouteMotif.tsx:109`) and is explicitly documented as "the REAL committed brand Transfer Badge served verbatim … NEVER re-drawn." So the one place the badge appears renders an off-brand teal (`#009B87` vs `#029B87`) directly beside `bg-teal` (`#029b87`) surface elements, where the ~2-point hue difference is side-by-side visible. Either the asset is wrong or the locked token is wrong; they cannot both be authoritative. This is a brand-correctness defect in a design-system foundation whose entire job is to be the single source of brand truth.
**Fix:** Confirm the canonical hex with the brand owner. If `#029B87` is locked (as CLAUDE.md states), update the asset:
```svg
.st1{fill:#029B87;}
```
If the badge’s `#009B87` is the true brand value, the discrepancy must be reconciled in `globals.css` and CLAUDE.md instead — but do not leave the two diverging.

### WR-02: Stepper marks the terminal `completed` step `data-state="completed"` while it visually renders as completed — `aria-current` + completed shape collide without a distinct "active" signal

**File:** `platform/ui/LifecycleStepper.tsx:72-76, 94, 116`
**Issue:** For `current="completed"`, the last step is simultaneously `isActive` (idx === currentIdx) and `isCompleted` (`isActive && isTerminalCompleted`). The shape resolves to `bg-teal` + check (completed treatment) and the element also carries `aria-current="step"`. This is intentional per the doc comment, but the visual result is that the terminal/active step is **indistinguishable** from a normal completed step — there is no "you are here" affordance at the end of the happy path. A sighted user landing on a completed transfer sees six identical teal-check circles with no indication which is current; only assistive tech (via `aria-current`) can tell. For a stepper whose stated purpose (D-07) is "shape encodes state beyond colour," the terminal state loses its distinct visual encoding. Compare `cancelled`, which gets a fully distinct treatment.
**Fix:** Give the terminal `completed` step a visually distinguishable cue (e.g. a ring or slightly larger shape) so the current position is conveyed visually, not only via `aria-current`. At minimum, document this as an accepted visual limitation if the product owner signs off — but the current code presents it as deliberate without a visual differentiator.

### WR-03: `StatusDot` ignores `variant` for `cancelled`, so the showcase `pill × cancelled` cell silently renders a dot — and the pill carrier test never exercises it

**File:** `platform/ui/StatusDot.tsx:68-83`; `app/dev/design-system/page.tsx:172-176`
**Issue:** The cancelled branch returns the hollow-ring dot before the `variant === "pill"` check, so `<StatusDot state="cancelled" variant="pill" />` renders identically to the dot variant. The showcase explicitly renders an 8-state × {dot, pill} matrix (`page.tsx:166-177`), so the `pill / cancelled` cell renders a dot in the "pill" column — a visual inconsistency in the very artifact meant to demonstrate every state × variant. The component comment claims this is intended ("hollow coral ring … in BOTH variants, never a filled pill"), which is a defensible product decision, but the showcase presents it under a "pill" heading without annotation, making the matrix misleading. The test (`StatusDot.test.tsx:62-65`) hard-codes this by routing cancelled to the `status-dot` carrier regardless of variant, so it can never catch a regression where pill-cancelled diverges.
**Fix:** Either (a) in the showcase, skip or annotate the `pill × cancelled` cell so the matrix doesn’t imply a pill rendering exists, or (b) render a pill-shaped hollow-coral badge for `variant="pill"` to keep the matrix internally consistent. Decision is product-owned; the current state is an undocumented inconsistency in a demonstration surface.

## Info

### IN-01: `getLang()` is awaited but its result is discarded (dead call)

**File:** `app/dev/design-system/page.tsx:87`
**Issue:** `const [t] = await Promise.all([getDict(), getLang()]);` destructures only the first element; `getLang()`’s result is fetched and thrown away. It adds an unnecessary async call and reads as an incomplete refactor (perhaps a lang toggle was planned). `getDict()` already resolves the active language internally, so `getLang()` here is pure dead weight.
**Fix:**
```tsx
const t = await getDict();
```
Drop the `Promise.all` + `getLang()` unless the lang value is actually needed for rendering.

### IN-02: Duplicate inline `PlanePin`/`PlaneIcon` SVG pictograms across two files

**File:** `app/dev/design-system/page.tsx:219-236`; `platform/ui/RouteMotif.tsx:39-55`
**Issue:** The showcase defines a local `PlanePin` plane/pin SVG, while `RouteMotif` exports a conceptually-equivalent `PlaneIcon` (different path data, same role). The showcase even passes `<PlanePin />` for *both* the start and end endpoints of its custom sample (`page.tsx:208-210`), which is odd (a plane icon used as the "Seaside Villa" arrival endpoint). Minor duplication and a semantically wrong icon in a demo.
**Fix:** Reuse exported pictograms from `RouteMotif` (export `PlaneIcon`/`BuildingIcon` if a building endpoint is wanted) rather than re-authoring inline SVG in the showcase; use a building/pin icon for the villa endpoint.

### IN-03: `COLOUR_TOKENS` comment says "seven @theme brand colour tokens" but the palette is documented as six colours + white

**File:** `app/dev/design-system/page.tsx:40`
**Issue:** Comment reads "The seven @theme brand colour tokens"; `globals.css:3` and CLAUDE.md describe "six colours + white." Counting white as a brand colour is a minor doc inconsistency that could confuse a future reader about how many true brand hues exist.
**Fix:** Reword to "six brand colours + white surface" to match the locked palette description.

### IN-04: `STATE_META.cancelled.colorClass` is `bg-coral` but is never used as a fill — dead/ misleading data

**File:** `platform/ui/StatusDot.tsx:43`
**Issue:** The map entry `cancelled: { colorClass: "bg-coral", … }` defines a solid coral fill, but the render path for cancelled (lines 72-83) ignores `colorClass` entirely and uses `CANCELLED_RING` (`border-coral bg-transparent`). Any future consumer reading `STATE_META.cancelled.colorClass` (it is module-level data, and `stateLabel` already exposes the map’s pattern) would get `bg-coral` and render the wrong (filled) treatment the phase explicitly removed (D-04). This is a latent trap.
**Fix:** Either change the value to reflect reality (e.g. a `ringClass`/`bg-transparent` marker) or add a comment that `colorClass` is intentionally unused for `cancelled` and consumers must special-case it. Best: keep the rendering treatment in one place so the map can’t lie.

### IN-05: Stepper connector logic renders an empty leading/trailing `flex-1` spacer that offsets shape centering

**File:** `platform/ui/LifecycleStepper.tsx:97-129`
**Issue:** For the first step the leading connector is replaced by an empty `<span className="flex-1" />`, and for the last step the trailing connector is likewise an empty `flex-1` spacer. Because each step is `flex-1` and the shape is centered between two flex-1 segments, the first and last shapes still get a full-width invisible spacer on the outer side — visually fine, but the empty `aria-hidden` spacers are pure layout scaffolding that could be achieved with `justify-center`/margins. Not a bug; flagged as avoidable complexity in a foundation component others will copy.
**Fix:** Optional — consider simplifying the connector model (e.g. render connectors only *between* shapes via a CSS approach) to reduce the four-branch conditional. Low priority.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
