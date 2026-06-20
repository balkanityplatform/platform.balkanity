---
phase: 09-design-system-foundation
plan: 03
subsystem: ui
tags: [react, next-image, design-system, brand-asset, svg, tailwind]

# Dependency graph
requires:
  - phase: 09-01
    provides: "Named @theme tokens (text-label, radius/spacing aliases) consumed by RouteMotif"
provides:
  - "RouteMotif — reusable Departure→Arrival route motif with configurable {icon,label} endpoints (DS-03)"
  - "public/brand/transfer-badge.svg — committed real brand Transfer Badge served verbatim for the midpoint"
affects: [10-guest, 11-driver, 12-admin, 09-04-showcase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serve a committed pictogram SVG inside a React component via public/ + next/image (no SVG-as-component, no raw-HTML injection)"
    - "Configurable {icon,label} endpoint props with sensible inline line-pictogram defaults; labels are props (i18n stays in the surface)"

key-files:
  created:
    - platform/ui/RouteMotif.tsx
    - public/brand/transfer-badge.svg
  modified: []

key-decisions:
  - "Midpoint serving strategy = copy the committed transfers.svg verbatim to public/brand/ and render via next/image (the app/admin/page.tsx analog); NOT SVG-as-React-component — keeps the reviewed brand bytes untouched"
  - "Plane/Building default endpoints are inline 1.5px-stroke line pictograms (D-10 permits line icons where no brand asset exists); they are NOT brand marks"
  - "Endpoint label strings are component props (surface supplies the translated string); no i18n wired inside RouteMotif"

patterns-established:
  - "Pictogram-in-component: public/brand/ asset + next/image with explicit width/height + alt; never dangerouslySetInnerHTML"
  - "Endpoint-as-props: {start?,end?} each {icon:ReactNode,label:string} with defaults, className passthrough merged last (Card/Button convention)"

requirements-completed: [DS-03]

# Metrics
duration: 2min
completed: 2026-06-20
---

# Phase 09 Plan 03: RouteMotif (Balkanity Path) Summary

**Reusable Departure→Arrival RouteMotif whose auto-centered midpoint is the REAL committed brand Transfer Badge served verbatim via next/image, with configurable Plane→Building endpoint props.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-20T13:39:29Z
- **Completed:** 2026-06-20T13:42Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Copied the committed brand Transfer Badge (`platform/ui/pictograms/transfers.svg`) byte-for-byte to `public/brand/transfer-badge.svg` so `next/image` can serve it — verbatim, never re-drawn (ASSET guardrail / D-10).
- Shipped `platform/ui/RouteMotif.tsx`: `RouteEndpoint {icon,label}` + `RouteMotifProps {start?,end?,className?}`, named export, `className` passthrough — following Card/Button conventions.
- Midpoint is the fixed real brand badge via `next/image` from `/brand/transfer-badge.svg`; defaults are inline 1.5px-stroke Plane→Building line pictograms (line icons, not brand marks).
- No `dangerouslySetInnerHTML` / untrusted SVG injection anywhere; typecheck + lint clean for the new file; production `npm run build` resolves the import and asset path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Serve the committed Transfer Badge under public/** - `0948ea9` (feat)
2. **Task 2: Build the RouteMotif component with configurable endpoints + brand midpoint** - `5820f99` (feat)

**Plan metadata:** (docs commit — this SUMMARY + STATE/ROADMAP)

## Files Created/Modified
- `public/brand/transfer-badge.svg` - The committed brand Transfer Badge copied verbatim (byte-identical to `platform/ui/pictograms/transfers.svg`) so `next/image` can serve the midpoint mark.
- `platform/ui/RouteMotif.tsx` - Reusable route/infinity motif: configurable `{icon,label}` start/end (default Plane→Building inline line pictograms), fixed real brand Transfer Badge midpoint via `next/image`, `className` passthrough; no raw-HTML injection.

## Decisions Made
- **Serving strategy (the one un-precedented mechanic):** copy the committed SVG verbatim to `public/brand/` and render via `next/image` — chosen over SVG-as-React-component so the reviewed brand bytes are never edited and the threat register's "no inline untrusted SVG" disposition holds.
- **Defaults:** Plane and Building rendered as inline 1.5px-stroke line pictograms (permitted by D-10 where no brand asset exists), explicitly NOT brand marks.
- **i18n boundary:** labels are props; the component does not touch the dictionary (surfaces pass already-translated strings).

## Deviations from Plan

None - plan executed exactly as written. (The Task-2 acceptance grep `grep "dangerouslySetInnerHTML"` must return nothing; the file header comment was worded to describe the constraint without using the literal token, so the gate passes while the constraint is still documented — a wording choice within the plan, not a deviation.)

## Issues Encountered
- `npm run lint` reports 4 repo-wide errors + warnings, ALL in pre-existing files this plan never touched (`app/driver/run/...`, digest settings, two `*.test.ts` unused-var warnings). `npx eslint platform/ui/RouteMotif.tsx` is clean (exit 0). Per the SCOPE BOUNDARY these are out of scope; logged to `.planning/phases/09-design-system-foundation/deferred-items.md`, not fixed. They belong to the Driver (11) / Notifications (7) surfaces.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `RouteMotif` is ready for the Plan 09-04 dev showcase (D-11) and for Guest (10) / Driver (11) / Admin (12) route headers to consume with their own `start`/`end` endpoints.
- The committed brand badge is now served from `public/brand/` for any future surface that needs the mark via `next/image`.
- No blockers. Presentation-only: zero backend/schema/auth/RLS/payment changes (v1.1 guardrail honored).

## Self-Check: PASSED

- FOUND: public/brand/transfer-badge.svg
- FOUND: platform/ui/RouteMotif.tsx
- FOUND: .planning/phases/09-design-system-foundation/09-03-SUMMARY.md
- FOUND commit: 0948ea9 (Task 1)
- FOUND commit: 5820f99 (Task 2)

---
*Phase: 09-design-system-foundation*
*Completed: 2026-06-20*
