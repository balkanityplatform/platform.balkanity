---
phase: 11-driver-pwa-rebuild
plan: 04
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, i18n, lifecycle]

# Dependency graph
requires:
  - phase: 11-driver-pwa-rebuild
    plan: 01
    provides: driver shell layout (slim header + bottom nav) + EN/BG dictionary keys (driver*Label + driverConfirmArrivalCta)
  - phase: 09-design-system
    provides: LifecycleStepper (horizontal DS-04 stepper), RouteMotif, Button, Toast, StatusDot TransferState
  - phase: 06-driver-views
    provides: advanceStatus gated service-role write, claiming-driver RLS detail read
provides:
  - "app/driver/run/[id]/DetailView.tsx — NEW client island: next-forward-edge advance CTA wired to advanceStatus; en_route→arrived labeled driverConfirmArrivalCta (DUI-04)"
  - "app/driver/run/[id]/page.tsx — restyled detail RSC: LifecycleTimeline→LifecycleStepper swap, RouteMotif hero, dictionary captions, DetailView mount, header removed"
affects: [11-05-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RSC reads the claiming-driver row, resolves EN/BG copy, and hands {id,status,copy} to a thin client island that holds the lone server-action interaction (the advance CTA)"
    - "Next-forward-edge label resolution via ALLOWED_TRANSITIONS[status].find(s => s!=='cancelled' && s!=='paid') keyed by next-state — copied verbatim from RunView, only the en_route→arrived label diverges"

key-files:
  created:
    - app/driver/run/[id]/DetailView.tsx
  modified:
    - app/driver/run/[id]/page.tsx

key-decisions:
  - "Confirm-Arrival CTA labels the en_route→arrived edge by keying labelByNext[arrived] = copy.driverConfirmArrivalCta; every other forward edge reuses the existing advanceTo*Cta keys"
  - "RouteMotif end label falls back zone → address → t.zoneLabel so the hero card always shows the most specific available destination without leaking a blank endpoint"
  - "advanceStatus reused verbatim — no new server action, no client write; the island only triggers the existing gated service-role path (T-11-11 mitigation unchanged)"
  - "Detail page now relies on the Plan-01 layout for chrome (slim header + bottom nav); the per-page back-link header was deleted, and D-02 keeps the My Trips tab lit on /driver/run/[id]"

patterns-established:
  - "Trip-detail island holds ONLY the advance CTA + its coral failure Toast; all read-only facts stay in the RSC (no PII passes through the client island props — only id/status/copy)"

requirements-completed: [DUI-04]

# Metrics
duration: 3min
completed: 2026-06-21
---

# Phase 11 Plan 04: En-route Trip Detail + Confirm-Arrival Summary

**The driver trip-detail page is re-skinned to the design system — a horizontal LifecycleStepper, a RouteMotif hero, fully dictionary-keyed captions, and a NEW DetailView island whose next-forward-edge CTA ("Confirm arrival" on en_route→arrived) is wired to the unchanged advanceStatus, completing the claim→fulfil loop in the UI.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-21T22:01:45Z
- **Completed:** 2026-06-21T22:04:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `DetailView.tsx`, a `"use client"` island that resolves the next forward lifecycle edge via `ALLOWED_TRANSITIONS` (no hand-rolled order) and renders a single 52px advance Button wired to the existing `advanceStatus(id)`, surfacing a coral `advanceFailedToast` on failure. The en_route→arrived edge is labeled `driverConfirmArrivalCta` ("Confirm arrival", DUI-04); all other edges reuse the existing `advanceTo*Cta` keys.
- Swapped the vertical `LifecycleTimeline` for the horizontal `LifecycleStepper current={status}` (DS-04, Decision 4) and added a `RouteMotif` hero (airport → zone/address) — no live map (Decision 1).
- Replaced every hardcoded English caption ("Arrival"/"Flight"/"Fare"/"Passengers"/"Luggage"/"Guest name"/"Guest phone"/"Notes") with the Plan-01 `t.driver*Label` dictionary keys, behind the tsc EN/BG parity gate.
- Removed the per-page back-link `<header>` (chrome now lives in the Plan-01 layout); D-02 keeps the My Trips tab active on the detail route.

## Task Commits

Each task was committed atomically:

1. **Task 1: DetailView client island (Confirm-Arrival CTA → advanceStatus)** - `b315ae6` (feat)
2. **Task 2: Restyle detail RSC — stepper swap, dictionary captions, island wiring, header removal** - `f46936b` (feat)

## Files Created/Modified
- `app/driver/run/[id]/DetailView.tsx` (created) - `"use client"` advance island: `{ id, status, copy }` props; next-forward-edge resolution via `ALLOWED_TRANSITIONS`; `useTransition` + `advanceStatus(id)`; coral failure Toast; en_route→arrived keyed `driverConfirmArrivalCta`. No release/give-back control (CLAIM-04); no new server action.
- `app/driver/run/[id]/page.tsx` (modified) - LifecycleTimeline→LifecycleStepper import + render swap; RouteMotif hero; all detail-grid captions → `t.driver*Label`; mounts `<DetailView id status copy />`; claiming-driver RLS row read (`from("wp_transfers")…single()`) preserved verbatim; back-link header deleted.

## Decisions Made
- The "Confirm arrival" copy is bound to the en_route→arrived edge by keying `labelByNext[arrived]`, exactly as RunView keys its labels on the resolved next state — so the label tracks the lifecycle, not a hand-rolled status check.
- `RouteMotif` end label falls back zone → address → `t.zoneLabel` so the hero never renders a blank endpoint while still preferring the area name.
- No PII is passed through the island props (only `id`, `status`, `copy`); the full guest contact stays rendered in the RSC, keeping the post-claim PII inside the server boundary.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Threat Flags
None - no new security surface. The Confirm-Arrival CTA invokes the EXISTING `advanceStatus` (auth.uid() identity + `.eq("driver_id", user.id)` ownership + `.eq("status", current)` optimistic guard + `ALLOWED_TRANSITIONS` legal-edge-only) verbatim — no client write, no new action (T-11-11 unchanged). The detail PII render stays behind the claiming-driver RLS read for the owning driver (T-11-12 accept). Caption literals → `t.*` keys is presentation-only (T-11-13 accept). No installs (T-11-SC).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The trip-detail surface is on the design system and feature-complete (stepper + route + advance). Plan 05 (Profile) is the final restyle slice; it must DELETE its own page `<header>` to avoid the transient double-header (Pitfall 1).
- Verification: `npx tsc --noEmit` exits 0 (EN/BG parity for the new caption keys); `npx vitest run app/driver` passes (4 files / 11 tests — advanceStatus untouched, the presentation-only guarantee, D-06).

## Self-Check: PASSED
- FOUND: app/driver/run/[id]/DetailView.tsx
- FOUND: app/driver/run/[id]/page.tsx
- FOUND: commit b315ae6, f46936b

---
*Phase: 11-driver-pwa-rebuild*
*Completed: 2026-06-21*
