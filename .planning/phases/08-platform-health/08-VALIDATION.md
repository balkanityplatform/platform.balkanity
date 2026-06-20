---
phase: 8
slug: platform-health
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom) + Playwright 1.61 (e2e) [VERIFIED: package.json] |
| **Config file** | `vitest.config.ts` + `vitest.setup.ts` |
| **Quick run command** | `npm run test` (`vitest run`) |
| **Full suite command** | `npm run test && npm run typecheck && npm run lint` |
| **Estimated runtime** | ~30 seconds (unit suite); +typecheck/lint on wave merge |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run typecheck && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green + the three LIVE manual DoD checks (Plan 05) recorded
- **Max feedback latency:** ~30 seconds (unit), ~120 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | HLTH-02/03/04/05 | T-08-01 / T-08-02 / T-08-03 | 0008 FLAGGED, Balkanity-only ref, health_events polymorphic (no transfer_id), admin-read RLS + no write policy, free-form `kind` (incl. keepalive) | grep gate | `test -f supabase/migrations/0008_platform_health.sql && grep -q "create table if not exists public.health_events" … && ! grep -Eiq "check \(kind" …` | ✅ authored | ⬜ pending |
| 08-01-02 | 01 | 1 | HLTH-02/03/04 | — | Wave-0 RED baseline (detection, lookback, dedup, auth gates, gauge) tsc-clean but RED | unit (RED) | `npm run test -- platform/health/reconcile.test.ts platform/health/stuck.test.ts app/api/cron/health/route.test.ts app/api/cron/digest/route.test.ts app/admin/health/EmailCapGauge.test.tsx ; npm run typecheck` | ❌ W0 (this task creates) | ⬜ pending |
| 08-01-03 | 01 | 1 | HLTH-03 | — | EN/BG Dict parity holds (no inline copy) | unit | `npm run test -- platform/i18n/dictionary.test.ts && npm run typecheck` | ✅ extend | ⬜ pending |
| 08-02-01 | 02 | 2 | HLTH-02 | T-08-05 / T-08-06 / T-08-08 | Stripe-API anti-join detects discrepancy; lookback no-false-positive; per-entity dedup; NEVER writes paid; no guest PII in alert | unit | `npm run test -- platform/health/reconcile.test.ts && npm run test -- platform/payments/single-writer.test.ts && npm run typecheck` | ✅ (W0 spec) | ⬜ pending |
| 08-02-02 | 02 | 2 | HLTH-04, HLTH-05 | T-08-05 | Stuck predicate (paid+unclaimed≤12h); in-app ONLY (no sendEmail); keep-alive writes health_events kind='keepalive' (no new table) | unit + grep | `npm run test -- platform/health/stuck.test.ts && npm run test -- platform/payments/single-writer.test.ts && ! grep -E "sendEmail" platform/health/stuck.ts && grep -q "keepalive" platform/health/keepalive.ts && ! grep -q "health_heartbeat" platform/health/keepalive.ts && npm run typecheck` | ✅ (W0 spec) | ⬜ pending |
| 08-02-03 | 02 | 2 | HLTH-02 | T-08-04 / T-08-07 | x-cron-secret timing-safe gate → 401 zero-work; runtime nodejs; no paid write | unit | `npm run test -- app/api/cron/health/route.test.ts && npm run test -- platform/payments/single-writer.test.ts && grep -q "timingSafeEqual" app/api/cron/health/route.ts && grep -q 'runtime = "nodejs"' app/api/cron/health/route.ts && npm run typecheck && npm run lint` | ✅ (W0 spec) | ⬜ pending |
| 08-03-01 | 03 | 2 | HLTH-03 | T-06-COLOR | Gauge state at 80/90 boundaries (cap 90); worded label always renders (WCAG 1.4.1) | unit | `npm run test -- app/admin/health/EmailCapGauge.test.tsx && npm run typecheck && npm run lint` | ✅ (W0 spec) | ⬜ pending |
| 08-03-02 | 03 | 2 | HLTH-02, HLTH-04 (surface) | T-08-10 / T-08-11 / T-08-12 | Admin gate before any read; reads open health_events via admin-read RLS (not service-role); display-only of Plan-02 rows | build + grep | `npm run build && npm run typecheck && npm run lint && grep -q "/admin/health" app/admin/page.tsx && grep -q "getCurrentRole" app/admin/health/page.tsx && grep -q "health_events" app/admin/health/page.tsx` | n/a (page) | ⬜ pending |
| 08-04-01 | 04 | 2 | HLTH-05 (D-10) | T-08-13 / T-08-14 | x-cron-secret gate → 401 zero-work; sendDueDigests invoked unchanged; no paid write | unit | `npm run test -- app/api/cron/digest/route.test.ts && npm run test -- platform/payments/single-writer.test.ts && grep -q "sendDueDigests" app/api/cron/digest/route.ts && grep -q "timingSafeEqual" app/api/cron/digest/route.ts && npm run typecheck && npm run lint` | ✅ (W0 spec) | ⬜ pending |
| 08-04-02 | 04 | 2 | HLTH-05 | T-08-15 | Single daily backstop entry → /api/cron/health; existing vercel.json keys preserved | config + build | `node -e "…crons single-entry, path /api/cron/health, schedule 0 3 * * *, framework+buildCommand preserved…" && npm run build` | n/a (config) | ⬜ pending |
| 08-05-01..03 | 05 | 3 | HLTH-02/03/04/05 | T-08-17..20 | LIVE: dropped webhook caught (no paid write), cron fires, keep-alive holds; Balkanity-only ref | manual/live | Management API `/database/query` (NOT MCP, NOT db push) — see Manual-Only Verifications | n/a (live gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `platform/health/reconcile.test.ts` — HLTH-02 (detection, `-t lookback` no-false-positive, `-t dedup` single-alert, never-writes-paid). Mocks `@/platform/supabase/admin` (createAdminClient) + `@/platform/payments/stripe` (getStripe).
- [ ] `platform/health/stuck.test.ts` — HLTH-04 (predicate paid+unclaimed≤12h; in-app-only source-grep asserts no `sendEmail`).
- [ ] `app/api/cron/health/route.test.ts` — `x-cron-secret` auth gate (`-t unauthorized` → 401 zero-work; authorized → workers invoked).
- [ ] `app/api/cron/digest/route.test.ts` — auth gate (`-t unauthorized` → 401 zero-work; authorized → `sendDueDigests` awaited).
- [ ] `app/admin/health/EmailCapGauge.test.tsx` — HLTH-03 (state ok/warning/at-cap at 80/90 boundaries, default cap 90; worded label renders).
- [ ] Extend `platform/payments/single-writer.test.ts` grep-gate to cover `platform/health/*` + `app/api/cron/*` (ROOTS already include `app`/`platform` — confirm, no edit if covered).
- [ ] Shared service-role admin-client mock fixture (reuse the Phase-7 `send-email.test.ts` pattern) + a `getStripe()` mock for reconcile.test.ts.
- [ ] Framework install: none — Vitest + Playwright already present.

*Wave 0 specs are authored in Plan 08-01 (Task 2) and turned GREEN by Plans 08-02/03/04. `wave_0_complete: false` until those specs land and are confirmed RED.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dropped/never-delivered webhook is caught by the live sweep → health_events reconciliation row + admin in-app + critical email, transfer NOT paid (D-01) | HLTH-02 / DoD | Requires a live Stripe-paid session + the live cron/route + live Resend; cannot be exercised in unit tests | Plan 05 Gate A: seed a paid Stripe session whose `wp_transfers` stays unpaid; invoke `/api/cron/health` with the valid `x-cron-secret` (or wait one window); assert the recon `health_events` row + bell + critical email; assert `wp_transfers.status` unchanged + `single-writer.test.ts` green; replay via Stripe CLI → idempotent paid + no re-alert. Clean up. |
| Cron actually fires on the live project | HLTH-02 / HLTH-05 / DoD | pg_cron + net.http_post run only on the live Balkanity DB (async fire-and-forget) | Plan 05 Gate B: `select jobname, status, start_time from cron.job_run_details order by start_time desc limit 10;` via Management API — `health-sweep` (and `digest-hourly` at the hour) show runs. |
| Keep-alive keeps the project warm | HLTH-05 / DoD | The 7-day inactivity pause is a live free-tier behaviour | Plan 05 Gate C: `select created_at from health_events where kind='keepalive' order by created_at desc limit 5;` — rows ~15 min apart; backstop `curl /api/cron/health` returns 200 with the secret / 401 without. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (live DoD gates are manual by necessity — see Manual-Only Verifications)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the Plan-05 live-apply checkpoints are manual, by design)
- [x] Wave 0 covers all MISSING references (5 RED specs authored in Plan 01)
- [x] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [x] Feedback latency < 30s (unit) / < 120s (full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-20
