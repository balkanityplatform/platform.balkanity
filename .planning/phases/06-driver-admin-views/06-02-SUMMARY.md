---
phase: 06-driver-admin-views
plan: 02
subsystem: driver-pwa
tags: [driver, pool, claim, rls, pii-masking, pwa, serwist, server-actions, i18n]

# Dependency graph
requires:
  - phase: 05-claim-correctness
    provides: "wp_pool() masked read RPC + claim_transfer atomic RPC + claimTransfer caller-auth wrapper"
  - phase: 06-driver-admin-views
    plan: 01
    provides: "Phase-6 EN/BG driver dictionary keys + the pool.masking RED-by-absence gate this plan turns GREEN"
provides:
  - "Driver pool vertical slice: /driver reads the masked wp_pool() RPC and renders limited-detail cards (CLAIM-01)"
  - "claimAction server action (caller-auth claimTransfer wrapper, never service-role) + refetchPool poll action"
  - "Win -> /driver/run/<id> navigation contract (winner renders full PII from the RPC's returned row); lose -> neutral toast + card removal (D-03)"
  - "platform/ui/Toast.tsx neutral/coral transient toast primitive"
  - "NetworkFirst SW rule for the /driver pool DATA path (Pitfall 4)"
  - "No driver-facing un-claim control (CLAIM-04)"
affects: [06-03-driver-run]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Masked RPC read in the RSC (.rpc('wp_pool')) — structural PII omission, never a base-table select"
    - "Live client poll = focus-refetch + ~25s visible-tab interval, calling the SAME masked server action as the page"
    - "Win-from-returned-row: the claim RPC returns the full row, so the winner navigates with NO follow-up PII fetch"
    - "Driver warm-light chrome (white header + logo chip + teal accents) vs the admin slate console — same page->island shape"

key-files:
  created:
    - app/driver/page.tsx
    - app/driver/PoolView.tsx
    - app/driver/actions.ts
    - platform/ui/Toast.tsx
  modified:
    - app/sw.ts

key-decisions:
  - "Pool read is the masked wp_pool() RPC only — zero guest-PII keys on the pool path (CLAIM-01/CLAIM-03, Pitfall 11)"
  - "claimAction is a thin pass-through to the caller-auth claimTransfer; NO service-role on the claim path (D-04)"
  - "A losing claim is neutral (toast + silent card removal), never an error state (D-03)"
  - "Winner renders from the RPC's returned row — no follow-up PII fetch from the island (Pitfall 7)"
  - "No un-claim control anywhere in the driver UI (CLAIM-04)"
  - "Driver pool DATA path forced NetworkFirst in app/sw.ts (a non-document /driver rule added alongside the existing document rule)"

patterns-established:
  - "RSC masked-RPC read + dictionary prop-bag -> client island (mirrors app/admin/drivers, swapped to driver warm-light chrome)"
  - "Pool poll via a server action that reuses the page's masked read so the poll can never widen the PII surface"

requirements-completed: [CLAIM-01, CLAIM-04]

# Metrics
duration: 4min
completed: 2026-06-19
---

# Phase 6 Plan 02: Driver Pool Vertical Slice Summary

**The driver pool slice is wired end-to-end: `/driver` reads the masked `wp_pool()` RPC and renders limited-detail cards, the Claim CTA calls the caller-auth `claimTransfer` (never service-role), a win navigates to `/driver/run/<id>` (full PII renders there from the RPC's returned row) and a loss shows a neutral toast + silently removes the card — with the pool kept live via focus + ~25s poll and NetworkFirst so it is never SW-cached.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-19T12:05:00Z
- **Completed:** 2026-06-19T12:08:29Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `app/driver/page.tsx` — driver-guarded RSC (`getCurrentRole()==='driver'` else redirect to `/sign-in`) reading the masked `wp_pool()` RPC on the anon cookie-bound caller-auth client; zero guest-PII keys on the pool path; warm-light chrome (white header + logo chip + teal accents) with the dictionary-resolved copy prop bag.
- `app/driver/PoolView.tsx` — client island rendering the 9 masked columns as warm-light cards with a 52px primary Claim CTA + `StatusDot state="paid"`; live refresh via window-focus refetch + a ~25s interval poll while the tab is visible; win→`/driver/run/<id>`, lose→neutral toast + card removal, other reason→coral toast; one in-flight claim at a time (no double-submit); no un-claim control (CLAIM-04).
- `app/driver/actions.ts` — `claimAction` (thin caller-auth `claimTransfer` wrapper, never `createAdminClient`) + `refetchPool` (re-reads the same masked `wp_pool()` for the poll). `advanceStatus` intentionally left for Plan 03.
- `platform/ui/Toast.tsx` — presentational transient toast; neutral grey default (the lost-claim toast is NOT an error, D-03), coral only for genuine errors; `role="status"`/`role="alert"` accordingly; auto-dismiss.
- `app/sw.ts` — added a `driverPoolDataNetworkFirst` runtime-caching rule (non-document `/driver` requests) so the pool DATA path is NetworkFirst and never served stale from the SW cache (Pitfall 4 / T-06-STALE).

## Task Commits

Each task was committed atomically:

1. **Task 1: Driver pool RSC + masked read + Toast primitive** — `ac6fe2d` (feat)
2. **Task 2: Pool island (focus/poll refetch) + claimAction win/lose branching + SW NetworkFirst** — `4d3923d` (feat)

## Files Created/Modified
- `app/driver/page.tsx` (NEW) — driver-guarded RSC; `.rpc("wp_pool")` masked read; prop bag → `<PoolView>`.
- `app/driver/PoolView.tsx` (NEW) — pool island; focus/poll refetch; Claim CTA; win→run, lose→neutral toast + card removal; no un-claim control.
- `app/driver/actions.ts` (NEW) — `claimAction` (caller-auth wrapper) + `refetchPool`; no service-role.
- `platform/ui/Toast.tsx` (NEW) — neutral/coral transient toast.
- `app/sw.ts` (MODIFIED) — NetworkFirst rule for the `/driver` pool data path.

## Decisions Made
- **Masked RPC, not a base-table select.** The pool read is `.rpc("wp_pool")` on the caller-auth client — structural PII omission (the function never selects guest contact / exact address / notes), satisfying CLAIM-01/CLAIM-03 and the Plan-01 `pool.masking.test.ts` gate (now GREEN).
- **Caller-auth only on the claim path.** `claimAction` is a thin pass-through to `claimTransfer`; it never imports `createAdminClient` — service-role would null `auth.uid()` and break the claim (D-04).
- **Lose is neutral.** A `reason==='already_claimed'` loss shows the neutral Toast and silently drops the card — never an error state (D-03). Only a genuine transport/claim failure uses the coral tone.
- **Win renders from the returned row.** The claim RPC returns the winner's full row, so the island just navigates to `/driver/run/<id>` with NO follow-up PII fetch (Pitfall 7).
- **Pool data is NetworkFirst.** Added a non-document `/driver` rule in `app/sw.ts` so live pool/claim state is never served stale from the SW cache (Pitfall 4); the graceful `already_claimed` branch is the second line of defence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded source comments to keep the plan's literal acceptance-criteria greps clean**
- **Found during:** Tasks 1 & 2 (acceptance-criteria verification)
- **Issue:** The plan's acceptance criteria use raw `grep -c` (comment-inclusive) and require `from("wp_transfers")`==0 and PII-key==0 in `page.tsx`, and `unclaim|un-claim|release`==0 in `PoolView.tsx`. My explanatory header comments mentioned `.from("wp_transfers").select`, the PII column names, and "un-claim / release control", which made those comment-inclusive greps non-zero even though the code itself is clean.
- **Fix:** Reworded the comments to convey the same intent without the literal tokens (e.g. "base-table transfers select", "guest contact PII", "no such control exists here").
- **Files modified:** app/driver/page.tsx, app/driver/PoolView.tsx
- **Verification:** all plan greps now return the required counts; `npm run typecheck` clean; both gate tests GREEN.
- **Committed in:** ac6fe2d (page.tsx) / 4d3923d (PoolView.tsx)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking, comment wording only — zero behavior change)
**Impact on plan:** Mechanical. The wired contracts are exactly as specified.

## Issues Encountered
None beyond the comment-wording fix above.

## Verification Results
- `npm run typecheck` — clean.
- `platform/transfers/pool.masking.test.ts` (Plan-01 CLAIM-01 gate) — GREEN (now satisfied by the wired `wp_pool` read; zero PII keys; `flight_no` present).
- `platform/payments/single-writer.test.ts` — GREEN (no new `status='paid'` writer; the claim path only moves paid→claimed inside the RPC).
- Acceptance greps: `getCurrentRole`/`redirect` present; `rpc("wp_pool")`==1; `from("wp_transfers")`==0; PII keys==0 in page; `createAdminClient`==0 in actions; `claimTransfer` wrapped; `/driver/run`==2 in PoolView; `unclaim|un-claim|release`==0; `NetworkFirst` present in sw.ts.

## Known Stubs
None. The win-path navigates to `/driver/run/<id>` — that run detail page is the Plan-03 deliverable (the push target is the agreed contract, not a stub). `app/driver/actions.ts` intentionally omits `advanceStatus`, which Plan 03 adds to the same file.

## Threat Flags
None. No new security surface beyond the plan's `<threat_model>`. T-06-PII (masked RPC read), T-06-RACE / T-06-CLIENT (caller-auth `claimTransfer` only, no read-then-write, no service-role), and T-06-STALE (NetworkFirst pool data path) are all mitigated as specified. Zero new dependencies (T-06-SC).

## User Setup Required
None.

## Next Phase Readiness
- Plan 03 (driver run detail) receives: the `/driver/run/<id>` navigation contract, the open `app/driver/actions.ts` (add `advanceStatus`), the `claimed` row's full PII rendered from the claim RPC, and the Toast primitive for the advance-failed feedback.
- The `claimed->paid` release edge + migration 0006 live apply remain Plan-05 (signed-off) tasks.

## Self-Check: PASSED

All 5 created/modified key artifacts exist on disk; both task commits (`ac6fe2d`, `4d3923d`) are present in git history.

---
*Phase: 06-driver-admin-views*
*Completed: 2026-06-19*
