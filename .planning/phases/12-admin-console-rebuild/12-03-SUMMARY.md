---
phase: 12-admin-console-rebuild
plan: 03
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, admin-console, transfers-list, client-search, client-sort]

# Dependency graph
requires:
  - phase: 12-admin-console-rebuild
    plan: 01
    provides: "Admin shell (app/admin/layout.tsx) + AdminTopBar client-search seam (onSearchChange) that this plan wires to loaded-rows filtering"
  - phase: 09-design-system
    provides: "StatusDot (+ stateLabel), LifecycleStepper, RouteMotif consumed verbatim"
provides:
  - "Admin transfers list as the pending-transmissions <table> on desktop (Time/ID · Passenger · Route · Lifecycle · Status · Driver · Actions) + the existing <ul> rows reused as the mobile card fallback (D-04)"
  - "Top-bar search filters the ALREADY-LOADED rows client-side (guest_name / flight_no / destination / id) via the admin:search window event — no URL q, no server round-trip (D-01)"
  - "Client sort control (Needs attention default / Soonest arrival / Status) as the SOLE ordering authority over loaded rows (D-02)"
  - "page.tsx: server q/ilike/destination-search machinery retired; role gate + anon-RLS read + .in(status)/attention server filter preserved"
affects: [12-04, 12-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-island client search seam via a window CustomEvent (admin:search) — top bar (layout subtree) → TransfersView (page subtree) without threading a callback through the RSC boundary"
    - "Authority split: status/attention chips = server URL-param re-query (narrow); search + sort = client-side over the loaded set (D-01/D-02)"

key-files:
  created: []
  modified:
    - app/admin/transfers/TransfersView.tsx
    - app/admin/transfers/page.tsx
    - app/admin/_nav/AdminTopBar.tsx

key-decisions:
  - "Top-bar search → TransfersView wired via a window CustomEvent('admin:search') dispatched from AdminTopBar's existing onChange — keeps the Plan-01 layout/shell untouched (no callback threading across the RSC boundary), client-side only, no URL q (D-01)"
  - "Server needsAttention coral PIN partition removed from page.tsx so the client sort is the SOLE ordering authority (D-02 — no hidden server pin underneath); rows hand off in arrival_at ASC natural load order"
  - "driver_id added to TransferRow (already in the existing select — NOT a read-shape change) to render the worded Driver cell (driverUnassigned when null, else stateLabel(status)) — never an empty cell"
  - "Date.now() in the async RSC suppressed with a scoped react-hooks/purity eslint-disable (renders once per request; not a re-rendering hook) — pre-existing lint surfaced by the edited region"

patterns-established:
  - "Pending-transmissions table on desktop + the prior <ul> rows verbatim as the mobile card fallback (D-04 — no new mobile layout invented)"

requirements-completed: [AUI-03, AUI-05]

# Metrics
duration: ~6min
completed: 2026-06-22
---

# Phase 12 Plan 03: Admin Transfers List (table + client search/sort) Summary

**Reworked the admin transfers list into the pending-transmissions `<table>` on desktop with the existing stacked rows reused as the mobile card fallback, wired the shell top-bar search to filter the loaded rows client-side, and added a client sort control as the sole ordering authority — retiring the server `q` search machinery (presentation-only, anon-RLS read shape untouched).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-22T19:37Z (approx)
- **Completed:** 2026-06-22T19:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `TransfersView.tsx` now renders a semantic desktop `<table>` (Time/ID · Passenger · Route · Lifecycle (`LifecycleStepper`) · Status (`StatusDot`) · Driver · Actions (`View` → `/admin/transfers/[id]`)) with the prior stacked `<ul>` rows reused verbatim as the `md:hidden` mobile card fallback (D-04). The coral needs-attention left border + worded badge are preserved in both layouts (WCAG 1.4.1).
- Top-bar search (Plan-01 shell) now filters the **already-loaded** rows client-side across guest name / flight no. / destination (zone/airport) / truncated id, sourced via a `admin:search` window `CustomEvent` — no URL `q`, no server round-trip (D-01). A non-match renders `transfersNoMatchBody`.
- A client sort control (`Needs attention` default / `Soonest arrival` / `Status`) is the sole ordering authority over the loaded rows (D-02); the default reproduces the coral-pin-then-arrival order client-side with no hidden server pin underneath.
- `page.tsx` retired the server `q` searchParam, the `.or(ilike)` name/flight query branch, the in-RSC destination-name search, and the server needsAttention pin partition — while preserving the `getCurrentRole()` admin gate, the anon cookie-bound `wp_transfers` RLS read shape, the parameterized `.in("status", …)` filter, the attention server narrow, and the needsAttention compute.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rework TransfersView — table + mobile cards + client search/sort** — `1c68c8b` (feat)
2. **Task 2: Retire the server `q` search machinery in page.tsx** — `7eccec3` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `app/admin/transfers/TransfersView.tsx` — desktop `<table>` + mobile `<ul>` fallback; client search over loaded rows (admin:search window event) + client sort control; own slate `<header>` and in-page `q` `<form>` removed; widened to `max-w-6xl`; `driver_id` added to `TransferRow` for the worded Driver cell. Exports `TransfersView`, `TransferRow`.
- `app/admin/transfers/page.tsx` — server `q`/ilike/destination-search + needsAttention pin partition retired; role gate + anon-RLS read + `.in(status)`/attention server filter preserved; passes `driver_id` + the new col*/sort* copy bag.
- `app/admin/_nav/AdminTopBar.tsx` — wired the Plan-01 search seam: every `onChange` dispatches the `admin:search` window `CustomEvent` (client-only, no URL `q`); `onSearchChange` prop seam retained.

## Decisions Made
- **Sibling-island search seam via window event.** `AdminTopBar` (layout subtree) and `TransfersView` (page subtree) are separate client islands under different RSC trees — a callback prop cannot cross that boundary without rewriting the Plan-01 layout. A `window.dispatchEvent(new CustomEvent("admin:search", { detail }))` from the top bar, listened to by `TransfersView` via `useEffect`, keeps the shell untouched, stays purely client-side, and adds no URL `q` (honours D-01).
- **Server pin removed for D-02.** The page's prior coral-pin stable sort was deleted so the client sort control is genuinely the sole ordering authority; the RSC now hands rows off in the query's natural `arrival_at` ASC order and the default `needs-attention` client sort re-derives the pin.
- **`driver_id` on the row, not a read-shape change.** `driver_id` was already in the existing `select` (used for `computeNeedsAttention`); surfacing it on `TransferRow` lets the Driver cell render `driverUnassigned` when null vs a worded `stateLabel(status)` otherwise — never an empty cell — without widening the DB read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Date.now()` react-hooks/purity lint error in page.tsx**
- **Found during:** Task 2 (eslint gate)
- **Issue:** `npx eslint app/admin/transfers/page.tsx` failed on `const now = Date.now()` with `react-hooks/purity` ("Cannot call impure function during render"). This error PRE-EXISTED on the original file (confirmed via `git stash` — the line was already there at the same position) but the acceptance criteria requires the eslint run clean.
- **Fix:** Added a scoped `// eslint-disable-next-line react-hooks/purity` with rationale — this is an async RSC that renders once per request (not a re-rendering client hook), so a single wall-clock read is deterministic for the render.
- **Files modified:** `app/admin/transfers/page.tsx`
- **Commit:** `7eccec3`

**2. [Rule 3 - Blocking] AdminTopBar search seam wired (Plan-01 left it presentational)**
- **Found during:** Task 1
- **Issue:** Plan-01's `AdminTopBar` held the search term in local `useState` but did not propagate it; the layout (RSC) mounts it and cannot pass a client callback to the page-subtree `TransfersView`. Without a seam, the AUI-05 client search could not function.
- **Fix:** `AdminTopBar.onChange` now dispatches the `admin:search` window `CustomEvent` (client-only, no URL `q`), which `TransfersView` listens for. One-line additive change; the `onSearchChange` prop seam is retained.
- **Files modified:** `app/admin/_nav/AdminTopBar.tsx`
- **Commit:** `1c68c8b`

_(The grep acceptance check `grep -c '.or('` and `grep -c 'service.role'` return 1–2 on `page.tsx` — these are comment-prose matches only; no `.or()` query branch and no service-role client call remain. The strict code-only grep `query…\.or\(` returns 0. The line-7 "NOT the service-role client" header comment documents the security posture and was left intact.)_

## Threat Surface
No new network endpoints, auth paths, or schema changes. Search + sort operate only over the rows the existing `wp_transfers_admin_read` RLS read already returned (T-12-08); the role gate is preserved before the read (T-12-09); retiring the server `.or(ilike)` removes a string-built filter surface and the new search is a pure in-memory substring match (T-12-10); the page stays read-only — no `paid` writer introduced (T-12-11). No package installs (T-12-SC).

## Known Stubs
None. The Driver cell is intentionally a worded `Unassigned`/state label rather than a fetched driver name — the existing admin read does not carry the driver's display name, and widening the read is out of scope (presentation-only). This is a truthful presentation of available data, not a stub blocking the plan goal.

## Verification
- `npx tsc --noEmit` — exits 0.
- `npx eslint app/admin/transfers/TransfersView.tsx app/admin/transfers/page.tsx app/admin/_nav/AdminTopBar.tsx` — clean.
- `npm test -- --run app/admin/transfers/TransfersView.test.tsx app/admin/transfers/actions.test.ts` — 12/12 pass (the OPS-01 list regression gate + ops semantics unchanged).
- Acceptance greps: `<table` > 0 (3), `<ul` > 0 (2), sort tokens > 0 (8), `driverUnassigned` > 0 (2), `q`-form = 0, own-header = 0, all test tokens (`guest_name`/`flight_no`/`search`/`transfersNoMatchBody`/`needsAttention`/`needsAttentionBadge`/`status`+`filter`) present; `getCurrentRole` > 0, `wp_transfers` read > 0, `.or()` query branch = 0, `q` machinery = 0, `.in("status"` > 0.

## User Setup Required
None — presentation-only; zero backend/schema/auth/RLS/payment changes.

## Next Phase Readiness
- AUI-03 + AUI-05 complete: the transfers list is the pending-transmissions table with working server status/attention filter + client search + client sort.
- Plans 04 (transfer detail — swap LifecycleTimeline→LifecycleStepper, ops verbatim) and 05 (settings hub + light restyle of remaining admin pages, drop per-page headers) remain in this phase.
- Visual review (Phase 11 D-06, end-of-phase): confirm the desktop 7-column table, the mobile stacked cards below the `md` breakpoint, the sort control defaulting to Needs attention, the coral needs-attention rows + text badge, and the top-bar search filtering the loaded set live.

## Self-Check: PASSED

Both modified source files exist on disk; both task commits (`1c68c8b`, `7eccec3`) are present in git history.

---
*Phase: 12-admin-console-rebuild*
*Completed: 2026-06-22*
