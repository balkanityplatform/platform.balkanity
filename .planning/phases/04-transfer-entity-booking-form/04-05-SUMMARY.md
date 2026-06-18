---
phase: 04-transfer-entity-booking-form
plan: 05
subsystem: schema-apply-gate
tags: [migration, flagged-irreversible, live-apply, supabase, rls, lifecycle-trigger, adversarial-runbook, blocking-checkpoint]
requires:
  - phase: 04-transfer-entity-booking-form
    plan: 02
    provides: "supabase/migrations/0004_transfer_entity.sql — the authored DDL applied here"
  - phase: 04-transfer-entity-booking-form
    plan: 03
    provides: "booking action under the live booking→pay smoke"
  - phase: 04-transfer-entity-booking-form
    plan: 04
    provides: "webhook paid-writer + /status read under the live confirm→track smoke"
provides: "Migration 0004 live on Balkanity; tests/runbooks/0004-lifecycle-trigger.md adversarial record"
requirements: [XFER-01, BOOK-01, BOOK-03, AUTH-02, BOOK-07]
status: complete
---

# 04-05 SUMMARY — Apply migration 0004 + adversarial live-DB gate

## Outcome

The FLAGGED/irreversible migration `0004_transfer_entity.sql` is **applied live to Balkanity** (`qyhdogajtmnvxphrslwm`, never Kalvia) with explicit operator sign-off, and the lifecycle trigger + RLS are **adversarially proven against the live database**. This closes XFER-01 at the data layer (the DB trigger is the authority) and confirms the guest-self-read + active-destination RLS boundaries (AUTH-02 / BOOK-01).

## Tasks

| Task | Status | Notes |
|------|--------|-------|
| 1 — [SIGN-OFF] review + apply 0004 to Balkanity | ✓ complete | Operator approved; applied via `supabase db push --linked`. Target confirmed Balkanity at every layer (project-ref file, pooler username, `linked-project.json`). 19 columns, trigger, 2 policies, 2 indexes live; 0→0 rows (no data loss). |
| 2 — adversarial trigger + RLS runbook (live) | ✓ complete | `tests/runbooks/0004-lifecycle-trigger.md`. Legal chain all SUCCEED; 3 illegal jumps each raise `check_violation` (23514) on the superuser path; non-owner RLS = 0 rows; anon inactive-dest = 0 rows. Whole run inside `BEGIN…ROLLBACK` — live DB left pristine. |
| 3 — full suite + live smoke | ◐ partial | Automated suite GREEN (106 tests, typecheck, lint 0 errors, build). **Live Stripe pay→webhook smoke DEFERRED to operator** — Stripe CLI not installed on this machine (operator's chosen split). Recorded as a human-verify item in the runbook. |

## How it was applied (environment)

- Connection: IPv4 **session pooler** `aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.qyhdogajtmnvxphrslwm`. The direct host `db.<ref>.supabase.co` is IPv6-only and does not resolve on this network. Credentials sourced from `.env.local` (`SUPABASE_ACCESS_TOKEN` for the CLI push; the DB password from `SUPABASE_DB_URL` for the psql runbook). **Not MCP** (MCP reaches only Kalvia — project memory).
- Migration history now: `0001–0004` on remote.

## Deviations

- **Live end-to-end Stripe smoke not run** (Task 3b). The Stripe CLI is absent here; per the operator's execution decision the live round-trip is handed off. All other Task-3 acceptance (automated suite) is GREEN. The phase's automated DoD is met; the live smoke remains an operator human-verify item (steps in the runbook).
- Adversarial runbook used a seed-and-rollback transaction rather than persistent seed rows + manual cleanup — stronger guarantee that no test data lingers on the production DB.

## Verification evidence

- `\d`-equivalent column/trigger/policy/index queries (before vs after) — see runbook Task 1 table.
- Live trigger legal/illegal matrix + RLS isolation — see runbook Task 2. Live allowed pairs match `platform/transfers/lifecycle.ts` exactly.
- `npm run test && npm run typecheck && npm run lint` — all GREEN.

## Self-Check: PASSED
- Migration 0004 live on Balkanity only, objects present, seed rows intact (none existed).
- Trigger fires on the service-role path; RLS isolates non-owners; anon sees only active destinations.
- Automated suite green; single `paid` writer preserved.
- Open item (non-blocking for automated DoD): operator live Stripe smoke.
