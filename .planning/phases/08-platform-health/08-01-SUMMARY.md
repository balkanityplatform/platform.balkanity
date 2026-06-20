---
phase: 08-platform-health
plan: 01
subsystem: database
tags: [pg_cron, pg_net, supabase, vault, rls, vitest, i18n, reconciliation, cron]

# Dependency graph
requires:
  - phase: 07-notifications
    provides: "email_log (daily-count query) + sendDueDigests() + send-email.ts soft-cap; is_admin() (0002); wp_transfers money spine"
provides:
  - "FLAGGED migration 0008_platform_health.sql (file only): pg_cron + pg_net extensions, health_events table (polymorphic, free-form kind incl. keepalive, admin-read RLS, no write policy), health_events_open_idx partial index, 2 idempotent cron schedules (health-sweep */15, digest-hourly 0 *) via Vault x-cron-secret"
  - "5 Wave-0 RED specs: reconcile (HLTH-02), stuck (HLTH-04), 2 cron-route auth gates, email-cap gauge (HLTH-03)"
  - "15 Phase-8 EN/BG health dictionary keys (Dict-parity gate green)"
affects: [08-02-reconcile-stuck-keepalive, 08-03-health-widgets, 08-04-cron-routes, 08-05-live-apply]

# Tech tracking
tech-stack:
  added: [pg_cron, pg_net]
  patterns: ["FLAGGED authored-not-applied migration", "Vault-stored cron secret + pg_net→Next-route auth-by-header", "Nyquist RED-by-absence via runtime-string dynamic import + comment-stripped source-grep"]

key-files:
  created:
    - supabase/migrations/0008_platform_health.sql
    - platform/health/reconcile.test.ts
    - platform/health/stuck.test.ts
    - app/api/cron/health/route.test.ts
    - app/api/cron/digest/route.test.ts
    - app/admin/health/EmailCapGauge.test.tsx
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts

key-decisions:
  - "health_events: polymorphic entity_type/entity_id (NO transfer_id, SC#1), entity_id TEXT (Stripe ids not uuid), kind free-form text with NO CHECK constraint (comment documents reconciliation_discrepancy | stuck_unclaimed | keepalive; keepalive auto-resolved heartbeat never alerts)"
  - "Migration FILE-ONLY: extensions create-if-not-exists FIRST (Pitfall 6), idempotent unschedule-then-schedule, Vault decrypted_secrets x-cron-secret header, balkanityplatformproject.vercel.app receiver; live apply deferred to Plan 05 with sign-off"
  - "RLS single admin-read SELECT via is_admin() (0002, not redefined); ZERO write policies → service-role-only writes (no-write-policy lock holds)"
  - "5 RED specs via runtime-string dynamic import + typed cast (tsc-clean before impl) and comment-stripped source-grep belts; Stripe/admin/Resend always mocked"
  - "EmailCapGauge thresholds at the 80/90 boundaries with default cap 90 (EMAIL_SOFT_CAP, D-07); figure '{sent} / {cap}' + worded label (WCAG 1.4.1)"

patterns-established:
  - "Pattern 1: pg_cron→pg_net→Next route handler authenticated by a Vault-stored shared secret, idempotent reschedule block"
  - "Pattern 2: cron-route RED spec asserts 401 + zero-work on bad/missing x-cron-secret and worker-invoked + 200 on correct secret"

requirements-completed: [HLTH-02, HLTH-03, HLTH-04, HLTH-05]

# Metrics
duration: 9min
completed: 2026-06-20
---

# Phase 8 Plan 01: Platform-health foundation Summary

**FLAGGED 0008 migration (pg_cron/pg_net + polymorphic health_events + 2 idempotent Vault-authenticated cron schedules, file-only), 5 Wave-0 RED specs, and 15 EN/BG health dictionary keys — the shared non-overlapping slice every Phase-8 implementation slice builds on.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-20T13:10:00Z
- **Completed:** 2026-06-20T13:20:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Authored `0008_platform_health.sql` (FILE ONLY): `create extension` pg_cron + pg_net first; `health_events` table (polymorphic entity_type/entity_id, NO transfer_id, entity_id TEXT, free-form `kind` with no CHECK, partial open-index, admin-read RLS, zero write policies); two idempotent cron schedules (`health-sweep` */15, `digest-hourly` 0 *) calling `net.http_post` with a Vault `x-cron-secret` header. Live apply deferred to Plan 05.
- Landed 5 Wave-0 Nyquist RED specs (all RED-by-absence, typecheck green): reconcile detection/lookback/dedup (HLTH-02), stuck predicate + in-app-only (HLTH-04), both cron-route x-cron-secret auth gates, email-cap gauge ok/warning/at-cap states (HLTH-03).
- Added all 15 Phase-8 EN health keys (verbatim from 08-UI-SPEC) + BG parity keys; Dict-parity gate and typecheck stay green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 0008_platform_health.sql (file only)** - `07e1559` (feat)
2. **Task 2: Wave-0 RED specs (reconcile, stuck, 2 cron routes, email-cap gauge)** - `06df9df` (test)
3. **Task 3: Add 15 Phase-8 EN + BG dictionary keys** - `f85d98f` (feat)

## Files Created/Modified
- `supabase/migrations/0008_platform_health.sql` - FLAGGED authored-not-applied migration: extensions, health_events, partial index, RLS, 2 cron schedules
- `platform/health/reconcile.test.ts` - HLTH-02 RED contract: detection, lookback no-false-positive, dedup, never-writes-paid belt
- `platform/health/stuck.test.ts` - HLTH-04 RED contract: stuck predicate + no-sendEmail source-grep (D-05)
- `app/api/cron/health/route.test.ts` - health cron x-cron-secret auth gate (401 + zero work / 200 + worker invoked)
- `app/api/cron/digest/route.test.ts` - digest cron auth gate + sendDueDigests awaited (D-10)
- `app/admin/health/EmailCapGauge.test.tsx` - HLTH-03 gauge ok/warning/at-cap states at 80/90, default cap 90
- `platform/i18n/en.ts` - 15 Phase-8 EN health source strings
- `platform/i18n/bg.ts` - 15 BG parity translations

## Decisions Made
- Reworded the migration's `comment on table` to describe the deliberately-omitted kind constraint without the literal `CHECK (kind ...)` substring, so the required documentation of the keepalive allowance coexists with the Task-1 verify grep (`! grep -Eiq "check \(kind"`). Same intent, no actual constraint — the table genuinely has no CHECK on `kind`. (See Deviations.)
- `single-writer.test.ts` ROOTS already includes `app` + `platform`, so the gate auto-covers `app/api/cron/*` and `platform/health/*` — no edit needed (confirmed GREEN, 3/3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded migration comment to satisfy the Task-1 verify grep**
- **Found during:** Task 1 (Author migration 0008)
- **Issue:** The plan's Task-1 action text requires the `comment on table` to document that if a kind constraint "is ever introduced it MUST include 'keepalive'", but the plan's own verify gate asserts `! grep -Eiq "check \(kind"` — a case-insensitive match that the phrase "CHECK (kind in (...))" in that very comment would trip, failing the gate.
- **Fix:** Reworded the comment to "A constraint restricting the allowed kinds is deliberately omitted; if one is ever added it MUST allow 'keepalive'." — preserving the documented intent (no constraint; keepalive must always be allowed) while removing the literal `CHECK (kind` substring. The table still has NO CHECK constraint on `kind`.
- **Files modified:** supabase/migrations/0008_platform_health.sql
- **Verification:** Task-1 grep gate now prints `PASS`; no write policies; all required greps (extensions, health_events, is_admin, refs, cron jobs, keepalive) pass.
- **Committed in:** `07e1559` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Cosmetic comment wording only; the schema and documented behaviour are exactly as the plan specifies (free-form `kind`, keepalive allowed, no CHECK constraint). No scope change.

## Issues Encountered
None beyond the deviation above.

## Known Stubs

These are INTENTIONAL Wave-0 baselines / deferred-apply artifacts, each resolved by a named later plan — not goal-blocking gaps:

| Artifact | Reason | Resolved by |
|----------|--------|-------------|
| `0008_platform_health.sql` authored-not-applied | Schema is FLAGGED; live apply needs sign-off (CLAUDE.md review gate) | Plan 08-05 (live apply via Management API) |
| `platform/health/reconcile.ts` / `stuck.ts` (referenced by RED specs, not yet present) | Nyquist RED baseline; specs RED-by-absence by design | Plan 08-02 |
| `app/api/cron/health/route.ts` / `digest/route.ts` (referenced by RED specs) | Nyquist RED baseline | Plan 08-02 / 08-04 |
| `app/admin/health/EmailCapGauge.tsx` (referenced by RED spec) | Nyquist RED baseline | Plan 08-03 |

## User Setup Required
None in this plan. (Out-of-band setup happens at Plan 08-05 live apply: create the Vault `cron_secret` and set the matching Vercel `CRON_SECRET` env — documented in the migration header and 08-RESEARCH.)

## Next Phase Readiness
- The single migration file every Plan-8 live-apply depends on is authored and FLAGGED; the RED test baseline that makes each later slice verifiable is in place; the EN/BG copy keys the admin widgets consume exist.
- Zero file overlap between this slice and the Wave-2 slices (Plans 02/03/04), so they can run in parallel.
- Blocker carried forward: live apply of 0008 (Plan 05) requires schema sign-off and the one-time Vault secret / Vercel env setup; Resend verified-domain + pg_cron ≥1.6.4 already verified on Balkanity.

## Self-Check: PASSED

All 8 created/modified files exist on disk; all 3 task commits (`07e1559`, `06df9df`, `f85d98f`) present in git history.

---
*Phase: 08-platform-health*
*Completed: 2026-06-20*
