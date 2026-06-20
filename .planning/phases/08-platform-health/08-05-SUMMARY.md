---
phase: 08-platform-health
plan: 05
subsystem: infra
status: partial
tags: [live-apply, flagged-migration, pg_cron, pg_net, vault, vercel-env, dod-gates, reconciliation]

# Dependency graph
requires:
  - phase: 08-platform-health
    plan: 01
    provides: "authored FLAGGED 0008_platform_health.sql (extensions + health_events + 2 cron schedules)"
  - phase: 08-platform-health
    plan: 02
    provides: "platform/health/* detection + /api/cron/health route exercised by the live cron"
  - phase: 08-platform-health
    plan: 03
    provides: "admin /admin/health console that displays the live health_events rows"
  - phase: 08-platform-health
    plan: 04
    provides: "/api/cron/digest route fired by digest-hourly; vercel.json daily backstop"
provides:
  - "Migration 0008 applied LIVE to Balkanity (qyhdogajtmnvxphrslwm): pg_cron 1.6.4 + pg_net 0.20.3, health_events (admin-read RLS, no write policy), cron jobs health-sweep + digest-hourly active"
  - "Shared cron secret: Vault cron_secret + Vercel CRON_SECRET (same value); route auth proven 401/200"
  - "DoD Gates B (cron fires) + C (keep-alive + backstop auth) GREEN live; no-paid-write invariant proven live"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FLAGGED live apply via Supabase Management API /database/query (NOT MCP, NOT db push); ref guardrail re-asserted before DDL"
    - "Cron auth secret stored in Supabase Vault, read at fire time into the x-cron-secret header; matched to a server-only Vercel env"

key-files:
  created:
    - .planning/phases/08-platform-health/08-GATES-EVIDENCE.md
  modified: []

key-decisions:
  - "Receiver project resolved by domain ownership: balkanityplatformproject.vercel.app → balkanity_platform_project (prj_6qIZGAJPt6BdWY6hNvyIYWlloB6s); CRON_SECRET set there (production+preview+development) and redeployed so the function binds it."
  - "The first auto-deploy (07f5a7d) was created ~100s BEFORE the env was added, so it 401'd even with the correct secret; an explicit redeploy bound the env and the route then returned 200."
  - "Gate A (dropped-webhook reconciliation + critical email) DEFERRED: prod Vercel has no STRIPE_SECRET_KEY (reconcile's D-03 source), no STRIPE_WEBHOOK_SECRET (replay remediation), no RESEND_API_KEY (critical email); send.balkanity.com unverified (open Phase-7 gate). Not provable without operator-provisioned secrets + a Stripe test scenario."

patterns-established:
  - "Pattern: provision cron secret atomically (Vault + Vercel, same generated value, never printed) BEFORE relying on the schedule; verify the chain with a 401-without / 200-with route probe."

requirements-completed: []
requirements-partial: [HLTH-02, HLTH-03, HLTH-04, HLTH-05]

# Metrics
duration: 25min
completed: 2026-06-20
---

# Phase 8 Plan 05: Live Apply + DoD Gates Summary (PARTIAL)

**Migration `0008_platform_health.sql` applied LIVE to Balkanity with operator sign-off — pg_cron + pg_net installed, `health_events` (admin-read RLS, no write policy, no PII) live, both cron schedules registered and firing; the shared cron secret provisioned in Vault + Vercel with the route auth chain proven (401/200). DoD Gates B (cron fires) and C (keep-alive + backstop) are GREEN and the money single-writer invariant holds live. Gate A (dropped-webhook reconciliation + critical email) is DEFERRED — the production deployment lacks the Stripe and Resend secrets it requires.**

## Performance
- **Duration:** ~25 min (includes Vercel redeploy + waiting one live `*/15` cron window)
- **Completed:** 2026-06-20
- **Tasks:** 3 (Task 1 sign-off ✓, Task 2 apply ✓, Task 3 gates — B/C ✓, A deferred)

## Accomplishments
- **Sign-off (Task 1):** operator approved the FLAGGED apply after an end-to-end DDL review (Balkanity-only ref, extensions-before-cron, no write policy, free-form `kind`, idempotent cron block).
- **Secret provisioning (Task 2):** generated a 64-hex secret (never printed); `vault.create_secret(...,'cron_secret')` on Balkanity + Vercel `CRON_SECRET` (server-only, production+preview+development) — same value; redeployed `balkanity_platform_project`.
- **DDL apply (Task 2):** full `0008` body POSTed to the Management API `/database/query` (response `[{"schedule":4}]`). Verified live: `pg_cron` 1.6.4 + `pg_net` 0.20.3; `health_events` with `rowsecurity=true`, columns with **no `transfer_id`**, single `health_events_admin_read` SELECT policy (**no write policy**), `health_events_open_idx` partial index; cron jobs `health-sweep` (`*/15`, active) + `digest-hourly` (`0 *`, active).
- **Route auth:** `POST /api/cron/health` → **401** without secret, **200 `{"ok":true}`** with the Vault secret — the Vault↔Vercel secret match + timing-safe gate proven.
- **Gate B (cron fires):** `cron.job_run_details` at `11:00:00Z` shows both jobs `succeeded`.
- **Gate C (keep-alive + backstop):** `keepalive` `health_events` rows recur (10:58 manual + 11:00 cron, `resolved_at` set so never alerting); backstop auth 200/401 confirmed.
- **No-paid-write invariant (live):** both live sweeps wrote **only** keepalive rows — zero `paid` writes, zero `wp_transfers` status changes; `single-writer.test.ts` GREEN.

## Files Created/Modified
- `.planning/phases/08-platform-health/08-GATES-EVIDENCE.md` — full runbook + gate evidence (status: partial).

## Deviations from Plan
- **Two redeploys fired** (an accidental duplicate redeploy request) — harmless; the latest READY deployment became production.
- **Gate A deferred** (not a code deviation): the plan assumed prod had the Stripe + Resend secrets; it does not. Documented as a blocker with explicit close-out steps in `08-GATES-EVIDENCE.md`.

## Issues Encountered / Blockers
- **Production env gap:** `balkanity_platform_project` env = `CRON_SECRET, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`. Missing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. The latter two are unavailable locally as well; `send.balkanity.com` is unverified (open Phase-7 D-15 gate). Gate A's reconciliation-detection + critical-email + webhook-replay legs cannot run until the operator provisions these.

## Threat Flags
- T-08-17 (wrong project): mitigated — ref guardrail re-asserted before DDL; Kalvia absent.
- T-08-18 (secret in cron.command): mitigated — secret read from Vault `decrypted_secrets`, not inlined.
- T-08-19 (sweep sets paid): mitigated + proven live — sweeps wrote zero paid; single-writer test green.
- T-08-20 (secret mismatch → silent 401): mitigated — 200/401 probe confirms the match.

## User Setup Required (to close Gate A + the phase)
1. Decide Stripe pilot mode (test vs live); set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` server-only on `balkanity_platform_project`; redeploy.
2. Verify Resend `send.balkanity.com` (DNS) + set `RESEND_API_KEY` server-only; this also closes the Phase-7 D-15 gate.
3. Run Gate A: seed a paid Stripe session whose transfer stays `requested` → sweep → assert reconciliation row + admin in-app + critical email + transfer NOT paid → idempotent webhook replay remediates → no re-alert; clean up the seeded row.

## Self-Check: PASSED (partial)
Migration 0008 verified live (extensions + table + RLS + cron jobs); secret chain proven (401/200); Gates B + C GREEN; no-paid-write invariant proven live; `08-GATES-EVIDENCE.md` written. Gate A is explicitly DEFERRED with documented close-out steps — the plan is **not** fully complete until Gate A passes.

---
*Phase: 08-platform-health*
*Completed (partial): 2026-06-20*
