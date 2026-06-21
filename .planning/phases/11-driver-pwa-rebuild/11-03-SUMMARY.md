---
phase: 11-driver-pwa-rebuild
plan: 03
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, driver-pwa]

# Dependency graph
requires:
  - phase: 11-driver-pwa-rebuild
    plan: 01
    provides: shared driver layout (header + bell + bottom nav), surface-local LuggageIcon, dictionary keys
  - phase: 09-design-system
    provides: StatusDot (+ stateLabel), RouteMotif, Button, Toast primitives
  - phase: 06-driver-views
    provides: RunView/run page surfaces, advanceStatus gated write, claiming-driver RLS read
provides:
  - "app/driver/run/RunView.tsx — My Trips trip-card island: per-row StatusDot real-state badge + RouteMotif + pax/luggage meta + teal details link + preserved inline advance CTA; arrival_at ASC + Completed-today partition intact (DUI-03)"
  - "app/driver/run/page.tsx — My Trips RSC with chrome props removed (layout owns header/bell); claiming-driver own-rows read unchanged"
affects: [11-04-trip-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Restyle a claimed-run island into mockup trip cards while preserving the RunView.test.tsx source-grep contract (arrival_at ASC + completedTodayTitle partition + 'completed' literal)"
    - "Trip card composes Plan-02's PoolView card grammar (RouteMotif + meta row) over the driver's OWN post-claim rows with per-row real-state StatusDot (no coral Unclaimed override)"

key-files:
  created: []
  modified:
    - app/driver/run/RunView.tsx
    - app/driver/run/page.tsx

key-decisions:
  - "Replaced the vertical LifecycleTimeline inside each My Trips card with a per-row StatusDot real-state badge — the trip card is a compact list item (mockup), and the full horizontal stepper lives on the trip detail (Plan 04); the inline advance CTA still drives the lifecycle change"
  - "Used the full RouteMotif (airport -> zone) rather than a compact route line — Open Question 2 left this to executor's visual call; RouteMotif matches Plan-02's Available card grammar for a consistent driver surface"
  - "Teal details link is labelled with the route summary (airport -> zone) reusing the original RunView link pattern — avoids adding a new EN/BG 'View details' dictionary key (platform/i18n is OUT of this plan's files_modified scope; Plan 01 owns the key set)"
  - "Dropped the now-unused langToggle copy key from the RunView prop bag (LanguageToggle moved to the layout in Plan 01); added airport/zone/pax/luggage label keys the trip card meta needs (all pre-existing dictionary keys)"

patterns-established:
  - "My Trips trip card: arrival date·time (Body 600) + per-row StatusDot, RouteMotif, pax/luggage meta row, teal route details link, optional next-edge advance Button — all on the unchanged claiming-driver RLS read"

requirements-completed: [DUI-03]

# Metrics
duration: 6min
completed: 2026-06-21
---

# Phase 11 Plan 03: My Trips Trip-Card Restyle Summary

**Re-skinned the driver "My run" list into mockup trip cards — per-row real-state StatusDot, a RouteMotif route, pax/luggage meta, and a teal details link — without touching the arrival_at ASC ordering, the Completed-today partition, or the inline advanceStatus CTA that the RunView.test.tsx source-grep gate protects.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-21T21:53:00Z
- **Completed:** 2026-06-21T21:59:00Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- Each active claimed run renders as a warm-light trip card: arrival date · pickup time, a per-row `<StatusDot state={r.status} />` real-state badge (Claimed=teal / En route=amber / Completed=grey / Cancelled=hollow coral ring — no coral "Unclaimed" override), a `RouteMotif` (airport → zone), a pax · luggage meta row, a teal route details link to `/driver/run/[id]`, and the preserved next-edge advance CTA.
- The three protected contracts survive the restyle: `arrival_at` ASC sort of the active list, the `status === "completed"` partition into the collapsed `completedTodayTitle` "Completed today" `<details>` section, and the `"completed"` status literal — RunView.test.tsx green (3/3).
- No earnings and no ratings anywhere on My Trips (Decision 1).
- Removed the per-page `<header>` (logo + NotificationBell + LanguageToggle) and the `bellInitial`/`bellCopy` props from both the island signature and the RSC — chrome now lives once in `app/driver/layout.tsx` (Plan 01, Pitfall 1: no double bell).
- The RSC data path is unchanged: `getCurrentRole()` driver gate + the claiming-driver own-rows `wp_transfers` read (RLS-scoped, never service-role), ordered `arrival_at` ASC.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle RunView into trip cards** — `f9af040` (feat)
2. **Task 2: My Trips RSC header removal** — `445f695` (feat)

## Files Created/Modified
- `app/driver/run/RunView.tsx` (modified) — Trip-card restyle: per-row StatusDot real state, RouteMotif, pax/luggage meta, teal details link; `arrival_at` ASC + Completed-today partition + `advanceStatus` inline CTA preserved; header/bell/timeline/LanguageToggle + bell props removed; new prop-bag copy keys (airport/zone/pax/luggage labels).
- `app/driver/run/page.tsx` (modified) — Dropped the bell seed (`readOwnNotifications`) + `bellInitial`/`bellCopy` props and the `langToggle` key; kept the `getCurrentRole()` gate and claiming-driver own-rows read verbatim; passes only the copy keys RunView now needs.

## Decisions Made
- Per-row StatusDot badge replaces the in-card vertical LifecycleTimeline (compact trip-card list); the full horizontal stepper is reserved for the Plan-04 trip detail.
- Full RouteMotif (not a compact line) for grammar consistency with Plan-02's Available card (Open Question 2 — executor's visual call).
- Teal details link labelled with the route summary to avoid adding an out-of-scope i18n key.

## Deviations from Plan
None — plan executed exactly as written. (Tasks 1 and 2 are tsc-interdependent via the RunView↔page prop bag; both edits were completed before running the shared `npx tsc --noEmit` verification, then committed to their respective task-owned files.)

## Issues Encountered
None.

## Threat Flags
None — no new security surface. My Trips renders only the owning driver's OWN claimed rows via the unchanged claiming-driver RLS read (T-11-08, post-claim PII legitimate); the inline advance reuses the gated `advanceStatus` verbatim (T-11-09); the source-grep contract gate (T-11-10) stays green. No base-table read of others' rows, no service-role client added, no npm installs.

## Known Stubs
None — every trip card is wired to real claiming-driver rows; no placeholder/mock data, no empty hardcoded values flowing to render.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- My Trips is on the stable Plan-01 shell; Plan 04 (trip detail `/driver/run/[id]`) can land the horizontal `LifecycleStepper` + Confirm-Arrival CTA against the same teal-details-link entry point (My Trips tab stays lit on the detail route, D-02).
- Verification: `npx tsc --noEmit` exits 0; `npx vitest run app/driver/run/RunView.test.tsx` passes (3/3); `npx vitest run app/driver` passes (4 files / 11 tests).

## Self-Check: PASSED
- FOUND: app/driver/run/RunView.tsx
- FOUND: app/driver/run/page.tsx
- FOUND: commit f9af040, 445f695

---
*Phase: 11-driver-pwa-rebuild*
*Completed: 2026-06-21*
