---
phase: 11-driver-pwa-rebuild
plan: 02
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, claim, pii-boundary]

# Dependency graph
requires:
  - phase: 11-driver-pwa-rebuild
    plan: 01
    provides: shared driver layout/header/bell + DriverBottomNav, LuggageIcon, driverUnclaimedBadge + flight/fare/pax/luggage caption keys
  - phase: 09-design-system
    provides: RouteMotif (DS-03), Button (52px CTA), brand coral @theme token
  - phase: 06-driver-views
    provides: wp_pool() masked read, claimAction → claim_transfer atomic RPC, PoolRow shape, focus+25s poll
provides:
  - "app/driver/PoolView.tsx — restyled claim-card pool island (RouteMotif + coral Unclaimed pill + 52px Claim CTA); claim/poll/PII logic verbatim (DUI-01/DUI-05)"
  - "app/driver/page.tsx — pool RSC with bell seed/props removed (layout owns chrome); wp_pool() masked read unchanged"
affects: [11-03-my-trips, 11-04-trip-detail, 11-05-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-claim claim card renders ONLY the 9 masked wp_pool() columns — coral Unclaimed pill is presentation copy over a status='paid' row (no new TransferState / STATE_META edit)"
    - "Per-page <header>/NotificationBell deleted as each surface slice lands — chrome now consolidated in the Plan-01 layout"

key-files:
  created: []
  modified:
    - app/driver/PoolView.tsx
    - app/driver/page.tsx

key-decisions:
  - "Coral Unclaimed badge rendered as a literal coral rounded-full pill (bg-coral + worded driverUnclaimedBadge) rather than StatusDot variant='pill' — StatusDot has no 'unclaimed' state and STATE_META must not be edited (Pitfall 5); a literal pill avoids any TransferState misuse"
  - "Meta row uses labelled per-item captions (flight/fare/pax) + LuggageIcon for luggage; fmtEur returns a bare number so '€' is appended explicitly (matches prior card)"
  - "fmtArrival, the focus+~25s poll, the PoolRow type, and the full claim branch (win → router.push; already_claimed → neutral toast + card removal; else → coral error toast) kept byte-for-byte"

patterns-established:
  - "Claim card layout: top row (arrival date · time + coral Unclaimed pill) → RouteMotif (airport → zone) → flex-wrap non-PII meta row → full-width 52px Claim CTA, all inside rounded-md border-grey/30 bg-white p-[16px] shadow-sm"

requirements-completed: [DUI-01, DUI-05]

# Metrics
duration: 6min
completed: 2026-06-22
---

# Phase 11 Plan 02: Pool Claim-Card Restyle Summary

**The driver Available pool now renders each masked-pool row as a mockup claim card — coral Unclaimed pill, RouteMotif (airport → zone), flight/fare/pax/luggage meta, and a 52px teal Claim CTA — over the unchanged wp_pool() read, atomic claim path, and live poll, with zero guest-PII keys pre-claim.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-22T00:50:00Z
- **Completed:** 2026-06-22T00:56:00Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- Restyled each pre-claim pool row into a claim card per the UI-SPEC "Available claim card" contract: arrival date · pickup time, coral DS-02 Unclaimed pill, `RouteMotif` (airport → zone, never the exact address), a flight · fare · pax · luggage meta row, and a full-width 52px teal "Claim" CTA (DUI-01).
- Preserved the claim path and live refresh verbatim: `claimAction → claim_transfer` atomic RPC, win → `router.push(/driver/run/<id>)`, `already_claimed` → neutral toast + silent card removal, other failures → coral error toast, plus the focus + ~25s `refetchPool` poll (DUI-05).
- Removed the per-page `<header>`/`NotificationBell` from PoolView and dropped the bell seed (`readOwnNotifications`) + `bellInitial`/`bellCopy` props from the pool RSC — the Plan-01 layout now owns the chrome (Pitfall 1, no double bell render).
- Kept `wp_pool()` masked read + `export const dynamic = "force-dynamic"` byte-for-byte; no base-table `wp_transfers` select introduced.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle PoolView into claim cards (preserve claim + poll + PII boundary)** - `1b182a8` (feat)
2. **Task 2: Pool RSC header removal + bell-prop cleanup** - `e147277` (feat)

## Files Created/Modified
- `app/driver/PoolView.tsx` (modified) - Claim-card markup: coral Unclaimed pill + `RouteMotif` + labelled non-PII meta row + LuggageIcon + 52px `Button` CTA. Header/NotificationBell/LanguageToggle and the `bellInitial`/`bellCopy` props removed; root wrapper now a fragment (the layout supplies `<main>`/chrome). `PoolViewCopy` gains `unclaimedBadge` + `flight/fare/passengers/luggage` labels and drops `langToggle`. Claim branch, poll, `fmtArrival`, and the 9-column `PoolRow` unchanged.
- `app/driver/page.tsx` (modified) - Removed the `readOwnNotifications` import + bell seed and the `bellInitial`/`bellCopy` prop bag; passes the new claim-card copy keys. `getCurrentRole()` driver gate, `Promise.all([getDict(), getLang()])`, `rpc("wp_pool")` masked read, `PoolRow` map, and `force-dynamic` all unchanged.

## Decisions Made
- Rendered the coral Unclaimed badge as a literal `bg-coral` rounded-full pill carrying the `driverUnclaimedBadge` label, rather than `StatusDot variant="pill"`. `StatusDot` has no `"unclaimed"` state and `STATE_META` must not be edited (Pitfall 5); a literal pill keeps the presentation coral without any TransferState misuse.
- Meta items use explicit captions from the Plan-01 keys (`driverFlightLabel`/`driverFareLabel`/`driverPassengersLabel`) with `LuggageIcon` + count for luggage; `fmtEur` returns a bare `NN.NN` string so the `€` is appended in the markup (consistent with the prior card).
- Converted PoolView's root from `<main className="min-h-dvh bg-white">` to a fragment because the shared layout (Plan 01) now renders the `min-h-dvh` wrapper and `<main>` — avoids a nested `<main>` and duplicated background.

## Deviations from Plan
None - plan executed exactly as written. (The plan permitted either `StatusDot variant="pill"` styled coral OR a coral `rounded-full` pill; the literal-pill option was chosen as documented above — an allowed choice, not a deviation.)

## Issues Encountered
None.

## Known Stubs
None - the cards are wired to the live masked `wp_pool()` read and the real `claimAction` RPC; no placeholder/mock data.

## Threat Flags
None - no new security surface. The card reads only the 9 masked `wp_pool()` columns (source-grep confirms no `guest_name`/`guest_phone`/`guest_email`/`notes`/exact-`address` token in PoolView.tsx); masking stays structural at the RPC and is never re-implemented in UI (T-11-04 mitigated). The claim path (`claimAction → claim_transfer` atomic UPDATE) and `force-dynamic` (anti-stale-SW, T-11-06) are preserved verbatim.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Available surface is the first user-visible driver capability of the rebuild and is now mockup-styled on the correct data layer. Plans 03–05 (My Trips, Trip Detail, Profile) each still own and must DELETE their own page `<header>` to clear the transient double-header (Pitfall 1).
- Verification: `npx tsc --noEmit` exits 0; `npx vitest run app/driver` passes (4 files / 11 tests, claim/advance logic unchanged).

## Self-Check: PASSED
- FOUND: app/driver/PoolView.tsx
- FOUND: app/driver/page.tsx
- FOUND: commit 1b182a8
- FOUND: commit e147277
- PII gate: PoolView.tsx references zero guest-PII keys (only the 9 masked wp_pool() columns)

---
*Phase: 11-driver-pwa-rebuild*
*Completed: 2026-06-22*
