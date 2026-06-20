---
status: partial
phase: 07-notifications
plan: 07-06
updated: 2026-06-20
---

# Phase 7 — Live Operational Gate Evidence (07-06)

Plans 01–05 are code-complete and the full unit suite is GREEN (158 passed, 6 skipped, 0 failed; tsc clean). This file records the live-infrastructure gates. Two of the three gates are deferred (see TODOs) because the operator did not have DNS/domain access at execution time.

## Task 1 — Resend `send.balkanity.com` verification + `RESEND_API_KEY` (Vercel) — ⏳ DEFERRED

**Status:** Not done — operator lacks domain/DNS access at this time. Tracked as a TODO below.

- `send.balkanity.com` is NOT yet verified in Resend. Current sender remains the test sender `onboarding@resend.dev` (delivers only to `balkanityplatform@gmail.com`).
- `RESEND_API_KEY` server-only presence in Vercel production: NOT confirmed this session.
- Target verified sender once done: `noreply@send.balkanity.com`.

## Task 2 — Apply migration 0007 LIVE to Balkanity — ✅ DONE (2026-06-20)

**Sign-off:** Operator approved the flagged/irreversible apply ("Approved — apply now").

**Ref guardrail (re-asserted before apply):** The Management token (`SUPABASE_ACCESS_TOKEN`, `sbp_…`) reaches exactly ONE project:
`qyhdogajtmnvxphrslwm | balkanityplatform's Project | eu-central-1`.
Kalvia (`utyatpadtibqqswsfvtr`) is NOT reachable/present — confirmed absent.

**Apply path:** Supabase Management API `POST /v1/projects/qyhdogajtmnvxphrslwm/database/query` with the full `supabase/migrations/0007_notifications.sql` body. NOT MCP, NOT `supabase db push`. Response: HTTP `201`, body `[]` (DDL, no rows).

**Live verification queries (all passed against the live DB):**

| Check | Result |
|-------|--------|
| Tables exist | `notifications`, `email_log` ✓ |
| RLS enabled | `notifications` = true, `email_log` = true ✓ |
| Policies (SELECT-only, NO write policy) | `notifications_own_read` (SELECT), `email_log_admin_read` (SELECT) ✓ |
| `wp_transfers.locale` | `text`, nullable ✓ (D-17) |
| `driver_profiles.digest_enabled` | `boolean` default `false` ✓ (D-07) |
| `driver_profiles.digest_send_hour` | `smallint`, default null ✓ (D-08) |
| `email_log` idempotency index | `email_log_idempotency_key_key` — **UNIQUE = true** ✓ (race-safe dedup authority) |
| Indexes | `notifications_recipient_unread_idx`, `email_log_created_at_idx` ✓ |

Migration is additive (`create … if not exists`) and re-runnable; no-write-policy lock intact (only SELECT policies on both new tables).

## Task 3 — Live email delivery + end-to-end fan-out UAT (D-15 completion gate) — ⏳ DEFERRED

**Status:** Blocked on Task 1 (a verified sender is required to prove real delivery). Tracked as a TODO below. The D-15 completion gate (a real email delivered from the verified subdomain) is NOT yet met, so Phase 7 cannot be marked fully complete.

---

## Outstanding TODOs (Phase 7 completion blockers)

1. **Verify `send.balkanity.com` in Resend** (add MX on `send` → `feedback-smtp.<region>.amazonses.com` pri 10, SPF TXT on `send` → `v=spf1 include:amazonses.com ~all`, DKIM TXT on `resend._domainkey`; values copied verbatim from the Resend dashboard) and **confirm `RESEND_API_KEY` is set server-only in Vercel production**. Then record the verified sender + env status here.
2. **Run the D-15 live-delivery + end-to-end fan-out UAT** on `balkanityplatformproject.vercel.app` with the verified `noreply@send.balkanity.com` sender: booking → guest confirmation + admin alert email + admin/all-drivers in-app; claim → guest driver-assigned email (name + phone) + driver `run_assigned`; arrived email (en_route silent); invite email-only with a working set-password link and NO inline reveal; bell unread-count / mark-read-on-open / mark-all-read / focus-poll for driver + admin. Record pass/fail per item + the delivered-email evidence here.

When both are done, re-run `/gsd:execute-phase 7` to close 07-06 and complete phase verification.
