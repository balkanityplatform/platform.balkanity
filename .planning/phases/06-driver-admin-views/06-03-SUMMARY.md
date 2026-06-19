---
phase: 06-driver-admin-views
plan: 03
subsystem: driver-pwa
tags: [driver, run, lifecycle, server-actions, rls, ownership, pii, i18n, claim]

# Dependency graph
requires:
  - phase: 06-driver-admin-views
    plan: 01
    provides: "ALLOWED_TRANSITIONS + run/advance RED specs (CLAIM-04/05/06) + driver dictionary keys"
  - phase: 06-driver-admin-views
    plan: 02
    provides: "app/driver/actions.ts (claimAction/refetchPool) + /driver/run/<id> win-landing contract + Toast primitive"
  - phase: 05-claim-correctness
    provides: "wp_transfers_claimed_driver_read claiming-driver RLS (own-claim full-PII read)"
provides:
  - "advanceStatus(transferId) — D-13 gated service-role driver write (role + ownership + ALLOWED_TRANSITIONS next edge + .eq status optimistic guard)"
  - "/driver/run My run list ordered by arrival_at ASC with inline single next-step 52px advance CTA"
  - "Completed today collapsed partition (completed rows drop out of the active run, D-06)"
  - "/driver/run/<id> driver detail — full post-claim PII via claiming-driver RLS (the Plan-02 win-landing target); no un-claim control"
affects: [06-05-admin-ops-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Driver-action ownership gate: caller-auth getUser → driver_id===user.id check → service-role write (no driver RLS write policy, Pitfall 1)"
    - "Next-edge resolution via ALLOWED_TRANSITIONS forward filter (exclude cancelled/paid) — never a hard-coded status"
    - "Optimistic-concurrency write: service-role UPDATE with .eq(status,current) so a stale double-advance is a 0-row no-op"
    - "RSC arrival-ASC read + active/completed partition → island; completed rows partitioned into a Completed today <details> section"

key-files:
  created:
    - app/driver/run/page.tsx
    - app/driver/run/RunView.tsx
    - app/driver/run/[id]/page.tsx
  modified:
    - app/driver/actions.ts

key-decisions:
  - "advanceStatus is a gated service-role write (D-13) — NOT a new RLS write policy (would re-open Phase 5's closed no-write surface) and NOT a client write"
  - "Ownership is the only authz gate on the write (service-role bypasses RLS): driver_id === auth.uid(), derived server-side, never a client id (CLAIM-04, Pitfall 1)"
  - "Next status resolved through ALLOWED_TRANSITIONS as the single forward driver edge (never cancelled/paid); migration-0004 trigger is the hard backstop (CLAIM-05)"
  - ".eq(status,current) optimistic-concurrency guard prevents a double-advance race (no read-then-write)"
  - "Run list + detail read on the caller-auth client so the claiming-driver RLS scopes rows to the owner; full PII is legitimate only post-claim (CLAIM-06)"
  - "No un-claim / give-back control anywhere in the driver run surface (CLAIM-04)"
  - "Detail page is a plain RSC (no client island) — no actions live there, so no Server Action is needed"

patterns-established:
  - "Driver write path = caller-auth identity read + ownership check + service-role write + lifecycle-map next edge + optimistic guard"
  - "Completed-today partition via a collapsible <details> fed by the RSC's status split"

requirements-completed: [CLAIM-04, CLAIM-05, CLAIM-06]

# Metrics
duration: 4min
completed: 2026-06-19
---

# Phase 6 Plan 03: Driver "My run" Vertical Slice Summary

**The driver run slice is wired end-to-end: `/driver/run` lists the driver's own active claimed transfers ordered by arrival (soonest first), each card carries a read-only LifecycleTimeline plus a single next-step 52px CTA that advances the one legal forward edge in place via the new D-13 gated service-role `advanceStatus` (role + ownership + ALLOWED_TRANSITIONS + optimistic guard), a completed transfer drops into a "Completed today" collapsed section, and `/driver/run/<id>` shows the full post-claim PII — with no un-claim path anywhere.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-19T12:20:04Z
- **Completed:** 2026-06-19T12:23:55Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- **`advanceStatus(transferId)`** appended to `app/driver/actions.ts` — the one genuinely-new driver write surface (D-13). Reads the caller identity on the caller-auth `createClient()` (`auth.getUser()` + `getCurrentRole()==='driver'`), then the OWNERSHIP gate: the row's `status,driver_id` is read with the service-role client scoped `.eq("driver_id", user.id)` and re-checked `row.driver_id === user.id` (Pitfall 1). The next status is the single forward edge from `ALLOWED_TRANSITIONS[current]` (filtered to exclude `cancelled`/`paid`); the write is a service-role `update({status:next}).eq("id",id).eq("status",current)` optimistic-concurrency guard, then `revalidatePath("/driver/run")`. `claimAction`/`refetchPool` untouched.
- **`app/driver/run/page.tsx`** — driver-guarded RSC; reads the caller's own claimed/active/completed rows on the anon cookie-bound client (claiming-driver RLS is the gate), `.order("arrival_at", {ascending:true})`, partitions ACTIVE vs `completed` in the RSC, hands both lists + the dict prop bag to `<RunView>`.
- **`app/driver/run/RunView.tsx`** — client island; renders active cards arrival-ASC, each with a compact read-only `LifecycleTimeline current={status}` and a single next-step 52px primary CTA whose label is chosen by the next edge (`nextEdgeCta` maps `en_route→Start driving`, `arrived→Mark arrived`, `picked_up→Mark picked up`, `completed→Mark completed`). The CTA calls `advanceStatus(id)` inside a transition (one in flight at a time, disabled while pending); a failure shows the coral `advanceFailedToast`; a `completed` row drops into the "Completed today" collapsible `<details>` section. Run empty state when zero active rows. No un-claim control.
- **`app/driver/run/[id]/page.tsx`** — the Plan-02 win-landing detail RSC; reads the single own row on the caller-auth client (claiming-driver RLS returns it only if `driver_id = auth.uid()`), renders the `LifecycleTimeline`, trip facts (arrival, airport, zone, exact address, flight, fare, pax, luggage) and guest contact (name, phone, notes) — all legitimate post-claim. No give-back control.

## Task Commits

Each task was committed atomically:

1. **Task 1: advanceStatus gated service-role driver write (D-13)** — `67a5515` (feat)
2. **Task 2: My run list + inline advance CTA + Completed today + detail** — `e7582d3` (feat)

## Files Created/Modified
- `app/driver/actions.ts` (MODIFIED — append) — `advanceStatus` D-13 gated service-role write; claimAction/refetchPool untouched.
- `app/driver/run/page.tsx` (NEW) — My run RSC; caller-auth RLS read; arrival-ASC; active/completed partition.
- `app/driver/run/RunView.tsx` (NEW) — run island; read-only timeline + inline advance CTA; Completed today section; no un-claim.
- `app/driver/run/[id]/page.tsx` (NEW) — driver detail RSC; full post-claim PII; no give-back control.

## Decisions Made
- **Gated service-role write, not RLS.** advanceStatus uses the service-role admin client because drivers have NO RLS write policy (Pitfall 1) — adding one would re-open Phase 5's closed no-write surface. The in-action `driver_id === user.id` ownership check is therefore the sole authz gate (D-13).
- **Ownership derived from auth.uid().** The owner is read from the authenticated caller (`getUser`), never from a client-supplied id; the service-role read is additionally scoped `.eq("driver_id", user.id)` and re-checked, so a forged call for another driver's transfer returns no row and writes nothing (CLAIM-04, T-06-EOP1).
- **Next edge through the lifecycle map.** The advance target is `ALLOWED_TRANSITIONS[current].find(s => s!=='cancelled' && s!=='paid')` in both the action and the island's CTA-label resolver — never a hard-coded status. The migration-0004 trigger is the hard legality backstop (CLAIM-05, T-06-LEGAL).
- **Optimistic-concurrency, not read-then-write.** The write carries `.eq("status", current)` so a stale/duplicate advance affects 0 rows (T-06-CONCUR).
- **Reads on the caller-auth client.** Both the run list and the detail read on `createClient()` (anon cookie-bound) so the claiming-driver RLS scopes rows to the owner — never a broad service-role read into the UI (T-06-PII). Full PII is legitimate only because the driver owns the claim.
- **Detail is a plain RSC.** No action runs on the detail page, so it needs no client island or Server Action — keeping the surface minimal.
- **No driver-facing dictionary additions.** The run-list copy uses the Plan-01 keys; the detail page reuses existing label keys (`airportLabel`/`zoneLabel`/`addressLabel`/`myRunTitle`/`langToggle`) plus plain English field labels, so the tsc EN/BG Dict-parity gate is untouched (no new key without a BG counterpart).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a detail-page comment to keep the plan's literal un-claim grep clean**
- **Found during:** Task 2 (acceptance-criteria verification)
- **Issue:** My explanatory comment in `app/driver/run/[id]/page.tsx` used the phrase "NO un-claim / release / give-back control", which made the comment-inclusive `grep -rci 'unclaim\|un-claim' app/driver/run/` non-zero for a production file even though the code has no such control.
- **Fix:** Reworded the comment to "no give-back / release control … once a driver owns a claim it stays theirs" — same intent, no literal `un-claim` token.
- **Files modified:** app/driver/run/[id]/page.tsx
- **Verification:** all three production run files now return 0 for the un-claim grep; the only remaining match is `RunView.test.tsx` (the Plan-01 spec describing the contract, not a control). typecheck clean; CLAIM-06 GREEN.
- **Committed in:** e7582d3 (Task 2 commit)

**2. [Rule 3 - Blocking] Dropped a brittle label-replace hack on the detail guest-contact labels**
- **Found during:** Task 2 (detail page authoring)
- **Issue:** I initially derived the guest name/phone labels from `t.driverNameLabel.replace(/driver/i,"Guest")`, which is fragile and locale-incorrect for BG.
- **Fix:** Used plain "Guest name" / "Guest phone" string labels (consistent with the other plain detail field labels) rather than mangling a driver-scoped dictionary key. No new dictionary keys added (Dict-parity gate untouched).
- **Files modified:** app/driver/run/[id]/page.tsx
- **Verification:** typecheck clean.
- **Committed in:** e7582d3 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking; comment wording + a label hack — zero behavior change to the wired contracts)
**Impact on plan:** Mechanical. The wired contracts (gated ownership-checked write, arrival-ASC run, completed partition, post-claim detail) are exactly as specified.

## Issues Encountered
None beyond the two blocking fixes above.

## Verification Results
- `npm run typecheck` — clean.
- `app/driver/advance.ownership.test.ts` (CLAIM-04) — GREEN.
- `app/driver/advance.lifecycle.test.ts` (CLAIM-05) — GREEN.
- `app/driver/run/RunView.test.tsx` (CLAIM-06) — GREEN (arrival-ASC active order + completed→Completed today partition).
- `platform/payments/single-writer.test.ts` — GREEN (advanceStatus never writes `status='paid'`; it only moves forward driver edges).
- `platform/transfers/lifecycle.test.ts` — GREEN (8×8 pin unaffected).
- Acceptance greps: `driver_id`/`getCurrentRole`/`ALLOWED_TRANSITIONS`/`createAdminClient`/`.eq("status"` all present in actions.ts; claimAction/refetchPool still present; page.tsx `order("arrival_at")`=1 and `createAdminClient`=0; RunView `advanceStatus`/`LifecycleTimeline`/`completedTodayTitle` present; un-claim==0 across all production run files; detail reads caller-auth, `createAdminClient`=0.

## Known Stubs
None. The driver can work a claim claimed→en_route→arrived→picked_up→completed end-to-end from My run; the detail page renders real joined data via RLS. The `claimed→paid` release edge (admin) + migration-0006 live apply remain Plan-05 tasks (not stubs).

## Threat Flags
None. No new security surface beyond the plan's `<threat_model>`. T-06-EOP1 (ownership gate), T-06-LEGAL (ALLOWED_TRANSITIONS forward-only + trigger backstop), T-06-CONCUR (`.eq(status,current)` guard), and T-06-PII (caller-auth claiming-driver RLS reads) are all mitigated as specified. Zero new dependencies (T-06-SC).

## User Setup Required
None.

## Next Phase Readiness
- Plan 05 (admin ops + migration-0006 live apply) is unaffected by this slice; the driver write surface is complete and the single-writer gate stays GREEN.
- The driver can now claim from the pool (Plan 02) and advance the claim to completion (this plan) — the full driver happy path is wired.

## Self-Check: PASSED

All 4 created/modified key artifacts exist on disk; both task commits (`67a5515`, `e7582d3`) are present in git history.

---
*Phase: 06-driver-admin-views*
*Completed: 2026-06-19*
