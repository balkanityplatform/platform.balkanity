---
phase: 07-notifications
plan: 05
subsystem: notifications
tags: [digest, resend, service-role, pii-gate, idempotency, rate-limit, opt-in, driver-ui]

# Dependency graph
requires:
  - phase: 07-notifications
    plan: 02
    provides: "sendEmail(best_effort) single Resend call-site (cap/idempotency/rate guard) + buildDigestEmail({poolItems, ownRuns}) plain-HTML builder"
  - phase: 07-notifications
    plan: 01
    provides: "migration 0007 driver_profiles.digest_enabled/digest_send_hour columns + all EN/BG digest copy keys + digest.test.ts Wave-0 RED spec"
  - phase: 05-claim-correctness
    provides: "masked wp_pool() RPC shape (the 9 non-PII pool columns) + caller-identity→service-role gate pattern"
provides:
  - "buildDigest(driverId) — assembles a zero-PII morning snapshot (masked pool + own active runs) rendered to {subject, html} via buildDigestEmail"
  - "sendDueDigests() — the invokable best_effort, sequenced (<=5 req/s) digest fan-out for opted-in drivers due this hour (Phase 8 cron calls it)"
  - "saveDigestPreference(prev, formData) — gated service-role digest-preference write scoped to user_id = auth.uid()"
  - "/driver/settings route — role-gated RSC hosting the DigestPreferenceCard (opt-in Toggle off-by-default + send-hour Select)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit non-PII column projection AS the PII gate on a cron/no-JWT read path (the projection, not RLS, is the boundary)"
    - "Sequenced best_effort fan-out (~250ms between sends) keyed by a stable per-(driver, day) idempotencyKey — never Promise.all"
    - "Gated service-role self-scoped preference write (auth.uid() row-scope) + narrow service-role self-read where no driver self-read RLS policy exists"

key-files:
  created:
    - platform/notifications/digest.ts
    - app/driver/settings/page.tsx
    - app/driver/settings/DigestPreferenceCard.tsx
    - app/driver/settings/actions.ts
  modified: []

key-decisions:
  - "buildDigest returns the RENDERED {subject, html} (via buildDigestEmail), not the raw {poolItems, ownRuns} the plan <action> sketched — the binding digest.test.ts contract destructures {html} from buildDigest, so the test (not the draft action prose) is authoritative (mirrors Plan 02's build* naming precedent)."
  - "Own-runs status filter is applied in JS after the .eq('driver_id', …) select rather than a chained .in('status', …) — the binding test mock resolves .eq() to a promise (no further builder), and a small per-driver row set makes the JS filter trivially correct."
  - "Send hour is stored/handled as a UTC whole hour (sendDueDigests matches getUTCHours(); idempotencyKey uses the UTC date). True per-driver LOCAL-hour resolution is deferred to the Phase 8 cron trigger that owns scheduling."
  - "Driver settings preference is READ via a narrow service-role select keyed to the verified auth.uid() because driver_profiles has only an admin-read RLS policy (no driver self-read) — the uid identity is the row-scope gate, mirroring the gated write."

requirements-completed: [NOTF-05]

# Metrics
duration: 3min
completed: 2026-06-19
---

# Phase 7 Plan 05: Driver Daily-Digest Summary

**The driver daily-digest slice: `buildDigest` assembles a zero-PII morning snapshot (masked `wp_pool` columns + the driver's own active runs) rendered via `buildDigestEmail`, `sendDueDigests` is the invokable, rate-safe, idempotent best_effort fan-out for opted-in drivers, and a role-gated `/driver/settings` page lets a driver opt in (off by default) at a self-chosen hour via a gated service-role action — with the Phase 8 cron time-trigger seam flagged.**

## Performance
- **Duration:** ~3 min
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- `platform/notifications/digest.ts` — `import "server-only"` line 1. `buildDigest(driverId)` reads the masked claimable pool via the `wp_pool()` RPC and the driver's own rows via a service-role select of ONLY the 9 non-PII operational columns (`id,status,arrival_at,airport,zone,flight_no,amount_cents,pax,luggage_count`), maps both through a `toDigestItem` projection that can never copy a guest contact / address key, filters own rows to the active run states, and renders to `{subject, html}` via `buildDigestEmail`. `sendDueDigests()` queries opted-in (`digest_enabled = true`) drivers due this UTC hour, joins `app_users` for the recipient email, and sends each `best_effort` through `sendEmail` with a stable `digest:{driverId}:{YYYY-MM-DD}` idempotencyKey — sequenced ~250ms apart (≤5 req/s, Pitfall 3), each send isolated in try/catch so one failure never aborts the loop. A header comment FLAGS the Phase 8 pg_cron + pg_net time-trigger seam (D-08).
- `app/driver/settings/page.tsx` — role-gated RSC (`getCurrentRole() !== 'driver'` → redirect `/sign-in`; never `getSession`). Reads the driver's own `digest_enabled`/`digest_send_hour` via a narrow service-role select keyed to the verified `auth.uid()`, resolves all digest copy server-side, renders the warm-light driver chrome (logo chip + `LanguageToggle`) + `<DigestPreferenceCard>`.
- `app/driver/settings/DigestPreferenceCard.tsx` — `"use client"` island. `Card` (p-[24px]) with `digestPrefTitle` + `digestPrefBody`; a `Toggle` (`digestEnableLabel`, OFF by default, accent-teal); a send-hour `Select` (00:00–23:00, `digestTimeLabel`) DISABLED until the toggle is on; a `Button` save CTA → `saveDigestPreference` via `useActionState`; a neutral `Toast` on success, coral only on genuine failure. All hit targets ≥44px via the primitives.
- `app/driver/settings/actions.ts` — `"use server"`. `saveDigestPreference` re-gates the driver role, zod-validates `{ enabled: boolean, hour: 0..23 (required only when enabled) }` at the boundary, resolves the caller's verified `auth.uid()`, then service-role UPDATEs `driver_profiles` SET `digest_enabled`/`digest_send_hour` WHERE `user_id = auth.uid()` (disabled → hour cleared to null). No client write RLS policy.

## Task Commits
1. **Task 1: digest.ts — buildDigest + sendDueDigests** — `481caa1` (feat)
2. **Task 2: driver settings page + DigestPreferenceCard + gated save action** — `63ed687` (feat)

## Decisions Made
- **`buildDigest` returns rendered `{subject, html}`, not raw `{poolItems, ownRuns}`.** The binding Wave-0 spec `digest.test.ts` destructures `{ html }` from `buildDigest("driver-1")` and asserts against the rendered HTML; the plan's `<action>` prose sketched a structured return + "do not render HTML here". Per the Plan 02 precedent (the executing spec is the binding contract over the draft `<artifacts>` names), `buildDigest` calls `buildDigestEmail` and returns the rendered email.
- **Own-runs status filter is in JS, not a chained `.in(status, …)`.** The binding test mock resolves `from().select().eq()` to a promise (the `.eq()` is awaitable, with no further builder), so a chained `.in` would break the contract. The per-driver row set is tiny, so filtering active states in JS after the `.eq("driver_id", …)` select is correct and test-faithful.
- **UTC hour handling now; local-hour scheduling deferred to Phase 8.** `sendDueDigests` matches `getUTCHours()` and keys idempotency on the UTC date. Per-driver local-hour resolution belongs to the Phase 8 cron trigger that owns scheduling (the D-08 seam).
- **Settings page reads the preference via a narrow service-role self-read.** `driver_profiles` has only an admin-read RLS policy (migrations 0002/0007 — no driver self-read), so the own preference is read with a service-role select scoped to the verified `auth.uid()`; the uid identity is the gate, mirroring the gated write.

## Deviations from Plan
None beyond the contract-vs-prose reconciliations recorded under Decisions Made (the digest.test.ts return shape + the JS status filter — both required to satisfy the binding test). No Rule 1–4 deviations; no auth gates.

## Threat Surface Notes
All Plan threat-model mitigations applied:
- **T-07-DG1 (PII disclosure):** `buildDigest` reads ONLY the 9 masked operational columns and maps both pool and own-runs rows through `toDigestItem`, which never copies a guest contact / address key. The grep gate `! grep guest_name|guest_phone|guest_email|notes` passes (the data path references none); `digest.test.ts` asserts ZERO guest-PII fragments reach the HTML — GREEN.
- **T-07-DG2 (cross-driver tampering):** `saveDigestPreference` re-gates the driver role and scopes the UPDATE to `user_id = auth.uid()` (verified JWT, never a client id); a forged call matches 0 rows. No client write RLS policy.
- **T-07-DG3 (cap/rate DoS):** sends are sequenced ~250ms apart (not Promise.all), `best_effort` (soft-capped by `sendEmail`), with a stable per-(driver, day) idempotencyKey preventing double-send.
- **T-07-DG4 (no trigger):** accepted — the Phase 8 pg_cron time-trigger seam is flagged in the digest.ts header comment.

No new threat surface beyond the plan's register.

## Verification Results
- `npx vitest run platform/notifications/digest.test.ts` — 2/2 GREEN (masked pool fields + own runs present; zero guest-PII fragments).
- `npx tsc --noEmit` — clean (exit 0) after each task.
- Task 1 grep gates: `buildDigest`/`sendDueDigests` exported; `cron`/`phase 8` seam present; no `guest_name|guest_phone|guest_email|notes` in digest.ts.
- Task 2 grep gates: `getCurrentRole` in page.tsx; `digest_enabled` + `"use server"` in actions.ts; `Toggle`/`Select` in DigestPreferenceCard.tsx.

## Deferred Issues (out of scope — pre-existing, other waves)
The full `npx vitest run` shows 11 failing tests in `app/driver/advance.notify.test.ts`, `app/admin/drivers/invite.notify.test.ts`, and `app/pickup/[slug]/booking.test.ts`. NONE reference this plan's files (`digest.ts`, `app/driver/settings/*`). They are Wave-pending fan-out specs (07-03/07-04 un-stub wiring of `advanceStatus`/`inviteDriver`) and a Phase-4 booking-validation suite — out of the SCOPE BOUNDARY for this plan. Not fixed here; logged for the owning plans / verifier.

## Self-Check: PASSED

All 4 created files verified present on disk; both task commits (`481caa1`, `63ed687`) verified in git history.

---
*Phase: 07-notifications*
*Completed: 2026-06-19*
