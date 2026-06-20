---
phase: 08-platform-health
plan: 02
subsystem: platform-health
tags: [reconciliation, stuck-transfer, keep-alive, cron, stripe, timing-safe-auth, detect-and-alert]

# Dependency graph
requires:
  - phase: 08-platform-health
    plan: 01
    provides: "0008 health_events table (polymorphic, free-form kind incl. keepalive, partial open-index, admin-read RLS, no write policy); 5 Wave-0 RED specs; 15 EN/BG health dictionary keys"
  - phase: 07-notifications
    provides: "insertNotification (notify.ts), sendEmail({tier}) (send-email.ts), createAdminClient header discipline / CR-01 no-JWT read trap (digest.ts)"
  - phase: 03-payments
    provides: "getStripe() server-only client + webhook session.metadata.transfer_id link key"
provides:
  - "reconcile() — Stripe-API-vs-ledger discrepancy detection + per-transfer dedup + in-app + critical-email fan-out (HLTH-02)"
  - "findStuck() — paid-but-unclaimed-within-12h predicate + in-app-only dedup alert (HLTH-04)"
  - "touchHeartbeat() — benign auto-resolved health_events keepalive write defeating the 7-day pause (HLTH-05), no schema change"
  - "runHealthSweep() — sequential reconcile+stuck+keepalive orchestrator (each isolated)"
  - "POST /api/cron/health — timing-safe x-cron-secret-gated nodejs route running the sweep"
affects: [08-03-health-widgets, 08-04-cron-routes, 08-05-live-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detect-and-alert layer: Stripe API is the reconciliation source of truth (catches a never-delivered webhook the DB-only path is blind to); ZERO status:'paid' writes (D-01 money lock)"
    - "Per-entity dedup against the 0008 partial open-index (resolved_at IS NULL) — exactly one alert per discrepancy/stuck transfer"
    - "Timing-safe cron-secret gate (crypto.timingSafeEqual over equal-length buffers), 401 + zero-work-before-pass, accepting both x-cron-secret and Authorization: Bearer"

key-files:
  created:
    - platform/health/reconcile.ts
    - platform/health/stuck.ts
    - platform/health/keepalive.ts
    - platform/health/sweep.ts
    - app/api/cron/health/route.ts
  modified: []

key-decisions:
  - "RED spec is the contract authority: reconcile() returns Discrepancy[] (not void); the stuck export is findStuck() returning StuckRow[] (not detectStuck); the route delegates to a runHealthSweep() seam in platform/health/sweep.ts (the test mocks @/platform/health/sweep). The plan prose named reconcile/detectStuck as void — the failing-test signatures overrode it."
  - "health_events for a reconciliation discrepancy is keyed by entity_id = TRANSFER id (entity_type='transfer'), NOT the Stripe session id — the dedup RED fixture keys its OPEN_EVENTS row on the transfer id, so the discrepancy subject is the transfer."
  - "The 12h stuck arrival bound is applied in JS over the paid+unclaimed candidate set (the RED mock chain supports only .select().eq().is()); the status/driver predicate is at the query layer."
  - "Alert/notification titles are inline EN strings (the 08-01 dictionary has widget-panel keys, not notification/email title keys for these alerts) — mirrors how the webhook stores a pre-rendered title string in the row."
  - "Keep-alive is a benign auto-resolved (resolved_at=now()) insert into the EXISTING health_events table — no new table, no migration edit; the partial open-index excludes it so it never alerts."

patterns-established:
  - "platform/health/sweep.ts as the thin orchestrator seam so the cron route stays a pure auth gate (route.test.ts mocks runHealthSweep)"

requirements-completed: [HLTH-02, HLTH-04, HLTH-05]

# Metrics
duration: 4min
completed: 2026-06-20
---

# Phase 8 Plan 02: Reconcile / Stuck / Keep-alive Detection Summary

**A server-only detect-and-alert layer (Stripe-API reconciliation, paid-but-unclaimed stuck detection, keep-alive heartbeat) behind a timing-safe 15-min cron route — turning the three 08-01 RED specs GREEN while writing ZERO `status:'paid'` (the money single-writer lock holds).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-20T10:21:34Z
- **Completed:** 2026-06-20T10:26:08Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments
- `reconcile()` (HLTH-02): lists recent PAID Stripe Checkout Sessions (server-only key, D-03 source of truth), anti-joins the paid `wp_transfers` set, applies a ~10-min in-flight lookback (no false positives), dedups per discrepant transfer against the open `health_events` index, and fans out an in-app notification + a **critical-tier** email per new discrepancy — non-PII facts only (transfer id / session id), reads no guest contact columns. Catches a never-delivered webhook within one sweep window (the DoD reconciliation net).
- `findStuck()` (HLTH-04): flags paid + unclaimed transfers arriving within 12h (D-04), dedups per transfer, raises an **in-app-only** admin alert — **no email anywhere in stuck.ts** (D-05).
- `touchHeartbeat()` (HLTH-05): a benign auto-resolved (`resolved_at=now()`) `health_events` keepalive insert defeating the 7-day Supabase pause — **no schema change, no new table, no migration edit**; never appears as an open alert.
- `runHealthSweep()` + `POST /api/cron/health`: a `runtime="nodejs"` route with a timing-safe `crypto.timingSafeEqual` `x-cron-secret` gate (also accepting Vercel's `Authorization: Bearer`), 401 + ZERO work on failure (T-08-04/07), running the three workers each isolated so the keep-alive always fires.

## Task Commits

1. **Task 1: Reconciliation detection + critical alert fan-out** — `9215eb3` (feat)
2. **Task 2: Stuck predicate (in-app only) + keep-alive heartbeat** — `d5adb9c` (feat)
3. **Task 3: Authenticated 15-min health route + sweep orchestrator** — `d864555` (feat)

## Files Created
- `platform/health/reconcile.ts` — Stripe-API anti-join discrepancy detection, lookback, per-transfer dedup, in-app + critical-email fan-out; zero paid write; no guest PII.
- `platform/health/stuck.ts` — paid+unclaimed≤12h predicate, per-transfer dedup, in-app-only alert (no email import/call).
- `platform/health/keepalive.ts` — benign auto-resolved health_events keepalive write (no schema change).
- `platform/health/sweep.ts` — `runHealthSweep()` sequential orchestrator (each worker isolated; keep-alive last/guaranteed).
- `app/api/cron/health/route.ts` — nodejs route, timing-safe x-cron-secret / Bearer gate, 401-zero-work, runs the sweep.

## Decisions Made
- **RED-spec signatures overrode the plan prose** where they diverged: `reconcile()` returns `Discrepancy[]`; the stuck export is `findStuck()` (not `detectStuck`) returning `StuckRow[]`; the route imports `runHealthSweep` from `platform/health/sweep.ts` (the route.test.ts mock target). The tests are the contract authority. (See Deviations.)
- Reconciliation `health_events` rows are keyed by **transfer id** (the dedup RED fixture's OPEN_EVENTS keys on the transfer id), with `entity_type='transfer'`.
- The 12h stuck bound and the dedup kind-match are applied in JS over the candidate set to match the RED mock's single-`.eq`-then-`.is` chain.
- Alert titles are inline EN strings (no notification/email title key exists in the 08-01 dictionary for these alert types).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Export names + return types follow the RED specs, not the plan prose**
- **Found during:** Tasks 1-3
- **Issue:** The plan action text specified `reconcile(): Promise<void>` and `detectStuck(): Promise<void>`, and described the route invoking `reconcile(); detectStuck(); touchHeartbeat()` directly. The committed 08-01 RED specs instead pin `reconcile(opts?): Promise<Discrepancy[]>`, the stuck export name `findStuck(opts?): Promise<StuckRow[]>`, and a route that delegates to `runHealthSweep()` mocked from `@/platform/health/sweep`. Following the prose verbatim would leave the RED specs RED.
- **Fix:** Implemented the signatures the tests assert (`reconcile` returns the discrepancy array; exported `findStuck`; added `platform/health/sweep.ts` exporting `runHealthSweep`, which the route calls). Behaviour (detection/dedup/fan-out/in-app-only/keep-alive) is exactly as the plan specifies.
- **Files modified:** platform/health/reconcile.ts, platform/health/stuck.ts, platform/health/sweep.ts, app/api/cron/health/route.ts
- **Commits:** `9215eb3`, `d5adb9c`, `d864555`

**2. [Rule 3 - Blocking] Reconciliation event keyed by transfer id, not session id**
- **Found during:** Task 1 (dedup test)
- **Issue:** The plan action suggested `entity_id=<stripe session id>`, but the dedup RED fixture supplies an OPEN_EVENTS row keyed on the **transfer id** (`t_dupe`) and asserts no second insert fires. Keying on the session id would miss the dedup and fail the test.
- **Fix:** The discrepancy `health_events` row uses `entity_type='transfer'`, `entity_id=<transfer id>`; the session id is retained in the non-PII `detail`.
- **Files modified:** platform/health/reconcile.ts
- **Commit:** `9215eb3`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both are contract-alignment to the committed RED specs; the plan's intended behaviour is fully preserved. No scope change, no architectural change.

## Issues Encountered
- `npm run lint` reports 4 errors + 5 warnings, ALL in pre-existing files unrelated to this plan (driver/admin UI + test files; verified present at HEAD~2). All Plan 08-02 files lint clean. Logged to `.planning/phases/08-platform-health/deferred-items.md`; not fixed (out of scope per the executor SCOPE BOUNDARY rule).

## Known Stubs
None goal-blocking. Live behaviour depends on the FLAGGED 0008 migration being applied (Plan 08-05) and the `CRON_SECRET` Vercel env + Vault secret being set at live-apply — both already tracked as 08-01/08-05 items, not gaps in this code.

## Threat Flags
None — no new trust-boundary surface beyond the route already enumerated in the plan's threat model (the route auth gate, Stripe-API read, and service-role writes are all mitigated as planned).

## Next Phase Readiness
- HLTH-02/04/05 detection logic is complete and unit-green; the 15-min route is the live entry point the 0008 `health-sweep` cron schedule already targets.
- Plan 08-03 (health widgets) consumes the `health_events` rows this layer writes; Plan 08-05 applies 0008 live and sets the `CRON_SECRET` / Vault secret to wire the cron→route auth end-to-end.

## Self-Check: PASSED

All 5 created files exist on disk; all 3 task commits (`9215eb3`, `d5adb9c`, `d864555`) present in git history; the three 08-01 RED specs + single-writer gate are GREEN (11/11), typecheck clean.

---
*Phase: 08-platform-health*
*Completed: 2026-06-20*
