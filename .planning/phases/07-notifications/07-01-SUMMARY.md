---
phase: 07-notifications
plan: 01
subsystem: testing
tags: [resend, supabase, postgres, rls, i18n, vitest, notifications, email]

# Dependency graph
requires:
  - phase: 06-driver-admin-views
    provides: "wp_transfers lifecycle + driver_profiles + masked wp_pool + poll-on-focus shape + single-writer money lock"
  - phase: 04-transfer
    provides: "createBooking server action + confirmation-email seam + getDict/getLang i18n"
  - phase: 03-payments
    provides: "webhook_events UNIQUE-index dedup pattern (mirrored for email_log)"
provides:
  - "resend@6.14.0 transactional email SDK installed"
  - "Migration 0007 (notifications + email_log tables, wp_transfers.locale, driver_profiles digest prefs) — AUTHORED, not applied"
  - "getDictFor(lang) cookie-free locale accessor"
  - "All Phase-7 EN/BG dictionary keys (bell/feed, notif titles, digest UI, email copy)"
  - "createBooking persists wp_transfers.locale (D-17)"
  - "8 Wave-0 Nyquist RED specs (Resend mocked) — engine, single-sender, bell RLS, assigned-email, digest, locale, arrived fan-out, invite fan-out"
affects: [07-02, 07-03, 07-04, 07-05, 07-06]

# Tech tracking
tech-stack:
  added: [resend@6.14.0]
  patterns:
    - "Cookie-free locale-by-argument accessor (getDictFor) for webhook/cron/email paths with no request cookie"
    - "Polymorphic notifications table (entity_type/entity_id, NO transfer_id) — PLAT-01 platform-generic seam"
    - "email_log UNIQUE idempotency_key dedup (mirrors webhook_events.event_id)"

key-files:
  created:
    - supabase/migrations/0007_notifications.sql
    - platform/notifications/send-email.test.ts
    - platform/notifications/single-sender.test.ts
    - platform/notifications/notifications-rls.test.ts
    - platform/notifications/assigned-email.test.ts
    - platform/notifications/digest.test.ts
    - platform/notifications/locale.test.ts
    - app/driver/advance.notify.test.ts
    - app/admin/drivers/invite.notify.test.ts
  modified:
    - package.json
    - package-lock.json
    - platform/i18n/dictionary.ts
    - platform/i18n/en.ts
    - platform/i18n/bg.ts
    - app/pickup/[slug]/actions.ts

key-decisions:
  - "Used the plan's explicit email-subject key set (emailAssignedSubject/emailArrivedSubject/emailAdminBookingSubject/emailInviteSubject/emailDigestSubject); confirmation reuses the existing confirmEmailSubject rather than the UI-SPEC's draft emailConfirmSubject name"
  - "Digest preference stored as two columns on driver_profiles (digest_enabled off-by-default + digest_send_hour) — no new table, consistent with where the driver display profile already lives"
  - "Provided real BG copy for every new key (incl. admin/invite/digest emails that are EN-only at send time) to satisfy the tsc Dict-parity gate"

patterns-established:
  - "getDictFor(lang): cookie-free dict accessor for non-request-context senders"
  - "notifications/email_log are UNPREFIXED platform-generic tables with RLS SELECT-only + no write policy (service-role-only writes)"
  - "RED Nyquist specs via runtime-string dynamic import (type-safe before impl) + comment-stripped source-grep gates (single-sender, fan-out)"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03, NOTF-05, NOTF-06]

# Metrics
duration: 18min
completed: 2026-06-19
---

# Phase 7 Plan 01: Notifications Foundation Summary

**Phase-7 vertical-enabling slice: resend@6.14.0 installed, the flagged 0007 migration authored (polymorphic notifications + email_log + wp_transfers.locale + driver_profiles digest prefs), the cookie-free getDictFor accessor + all EN/BG notification copy, createBooking locale capture, and 8 Wave-0 RED specs with Resend mocked.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-19 (continuation from approved Task 1 checkpoint)
- **Completed:** 2026-06-19
- **Tasks:** 4
- **Files modified/created:** 15 (6 modified, 9 created)

## Accomplishments
- Installed `resend@6.14.0` (checkpoint-approved official SDK; no `@react-email`, RESEND_API_KEY kept server-only).
- Authored migration `0007_notifications.sql` AUTHORED-NOT-APPLIED: polymorphic `notifications` (own-rows SELECT, no write policy) + `email_log` (UNIQUE idempotency_key, admin-read, no write policy) + `wp_transfers.locale` + `driver_profiles` digest columns, all `if not exists`, Balkanity-ref guardrail.
- Added `getDictFor(lang)` cookie-free accessor and every Phase-7 UI-SPEC key in both `en.ts` and `bg.ts` (tsc Dict parity clean).
- `createBooking` now persists `locale: lang` (D-17) with no other behavioral change (still `status:'requested'`, no paid writer).
- Landed 8 Wave-0 Nyquist RED specs with Resend mocked in every send path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install resend** - `8201e72` (chore)
2. **Task 2: Author migration 0007 (FILE ONLY)** - `d8cd1d6` (feat)
3. **Task 3: getDictFor + EN/BG keys + createBooking locale** - `30a284e` (feat)
4. **Task 4: 8 Wave-0 RED specs** - `bfa3d1c` (test)

**Plan metadata:** _(final docs commit below)_

## Files Created/Modified
- `package.json` / `package-lock.json` — resend@6.14.0 dependency.
- `supabase/migrations/0007_notifications.sql` — notifications + email_log + locale + digest prefs (authored, not applied).
- `platform/i18n/dictionary.ts` — `getDictFor(lang)` cookie-free accessor.
- `platform/i18n/en.ts` / `platform/i18n/bg.ts` — all Phase-7 bell/feed/notif/digest/email copy keys.
- `app/pickup/[slug]/actions.ts` — `getLang()` capture → `locale: lang` insert (D-17).
- `platform/notifications/{send-email,single-sender,notifications-rls,assigned-email,digest,locale}.test.ts` — 6 RED specs.
- `app/driver/advance.notify.test.ts`, `app/admin/drivers/invite.notify.test.ts` — 2 RED source-grep fan-out specs.

## Decisions Made
- Email-subject keys follow the plan's explicit `<artifacts_this_phase_produces>` list; the existing `confirmEmailSubject` is reused for confirmation (the UI-SPEC's `emailConfirmSubject` draft name was not introduced to avoid a duplicate confirmation key).
- Digest preference stored as columns on `driver_profiles` (per the plan's Task-2 directive — no separate table).
- Real BG translations provided for all new keys (Dict parity), including the EN-only-at-send admin/invite/digest email copy.

## Deviations from Plan

None - plan executed exactly as written. The only non-mechanical judgment (email-subject key naming) was resolved per the plan's explicit artifact list, which supersedes the UI-SPEC draft key name; documented above.

## Issues Encountered
- The `notifications-rls.test.ts` mock initially targeted `createServerClient`; the real `platform/supabase/server.ts` exports `createClient`. Aligned the mock to the actual export name so the future impl's import is correctly intercepted. (Mock-target correctness, not a code bug.)

## TDD Gate Compliance
Task 4 is a RED-only task by design (`tdd="true"` with no GREEN phase in this plan — implementation modules land in Plans 02–05). All 8 spec files FAIL today as required; no `feat` GREEN commit is expected for this plan. The pre-existing money-lock gates (`single-writer.test.ts`, `confirmation.test.ts`) remain GREEN after the `createBooking` locale change.

## User Setup Required
`RESEND_API_KEY` must be set server-only in Vercel production (never `NEXT_PUBLIC_`). The Vercel env presence is confirmed in Plan 06; the dashboard config + send.balkanity.com verified subdomain are phase-completion gates.

## Next Phase Readiness
- All Phase-7 primitives exist: the email SDK, the schema file, the locale accessor + copy, and the RED contract specs.
- Plan 02 builds `send-email.ts` / `templates.ts` (turns send-email, single-sender, assigned-email, locale, invite specs GREEN); Plan 03 the webhook/bell fan-out (notifications-rls); Plan 04/05 the lifecycle hooks + digest (advance.notify, digest); Plan 06 applies migration 0007 LIVE to Balkanity (signed-off gate).
- Blocker carried: migration 0007 is AUTHORED-NOT-APPLIED — the live apply is the Plan-06 BLOCKING sign-off via Management API against Balkanity ref `qyhdogajtmnvxphrslwm` only (never Kalvia).

## Self-Check: PASSED

All 11 created files verified present on disk; all 4 task commits (`8201e72`, `d8cd1d6`, `30a284e`, `bfa3d1c`) verified in git history.

---
*Phase: 07-notifications*
*Completed: 2026-06-19*
