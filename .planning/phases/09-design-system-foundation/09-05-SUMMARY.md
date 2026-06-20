---
phase: 09-design-system-foundation
plan: 05
subsystem: ui
tags: [react, server-component, tailwind, i18n, design-system, next-app-router]

# Dependency graph
requires:
  - phase: 09-design-system-foundation (09-01)
    provides: "@theme tokens (colours/radii/spacing/type scale) in app/globals.css; STEPPER_ORDER in lifecycle.ts"
  - phase: 09-design-system-foundation (09-02)
    provides: "StatusDot variant prop (dot/pill), StatusVariant export, cancelled hollow coral ring"
  - phase: 09-design-system-foundation (09-03)
    provides: "RouteMotif (configurable Plane→Building endpoints, real brand transfer badge)"
  - phase: 09-design-system-foundation (09-04)
    provides: "LifecycleStepper (horizontal stepper driven by STEPPER_ORDER, cancelled terminal)"
provides:
  - "Dev-only, production-gated /dev/design-system showcase route rendering every Phase 9 deliverable across states/variants (D-11)"
  - "devShowcase* chrome label keys in en.ts + bg.ts behind the tsc parity gate"
affects: [10-guest-surface, 11-driver-surface, 12-admin-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Production-gated dev route: process.env.NODE_ENV === 'production' → notFound() (mirrors app/pay/start gate)"
    - "Server-Component showcase reads getDict()/getLang() for chrome labels; static samples only, no DB/PII"

key-files:
  created:
    - app/dev/design-system/page.tsx
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts

key-decisions:
  - "Showcase route gated off production via NODE_ENV→notFound() (not a 'production' literal check — uses the dev/non-prod NODE_ENV inversion); never linked from any nav"
  - "Only the showcase's OWN section chrome is dictionary-keyed (devShowcase*); component-internal StatusDot/stepper status labels stay in STATE_META (English-only, existing pattern)"
  - "RouteMotif custom-label sample uses a literal in-source pin pictogram; the brand transfer badge midpoint is served by RouteMotif itself from public/brand (unchanged)"

patterns-established:
  - "Dev-only demonstrable-slice route as the in-browser verification surface for a design-system phase (D-11)"

requirements-completed: [DS-01, DS-02, DS-03, DS-04]

# Metrics
duration: 3min
completed: 2026-06-20
---

# Phase 9 Plan 05: Dev Design-System Showcase Summary

**A production-gated, unlinked `/dev/design-system` Server-Component route that renders every Phase 9 deliverable — StatusDot × 8 states × {dot, pill}, LifecycleStepper at each STEPPER_ORDER state + cancelled, a RouteMotif default + custom-label sample, colour/radii/spacing token swatches, and the 4-role type scale — with its section chrome behind the EN/BG tsc parity gate.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-20T13:48:58Z
- **Completed:** 2026-06-20T13:51:21Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- New `app/dev/design-system/page.tsx` — the phase's demonstrable slice (D-11): every DS-01 token + DS-02/03/04 component rendered across its full state/variant matrix, eyeballable in-browser.
- Production gate (`NODE_ENV === "production"` → `notFound()`) so the throwaway route 404s in prod; not referenced by any header/sidebar/nav; no auth gate, no DB read, no env secrets, no guest PII (T-09-05-01/02 mitigated).
- `devShowcase*` chrome-label keys added to BOTH `en.ts` and `bg.ts` — same key set, tsc parity gate green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add showcase chrome labels to EN/BG dictionary (parity gate)** - `30cbe3c` (feat)
2. **Task 2: Build the dev-only design-system showcase route (D-11)** - `22292b9` (feat)

**Plan metadata:** _(final docs commit below)_

## Files Created/Modified
- `app/dev/design-system/page.tsx` - Dev-only, production-gated D-11 showcase Server Component; renders all Phase 9 deliverables across states/variants.
- `platform/i18n/en.ts` - Added 11 `devShowcase*` section-heading keys (EN canonical copy).
- `platform/i18n/bg.ts` - Added the parallel BG translations for the same keys (parity gate).

## Decisions Made
- Production-gated via the `NODE_ENV === "production"` → `notFound()` inversion (consistent with the existing `app/pay/start` dev gate), keeping the showcase reachable in dev/preview but a hard 404 in prod.
- Keyed only the showcase's own chrome (section headings); left component-internal status labels in `STATE_META` per the established StatusDot pattern (only NEW chrome strictly needs dictionary keys).
- Used `STEPPER_ORDER` directly to drive the stepper sample set (spread + `"cancelled"`), so the showcase never hand-rolls a parallel order array (Don't-Hand-Roll lock, T-04-02).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Both verification gates (typecheck for Task 1, `npm run build` for Task 2) passed first run; `/dev/design-system` appears in the build route manifest as a server-rendered route.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DS-01/02/03/04 are all demonstrably renderable together — the surface phases (10 Guest → 11 Driver → 12 Admin) can read `/dev/design-system` as the live reference before consuming the components.
- The showcase is throwaway/dev-only and production-gated; it can be deleted once the surfaces consume the foundation, with no production impact.
- No blockers. Phase 9 (Design System Foundation) is complete with all 5 plans executed.

## Self-Check: PASSED

- FOUND: `app/dev/design-system/page.tsx`
- FOUND commit: `30cbe3c` (Task 1)
- FOUND commit: `22292b9` (Task 2)
- `devShowcase` key count matches: en.ts 11 / bg.ts 11 (parity)

---
*Phase: 09-design-system-foundation*
*Completed: 2026-06-20*
