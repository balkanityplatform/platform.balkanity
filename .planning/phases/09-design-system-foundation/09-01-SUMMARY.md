---
phase: 09-design-system-foundation
plan: 01
subsystem: ui
tags: [tailwind, design-tokens, css-theme, typography, lifecycle, typescript]

# Dependency graph
requires:
  - phase: 06-claim
    provides: lifecycle.ts (LIFECYCLE_ORDER / ALLOWED_TRANSITIONS) + StatusDot TransferState union
provides:
  - "Named @theme tokens — text-display/heading/body/label, rounded-sm/md/lg/xl/full, spacing aliases (touch-target 44, cta-height 52, gutter/margin)"
  - "STEPPER_ORDER — the 6-step paid->completed source of truth for the DS-04 LifecycleStepper"
affects: [09-design-system-foundation (Waves 2+), 10-guest-surface, 11-driver-surface, 12-admin-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 CSS-first @theme: named semantic tokens (--text-*/--radius-*/--spacing-*) generate utilities; no JS tailwind.config"
    - "Single-source-of-truth lifecycle ordering: STEPPER_ORDER lives in lifecycle.ts, consumed not hand-rolled (T-04-02)"

key-files:
  created: []
  modified:
    - app/globals.css
    - platform/transfers/lifecycle.ts

key-decisions:
  - "Typography roles use Tailwind v4 --text-<name> + paired --text-<name>--line-height; weight applied at call-site (no extra font weights loaded)"
  - "STEPPER_ORDER excludes requested and cancelled — 6 happy-path steps paid->completed; consumer renders cancelled as distinct terminal treatment"

patterns-established:
  - "Surfaces author with semantic classes (text-heading, rounded-lg, h-cta-height) instead of arbitrary values (D-01/D-02)"
  - "Lifecycle stepper order centralised in lifecycle.ts — the stepper component must import STEPPER_ORDER, never declare its own array (D-06)"

requirements-completed: [DS-01, DS-04]

# Metrics
duration: 5min
completed: 2026-06-20
---

# Phase 9 Plan 01: Design-System Foundation Tokens Summary

**Named "Balkanity Path" @theme tokens (typography/radii/spacing) plus the 6-step STEPPER_ORDER lifecycle const — the two disjoint foundation symbols that unblock every Phase 9 component and downstream surface (10/11/12).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-20T16:26:00Z
- **Completed:** 2026-06-20T16:31:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended the single `@theme` block in `app/globals.css` with named typography roles (`text-display/heading/body/label`, each with a paired line-height), radii (`rounded-sm/md/lg/xl/full`, DEFAULT 8px), and spacing aliases (`--spacing-touch-target` 44px, `--spacing-cta-height` 52px, gutter 16 / margin 32) — all generating Tailwind v4 utilities, no JS config introduced.
- Confirmed brand primary stays `#029b87`; zero `#00685a`; no `tailwind.config.*` exists.
- Added `STEPPER_ORDER` to `platform/transfers/lifecycle.ts` — the readonly 6-step `paid→claimed→en_route→arrived→picked_up→completed` source of truth for the DS-04 stepper, with `LIFECYCLE_ORDER` / `ALLOWED_TRANSITIONS` / `canTransition` left unchanged and `TransferState` still imported from StatusDot (Don't-Hand-Roll lock).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the @theme with named typography, radii, and spacing tokens (DS-01)** - `f299dff` (feat)
2. **Task 2: Add the STEPPER_ORDER 6-step lifecycle const (DS-04, D-06)** - `736968e` (feat)

## Files Created/Modified
- `app/globals.css` - Extended the existing `@theme` block with `--text-*` (display/heading/body/label + paired line-heights), `--radius-*` (sm/DEFAULT/md/lg/xl/full), and `--spacing-*` aliases (touch-target, cta-height, gutter, margin). Colours and `--font-sans` untouched.
- `platform/transfers/lifecycle.ts` - Added the `STEPPER_ORDER` sibling export (6 happy-path steps from `paid`), with a comment documenting D-06/D-08; no change to the existing exports.

## Decisions Made
- Typography implemented with Tailwind v4's `--text-<name>` + `--text-<name>--line-height` paired-key syntax so `text-heading` etc. carry a line-height; weight (400/600) stays a call-site concern (`font-normal`/`font-semibold`) — no extra font weights loaded.
- `STEPPER_ORDER` formatted one-entry-per-line to mirror the existing `LIFECYCLE_ORDER` style (the plan's literal `"picked_up", "completed"` single-line grep was a formatting assumption; verified semantically instead — all 6 steps present, `requested`/`cancelled` absent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a CSS comment that broke the PostCSS build**
- **Found during:** Task 1 (token extension)
- **Issue:** The spacing-group comment contained the literal sequence `p-*/gap-*/h-*`. The `*/` inside `p-*/gap-*` prematurely terminated the CSS block comment, so the PostCSS loader hit "Unknown word" and `next build` failed.
- **Fix:** Reworded the comment to "padding / gap / height utilities" with no `*/` token inside the comment body.
- **Files modified:** app/globals.css
- **Verification:** `npm run build` then exits 0; all grep gates and the full test suite stay green.
- **Committed in:** `f299dff` (Task 1 commit — fixed before the commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Self-inflicted comment-syntax issue fixed inline before commit; no scope change, no behaviour change. Plan executed as written otherwise.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. Presentation/config-only (CSS tokens + a TS const); no backend, schema, auth, RLS, or payment-path touched.

## Next Phase Readiness
- Wave 2+ of Phase 9 is unblocked: the named tokens are available for `StatusDot`/`LifecycleStepper`/`RouteMotif` and the dev showcase, and `STEPPER_ORDER` is ready for the DS-04 `LifecycleStepper` (Plan 04) to consume.
- `npm run build`, `npm run typecheck`, and `npm test` (177 passed / 6 skipped) all green; no blockers.

## Self-Check: PASSED

- FOUND: app/globals.css
- FOUND: platform/transfers/lifecycle.ts
- FOUND: .planning/phases/09-design-system-foundation/09-01-SUMMARY.md
- FOUND commit: f299dff
- FOUND commit: 736968e

---
*Phase: 09-design-system-foundation*
*Completed: 2026-06-20*
