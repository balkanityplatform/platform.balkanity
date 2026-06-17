---
phase: 01-platform-foundation
plan: 02
subsystem: infra
tags: [supabase, ssr, server-only, rls, migration, app_users, auth, security]

# Dependency graph
requires:
  - "01-01 (Next 16 scaffold, platform/ seam, test runners, .env.local.example)"
provides:
  - Three-way Supabase client split — browser-anon (client.ts), server-anon cookie-bound (server.ts), service-role server-only (admin.ts)
  - Build-time secret boundary — a client import of the service-role module fails `next build` (SC-4 proven)
  - Live app_users table on Balkanity (ref qyhdogajtmnvxphrslwm) — id/email/role(app_user_role enum)/created_at, RLS enabled, self-read policy, one seeded admin
  - app_user_role enum {admin,driver,guest}
affects:
  - "01-03 (role resolution reads app_users via auth.getUser(); server.ts powers proxy.ts session refresh)"
  - "all later plans (every server/admin DB access flows through the three client modules)"

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.108, @supabase/ssr ^0.12, server-only"
  patterns:
    - "Per-call server client (never module-cached) with cookie getAll/setAll + try/catch on setAll"
    - "import \"server-only\" as line 1 of admin.ts to make the secret boundary a build error"
    - "RLS deny-by-default + explicit self-read policy (auth.uid() = id); writes only via service-role"

key-files:
  created:
    - "platform/supabase/client.ts"
    - "platform/supabase/server.ts"
    - "platform/supabase/admin.ts"
    - "supabase/migrations/0001_app_users_and_roles.sql"
  modified:
    - "package.json"
    - ".env.local.example"

key-decisions:
  - "Role storage = Postgres ENUM app_user_role (user decision at the flagged-schema checkpoint), not TEXT+CHECK"
  - "Seed admin = admin@balkanity.com; auth user created first via Supabase Auth (proper auth.identities), migration only links the app_users row — avoids the missing-identities risk a direct auth.users insert would create (would break magic-link OTP in 01-03)"
  - "Migration carries an AUTH-01 seed guard: raises/aborts if no admin row is seeded, so applying before the auth user exists fails fast instead of silently seeding none"
  - "Applied via psql + direct connection string (SUPABASE_DB_URL in .env.local), NOT the Supabase MCP — the connected MCP/account reaches only the forbidden Kalvia project; user directive is CLI/auth, not MCP, for this project"

patterns-established:
  - "All live DB work on this project goes through the Supabase CLI / direct connection, never MCP (see project memory)"
  - "Flagged/irreversible schema applied atomically: psql --single-transaction -v ON_ERROR_STOP=1"

requirements-completed: [PLAT-05, AUTH-01]

# Metrics
duration: ~40min (incl. access-blocker resolution)
completed: 2026-06-17
---

# Phase 01 Plan 02: Supabase Client Split + Flagged app_users Migration Summary

**Three-way Supabase client split with a build-enforced server-only secret boundary (PLAT-05, SC-4), plus the flagged/irreversible first migration — app_users (Postgres-enum role, RLS, self-read policy, one seeded admin) — signed off and applied live to the Balkanity project ref qyhdogajtmnvxphrslwm (never Kalvia).**

## Accomplishments
- `platform/supabase/client.ts` (browser anon, `createBrowserClient`), `server.ts` (async per-call `createServerClient` with cookie getAll/setAll + try/catch), `admin.ts` (`import "server-only"` line 1, service-role with autoRefreshToken/persistSession off).
- **SC-4 proven:** with a `"use client"` fixture importing `admin.ts` wired into a real route, `next build` fails (`'server-only' cannot be imported from a Client Component`); fixture + probe route deleted, clean build exits 0; final tree carries neither. No secret under a `NEXT_PUBLIC_` name (grep-gate clean); no `getSession()` in `platform/supabase/`.
- **Live schema applied** to `qyhdogajtmnvxphrslwm`: `app_user_role` enum {admin,driver,guest}; `app_users(id uuid PK→auth.users, email text, role app_user_role, created_at)`; case-insensitive unique email index; RLS **enabled**; `app_users_self_read` policy `(auth.uid() = id)` for SELECT to authenticated; exactly **one** admin row (admin@balkanity.com), zero other roles.

## Task Commits
1. **Task 1: Three-way client split + server-only boundary** — `63f287c` (feat)
2. **Author flagged 0001 migration (awaiting sign-off)** — `c86a341` (docs)
3. **Revise 0001 seed to link pre-existing auth admin + AUTH-01 guard** — `1b03697` (docs)
4. **Task 2: Apply 0001 to live Balkanity DB** — no code commit (live DB action); migration file already committed at `1b03697`, live schema verified to match.

## Decisions Made
- **Role storage = Postgres ENUM** (`app_user_role`) per the flagged-schema decision checkpoint.
- **Seed admin = admin@balkanity.com**, created first via Supabase Auth so it has a proper `auth.identities` record; the migration only seeds the `app_users` row from the existing auth user (the original draft inserted into `auth.users` directly — dropped because a missing identities row would break magic-link OTP in 01-03).
- **Apply path = psql + direct connection string**, not MCP (see Deviations).

## Deviations from Plan

**1. [Blocking — environment] Supabase MCP unusable; applied via CLI/psql instead**
- The connected Supabase MCP/account lists **only Kalvia** (`utyatpadtibqqswsfvtr`, the forbidden project) and returns *permission denied* for Balkanity `qyhdogajtmnvxphrslwm`; executor subagents couldn't call the MCP tools at all. Per the CLAUDE.md STOP-on-Kalvia rule, no apply was attempted through MCP.
- **Resolution:** user directive — "use auth not MCP for this project." Applied with `psql --single-transaction -v ON_ERROR_STOP=1` using `SUPABASE_DB_URL` (gitignored `.env.local`). Host verified to contain `qyhdogajtmnvxphrslwm` and explicitly rejected on `utyatpadtibqqswsfvtr` before connecting. Recorded as project memory.

**2. [Design] Seed no longer writes auth.users**
- Original 0001 inserted into `auth.users` to self-satisfy the FK. Revised to link only `app_users` to a pre-created auth user, plus an AUTH-01 guard that raises if no admin row results. Safer for OTP sign-in and keeps the migration out of the auth schema.

**3. [SC-4 proof] Real route needed to trip the boundary**
- A standalone fixture alone didn't fail the build (Turbopack tree-shakes unreferenced files). A transient real route importing the fixture made the violation reachable; failure captured, then both removed. Final tree clean.

## Live Verification (psql against qyhdogajtmnvxphrslwm)
- Columns: `id:uuid, email:text, role:app_user_role, created_at:timestamptz` ✓
- `relrowsecurity = true` ✓; policy `app_users_self_read` cmd=SELECT qual=`(auth.uid() = id)` ✓
- Role distribution: `admin=1`, no other rows ✓
- Advisor-equivalent: no RLS-disabled tables in `public` ✓
- Pre-apply: clean slate (no table/enum), `admin@balkanity.com` auth user present → seed guard passed (`INSERT 0 1`).

## User Setup Required
- Done this plan: created `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`; created the `admin@balkanity.com` auth user in the Balkanity project.
- For ongoing live DB work: Supabase CLI/direct-connection only (not MCP).

## Next Phase Readiness
- 01-03 can resolve roles against a real `app_users` table and refresh sessions via `server.ts`; the admin can request a magic link immediately (auth user is email-confirmed).
- Carry-forward: API keys are now in `.env.local`, so 01-03/01-05 auth + deploy flows have credentials without another pause.

## Self-Check: PASSED

All 4 declared files exist; commits `63f287c`, `c86a341`, `1b03697` present; live schema verified to match the committed migration on ref qyhdogajtmnvxphrslwm.

---
*Phase: 01-platform-foundation*
*Completed: 2026-06-17*
