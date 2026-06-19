---
phase: 06-driver-admin-views
plan: 04
subsystem: admin-console
tags: [nextjs, rsc, rls, supabase, i18n, a11y, pwa, search]

# Dependency graph
requires:
  - phase: 06-driver-admin-views
    plan: 01
    provides: "Phase-6 EN/BG dict keys + the OPS-01 TransfersView RED spec this plan turns GREEN"
  - phase: 04-transfer-entity
    provides: "wp_transfers PII + lifecycle columns + wp_transfers_admin_read RLS"
  - phase: 05-claim-correctness
    provides: "the masked wp_pool() pool (this admin read is its UNMASKED counterpart)"
provides:
  - "/admin/transfers list: admin-guarded RSC, unmasked admin-RLS read, status filter + name/flight/destination search + needsAttention coral pinning (D-07/D-08/D-09)"
  - "/admin/transfers/[id] detail: lifecycle timeline + trip/payment facts + 5 disabled ops-action LABEL placeholders for Plan 05 to wire"
  - "console nav link to /admin/transfers"
  - "OPS-01 TransfersView RED spec turned GREEN (5/5)"
affects: [06-05-admin-ops-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchParams-driven RSC re-query: client island writes URL params (router.replace), the RSC owns the .in/.or filter + in-RSC destination search + needsAttention compute + stable coral-pin sort"
    - "needsAttention pilot constants (D-09): unclaimed-paid always coral; near-arrival-unclaimed + arrived-stalled via simple hour constants; UI highlight only, no alerts"
    - "label-only disabled action placeholders so a read-only slice renders the next plan's controls without importing or wiring the action"

key-files:
  created:
    - app/admin/transfers/page.tsx
    - app/admin/transfers/TransfersView.tsx
    - app/admin/transfers/[id]/page.tsx
    - app/admin/transfers/[id]/TransferDetailView.tsx
  modified:
    - app/admin/page.tsx

key-decisions:
  - "needsAttention thresholds: NEAR_ARRIVAL_UNCLAIMED_HOURS=6, ARRIVED_STALL_HOURS=2 (planner discretion, D-09); unclaimed-paid is always coral regardless"
  - "Destination-name search done in-RSC after the .or(name/flight) query (RESEARCH A3, pilot volume) — the query layer stays parameterized"
  - "Filter/search state lives in the URL (router.replace), so the RSC re-queries server-side — no client-side row filtering that would mask un-fetched rows"
  - "Detail trip/payment field labels reuse existing dict keys where present (addressLabel/zoneLabel/airportLabel/emailLabel); the remaining fact labels are inline (no dict keys exist; detail layout is planner discretion per the plan)"

patterns-established:
  - "URL-searchParams re-query island over an RSC-owned filtered/sorted read"

requirements-completed: [OPS-01, OPS-02]

# Metrics
duration: 4min
completed: 2026-06-19
---

# Phase 6 Plan 04: Admin Transfers List + Detail Summary

**Admin can now find, triage, and open any transfer: `/admin/transfers` reads unmasked rows via admin RLS, applies status filter + needs-attention quick filter + name/flight/destination search, and renders soonest-arrival-first with coral needs-attention rows pinned-and-badged; `/admin/transfers/[id]` shows the lifecycle timeline + trip/payment facts with disabled ops-action placeholders for Plan 05.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-19T12:12:29Z
- **Completed:** 2026-06-19T12:16:01Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Built the OPS-01 admin transfers list: admin-guarded RSC reading ALL rows through the anon cookie-bound client (`wp_transfers_admin_read` RLS is the data gate — never service-role), joined to destination, ordered `arrival_at` ASC.
- Status filter via parameterized `.in("status", …)`, name/flight search via `.or(ilike)` (filter metacharacters stripped), destination-name search in-RSC (pilot volume).
- `needsAttention` computed per row with simple D-09 pilot constants (unclaimed-paid always coral; near-arrival-unclaimed at 6h; arrived-stalled at 2h); coral rows stable-sorted to the top (D-07), each carrying the `needsAttentionBadge` TEXT marker (WCAG 1.4.1, never colour alone).
- `TransfersView` island: status chips + needs-attention quick filter + search box that write the URL searchParams (router.replace) to re-query server-side; per-row `StatusDot`; rows link to detail; empty (`transfersEmptyHeading/Body`) vs filtered-empty (`transfersNoMatchBody`) states; ≥44px hit targets.
- Built the OPS-02 detail: admin-guarded RSC reading the single unmasked row joined to destination (exact address); `TransferDetailView` renders `LifecycleTimeline current={row.status}` + trip facts (guest contact, arrival, flight, airport/zone/address, pax, luggage, notes) + payment facts (fare, Stripe fee, paid_at, payment intent); five disabled ops-action LABEL placeholders (no action import — Plan 05 wires them); neutral not-found state.
- Added the Transfers link to the admin console nav.
- Turned the Plan-01 OPS-01 `TransfersView.test.tsx` RED spec GREEN (5/5).

## Task Commits

Each task was committed atomically:

1. **Task 1: Transfers list RSC + filter/search/sort + coral pinning island + console nav** - `6a91ce1` (feat)
2. **Task 2: Transfer detail page (lifecycle + trip/payment facts)** - `83c7ccf` (feat)

## Files Created/Modified
- `app/admin/transfers/page.tsx` (NEW) - list RSC; admin guard; unmasked admin-RLS read; `.in` status filter + `.or(ilike)` search + in-RSC destination search; needsAttention compute + coral-pinned-then-arrival sort.
- `app/admin/transfers/TransfersView.tsx` (NEW) - slate console island; status chips + needs-attention quick filter + search box (URL re-query); StatusDot per row; coral `needsAttentionBadge`; rows link to detail.
- `app/admin/transfers/[id]/page.tsx` (NEW) - detail RSC; admin guard; single unmasked row + joined destination; neutral not-found.
- `app/admin/transfers/[id]/TransferDetailView.tsx` (NEW) - detail island; LifecycleTimeline + trip/payment facts; five disabled ops-action label placeholders.
- `app/admin/page.tsx` - console nav gains `{ href: "/admin/transfers", label: t.transfersTitle }`.

## Decisions Made
- **needsAttention pilot constants.** Unclaimed-paid is always coral; near-arrival-unclaimed uses a 6h constant and arrived-stalled a 2h constant — simple, UI-highlight-only, no alerts (D-09 planner discretion).
- **In-RSC destination search.** Guest-name/flight search runs at the query layer (`.or(ilike)`); destination zone/airport search runs in-RSC after the read (RESEARCH A3, pilot volume) so the query stays parameterized.
- **URL-driven filter/search.** Filter/search state lives in the URL and the RSC re-queries server-side, so the list never client-side-filters un-fetched rows.
- **Inline detail labels.** Trip/payment fact labels reuse the existing dict keys where they exist (address/zone/airport/email); the rest are inline because no dict keys exist and the detail layout is explicitly planner discretion in the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None encountered. The pages use the standard `getCurrentRole()` server-side admin guard (no external auth/login flow in this read-only slice).

## Issues Encountered
None.

## Known Stubs
The five ops-action buttons on the detail page (assign/reassign/release/cancel/refund) are intentional, plan-specified LABEL-only placeholders: rendered disabled with no `onClick` and no action import. This is by design — the plan scopes action wiring to Plan 05 (OPS-03/OPS-04), which hangs the server actions on this detail page. Not a goal-blocking stub: this plan's goal (read-only triage: find/filter/search/open) is fully achieved.

## Threat Flags
None. No new security surface beyond the plan's `<threat_model>`:
- T-06-AC1 (EoP): `getCurrentRole()==='admin'` server guard on both pages; non-admin → redirect.
- T-06-INJ (Tampering): status filter via `.in`, search via `.or(ilike)` with metacharacters stripped — parameterized PostgREST, no string-built SQL; admin RLS scopes the read.
- T-06-COLOR (a11y): needs-attention rows always carry the `needsAttentionBadge` text marker.
- T-06-STALE (Integrity): `/admin/*` is NetworkFirst at the SW layer (app/sw.ts authNetworkFirst) — detail data is never stale-served.
- T-06-SC: zero new package installs.

## Test Status
- `npm run typecheck`: clean.
- `npx vitest run app/admin/transfers/TransfersView.test.tsx`: 5/5 GREEN (OPS-01 RED→GREEN).
- Full suite: the 14 remaining failures are the expected Plan-02/03/05 RED-by-absence specs (driver advance/run, admin actions, refund) whose consumers are not built yet — none are in this plan's scope and none were introduced by this work.

## User Setup Required
None - no external service configuration required in this plan.

## Next Phase Readiness
- Plan 05 (admin ops apply) hangs `assign/reassign/release/cancel` (OPS-03) + `refund` (OPS-04) server actions on the five LABEL placeholders already laid out in `TransferDetailView.tsx`; replace the disabled buttons with wired controls (no layout work needed).
- Plan 05 must also apply migration 0006 LIVE to Balkanity (qyhdogajtmnvxphrslwm) via the Management API (still authored-not-applied from Plan 01).

## Self-Check: PASSED

All 4 created + 1 modified key artifacts exist on disk; both task commits present in git history.

---
*Phase: 06-driver-admin-views*
*Completed: 2026-06-19*
