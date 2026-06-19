---
phase: 07-notifications
plan: 03
subsystem: notifications
tags: [bell, feed, poll-on-focus, rls, own-rows, server-actions, i18n, ui, driver, admin]

# Dependency graph
requires:
  - phase: 07-notifications
    plan: 01
    provides: "migration 0007 notifications table + notifications_own_read RLS, Phase-7 EN/BG alerts copy keys, notifications-rls Wave-0 RED spec"
  - phase: 07-notifications
    plan: 02
    provides: "notify.ts gated markRead/markAllRead (caller-identity → recipient-scoped service-role UPDATE), insertNotification"
  - phase: 06-driver-admin-views
    provides: "PoolView poll-on-focus shape (focus + visibilitychange + ~25s interval), refetchPool caller-auth single-read discipline, warm-light driver + slate admin chromes"
provides:
  - "readOwnNotifications() — caller-auth own-rows-only notifications read (newest-first); the SINGLE read shape behind both the RSC seed and the client poll"
  - "refetchNotifications() — \"use server\" live-poll action (reuses readOwnNotifications; pinned own-rows-only by notifications-rls.test.ts)"
  - "NotificationBell — Alerts trigger + teal unread badge + feed panel client island (poll-on-focus, mark-on-open, Mark-all-read)"
affects: [07-04, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single own-rows-only read shape (readOwnNotifications) reused by RSC seed + client poll — the poll can never widen the surface (mirrors wp_pool / refetchPool)"
    - "Bell mounted via RSC role gate + server-seeded initial; admin reuses the driver bell component (D-08)"

key-files:
  created:
    - platform/notifications/feed.ts
    - app/notifications/actions.ts
    - platform/ui/NotificationBell.tsx
  modified:
    - platform/notifications/notify.ts
    - app/driver/page.tsx
    - app/driver/PoolView.tsx
    - app/driver/run/page.tsx
    - app/driver/run/RunView.tsx
    - app/admin/page.tsx
    - app/admin/drivers/page.tsx
    - app/admin/drivers/DriversView.tsx

key-decisions:
  - "refetchNotifications is exported from notify.ts (delegating to feed.ts readOwnNotifications) because the Wave-0 notifications-rls.test.ts imports it from @/platform/notifications/notify — the spec is the binding contract; app/notifications/actions.ts re-exports it as the client-callable \"use server\" seam."
  - "The email_cap_near text marker is the pre-rendered notification title itself (\"Email cap nearing — best-effort emails paused\"), so the coral dot + title are the two WCAG-1.4.1 cues — no extra copy key needed."
  - "Bell poll listeners bind inside the useEffect keyed on the stable `poll` callback (no render-time pollRef.current write) — the verbatim PoolView ref pattern trips the project's react-hooks/refs lint rule; same lifecycle, lint-clean."

patterns-established:
  - "readOwnNotifications is the one caller-auth (never service-role) own-rows read; RSC seed + poll both call it so the poll surface == the RSC surface"
  - "Bell is server-seeded behind getCurrentRole(); guests get no bell on /pickup, /status, /track (D-01)"

requirements-completed: [NOTF-01]

# Metrics
duration: 7min
completed: 2026-06-19
---

# Phase 7 Plan 03: In-app Notification Bell + Feed Summary

**The user-observable NOTF-01 slice: a labelled "Alerts" bell + teal unread badge + feed panel that reads ONLY the caller's own notifications (caller-auth RLS, never service-role), polls on focus + visibilitychange + a ~25s interval (the proven PoolView shape, NOT a push subscription — D-04), marks read on open with an explicit Mark-all-read, and is mounted header-right in both the driver warm-light and admin slate chromes (guests get none) — with the notifications-rls Wave-0 spec now GREEN.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-19T16:11:00Z
- **Completed:** 2026-06-19T16:18:35Z
- **Tasks:** 3
- **Files created/modified:** 11 (3 created, 8 modified)

## Accomplishments
- `platform/notifications/feed.ts` — `import "server-only"` line 1; `readOwnNotifications(): Promise<NotificationRow[]>` reads `notifications` via the CALLER-AUTH `createClient` (never `createAdminClient`), `select(...).order('created_at', desc)` with NO manual recipient filter — RLS `notifications_own_read` is the recipient gate (T-07-BELL1). Defines the `NotificationRow` type (polymorphic entity_type/entity_id — no transfer_id). A transient read error returns `[]` (poll keeps last-good). This is the single read shape behind both the RSC seed and the poll.
- `platform/notifications/notify.ts` — added `refetchNotifications()` delegating to `readOwnNotifications()` so the Wave-0 `notifications-rls.test.ts` (which imports it from this module) pins the own-rows-only contract.
- `app/notifications/actions.ts` — `"use server"` seam re-exporting `refetchNotifications` (poll read) + thin wrappers over the Plan-02 gated `markRead`/`markAllRead`. No client write RLS policy; zero wp_transfers writes.
- `platform/ui/NotificationBell.tsx` — `"use client"` island. Labelled "Alerts" TEXT trigger + teal `h-[18px] min-w-[18px]` numeric badge (hidden at 0, "9+" past 9); `aria-label` = "Alerts, {count} unread". NO glyph / NO emoji / NO Unicode bell. Poll copied from PoolView: focus + visibilitychange + `POLL_INTERVAL_MS = 25_000` (no push subscription, D-04). Feed panel (~360px / clamped to viewport): own rows newest-first; unread = teal dot + 600 title, read = grey 400; `email_cap_near` = coral dot + its title text marker (never colour alone). Mark-on-open (optimistic + `markAllRead`) + explicit Mark-all-read CTA; neutral empty state; coral Toast only on genuine failure. All hit targets ≥44px.
- Bell mounted header-right (next to LanguageToggle) in: driver pool (`app/driver/page.tsx` → `PoolView`), driver run (`app/driver/run/page.tsx` → `RunView`), admin console (`app/admin/page.tsx`), admin drivers (`app/admin/drivers/page.tsx` → `DriversView`). Each RSC seeds `initial` via a role-gated `readOwnNotifications()` after the `getCurrentRole()` gate; copy resolved server-side (no-flash). Admin reuses the driver bell component (D-08). Guests get NO bell.

## Task Commits

1. **Task 1: feed read + notifications server actions** — `f442e34` (feat)
2. **Task 2: NotificationBell client island** — `3d17fb4` (feat)
3. **Task 3: mount the bell in driver + admin chromes** — `c040f6c` (feat)
4. **Lint fix: bell poll listeners in effect (no render-time ref write)** — `a9918be` (fix)

## Files Created/Modified
- `platform/notifications/feed.ts` — caller-auth own-rows-only read + NotificationRow type (created).
- `app/notifications/actions.ts` — "use server" refetch/markRead/markAllRead seam (created).
- `platform/ui/NotificationBell.tsx` — Alerts bell + badge + feed panel island (created).
- `platform/notifications/notify.ts` — added refetchNotifications delegate (modified).
- `app/driver/page.tsx`, `app/driver/PoolView.tsx` — seed + mount bell on the driver pool (modified).
- `app/driver/run/page.tsx`, `app/driver/run/RunView.tsx` — seed + mount bell on the driver run (modified).
- `app/admin/page.tsx` — seed + mount bell on the admin console (modified).
- `app/admin/drivers/page.tsx`, `app/admin/drivers/DriversView.tsx` — seed + mount bell on admin drivers (modified).

## Decisions Made
- **`refetchNotifications` lives in `notify.ts`, re-exported by `actions.ts`.** The Wave-0 `notifications-rls.test.ts` imports `refetchNotifications` from `@/platform/notifications/notify` (the binding contract). The plan's prose placed `refetchNotifications` in `actions.ts` and `readOwnNotifications` in `feed.ts`. Resolved by keeping `readOwnNotifications` (feed.ts) as the single read, adding a thin `refetchNotifications` delegate in `notify.ts` (so the spec passes on that module), and re-exporting it from `app/notifications/actions.ts` as the client-callable `"use server"` seam. One read shape end-to-end; the spec contract is honoured.
- **The `email_cap_near` text marker is the notification's own title.** Plan 02 seeds these alarms with the title "Email cap nearing — best-effort emails paused". The UI-SPEC requires a coral dot PLUS a text marker (WCAG 1.4.1). The pre-rendered title already carries the marker text, so the coral dot + title are the two cues — no extra `capNearMarker` copy key (which doesn't exist in the dictionary) was invented.
- **Poll listeners bind in the effect, not via a render-time ref write.** See Deviations (Rule 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The verbatim-copied PoolView `pollRef.current = poll` pattern trips the project lint rule**
- **Found during:** Task 2 (post-implementation eslint)
- **Issue:** The plan instructs copying PoolView's poll mechanism VERBATIM, which assigns `pollRef.current = poll` during render. The project's `react-hooks/refs` rule errors on this ("Cannot access refs during render"). PoolView predates the rule; the new file must satisfy it.
- **Fix:** Since `poll` is a `useCallback` with empty deps (stable), the ref is unnecessary — the `focus`/`visibilitychange` listeners + interval bind once inside the `useEffect` keyed on `poll`, with the same mount/unmount lifecycle. Also dropped the unused `markRead` import (mark-on-open uses `markAllRead`).
- **Files modified:** `platform/ui/NotificationBell.tsx`
- **Commit:** `a9918be`

### Out-of-scope discoveries (logged, NOT fixed — see deferred-items.md)
- `app/pickup/[slug]/booking.test.ts` (8 failing) — a PRE-EXISTING breakage from Plan 07-01 (the booking action began importing `getLang` from the i18n dictionary; the test's `vi.mock` only stubs `getDict`). Proven pre-existing: the test passed 8/8 at commit `122df2e` and the booking source is untouched by this plan. Logged to `deferred-items.md`; fix belongs to the Plan 07-01 follow-up / Plan 04 un-stub. Not touched (the bell does not touch `app/pickup`).
- `digest.test.ts` (NOTF-05, Plan 05), `invite.notify.test.ts` + `advance.notify.test.ts` (NOTF-02/04, Plan 04) remain RED by design — later-plan TDD baselines.

## Verification Results
- `npx vitest run platform/notifications/notifications-rls.test.ts` — GREEN (1/1): the caller-auth read returns own-rows-only (RED → GREEN).
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint` on all created/modified files — clean (exit 0).
- Task 2 gates: `25_000` present, `visibilitychange` present, no `supabase.channel`/`postgres_changes`/`realtime`, no `🔔`.
- Task 3 gates: `NotificationBell` present in `app/driver` + `app/admin`; `readOwnNotifications` in `app/driver/page.tsx`; `NotificationBell` ABSENT from `app/pickup`, `app/status`, `app/track` (all three dirs exist, so the negative grep is meaningful).
- All Phase-7 Plan-01/02 specs still GREEN (send-email, single-sender, assigned-email, locale); money lock (single-writer) intact.

## Threat Surface Notes
All Plan threat-model mitigations applied:
- **T-07-BELL1** (read widening): `feed.ts` uses the caller-auth `createClient` only; RLS `notifications_own_read` is the recipient gate; `refetchNotifications`/poll reuse the exact same read — the poll cannot widen the surface.
- **T-07-BELL2** (non-driver/admin reaching the bell): every mounting RSC re-gates with `getCurrentRole()` (never getSession) before the seed read; guests get no bell (D-01).
- **T-07-BELL3** (tampering with another user's read-state): `markRead`/`markAllRead` are the Plan-02 gated service-role actions scoped to `recipient_id = auth.uid()`; no client write RLS policy added.
- **T-07-BELL4** (stale SW-cached unread): the bell data path is live poll-on-focus; no SW caching introduced for the notifications path.
No new threat surface beyond the plan's register.

## Self-Check: PASSED

All 3 created files verified present on disk; all 4 task commits (`f442e34`, `3d17fb4`, `c040f6c`, `a9918be`) verified in git history; the plan's verification gate (notifications-rls GREEN + tsc clean) re-confirmed.

---
*Phase: 07-notifications*
*Completed: 2026-06-19*
