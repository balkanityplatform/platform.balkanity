---
phase: 02-supply-side-onboarding
plan: 02
subsystem: database
tags: [supabase, postgres, rls, migration, server-actions, service-role, zod, crud, nextjs-app-router]

# Dependency graph
requires:
  - phase: 01-platform-seam-auth
    provides: "app_users + role enum + getCurrentRole() authz primitive, anon cookie-bound server client, server-only service-role admin client, EN/BG dictionary, Button/StatusDot UI primitives, ESLint PLAT-01 seam"
  - phase: 02-supply-side-onboarding
    provides: "02-01: complete Phase 2 EN/BG dictionary keys, zod ^4.4 explicit dep, slugify/commission leaf utilities"
provides:
  - "Live supply schema on Balkanity: companies, properties, destinations, driver_profiles (UNPREFIXED, platform-generic) with RLS enabled + admin-only SELECT policy per table (ONBD-05 RLS half)"
  - "public.is_admin() SECURITY DEFINER predicate factoring the admin-read RLS check (used by all four supply policies)"
  - "Globally-unique destinations_slug_key index (D-09 — the /pickup resolution authority)"
  - "Shared UI primitives (TextField, Select, Toggle, Card, DataList) + Button variant=ghost (Task 1, commit d071e6e) for Plans 03/04/05"
  - "/admin/companies end-to-end CRUD: RSC list (anon RLS read) + create/edit islands + service-role-gated create/update/deactivate/delete actions (ONBD-01)"
  - "Admin console nav linking the four section routes (companies/properties/destinations/drivers)"
affects: [02-03, 02-04, 02-05, properties, destinations, drivers, pickup, payments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RSC anon cookie-bound read (admin-read RLS exercised) + client island + service-role write behind getCurrentRole() re-gate (two independent gates: RLS at DB + role-check in action)"
    - "Server actions use the (prev, formData) useActionState signature; deactivate/edit rows wrap their own useActionState so the action runs inside <form action={...}>"
    - "Lifecycle integrity rule (D-12) enforced inside the action (not UI-only), backed by FK on delete restrict; proven by a co-located *.test.ts"
    - "Co-located app/** action unit tests now run under vitest (include glob extended)"

key-files:
  created:
    - supabase/migrations/0002_supply_tables.sql (Task 1, applied live this plan)
    - app/admin/companies/page.tsx
    - app/admin/companies/CompaniesView.tsx
    - app/admin/companies/CompanyForm.tsx
    - app/admin/companies/actions.ts
    - app/admin/companies/lifecycle.test.ts
    - platform/ui/TextField.tsx (Task 1)
    - platform/ui/DataList.tsx (Task 1)
  modified:
    - app/admin/page.tsx
    - platform/ui/Button.tsx (Task 1 — variant prop)
    - vitest.config.ts

key-decisions:
  - "Migration history on Balkanity was empty though Phase 1's app_users is already live — used `supabase migration repair --status applied 0001` to record 0001 without re-running its DDL, then pushed only 0002 (avoids a create-table-already-exists failure that would abort the whole push)"
  - "Connected via the IPv4 transaction pooler (aws-1-eu-central-1.pooler.supabase.com:6543) resolved from the Management API; the direct db.<ref>.supabase.co host is IPv6-only and had no route on this network"
  - "deleteCompany (hard delete) reuses the deactivateCompanyBlocked dictionary copy when children exist — no new copy key, FK on delete restrict is the DB backstop"
  - "Extended vitest include to app/** so the plan-mandated co-located lifecycle test actually runs under `npm test` (Rule 3 blocking fix)"

patterns-established:
  - "Two-gate write security: admin-only RLS (no write policy) at the DB + getCurrentRole() re-gate in every service-role action"
  - "Migration-history repair is the safe reconciliation path when prior-phase schema was applied out-of-band"

requirements-completed: [ONBD-01, ONBD-05]

# Metrics
duration: 22min
completed: 2026-06-18
---

# Phase 2 Plan 02: Supply Schema + Companies CRUD Summary

**Applied the FLAGGED supply schema (companies/properties/destinations/driver_profiles + admin-only RLS + unique slug index + is_admin()) live to Balkanity after sign-off, then shipped the first end-to-end no-code CRUD surface — /admin/companies — with two independent write gates (admin-only RLS + service-role action re-gate) and the D-12 deactivation-order rule enforced server-side.**

## Performance

- **Duration:** ~22 min (continuation agent: migration apply + Task 3)
- **Started:** 2026-06-18T16:50:00Z
- **Completed:** 2026-06-18T17:00:30Z
- **Tasks:** 2 of 3 executed this session (Task 1 was completed pre-checkpoint in commit d071e6e); Task 2 (migration apply, post sign-off) + Task 3 (Companies CRUD)
- **Files modified:** 8 this session (5 created, 3 modified)

## Accomplishments

- **Migration 0002 applied live to Balkanity** (`qyhdogajtmnvxphrslwm`, region eu-central-1) after human sign-off. Verified live: all four supply tables exist with `relrowsecurity = true`, exactly one admin-read policy each, `destinations_slug_key` unique index present, `is_admin()` created, all tables empty (0 rows, no error), and `app_users` untouched (admin row intact).
- **Resolved an empty remote migration history safely:** Phase 1's `app_users` was already live but never recorded in `supabase_migrations.schema_migrations`. Marked 0001 `applied` via `migration repair` (no DDL re-run), so only 0002 pushed — avoiding a fatal "table app_users already exists" abort. The 0001 dependency guard (`is_admin()` reads `app_users.role`) was satisfied, not blocked.
- **/admin/companies CRUD vertical slice (ONBD-01):** RSC admin-gate + anon cookie-bound `from("companies")` read (admin-read RLS exercised, defence-in-depth), create/edit `CompanyForm` islands, `DataList` rows with active/inactive `StatusDot` indicator + Edit/Deactivate ghost actions, and the empty state.
- **Service-role-gated mutations (ONBD-05 enforcement half):** `createCompany`/`updateCompany`/`deactivateCompany`/`deleteCompany` each re-gate `getCurrentRole() !== "admin"`, zod-validate input (generic dict-keyed errors), and write via `createAdminClient()`. D-12 (no deactivation with active children) is enforced in `deactivateCompany` and proven by `lifecycle.test.ts`.
- **Admin console nav** links all four section routes. Full suite green (9 files, 55 tests); typecheck + lint clean.

## Task Commits

1. **Task 1: Migration 0002 + admin-only RLS + UI primitives** — `d071e6e` (feat) *(committed pre-checkpoint, prior session)*
2. **Task 2: [BLOCKING] Push migration 0002 to live Balkanity (SIGN-OFF)** — applied via Supabase CLI; no repo artifact (CLI tracks history server-side). Migration file already committed in d071e6e.
3. **Task 3: Companies CRUD end-to-end + admin nav** — `d8bcc56` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/0002_supply_tables.sql` — applied live this plan (authored in d071e6e).
- `app/admin/companies/page.tsx` — admin-gated RSC, anon RLS read of companies, prop-bag handoff.
- `app/admin/companies/CompaniesView.tsx` — slate console chrome + DataList + create form + per-row Edit/Deactivate; inline `DeactivateButton` wraps useActionState.
- `app/admin/companies/CompanyForm.tsx` — create/edit island over `TextField` + `Button`, inline + generic dict-keyed error slots.
- `app/admin/companies/actions.ts` — create/update/deactivate/delete service-role actions; admin re-gate + zod validation; D-12 enforcement.
- `app/admin/companies/lifecycle.test.ts` — D-12 block + allow + non-admin rejection (3 tests, green).
- `app/admin/page.tsx` — added nav links to the four console sections.
- `vitest.config.ts` — include glob extended to `app/**/*.test.{ts,tsx}`.

## Decisions Made

- **migration repair over re-push:** remote migration history was empty but `app_users` was live; recorded 0001 as applied without re-running it, then pushed only 0002. This is the safe reconciliation path for prior-phase schema applied out-of-band.
- **IPv4 pooler connection:** the direct `db.<ref>.supabase.co` host is IPv6-only (no route here); used the transaction pooler `aws-1-eu-central-1.pooler.supabase.com:6543` (resolved via Management API) for live verification, and `supabase link` for the push.
- **deleteCompany copy reuse:** childless-only hard delete reuses `deactivateCompanyBlocked` copy rather than adding a new key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest `include` to `app/**` so the mandated lifecycle test runs**
- **Found during:** Task 3 (lifecycle test)
- **Issue:** The plan places `lifecycle.test.ts` under `app/admin/companies/`, but `vitest.config.ts` `include` only globbed `platform/**` and `modules/**` — so `npm test` (the verification gate) would never run the test, silently passing the acceptance criterion.
- **Fix:** Added `"app/**/*.test.{ts,tsx}"` to the include array (comment noting co-located action tests).
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run app/admin/companies/lifecycle.test.ts` → 3 passed; full `npm test` → 9 files / 55 tests passed.
- **Committed in:** `d8bcc56` (Task 3 commit)

**2. [Rule 3 - Blocking] Used `migration repair` to reconcile an empty remote migration history before pushing 0002**
- **Found during:** Task 2 (migration apply)
- **Issue:** `supabase migration list --linked` showed NO remote migrations, so a plain `db push` would have tried to apply 0001 too — and 0001's `create table public.app_users` would fail because the table already exists live (Phase 1), aborting the whole push.
- **Fix:** Verified live `app_users` matches 0001 verbatim (columns, RLS, self-read policy), then `supabase migration repair --status applied 0001 --linked` (records history without re-running DDL); dry-run then confirmed only 0002 would push; applied 0002.
- **Files modified:** none (server-side migration history only).
- **Verification:** Post-apply live queries confirmed 4 tables + RLS + policies + unique index + is_admin() + app_users intact.
- **Committed in:** n/a (no repo artifact; CLI tracks history server-side).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both essential to make the plan's own verification real (test actually runs; migration actually applies cleanly). No scope creep — no new tables, copy keys, or packages.

## Issues Encountered

- **Direct DB host unreachable (IPv6-only).** `db.qyhdogajtmnvxphrslwm.supabase.co:5432` returned "no route to host". Resolved by using `supabase link` (for the push) and the IPv4 transaction pooler (for live verification), both confirmed targeting Balkanity `qyhdogajtmnvxphrslwm`, never Kalvia.
- **0001 dependency guard:** evaluated explicitly. `app_users` exists live, so `is_admin()`'s dependency is satisfied — NOT a blocker.

## Target Safety (CLAUDE.md)

Every live operation was asserted against Balkanity `qyhdogajtmnvxphrslwm` (host `db.qyhdogajtmnvxphrslwm.supabase.co`; linked ref file; Management API `ref: qyhdogajtmnvxphrslwm`). No tool ever reported Kalvia `utyatpadtibqqswsfvtr`. The DB password was never echoed.

## User Setup Required

None — the schema push was performed in-session with sign-off using the existing `.env.local` credentials. (Standing SECURITY TODO from STATE.md: rotate the pasted `SUPABASE_ACCESS_TOKEN` + DB password and scrub `.env.local.example` — unchanged by this plan.)

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model. T-02-EOP1/EOP2 (admin-only RLS + action re-gate), T-02-ID1 (service-role only in `"use server"` actions, never imported by the client view), T-02-TMP1 (D-12 in-action, FK backstop, lifecycle test), T-02-TMP2 (Balkanity-ref-confirmed push) and T-02-V5 (zod at the boundary) all mitigated as planned.

## Next Phase Readiness

- The supply hierarchy + admin-only RLS + unique slug index are LIVE on Balkanity — Plans 03 (properties), 04 (destinations + /pickup slug), and 05 (driver invites) can build CRUD on a real schema.
- Shared UI primitives (TextField/Select/Toggle/Card/DataList) + Button `variant` are available; the RSC-read + service-role-write + re-gate pattern is established and reusable.
- No blockers. (Standing pre-Phase-3 open decisions — settlement currency, Pro vs free keep-alive — unaffected.)

## Self-Check: PASSED

All 5 session-created source files exist on disk; Task 3 commit `d8bcc56` and Task 1 commit `d071e6e` found in git history; migration 0002 verified applied live (4 tables, RLS, policies, unique index, is_admin).

---
*Phase: 02-supply-side-onboarding*
*Completed: 2026-06-18*
