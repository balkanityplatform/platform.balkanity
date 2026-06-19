---
phase: 07-notifications
plan: 02
subsystem: notifications
tags: [resend, supabase, service-role, idempotency, rate-limit, i18n, email, notifications]

# Dependency graph
requires:
  - phase: 07-notifications
    plan: 01
    provides: "resend@6.14.0 SDK, migration 0007 (notifications + email_log + locale + digest prefs), getDictFor(lang) accessor, all EN/BG email copy keys, Wave-0 RED specs"
  - phase: 06-driver-admin-views
    provides: "single-writer money lock + masked wp_pool shape + caller-identity→service-role gate pattern"
provides:
  - "sendEmail(opts) — THE single resend.emails.send call-site with email_log idempotency + soft-cap + per-outcome logging + cap-near admin alarm"
  - "insertNotification(opts) — service-role polymorphic notifications insert (entity_type/entity_id, no transfer_id)"
  - "markRead/markAllRead — gated service-role read-state actions scoped to recipient_id = auth.uid()"
  - "buildAssignedEmail/buildArrivedEmail/buildAdminBookingEmail/buildInviteEmail/buildDigestEmail — plain-HTML builders via getDictFor(lang)"
affects: [07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single sanctioned external-send call-site fronted by a cap/idempotency/rate guard (mirrors the single-writer money lock)"
    - "Locale-by-argument email builders (getDictFor(lang)) — no request cookie on webhook/cron paths"
    - "Gated service-role read-state mutation (caller identity → recipient_id-scoped UPDATE) instead of a client write RLS policy"

key-files:
  created:
    - platform/notifications/send-email.ts
    - platform/notifications/notify.ts
    - platform/notifications/templates.ts
  modified:
    - platform/notifications/send-email.test.ts

key-decisions:
  - "Template builders named buildAssignedEmail/buildArrivedEmail/buildAdminBookingEmail/buildInviteEmail/buildDigestEmail returning {to, subject, html} — adopted the Wave-0 spec's exact contract (assigned-email/locale tests) over the <artifacts> draft names (assignedEmail/...). The spec is the binding contract."
  - "notify.ts kept as plain server-only functions (no \"use server\" directive) so send-email.ts can import insertNotification for the cap-near alarm without pulling an action boundary; Plan 03 wraps markRead/markAllRead in a \"use server\" action file at the bell call-site."
  - "Cap-near admin alarm (D-11) raised in-app only (NO email — free against the cap), de-duped to one email_cap_near per UTC day, wrapped in its own try/catch so it never affects the send outcome."

patterns-established:
  - "sendEmail is the ONLY resend.emails.send call-site (single-sender grep gate); three-layer dedup = email_log check + UNIQUE index + Resend native idempotencyKey 2nd arg"
  - "best_effort soft-cap at EMAIL_SOFT_CAP returns skipped_cap (logged, not sent, not retried); critical always sends"
  - "Email builders HTML-escape all interpolated values; only buildAssignedEmail carries driver name+phone and its `to` is always guest_email"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03, NOTF-06]

# Metrics
duration: 3min
completed: 2026-06-19
---

# Phase 7 Plan 02: Notification Engine Summary

**The Phase-7 notification seam: sendEmail (the single idempotent, cap-guarded, rate-aware Resend call-site), insertNotification + gated markRead/markAllRead service-role actions, and five plain-HTML locale-resolved email builders — with the send-email, single-sender, assigned-email, and locale Wave-0 specs now GREEN and the money lock intact.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-19T16:04:05Z
- **Completed:** 2026-06-19T16:07:10Z
- **Tasks:** 2
- **Files modified/created:** 4 (3 created, 1 test modified)

## Accomplishments
- `platform/notifications/send-email.ts` — `import "server-only"` line 1; THE single `resend.emails.send` call-site fronted by: (1) email_log idempotency check-before-send (prior `sent` → `duplicate`, no re-send), (2) today-UTC daily-count head query, (3) best_effort soft-cap at `EMAIL_SOFT_CAP` (default 90) → `skipped_cap` logged-not-sent-not-retried while `critical` always sends, (4) Resend native `idempotencyKey` 2nd arg (24h dedup), (5) per-outcome `email_log` insert, (6) D-11 cap-near admin in-app alarm (free against the cap, de-duped per UTC day, isolated try/catch). Zero `wp_transfers` writes.
- `platform/notifications/notify.ts` — `insertNotification` (service-role polymorphic `notifications` insert: `entity_type`/`entity_id`, NEVER a `transfer_id` column; non-fatal try/catch) + `markRead`/`markAllRead` (gated service-role: caller identity via `auth.getUser()` then UPDATE scoped to `recipient_id = auth.uid()` so a forged call matches 0 rows — no client write RLS policy).
- `platform/notifications/templates.ts` — `import "server-only"` line 1; `fill()` token helper + a single-column ~560px shell (teal #029B87 accent / slate #2F4858 body, ≤1 CTA). Five builders resolve copy by `getDictFor(lang)` argument (no request cookie, Pitfall 2): `buildAssignedEmail` (ONLY driver name+phone, to=guest_email, locale-resolved), `buildArrivedEmail` (no PII), `buildAdminBookingEmail`/`buildInviteEmail` (EN-only, invite has the one "Set your password" CTA), `buildDigestEmail` (masked operational fields only, no guest PII). All interpolation HTML-escaped. No react-email.

## Task Commits

1. **Task 1: sendEmail single Resend call-site + notify.ts dep** — `5f91c5b` (feat)
2. **Task 2: plain-HTML template builders** — `50d19df` (feat)

`notify.ts` landed with Task 1 (rather than Task 2) because `send-email.ts` imports `insertNotification` for the cap-near alarm — keeping each commit independently type-checkable.

## Files Created/Modified
- `platform/notifications/send-email.ts` — the single Resend call-site with cap/idempotency/rate guard (created).
- `platform/notifications/notify.ts` — insertNotification + gated markRead/markAllRead (created).
- `platform/notifications/templates.ts` — five plain-HTML email builders (created).
- `platform/notifications/send-email.test.ts` — Resend mock changed from a `vi.fn(() => obj)` arrow to a constructable `class` (modified; see Deviations).

## Decisions Made
- **Template names follow the spec contract, not the draft `<artifacts>` names.** The Wave-0 `assigned-email.test.ts` / `locale.test.ts` import `buildAssignedEmail` / `buildInviteEmail` returning `{ to, subject, html }`; the plan's `<artifacts_this_phase_produces>` draft listed `assignedEmail`/`arrivedEmail`/etc. returning `{ subject, html }`. The executing spec is the binding contract, so the `build*` names + `{to, subject, html}` shape were adopted (downstream Plans 03/05 call these builders).
- **notify.ts is plain server-only (no `"use server"`).** This lets `send-email.ts` import `insertNotification` for the cap-near alarm without crossing an action boundary; Plan 03 will wrap `markRead`/`markAllRead` in a `"use server"` action file at the bell call-site (documented per the plan's "pick the simpler wiring and document it" directive).
- **Cap-near alarm is in-app only and best-effort.** D-11 raised as an `email_cap_near` notification (no email — free against the cap), de-duped to once per UTC day, in its own try/catch so it can never alter the send outcome.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] send-email.test.ts Resend mock was not constructable under vitest v4**
- **Found during:** Task 1 (GREEN run)
- **Issue:** The Plan-01 RED spec mocked `Resend: vi.fn(() => ({ emails: { send } }))`. The real Resend SDK is `new Resend(key)`, but vitest v4 treats a `vi.fn` with an arrow implementation as non-constructable ("`() => (...)` is not a constructor"), so the "critical over the cap STILL sends" assertion threw a TypeError instead of exercising the send path.
- **Fix:** Replaced the mock with a constructable `class { emails = { send: emailsSend } }`, preserving the exact `emailsSend` spy and every assertion (cap, idempotency, critical-always-sends). Production code keeps the SDK-correct `new Resend(...)`.
- **Files modified:** `platform/notifications/send-email.test.ts`
- **Commit:** `5f91c5b`

## Verification Results
- `npx vitest run platform/notifications/send-email.test.ts platform/notifications/single-sender.test.ts platform/payments/single-writer.test.ts` — 7/7 GREEN (cap/idempotency/single-sender + money lock).
- `npx vitest run platform/notifications/assigned-email.test.ts platform/notifications/locale.test.ts` — 5/5 GREEN (driver name+phone in body, to=guest_email, BG/EN/invite-EN locale resolution).
- `npx tsc --noEmit` — clean (exit 0).
- Grep gates: `getDictFor` in templates.ts, `from("notifications")` in notify.ts, `from("email_log")` in send-email.ts, no react-email import (comment-only match), no `status: 'paid'` writer (comment-only match).
- `confirmation.test.ts` + `single-writer.test.ts` — still GREEN (no new paid writer).
- `digest.test.ts` (Plan 05's `digest.ts`) and `notifications-rls.test.ts` (Plan 03's `refetchNotifications`) remain RED by design — those modules land in later plans.

## Threat Surface Notes
All Plan threat-model mitigations applied: T-07-SE1 (`import "server-only"` line 1 of all three modules; keys read from non-NEXT_PUBLIC_ names), T-07-SE2 (single sanctioned Resend call-site + best_effort soft-cap), T-07-SE3 (three-layer dedup), T-07-SE4 (no client write policy; service-role-only inserts; recipient-scoped read-state UPDATEs), T-07-SE5 (zero wp_transfers writes), T-07-SE6 (only assignedEmail carries driver name+phone, to=guest_email; arrived/admin/digest carry none). No new threat surface beyond the plan's register.

## Next Plan Readiness
- Plan 03 (un-stub + fan-out) can now call `sendEmail` (swaps confirmation-email.ts's console.info reveal for a `critical` send + idempotency key), `insertNotification` for the bell feed, and `buildAssignedEmail`/`buildArrivedEmail`/`buildAdminBookingEmail`/`buildInviteEmail`; and wrap `markRead`/`markAllRead` in a `"use server"` action file. Plan 05's digest.ts consumes `buildDigestEmail`.
- Blocker carried from Plan 01: migration 0007 is AUTHORED-NOT-APPLIED — the live apply to Balkanity ref `qyhdogajtmnvxphrslwm` (never Kalvia) is the Plan-06 BLOCKING signed-off task. Until then these modules type-check and unit-test against mocks but cannot run against the live DB.

## Self-Check: PASSED

All 3 created files verified present on disk; both task commits (`5f91c5b`, `50d19df`) verified in git history.

---
*Phase: 07-notifications*
*Completed: 2026-06-19*
