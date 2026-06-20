---
phase: 08-platform-health
plan: 03
subsystem: admin-ui
tags: [health-console, rsc, admin-gate, rls, wcag, email-cap-gauge, reconciliation, stuck-transfers]

# Dependency graph
requires:
  - phase: 08-platform-health
    plan: 01
    provides: "EmailCapGauge RED spec (80/90 thresholds, default cap 90); 15 EN/BG health dictionary keys (emailCap*/stuck*/recon*/healthTitle/healthLoadFailed); 0008 health_events table (admin-read RLS) + email_log_admin_read RLS"
  - phase: 08-platform-health
    plan: 02
    provides: "the open health_events rows this console displays — reconcile() writes kind='reconciliation_discrepancy', findStuck() writes kind='stuck_unclaimed' (resolved_at IS NULL)"
  - phase: 07-notifications
    provides: "send-email.ts daily 'sent' count query shape (createdAt>=todayUTC, outcome='sent') + EMAIL_SOFT_CAP softCap() default 90; LanguageToggle chrome"
  - phase: 01-seam-auth
    provides: "getCurrentRole() admin gate; createClient() cookie-bound anon RLS client; slate console chrome"
provides:
  - "EmailCapGauge (app/admin/health/EmailCapGauge.tsx): gaugeState(sent,cap) resolver + presentational meter; figure + worded label (HLTH-03)"
  - "/admin/health (app/admin/health/page.tsx): read-only admin-gated RSC rendering gauge + stuck list + reconciliation list from open health_events rows (HLTH-02/HLTH-04 DISPLAY surfaces)"
  - "/admin/health nav link on the admin landing"
affects: [08-04-cron-routes, 08-05-live-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Display-only health surface: renders the OPEN health_events rows Plan 02's sweep writes (kind + resolved_at IS NULL); contains ZERO detection logic of its own"
    - "Read via the cookie-bound caller-auth client + admin-read RLS (email_log_admin_read / health_events_admin_read), NEVER createAdminClient — service-role never touches the read surface"
    - "Pure gaugeState(sent,cap) resolver exported for the RED spec to assert at the 80/90 boundaries; presentational component receives {sent,cap,copy} props"

key-files:
  created:
    - app/admin/health/EmailCapGauge.tsx
    - app/admin/health/page.tsx
  modified:
    - app/admin/page.tsx

key-decisions:
  - "EmailCapGauge split per the RED spec: a pure gaugeState(sent, cap=EMAIL_SOFT_CAP_DEFAULT) resolver (ok <80 / warning >=80 / at-cap >=90) + a presentational component; the test imports the component and asserts the '{sent} / {cap}' figure + worded labels"
  - "EMAIL_SOFT_CAP_DEFAULT mirrors send-email.ts softCap() exactly (Number(process.env.EMAIL_SOFT_CAP)||90, D-07) — the SAME constant the send guardrail uses, no divergence"
  - "Health page reads via the cookie-bound createClient() (anon + admin-read RLS), NOT createAdminClient — the daily 'sent' count uses the same query SHAPE as send-email.ts:63-71 but through the RLS path (T-08-11); createAdminClient count in the file = 0"
  - "Lists key each row link by entity_id (the transfer id Plan 02 writes as entity_id for both kinds), falling back to the event id; meta line shows id + non-PII amount from detail.amount_cents only (T-08-12 — never guest PII)"
  - "Each read wrapped in try/catch → null sentinel rendering t.healthLoadFailed (mirrors the alertsLoadFailed pattern); a failed read on one panel never breaks the others"

patterns-established:
  - "Read-only admin health console: role gate FIRST (before any read) → per-panel RLS reads with per-panel error fallback → gauge-first stack with Card panels + TransfersView list anatomy (divide-y, min-h-[56px], coral border-l-4 + worded badge)"

requirements-completed: [HLTH-03, HLTH-02, HLTH-04]

# Metrics
duration: 5min
completed: 2026-06-20
---

# Phase 8 Plan 03: Admin Platform-health console Summary

**The only user-observable UI of Phase 8 — a read-only admin-gated RSC rendering the email-cap gauge (HLTH-03), the open reconciliation-discrepancy list (HLTH-02 surface), and the open stuck-transfer list (HLTH-04 surface) from the health_events rows Plan 02's sweep writes — reusing the locked design system, every colour state paired with a worded label, all reads via the admin-read RLS path (never service-role).**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-06-20
- **Tasks:** 2
- **Files created:** 2 (+1 modified)

## Accomplishments
- **EmailCapGauge (HLTH-03):** turned the 08-01 RED spec GREEN. A pure `gaugeState(sent, cap)` resolver (ok `<80` / warning `>=80` / at-cap `>=90`, default cap 90 = the SAME `EMAIL_SOFT_CAP` constant the send guardrail uses, D-07) plus a presentational meter: a white-track horizontal bar with fill width `min(sent/cap,1)*100%`, fill colour by `@theme` token (teal/amber/coral — never raw hex), the always-rendered `{sent} / {cap}` figure (20px/600), and a worded state label/badge (warning amber badge / at-cap coral badge / zero → `emailCapZero`). WCAG 1.4.1: colour is never the sole signal.
- **/admin/health page (HLTH-02/HLTH-04 surfaces):** a read-only RSC. `getCurrentRole() !== 'admin' → redirect('/sign-in')` runs FIRST, before any read (T-08-10). Three panels in reading order — gauge (focal, first), stuck list, reconciliation list — each a `Card`. The two lists read OPEN `health_events` rows by `kind` (`resolved_at IS NULL`) via the cookie-bound admin-read RLS path; they DISPLAY Plan 02's detection and contain no detection logic. Empty states confirm the system is healthy; coral rows carry the worded `stuckBadge` / `reconBadge`. Each read has its own try/catch → `healthLoadFailed` fallback.
- **Nav:** added `{ href: "/admin/health", label: t.healthTitle }` to the admin landing console nav (the sole, additive change to `app/admin/page.tsx`).

## Task Commits

1. **Task 1: EmailCapGauge read-only widget (HLTH-03)** — `2b17ca5` (feat)
2. **Task 2: Platform-health page (gauge + recon + stuck) + admin nav link** — `766578a` (feat)

## Files Created/Modified
- `app/admin/health/EmailCapGauge.tsx` — `gaugeState()` resolver + presentational meter; figure + worded label; theme-token fill; copy via props (HLTH-03).
- `app/admin/health/page.tsx` — admin-gated read-only RSC: gauge + stuck list + reconciliation list from open `health_events` rows via admin-read RLS; per-panel error fallback; non-PII meta only.
- `app/admin/page.tsx` — additive `/admin/health` nav entry (only change).

## Decisions Made
- EmailCapGauge follows the RED spec exactly: the component is the default-tested entry, `gaugeState` is exported for boundary assertions, `EMAIL_SOFT_CAP_DEFAULT` mirrors `send-email.ts` `softCap()`.
- Reads go through `createClient()` (cookie-bound anon + admin-read RLS), confirmed `createAdminClient` count = 0 in the page (T-08-11). The daily 'sent' count reuses the send-guardrail query SHAPE but on the RLS path.
- Rows link by `entity_id` (Plan 02 keys both kinds on the transfer id) → `/admin/transfers/<id>`; the gated transfer detail is where PII lives. The console shows id + non-PII `detail.amount_cents` only (T-08-12).

## Deviations from Plan

None — plan executed as written. (The optional "Mark resolved" CTA was explicitly left out of scope by the planner for the pilot; not added.)

## Issues Encountered
- `npm run test` shows 2 failures in `app/api/cron/digest/route.test.ts`. This is a **Plan 08-01 Wave-0 RED-by-absence spec** (committed `06df9df`): its target `app/api/cron/digest/route.ts` does not exist yet and is resolved by **Plan 08-04** (per the 08-01 Known Stubs table). It is unrelated to Plan 08-03's files and out of scope per the executor SCOPE BOUNDARY rule. Logged to `deferred-items.md`. All 08-03 files and the EmailCapGauge spec are GREEN; the full suite is otherwise 175 passed / 6 skipped, typecheck + lint (08-03 files) clean, `npm run build` succeeds with `/admin/health` registered.

## Known Stubs
None. The console is fully wired: the gauge reads the live `email_log` daily count and the lists read live `health_events` rows. The rows themselves only appear once Plan 02's sweep runs against the applied 0008 migration (live apply = Plan 08-05) — that is a deferred live-apply dependency tracked in 08-01/08-05, not a stub in this UI.

## Threat Flags
None — no new trust-boundary surface beyond the plan's threat model. The page introduces a read-only admin route enumerated in the plan (T-08-10/11/12 all mitigated: server-side role gate before any read, admin-read RLS reads with zero `createAdminClient`, non-PII meta only).

## Next Phase Readiness
- HLTH-03 gauge + HLTH-02/HLTH-04 display surfaces are live behind the admin gate and reachable from the landing nav. Plan 08-04 lands the digest cron route (turning the remaining 08-01 RED spec GREEN); Plan 08-05 applies 0008 live so the sweep starts writing the rows this console renders.

## Self-Check: PASSED

Both created files (`app/admin/health/EmailCapGauge.tsx`, `app/admin/health/page.tsx`) exist on disk; the modified `app/admin/page.tsx` carries the `/admin/health` nav entry. Both task commits (`2b17ca5`, `766578a`) are present in git history. EmailCapGauge RED spec GREEN (4/4); `npm run build` succeeds with `/admin/health` registered.

---
*Phase: 08-platform-health*
*Completed: 2026-06-20*
