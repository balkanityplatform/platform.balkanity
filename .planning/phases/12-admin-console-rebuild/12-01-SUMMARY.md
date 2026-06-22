---
phase: 12-admin-console-rebuild
plan: 01
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, i18n, admin-console, layout-shell]

# Dependency graph
requires:
  - phase: 11-driver-pwa-rebuild
    provides: "app/driver/layout.tsx shell-consolidation pattern (D-04) + readOwnNotifications own-rows bell seed + DriverBottomNav/tabs prop-bag nav islands"
  - phase: 09-design-system
    provides: "NotificationBell, LanguageToggle, slate/teal brand tokens consumed verbatim"
provides:
  - "Shared admin console shell (app/admin/layout.tsx) wrapping every admin route"
  - "Persistent slate left sidebar (Dashboard/Transfers/Drivers/Settings) with teal active highlight + responsive hamburger drawer (AdminSidebar)"
  - "Slate top bar with client search seam + signed-in identity + single NotificationBell + LanguageToggle (AdminTopBar)"
  - "buildAdminTabs(copy, pathname) single-source nav config (exact-vs-prefix active rules, no Analytics)"
  - "4 new 1.5px-stroke sidebar line pictograms (Dashboard/Transfers/Drivers/Settings)"
  - "24 new EN/BG admin-console i18n keys (the phase's single key-introduction point)"
affects: [12-02, 12-03, 12-04, 12-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin shell consolidation mirroring app/driver/layout.tsx (Phase 11 D-04 carry-forward)"
    - "Responsive nav island: persistent lg+ panel + <lg hamburger overlay drawer via useState (the one piece of client state the driver nav lacked)"
    - "Top-bar client search as a presentational seam (Plan-03 wires loaded-rows filtering)"

key-files:
  created:
    - app/admin/layout.tsx
    - app/admin/_nav/tabs.ts
    - app/admin/_nav/icons.tsx
    - app/admin/_nav/AdminSidebar.tsx
    - app/admin/_nav/AdminTopBar.tsx
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts

key-decisions:
  - "Layout has NO role gate and NO service-role client — each admin page keeps its own getCurrentRole() re-gate (T-12-01 preservation)"
  - "Single NotificationBell seeded ONCE via own-rows readOwnNotifications() (caller-auth RLS, never service-role — T-12-02)"
  - "Signed-in identity read from verified auth.getUser() (revalidated JWT, never getSession — T-12-03); email alone acceptable"
  - "Menu accessible labels (navMenuLabel/menuSlotLabel/searchPlaceholder) reuse existing dictionary keys — no new keys beyond Task 1's 24 (the phase's single key-introduction point)"

patterns-established:
  - "Pattern 1: admin slate-console shell (sidebar + top bar + main) is the foundation Wave-2 surfaces render inside; each surface drops its own per-page <header>"
  - "Pattern 2: AdminSidebar self-owns its mobile hamburger toggle + overlay drawer (co-located with the nav it controls)"

requirements-completed: [AUI-01, AUI-05]

# Metrics
duration: ~20min
completed: 2026-06-22
---

# Phase 12 Plan 01: Admin Console Shell Summary

**Shared admin slate-console shell (app/admin/layout.tsx) mounting a persistent left sidebar + responsive drawer, a top bar with client-search seam + signed-in identity, and the single own-rows NotificationBell — mirroring the Phase 11 driver-layout consolidation.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-22T22:25:00Z (approx)
- **Completed:** 2026-06-22T22:35:00Z (approx)
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- New `app/admin/layout.tsx` async RSC wraps every admin route with the slate-console chrome, seeds exactly one NotificationBell, and reads the signed-in identity from the verified session — with no role gate and no service-role client in the layout (preservation gates T-12-01/02/03).
- `AdminSidebar` + `AdminTopBar` client islands provide the persistent slate sidebar (4 items, teal active highlight, no Analytics), the responsive hamburger overlay drawer (D-04), and the top-bar search/identity/bell/lang slots (AUI-05 partial; search→rows wiring lands in Plan 03).
- `buildAdminTabs` + 4 new 1.5px-stroke line pictograms establish the single-source nav config; 24 new EN/BG i18n keys land behind the tsc Dict parity gate as the phase's single key-introduction point.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add all new EN/BG admin-console i18n keys (tsc parity gate)** — `b357178` (feat)
2. **Task 2: Create sidebar nav config + 4 line icons + AdminSidebar + AdminTopBar islands** — `ff8b56b` (feat)
3. **Task 3: Create app/admin/layout.tsx shell (sidebar + top bar + bell once + identity)** — `1fcc8d9` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

_Note: Tasks 1 and 2 were already committed before this execution session (artifacts present, tracked, and clean on disk); this session verified their acceptance gates green and completed the remaining Task 3._

## Files Created/Modified
- `app/admin/layout.tsx` - Shared admin shell RSC: Promise.all([getDict, getLang]), one readOwnNotifications() bell seed, auth.getUser() identity, AdminSidebar + AdminTopBar + `<main>{children}</main>`. No role gate, no service-role.
- `app/admin/_nav/tabs.ts` - `buildAdminTabs(copy, pathname)` + `AdminNavCopy`/`AdminTab` types; exact `/admin` + prefix rules for Transfers/Drivers/Settings; no Analytics.
- `app/admin/_nav/icons.tsx` - 4 new 1.5px-stroke glyphs (Dashboard/Transfers/Drivers/Settings); baseProps copied verbatim from the driver icon module.
- `app/admin/_nav/AdminSidebar.tsx` - Client nav island: persistent lg+ slate panel + <lg hamburger overlay drawer (useState), usePathname active highlight, aria-current, redundant teal indicator, 14px/600 labels.
- `app/admin/_nav/AdminTopBar.tsx` - Client top bar: presentational search input (Plan-03 seam), signed-in identity prop, actions slot for the layout-mounted bell + LanguageToggle.
- `platform/i18n/en.ts` / `platform/i18n/bg.ts` - 24 new admin-console keys (Dict parity).

## Decisions Made
- Reused existing dictionary keys (`navDashboard`, `transferSearchPlaceholder`, `signedInAs`) for the sidebar/top-bar accessible labels rather than introducing `navMenuLabel`/`menuSlotLabel` keys — Task 1 is the phase's single key-introduction point and forbids Wave-2 additions, so deriving these from existing copy honours that constraint (mirrors the driver nav reusing `navAvailable` as its `<nav>` aria-label).
- Layout reads identity but renders email alone (name not fetched) — email is always present from the verified session and is sufficient (Claude's-Discretion per the plan).

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were found already committed from a prior session; their acceptance gates (tsc parity, eslint, no-Material-Symbols, no-Analytics, usePathname/aria-current, useState drawer) were re-verified green before completing Task 3.

## Issues Encountered
- After creating `app/admin/layout.tsx`, `npx tsc --noEmit` reported two `LayoutRoutes` errors in `.next/dev/types/validator.ts` — stale Next-generated route types that had not yet seen the new `/admin` layout route. Resolved by regenerating route types (`npx next typegen`); tsc then exited 0. These were build-artifact staleness, not source errors (eslint on the layout was clean throughout).

## User Setup Required
None - no external service configuration required. Presentation-only; zero backend/schema/auth/RLS/payment changes.

## Next Phase Readiness
- The admin shell is the foundation all four Wave-2 surface slices (Plans 02–05) render inside. Each Wave-2 plan will drop its own per-page slate `<header>` (a transient double-header mid-wave is acceptable, per the Phase 11 carry-forward).
- AUI-05 is partial: the top-bar search input is a presentational seam — Plan 03 wires `onSearchChange` to loaded-rows client filtering in TransfersView.
- Wave-2 plans CONSUME the 24 i18n keys introduced here; they must not add more.
- Visual review (Phase 11 D-06) still pending: confirm the slate sidebar shows 4 items with teal active highlight + no Analytics, the drawer toggles below the breakpoint, and the top bar shows search + bell + identity + lang.

## Self-Check: PASSED

All 5 created source files + the SUMMARY exist on disk; all 3 task commits (`b357178`, `ff8b56b`, `1fcc8d9`) are present in git history.

---
*Phase: 12-admin-console-rebuild*
*Completed: 2026-06-22*
