---
phase: 02-supply-side-onboarding
plan: 05
subsystem: admin-console
tags: [nextjs-app-router, server-actions, service-role, gotrue-admin, generate-link, invite, zod, auth]

# Dependency graph
requires:
  - phase: 02-supply-side-onboarding
    provides: "02-02: live supply schema (companies/properties/destinations/driver_profiles) + admin-only RLS, /admin/companies CRUD pattern (RSC anon read + service-role write behind getCurrentRole() re-gate), shared UI primitives (TextField/DataList/Button)"
  - phase: 01-platform-foundation
    provides: "01-03/01-04: getCurrentRole() authz, createAdminClient() service-role (server-only), /auth/confirm route that already allowlists type=invite → /set-password, forgot-password trusted NEXT_PUBLIC_SITE_URL redirect-base pattern"
provides:
  - "/admin/drivers end-to-end invite slice (ONBD-05 / AUTH-03): admin enters email+name+phone → inviteDriver server action calls auth.admin.generateLink({type:'invite'}) (creates the auth user + returns the set-password link, sends NO email — D-03), writes app_users.role='driver' (literal, server-side) + driver_profiles, and the console reveals the action_link inline for manual copy (D-04)"
  - "The closed driver pool (AUTH-03): generateLink({type:'invite'}) is the ONLY account-creation path — no open driver signup route exists"
  - "NOTF-04 stubbed as a copy-paste link in Phase 2; the Resend invite-email send wires in Phase 7"
  - "tests/e2e/driver-invite.spec.ts — admin-gate + invite-link-resolves-to-/set-password e2e (the redirect-allowlist proof)"
affects: [03-payments, 05-claim-correctness, 06-driver-views, 07-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin-invite account creation: auth.admin.generateLink({type:'invite'}) creates auth.users + auth.identities AND returns properties.action_link WITHOUT sending email (D-03) — never a raw auth.users INSERT (T-02-TMP8); the only driver-account path (AUTH-03)"
    - "Trusted redirect base reuse: redirectTo = ${NEXT_PUBLIC_SITE_URL}/auth/confirm?type=invite (the server constant, never the Origin header — WR-04 / T-02-TMP7); the URL must live in the Supabase Redirect-URLs allowlist or Supabase silently falls back to Site URL (RESEARCH Pitfall 1)"
    - "Reveal-link-instead-of-email island: InviteDriverForm mirrors ForgotPasswordForm's success-replaces-form pattern but renders the returned action_link in a read-only copy field + delivery note (D-04) rather than confirming an email send"

key-files:
  created:
    - app/admin/drivers/actions.ts
    - app/admin/drivers/page.tsx
    - app/admin/drivers/DriversView.tsx
    - app/admin/drivers/InviteDriverForm.tsx
    - app/admin/drivers/invite.test.ts
    - tests/e2e/driver-invite.spec.ts
  modified: []

key-decisions:
  - "generateLink (no email) over inviteUserByEmail (D-03): the action creates the user and returns the set-password link for manual copy; no Resend send in Phase 2 (NOTF-04 stubbed, wires in Phase 7)"
  - "Role written as the literal 'driver' server-side, never derived from FormData (mass-assignment / self-promotion defense, T-02-EOP5); no open signup route — invite is the only driver-account path (AUTH-03)"
  - "Re-invite (Pitfall 4) returns a single generic admin-facing driverAlreadyInvited message whether generateLink errors OR the app_users unique-email insert fails — no error-copy branch on provider detail (no account enumeration, T-02-ID5, mirrors forgot-password)"
  - "redirect base is the trusted NEXT_PUBLIC_SITE_URL constant (not the Origin header, WR-04); the target must be in the Supabase Redirect-URLs allowlist (Task 3 project-config gate, applied by the orchestrator)"

patterns-established:
  - "Admin-invite-creates-account: the two-gate write security (admin-only RLS + getCurrentRole() re-gate) now also fronts a GoTrue admin account-creation call, reusing the existing /auth/confirm → /set-password machinery with no new auth route"

requirements-completed: [ONBD-05]
requirements-pending-uat: [AUTH-03, NOTF-04]

# Metrics
duration: continuation
completed: 2026-06-18
---

# Phase 2 Plan 05: Driver-Invite Vertical Slice Summary

**Shipped /admin/drivers — the one genuinely new primitive of Phase 2 — as an end-to-end admin invite slice (ONBD-05 / AUTH-03): an admin enters a driver's email + name + phone, the `inviteDriver` server action calls `auth.admin.generateLink({type:'invite'})` to create the auth user and return a set-password link WITHOUT sending email (D-03), writes `app_users.role='driver'` (literal, server-side) + the `driver_profiles` row, and the console reveals the link inline for manual copy (D-04) — reusing the existing `/auth/confirm?type=invite` → `/set-password` machinery with no new auth route, so the invite is the only path to a driver account (AUTH-03) and NOTF-04 is stubbed as a copy-paste link until Phase 7.**

## Performance

- **Duration:** continuation (tasks 1–3 automation committed in the prior wave; this run finalizes docs/state after the blocking project-config gate was satisfied)
- **Completed:** 2026-06-18
- **Tasks:** 3 of 3 (2 auto + 1 checkpoint, automation portion) executed; 1 manual UAT step remains open (see below)
- **Files:** 6 created, 0 modified

## Accomplishments

- **inviteDriver server action (Task 1):** `app/admin/drivers/actions.ts` (`"use server"`) re-gates `getCurrentRole() !== "admin"` (the only authz gate — the service-role writes bypass RLS), zod-validates email/name/optional-phone (generic `fieldRequired`), computes the trusted base from `NEXT_PUBLIC_SITE_URL` (never the Origin header — WR-04), calls `generateLink({ type:"invite", email, options:{ redirectTo: \`${base}/auth/confirm?type=invite\`, data:{ name } } })` (creates the auth user + returns `properties.action_link`, sends NO email — D-03), then service-role inserts `app_users{ role:'driver' }` (literal) + `driver_profiles{ name, phone }`, returns the `actionLink`. Re-invite (Pitfall 4) collapses to a single generic `driverAlreadyInvited` whether GoTrue errors or the unique-email insert fails. Proven by `invite.test.ts` (role=driver written, link returned, no send, non-admin blocked).
- **Drivers page + invite island (Task 2):** `page.tsx` (RSC) admin-gates and reads the invited-driver list via the anon cookie-bound client (no `createAdminClient` on the read path); `DriversView` renders the `DataList` + empty state + the invite form; `InviteDriverForm` (client island) uses `useActionState(inviteDriver)` with email+name+phone fields and, on `status:"ok"`, replaces the form (ForgotPasswordForm pattern) with a `role="status"` block showing the returned `actionLink` in a read-only copy field plus the `inviteLinkDeliveryNote` — no email sent (D-03/D-04).
- **Driver-invite e2e + redirect-allowlist gate (Task 3 automation):** `tests/e2e/driver-invite.spec.ts` asserts the admin gate and that the generated invite link routes through `/auth/confirm` to `/set-password` (the redirect-allowlist proof, RESEARCH Pitfall 1). The blocking project-config (Supabase Redirect-URLs allowlist + Vercel `NEXT_PUBLIC_SITE_URL`) was the checkpoint gate — now applied (below).

## Task Commits

1. **Task 1: inviteDriver server action (generateLink + role/profile write) + invite unit test** — `53e3f4c` (feat)
2. **Task 2: /admin/drivers page + InviteDriverForm island (reveals link)** — `0f45a94` (feat)
3. **Task 3 (automation): driver-invite e2e — admin gate + manual checkpoint steps** — `443c4ec` (test)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified

- `app/admin/drivers/actions.ts` — `inviteDriver` server action: admin re-gate + zod + trusted `NEXT_PUBLIC_SITE_URL` base + `generateLink({type:'invite'})` (no email, D-03) + service-role `role:'driver'` literal + `driver_profiles` write + generic re-invite handling; returns `action_link`.
- `app/admin/drivers/page.tsx` — admin-gated RSC; anon-client read of the invited-driver list; prop-bag handoff to `DriversView`.
- `app/admin/drivers/DriversView.tsx` — slate console chrome + `DataList` of invited drivers + empty state + the invite form.
- `app/admin/drivers/InviteDriverForm.tsx` — client island; `useActionState(inviteDriver)`; email+name+phone fields; on success reveals the returned `actionLink` (read-only + copy) with the delivery note (no email).
- `app/admin/drivers/invite.test.ts` — unit test: role=driver written, link returned, no email-send call, non-admin blocked (generateLink not called).
- `tests/e2e/driver-invite.spec.ts` — Playwright: admin gate + invite link resolves through `/auth/confirm?type=invite` to `/set-password`.

## Project Config Applied (Task 3 checkpoint — now satisfied)

The blocking human-verify checkpoint required project config (dashboard / Management API, not code) so `redirectTo` is honored rather than silently falling back to Site URL (RESEARCH Pitfall 1). Both are now applied by the orchestrator on the **Balkanity** project (`qyhdogajtmnvxphrslwm` — confirmed NOT Kalvia `utyatpadtibqqswsfvtr`):

- **Supabase Auth `uri_allow_list`** now includes: `https://balkanityplatformproject.vercel.app/auth/confirm`, `https://balkanityplatformproject.vercel.app/**`, `http://localhost:3000/auth/confirm`, `http://localhost:3000/**`. `site_url` = `https://balkanityplatformproject.vercel.app` (unchanged).
- **Vercel env `NEXT_PUBLIC_SITE_URL`** = `https://balkanityplatformproject.vercel.app` set on production + preview (sensitive); a production redeploy was triggered to bake it in.

## Open Manual UAT (single remaining verification item — NOT a code gap)

One signed-in production walkthrough remains. It cannot be automated in this environment (no browser/admin session here) and is the final hands-on proof of AUTH-03 + NOTF-04 end-to-end:

1. Admin logs in to production → opens `/admin/drivers`.
2. Submits the invite form with a test driver email + name + phone.
3. Confirm the revealed set-password `action_link` contains `/auth/confirm?type=invite` and, when opened, resolves to `/set-password` (proving the allowlist is honored — Pitfall 1 cleared).
4. Set a password and confirm the account resolves to the driver role.

This creates a real auth user. Until run, AUTH-03 and NOTF-04 are recorded **complete-pending-UAT** in REQUIREMENTS.md (the code + project config that satisfy them are shipped; only the live signed-in walkthrough is outstanding). ONBD-05 is complete (the invite surface itself ships and is unit/e2e covered).

## Decisions Made

- **generateLink (no email) over inviteUserByEmail (D-03).** The action creates the user and returns the link for manual copy; no Resend send in Phase 2. NOTF-04 is intentionally stubbed as a copy-paste link and wires to the Resend wrapper in Phase 7.
- **Role is the literal `'driver'` written server-side (T-02-EOP5).** Never derived from FormData; no open signup route exists, so the admin invite is the only driver-account path (AUTH-03).
- **Single generic re-invite message (Pitfall 4 / T-02-ID5).** Both a GoTrue "already registered" error and the `app_users` unique-email insert failure return `driverAlreadyInvited` — no error-copy branch on provider detail (no account enumeration; mirrors forgot-password).
- **Trusted redirect base (WR-04 / T-02-TMP7).** `redirectTo` uses the `NEXT_PUBLIC_SITE_URL` constant, never the Origin header; the URL must be allowlisted (Task 3 project-config gate, now applied).

## Deviations from Plan

None — the plan executed as written. Tasks 1–2 shipped exactly to the acceptance criteria; Task 3's automation (the e2e + checkpoint) ran, the human-verify gate paused for the Supabase/Vercel project config, and that config has now been applied. The only carry-forward is the live signed-in walkthrough, which is the checkpoint's own manual UAT step (documented above), not a code change.

## Issues Encountered

None blocking. The plan's one designed pause — the blocking human-verify project-config checkpoint (Redirect-URLs allowlist + `NEXT_PUBLIC_SITE_URL`) — resolved as intended once the orchestrator applied the config.

## Threat Surface

All six threats in the plan's register are mitigated as designed:

- **T-02-TMP7** (open-redirect via attacker base) — `redirectTo` uses the trusted `NEXT_PUBLIC_SITE_URL` constant, never the Origin header; the URL is now in the Supabase Redirect-URLs allowlist (project config applied).
- **T-02-EOP5** (self-promotion / mass-assignment) — `role:'driver'` written as the literal server-side, never from FormData; no open signup; invite action admin re-gated.
- **T-02-ID5** (account enumeration on re-invite) — single generic `driverAlreadyInvited` for both error paths.
- **T-02-ID6** (service-role / link over-logging) — `createAdminClient` only in the `"use server"` action (`admin.ts` `import "server-only"`); the `action_link` is returned to the admin UI for copy, not logged broadly.
- **T-02-TMP8** (raw auth.users INSERT) — account created via the GoTrue admin API (`generateLink`), preserving `auth.identities`.
- **T-02-SC** (package installs) — no new package this plan; slopcheck N/A.

No new security-relevant surface beyond the plan's threat model.

## Known Stubs

- **NOTF-04 invite email (intentional, by design — D-03).** Phase 2 reveals the set-password `action_link` inline in the console for manual copy instead of sending an invite email. The Resend send wires in Phase 7 (Notifications). This is the planned stub, not an incomplete slice — ONBD-05/AUTH-03 are fully functional without it.

## Next Phase Readiness

- The closed driver pool now exists (AUTH-03): drivers can be invited and set a password, which Phase 5 (claim correctness) and Phase 6 (driver views) build on.
- The `generateLink` + `/auth/confirm?type=invite` → `/set-password` pattern + the Redirect-URLs allowlist are proven; Phase 7 only needs to swap the manual copy for a Resend send (NOTF-04).
- No blockers. One open manual UAT (the signed-in production walkthrough) is tracked above.

## Self-Check: PASSED

All 6 created source files exist on disk; all three task commits (`53e3f4c`, `0f45a94`, `443c4ec`) found in git history.

---
*Phase: 02-supply-side-onboarding*
*Completed: 2026-06-18*
