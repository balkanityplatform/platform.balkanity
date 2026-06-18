---
phase: 03-payments-trust-spine
plan: 02
subsystem: database
tags: [postgres, supabase, rls, stripe, migration, idempotency]

# Dependency graph
requires:
  - phase: 02-supply-onboarding
    provides: "public.is_admin() SECURITY DEFINER helper + destinations table (0002) + admin-read/no-write RLS precedent"
  - phase: 03-payments-trust-spine (plan 01)
    provides: "platform/rls/payments-schema.test.ts source-level contract (RED) this plan turns GREEN"
provides:
  - "supabase/migrations/0003_payments_spine.sql — wp_transfers (minimal money-spine) + webhook_events (audit/idempotency) schema"
  - "wp_transfers table the verified Stripe webhook flips to paid (D-03, BOOK-05)"
  - "webhook_events table with UNIQUE event_id — the insert-first race-safe replay authority (HLTH-01, SC3)"
  - "admin-read/no-write RLS posture on both payment tables (T-03-AC)"
affects: [03-payments-trust-spine plans 03/04/05, 04-transfer, 08-health]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Payment tables reuse the 0002 is_admin() helper (NOT redefined) for admin-read RLS"
    - "wp_ prefix for module tables, UNPREFIXED for platform-generic tables (PLAT-01 seam)"
    - "UNIQUE index as the DB-level idempotency authority (mirrors destinations_slug_key)"

key-files:
  created:
    - supabase/migrations/0003_payments_spine.sql
  modified: []

key-decisions:
  - "wp_transfers carries ONLY the minimal money-spine columns (D-03); Phase 4 ALTERs it to add PII + full lifecycle (D-04)"
  - "webhook_events.event_id is UNIQUE — the insert-first dedup authority the webhook relies on (SC3)"
  - "currency defaults to 'eur'; money is integer EUR minor units end-to-end (D-01, no BGN layer, no floats)"
  - "fee_cents is nullable — populated later from the balance transaction (D-05); Phase 8 backfills"

patterns-established:
  - "Payment-table RLS mirrors 0002 exactly: enable RLS + one admin-read SELECT policy + zero write policies (service-role-only writes)"
  - "Migration header carries the Balkanity-ref guardrail (qyhdogajtmnvxphrslwm only, never Kalvia)"

requirements-completed: [BOOK-05, HLTH-01]

# Metrics
duration: 3min
completed: 2026-06-18
---

# Phase 3 Plan 2: Payments-Spine Migration Summary

**Authored migration 0003 — minimal `wp_transfers` money-spine table + `webhook_events` audit/idempotency log (UNIQUE event_id), both RLS-enabled admin-read/no-write — turning the source-level schema contract GREEN.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-18T17:20:52Z
- **Completed:** 2026-06-18T17:22:05Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Authored `supabase/migrations/0003_payments_spine.sql` mirroring the Phase 2 `0002` RLS shape exactly.
- `wp_transfers`: minimal money-spine columns (D-03) with `destination_id` FK `on delete restrict`, integer EUR `amount_cents` (CHECK >= 0), `currency` default `'eur'`, nullable `fee_cents`, `status`, `paid_at`, and the two Stripe id columns.
- `webhook_events`: audit + idempotency log (HLTH-01) with `event_id`/`type`/`signature_result`/`outcome`/`payload`, plus `webhook_events_event_id_key` UNIQUE index (SC3 replay authority).
- Both tables RLS-enabled with a single admin-read SELECT policy each (reusing `public.is_admin()` from 0002 — NOT redefined) and ZERO write policies (service-role-only writes; T-03-AC).
- Turned `platform/rls/payments-schema.test.ts` from RED → GREEN (7/7 passing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 0003 — wp_transfers (minimal) + webhook_events + RLS** - `6aa408e` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/0003_payments_spine.sql` - FLAGGED payments-spine schema: `wp_transfers` money-spine table + `webhook_events` audit/idempotency log, admin-read/no-write RLS, UNIQUE `event_id`, Balkanity-ref guardrail header.

## Decisions Made
None new beyond plan — followed the plan and the 0002 precedent exactly. (Key decisions encoded: minimal wp_transfers per D-03, UNIQUE event_id per SC3, EUR/integer-cents per D-01, nullable fee_cents per D-05.)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The contract test was confirmed RED (migration absent), the migration was authored to satisfy every assertion, and the test went GREEN (7/7) on first run.

## User Setup Required
None - no external service configuration in this plan.

**IMPORTANT:** This plan authored the migration FILE ONLY. It was NOT applied to any live database. No `supabase db push` was run. The signed-off live apply to the Balkanity project (ref `qyhdogajtmnvxphrslwm`, NEVER Kalvia `utyatpadtibqqswsfvtr`) is the BLOCKING task in Plan 05 (D-04), via the Supabase CLI/Management token — never MCP.

## Next Phase Readiness
- `wp_transfers` + `webhook_events` schema authored; the webhook single-writer (Plan 04) and signed-off live apply (Plan 05) can proceed against a real table contract.
- The source-level schema contract is locked green in CI — any future weakening (added write policy, dropped admin gate, dropped UNIQUE event_id) will fail fast.
- Remaining Phase 3 contract tests (single-writer / route-contract / checkout / fee) stay RED until Plans 03-04 implement them.

## Self-Check: PASSED
- `supabase/migrations/0003_payments_spine.sql` — FOUND
- Commit `6aa408e` — FOUND
- `npx vitest run platform/rls/payments-schema.test.ts` — 7/7 GREEN

---
*Phase: 03-payments-trust-spine*
*Completed: 2026-06-18*
