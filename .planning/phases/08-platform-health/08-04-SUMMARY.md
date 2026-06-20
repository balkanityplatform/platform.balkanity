---
phase: 08-platform-health
plan: 04
subsystem: infra
tags: [cron, pg_cron, vercel-cron, digest, timing-safe-auth, resend, backstop]

# Dependency graph
requires:
  - phase: 08-platform-health
    plan: 01
    provides: "digest-route RED spec (app/api/cron/digest/route.test.ts); 0008 digest-hourly pg_cron schedule (file-only) targeting this route via Vault x-cron-secret"
  - phase: 08-platform-health
    plan: 02
    provides: "health route timing-safe x-cron-secret/Bearer auth-gate pattern (app/api/cron/health/route.ts) mirrored here; /api/cron/health backstop target"
  - phase: 07-notifications
    provides: "sendDueDigests() invokable (platform/notifications/digest.ts) — self-filters by digest_send_hour == current UTC hour; the PHASE 8 SEAM this route's time trigger satisfies"
provides:
  - "POST /api/cron/digest — timing-safe x-cron-secret/Bearer-gated nodejs route firing sendDueDigests() UNCHANGED (D-10 time trigger Phase 7 deferred)"
  - "vercel.json crons[] daily backstop (0 3 * * *) hitting /api/cron/health — re-warms DB / catches paused pg_cron (HLTH-05 belt-and-braces)"
affects: [08-05-live-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin authenticated cron wrapper: route is a pure timing-safe auth gate + a single call to an existing Phase-7 invokable (zero scheduling logic, zero wp_transfers writes — D-01)"
    - "Vercel Hobby daily backstop (1/day, hour-imprecise) is belt-and-braces for the Supabase pg_cron 15-min sweep — never a replacement"

key-files:
  created:
    - app/api/cron/digest/route.ts
  modified:
    - vercel.json

key-decisions:
  - "Route signature is POST(req: Request) (Web standard) not NextRequest — the RED spec passes a plain Request with an x-cron-secret header; Request.headers.get covers both x-cron-secret and Authorization: Bearer, and NextResponse extends Response so res.status works for the test. Gate logic is byte-identical to the health route (timingSafeEqual over equal-length buffers, 401 + zero work)."
  - "sendDueDigests() invoked UNCHANGED — it already self-filters drivers by digest_send_hour == getUTCHours(); the route adds NO scheduling logic, only authn + the call (the PHASE 8 SEAM header in digest.ts)."
  - "Defensive try/catch around sendDueDigests returns 200 even on a fan-out throw (a transient send error must not wedge the hourly cron — the next cycle retries the due set), mirroring the health route's sweep wrapper."
  - "Vercel backstop is a SINGLE daily entry hitting /api/cron/health only (NOT digest) — Hobby caps cron at 1/day and is hour-imprecise, so it cannot honour digest_send_hour; the hourly digest stays pg_cron-only (D-02/D-08)."

patterns-established:
  - "Pattern: cron route = timing-safe secret gate (x-cron-secret OR Authorization: Bearer, crypto.timingSafeEqual) + a single existing-invokable call, no business logic in the route."

requirements-completed: [HLTH-05, HLTH-02]

# Metrics
duration: 2min
completed: 2026-06-20
---

# Phase 8 Plan 04: Cron Routes (Digest Trigger + Daily Backstop) Summary

**The hourly digest cron route (`POST /api/cron/digest`) firing Phase-7's existing `sendDueDigests()` unchanged behind a byte-identical timing-safe x-cron-secret gate, plus the Vercel Hobby daily-backstop cron hitting `/api/cron/health` — closing the D-10 digest scheduling seam and adding the HLTH-05 belt-and-braces re-warm, with ZERO `paid` writes.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-20T10:34:35Z
- **Completed:** 2026-06-20T10:36:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `POST /api/cron/digest` (D-10): a `runtime="nodejs"` route with an AUTH-GATE-FIRST posture identical to the health route (Plan 02) — `crypto.timingSafeEqual` over equal-length buffers, accepting BOTH the pg_cron `x-cron-secret` header and Vercel's `Authorization: Bearer <CRON_SECRET>`, returning 401 with ZERO work (sendDueDigests never reached) on any missing/wrong secret. On success it `await`s `sendDueDigests()` UNCHANGED (the function self-filters drivers by `digest_send_hour == current UTC hour`), wrapped in a defensive try/catch that still returns 200 so a fan-out throw never wedges the hourly cron. Zero `wp_transfers` writes (D-01). The 08-01 RED spec is now GREEN.
- `vercel.json` daily backstop (HLTH-05): a single `crons[]` entry `{ "path": "/api/cron/health", "schedule": "0 3 * * *" }` — the once-daily, hour-imprecise Vercel Hobby cron that re-warms the DB / catches a paused pg_cron (belt-and-braces). It hits the health route only (which already accepts Vercel's Authorization header); NO digest backstop entry (the hourly digest needs pg_cron's cadence to honour `digest_send_hour`). Existing `$schema`/`framework`/`buildCommand` keys preserved; build green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hourly digest cron route (app/api/cron/digest/route.ts)** — `49fbc4f` (feat)
2. **Task 2: Vercel daily-backstop cron config (vercel.json)** — `8298032` (feat)

## Files Created/Modified
- `app/api/cron/digest/route.ts` — nodejs route, timing-safe x-cron-secret/Bearer gate (401 + zero work), fires `sendDueDigests()` unchanged; zero scheduling logic, zero paid writes.
- `vercel.json` — additive single `crons[]` daily backstop to `/api/cron/health` (`0 3 * * *`); existing keys intact.

## Decisions Made
- **Route signature `POST(req: Request)`** (Web standard) rather than `NextRequest`: the committed RED spec calls the route with a plain `Request` carrying an `x-cron-secret` header. `Request.headers.get(...)` reads both the `x-cron-secret` and `Authorization: Bearer` paths, and `NextResponse` extends `Response` so `res.status` is observable in the test. The timing-safe gate logic (`timingSafeEqual` over equal-length buffers, length-guard first, 401 + zero work) is byte-identical to the health route.
- **`sendDueDigests()` invoked unchanged** — no scheduling logic added to the route; the existing function honours `digest_send_hour`. The route only authenticates and calls it.
- **Defensive 200 on fan-out throw** — a transient digest send error returns 200 (logged, not 500) so the next hourly cycle retries; mirrors the health route's sweep wrapper.
- **Vercel backstop is health-route-only and daily** — Hobby caps cron at 1/day and fires hour-imprecise, so it cannot drive the hourly digest; the digest stays pg_cron-only and the backstop only re-warms via the health route (D-02/D-08).

## Deviations from Plan

None — plan executed exactly as written. The RED spec drove a `Request`-typed signature (an implementation detail, not a behavioural change), the gate logic mirrors the health route verbatim, and `sendDueDigests()` was invoked unchanged. No auto-fixes were required.

## Issues Encountered
- `npm run lint` reports 4 errors + 5 warnings, ALL in pre-existing files unrelated to this plan (driver/admin UI + test files). These are the SAME issues already logged to `.planning/phases/08-platform-health/deferred-items.md` by Plan 08-02 (verified present at the prior baseline). Both files created/modified by this plan lint clean. Out of scope per the executor SCOPE BOUNDARY rule — not fixed.

## Known Stubs
None. The digest route is fully wired to the live `sendDueDigests()` invokable. Live cron→route auth (the Vault `cron_secret` + matching Vercel `CRON_SECRET` env) is set at Plan 08-05 live apply — already tracked as an 08-01/08-05 item, not a gap in this code.

## Threat Flags
None — no new trust-boundary surface beyond the route already enumerated in the plan's threat model. The digest route's auth gate (T-08-13), no-paid-writer posture (T-08-14, single-writer.test.ts GREEN), the unchanged Phase-7 PII gate inside `sendDueDigests` (T-08-16), and the single daily Vercel entry (T-08-15) are all mitigated as planned.

## User Setup Required
None in this plan. The `CRON_SECRET` Vercel server env (also used by the Vercel backstop's `Authorization: Bearer` header) and the matching Vault `cron_secret` are set at Plan 08-05 live apply.

## Next Phase Readiness
- D-10 closed: the hourly digest time trigger now exists and is GREEN; the 0008 `digest-hourly` pg_cron schedule (Plan 01, file-only) already targets `/api/cron/digest`.
- HLTH-05 backstop in place: the Vercel daily cron config is committed; it activates on deploy and hits the health route (pg_cron remains the primary 15-min sweep).
- Plan 08-05 (live apply) wires the cron→route auth end-to-end: apply 0008 with sign-off, create the Vault `cron_secret`, and set the matching Vercel `CRON_SECRET` env.

## Self-Check: PASSED

`app/api/cron/digest/route.ts` exists on disk; `vercel.json` modified; both task commits (`49fbc4f`, `8298032`) present in git history; digest route RED spec + single-writer gate GREEN (5/5); typecheck clean; build green with `/api/cron/digest` in the manifest.

---
*Phase: 08-platform-health*
*Completed: 2026-06-20*
