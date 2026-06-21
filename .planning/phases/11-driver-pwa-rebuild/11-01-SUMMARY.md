---
phase: 11-driver-pwa-rebuild
plan: 01
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, i18n, pwa]

# Dependency graph
requires:
  - phase: 09-design-system
    provides: brand @theme tokens (teal/coral/grey/slate), StatusDot/RouteMotif/LifecycleStepper primitives, line-icon convention
  - phase: 07-notifications
    provides: NotificationBell island + readOwnNotifications own-rows feed read (bell seed)
  - phase: 06-driver-views
    provides: driver pool/run/settings RSC + island surfaces whose duplicated headers this consolidates
provides:
  - "app/driver/layout.tsx — shared driver shell (slim top header + bell seed + persistent bottom nav, mounted once) (D-01)"
  - "app/driver/_nav/DriverBottomNav.tsx — usePathname active-tab bottom nav (Available/My Trips/Profile) (DUI-02)"
  - "app/driver/_ui/icons.tsx — LuggageIcon + 3 nav-tab line icons in the guest 1.5px-stroke style"
  - "14 new EN/BG driver dictionary keys (nav labels, coral pool badge, confirm-arrival, sign-out, 8 detail-grid captions)"
affects: [11-02-pool-claim, 11-03-my-trips, 11-04-trip-detail, 11-05-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested App Router layout RSC consolidates duplicated per-page chrome + relocates the bell seed (own-rows read, not widened)"
    - "Client island bottom nav driven by usePathname() with exact-vs-prefix active rules (D-02)"

key-files:
  created:
    - app/driver/layout.tsx
    - app/driver/_nav/DriverBottomNav.tsx
    - app/driver/_ui/icons.tsx
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts

key-decisions:
  - "Bell seed RELOCATED (not duplicated) from app/driver/page.tsx into the layout RSC — same readOwnNotifications own-rows caller-auth read; pages keep their header until Plans 02-05 each remove their own (disjoint file ownership, transient double-header accepted mid-wave)"
  - "DriverBottomNav active state: Available = exact pathname === '/driver'; My Trips = startsWith('/driver/run') so the detail route /driver/run/[id] keeps the tab lit (D-02); Profile = startsWith('/driver/settings')"
  - "driverUnclaimedBadge is presentation copy only — NO 'unclaimed' TransferState, STATE_META untouched (Pitfall 5)"
  - "12px/600 nav label is the single deliberate sub-14px exception (UI-SPEC); line icon carries redundant signal"

patterns-established:
  - "Driver shell: min-h-dvh white wrapper with pb-[calc(64px+env(safe-area-inset-bottom))], slim border-b header (logo · NotificationBell · LanguageToggle), <main>, fixed-bottom DriverBottomNav"
  - "Surface-local icon module mirrors app/(guest)/_pass/icons.tsx baseProps factory; shared guest icons imported, never re-declared"

requirements-completed: [DUI-02]

# Metrics
duration: 7min
completed: 2026-06-21
---

# Phase 11 Plan 01: Driver Shell + Bottom Nav Foundation Summary

**Shared `app/driver/layout.tsx` mounts a slim header (logo · Alerts bell · language toggle) and a persistent usePathname-driven bottom nav once for every driver route, plus the surface-local line icons and all 14 new EN/BG keys the phase consumes.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-21T21:43:00Z
- **Completed:** 2026-06-21T21:50:00Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Consolidated the four duplicated driver `<header>` blocks + bell seed into one shared layout RSC (D-01).
- Persistent bottom nav (Available / My Trips / Profile) that highlights the active tab via `usePathname()`, with My Trips staying lit on the `/driver/run/[id]` detail route (D-02) (DUI-02).
- Surface-local Luggage + 3 nav-tab line icons in the guest 1.5px-stroke style — no Material Symbols, no re-drawn logo.
- All 14 new EN/BG dictionary keys with translated BG values behind the tsc parity gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add all Phase 11 EN/BG dictionary keys** - `096ea6f` (feat)
2. **Task 2: Surface-local line icons (Luggage + 3 nav-tab icons)** - `d91acee` (feat)
3. **Task 3: DriverBottomNav island + shared app/driver/layout.tsx** - `459078a` (feat)

## Files Created/Modified
- `app/driver/layout.tsx` (created) - Shared driver shell RSC: resolves [t, lang], seeds the Alerts bell from `readOwnNotifications`, renders the slim header + `<main>` + `<DriverBottomNav>`; bottom padding clears the fixed nav.
- `app/driver/_nav/DriverBottomNav.tsx` (created) - `"use client"` bottom-nav island; `usePathname()` active-tab logic; fixed bottom + `pb-[env(safe-area-inset-bottom)]`; 12px/600 active-teal labels; ≥44px hit targets.
- `app/driver/_ui/icons.tsx` (created) - `LuggageIcon`, `AvailableTabIcon`, `MyTripsTabIcon`, `ProfileTabIcon` mirroring the guest `_pass/icons.tsx` baseProps factory.
- `platform/i18n/en.ts` (modified) - 14 new Phase 11 driver keys (EN canonical).
- `platform/i18n/bg.ts` (modified) - identical key set with translated BG values (parity gate).

## Decisions Made
- Relocated the bell seed into the layout rather than duplicating it; left per-page headers in place so each later surface slice removes its own (disjoint file ownership). Transient double-header mid-wave is acceptable per the plan.
- Available tab uses exact `/driver` equality (not `startsWith`) so it does not light under `/driver/run`; My Trips uses the `/driver/run` prefix to cover the detail route.
- `driverUnclaimedBadge` kept as presentation copy — no TransferState/STATE_META change.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Threat Flags
None - no new security surface. The bell seed is the same own-rows-only `readOwnNotifications` read relocated to the layout RSC; the bottom nav is pure client routing with no authz dependency (every route still re-gates via `getCurrentRole()`); the new i18n keys are static UI strings.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fixed chrome + dictionary + icons are in place; the four surface restyle slices (Plans 02–05) can run against a stable contract. Each must DELETE its own page `<header>` to avoid the transient double-header (Pitfall 1).
- Verification: `npx tsc --noEmit` exits 0 (EN/BG parity); `npx vitest run app/driver` passes (4 files / 11 tests, no behaviour change).

## Self-Check: PASSED
- FOUND: app/driver/layout.tsx
- FOUND: app/driver/_nav/DriverBottomNav.tsx
- FOUND: app/driver/_ui/icons.tsx
- FOUND: commit 096ea6f, d91acee, 459078a

---
*Phase: 11-driver-pwa-rebuild*
*Completed: 2026-06-21*
