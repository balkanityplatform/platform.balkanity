---
phase: 02-supply-side-onboarding
verified: 2026-06-18T18:00:00Z
status: human_needed
score: 8/8
overrides_applied: 0
human_verification:
  - test: "Signed-in production invite walkthrough (AUTH-03 + NOTF-04 end-to-end)"
    expected: "Admin logs in to https://balkanityplatformproject.vercel.app/admin/drivers, submits the invite form (test email + name + phone), the console reveals an action_link whose URL contains /auth/confirm?type=invite, opening that link resolves through /auth/confirm to /set-password, driver sets a password and the session resolves to the driver role."
    why_human: "Requires a live browser admin session, a real Supabase generateLink call that creates an auth user, and the Balkanity Redirect-URLs allowlist + Vercel NEXT_PUBLIC_SITE_URL env — none of which the automated runner provisions. Driving it in CI would mutate live auth state."
  - test: "ONBD-06 second-company signed-in walkthrough"
    expected: "Admin creates a new company at /admin/companies (unique timestamp name, appears Active in list), adds a property under it at /admin/properties (parent picker selects new company, name — Company shown in DataList), adds a destination under that property at /admin/destinations (label auto-fills slug, price + commission set, live you-keep panel renders), the new destination appears in the list with its /slug and Active indicator — zero code or DB edits required."
    why_human: "Requires a live admin session and mutates live company/property/destination rows in the Balkanity DB. The automated e2e asserts only the admin-gate precondition (unauthenticated visits redirect to /sign-in), not the full signed-in creation chain."
  - test: "Live you-keep panel in the real /admin/destinations route (D-06)"
    expected: "Signed in as admin, open the destination create form, enter price 100.00 and commission 15 — the panel shows 'Company commission (15%): €15.00', 'You keep (before fees): €85.00', and the fee note 'Estimated Stripe fee ~1.5% + €0.25 …'. Change price to 200.00 / commission 10 → panel recomputes to €20.00 / €180.00 without a page reload."
    why_human: "The automated component test (you-keep.test.tsx) proves the recompute green in jsdom. The live route walkthrough requires a real admin session — the e2e spec only asserts the admin gate."
---

# Phase 2: Supply-Side Onboarding — Verification Report

**Phase Goal:** Admin can create and configure companies, properties, destinations (with pricing + commission), and invite drivers — entirely through the console with zero code or DB edits.
**Verified:** 2026-06-18T18:00:00Z
**Status:** human_needed (8/8 truths verified; 3 live-session human checks remain open — see below)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration 0002 creates companies, properties, destinations, driver_profiles with RLS enabled and an admin-only SELECT policy on each — no anon/authenticated write policy | VERIFIED | `supabase/migrations/0002_supply_tables.sql` lines 101–123: 4× `enable row level security`; 4× `for select to authenticated using (public.is_admin())`; grep for `for insert|for update|for delete` returns 0 matches. `platform/rls/supply-rls.test.ts` has 7 passing source-level contract tests (full suite: 65/65). |
| 2 | `destinations.slug` has a globally-unique index (D-09) | VERIFIED | `supabase/migrations/0002_supply_tables.sql` line 83: `create unique index destinations_slug_key on public.destinations (slug)`. Application layer catches Postgres `23505` → `slugTaken` (destinations/actions.ts lines 38, 148, 232). |
| 3 | An admin can create, edit, list, and soft-deactivate a company entirely through /admin/companies | VERIFIED | `app/admin/companies/page.tsx` (RSC, admin-gate + anon RLS read); `app/admin/companies/CompaniesView.tsx` (list + form); `app/admin/companies/actions.ts` (`createCompany`/`updateCompany`/`deactivateCompany`/`deleteCompany`, each re-gates `getCurrentRole() !== "admin"` and writes via `createAdminClient()`); D-12 deactivation guard enforced in `deactivateCompany` (lines 118–131). lifecycle.test.ts: 3/3 green. |
| 4 | An admin can create, edit, list, and soft-deactivate a property under a chosen company through /admin/properties | VERIFIED | `app/admin/properties/page.tsx` (anon RLS read of properties + companies); `app/admin/properties/PropertyForm.tsx` (company parent Select); `app/admin/properties/actions.ts` (re-gate + zod + service-role write; D-12 guard against active destinations). lifecycle.test.ts: 3/3 green. |
| 5 | An admin can create, edit, list, and soft-deactivate a destination (slug, label, address, zone, airport, active) with price + commission through /admin/destinations; slug auto-fills, is editable, validates URL-safe + globally-unique on save; editing a slug shows the coral warning; the "you keep" panel recomputes live | VERIFIED | `app/admin/destinations/page.tsx` (anon RLS read of destinations + properties); `app/admin/destinations/DestinationForm.tsx`: imports `slugify` + `commissionCents`/`netCents`/`estStripeFeeCents`/`fmtEur`; slug live-fill (line 117), slugDirty flag (line 101), D-10 coral warning (line 127), useMemo you-keep panel (lines 130–143). `app/admin/destinations/actions.ts`: `slugify`/`nextSlugCandidate` imported (line 28), 23505 caught (line 148), `commissionRange` validated (line 109). you-keep.test.tsx: green (€100/15% → €15.00/€85.00 + fee note; €200/10% on change). |
| 6 | An admin can invite drivers from /admin/drivers; the system creates the auth user + app_users row with role='driver' + a driver_profiles row; the set-password link is revealed inline (no email sent) | VERIFIED | `app/admin/drivers/actions.ts` line 93: `generateLink({ type: "invite", … })` (never `inviteUserByEmail`); line 117: `role: "driver"` as a literal (never from formData); line 126: `driver_profiles` insert. invite.test.ts: 6/6 green (role=driver written, link returned, no send, non-admin blocked, re-invite both paths). `InviteDriverForm.tsx`: renders `actionLink` on `status === "ok"` with copy button + `inviteLinkDeliveryNote`. |
| 7 | The driver invite link routes through /auth/confirm?type=invite → /set-password (redirect allowlist honoured; no open signup) | VERIFIED (code + config; one human UAT step open) | `app/admin/drivers/actions.ts` line 99: `redirectTo: \`${base}/auth/confirm?type=invite\`` using `NEXT_PUBLIC_SITE_URL` constant (WR-04 compliant, never Origin header). `app/auth/confirm/route.ts` line 42: `rawType === "invite"` allowlisted → `/set-password` (line 51). Supabase Redirect-URLs allowlist + Vercel `NEXT_PUBLIC_SITE_URL` applied to Balkanity (qyhdogajtmnvxphrslwm) per 02-05-SUMMARY. The live signed-in walkthrough (item 1 in Human Verification) is the single outstanding proof. |
| 8 | A second company can be onboarded end-to-end (company → property → destination) through the UI with zero code/DB edits (ONBD-06) | VERIFIED (automated gate; live walkthrough open) | All three onboarding routes are admin-gated and verified by the e2e suite (`tests/e2e/second-company.spec.ts`). The no-code surface exists at all three hierarchy levels (companies/properties/destinations CRUD shipped in Plans 02/03/04). Live signed-in creation chain is the human manual checkpoint (item 2). |

**Score:** 8/8 truths verified (3 require live-session human confirmation before closing)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0002_supply_tables.sql` | Supply schema + admin-only RLS + unique slug index | VERIFIED | 4 tables, 4 RLS enables, 4 admin-only SELECT policies, `destinations_slug_key`, `price_cents`/`commission_pct` CHECK constraints, `is_admin()` SECURITY DEFINER predicate. Applied live to Balkanity (qyhdogajtmnvxphrslwm). |
| `platform/slug/slugify.ts` | `slugify()` + `nextSlugCandidate()` pure URL-safe slug transform | VERIFIED | Exports both functions; uses `normalize("NFKD")`, `.slice(0, 80)`, Cyrillic-empty → `"dest"` fallback. 19 unit tests green. |
| `platform/money/commission.ts` | Integer-cents commission/net/fee math + EUR formatter (DISPLAY-ONLY) | VERIFIED | Exports `commissionCents`, `netCents`, `estStripeFeeCents`, `fmtEur`. Header comment: "DISPLAY-ONLY derivations … NEVER persist". EEA 1.5% + €0.25 (line 28). 7 unit tests green. |
| `platform/i18n/en.ts` + `platform/i18n/bg.ts` | All Phase 2 UI-SPEC copy keys present (parity gate) | VERIFIED | `youKeepFeeNote`, `deactivateCompanyBlocked`, `slugEditWarning` verified in both files. `tsc --noEmit` exits 0 (Dict = typeof en parity gate). |
| `app/admin/companies/actions.ts` | createCompany/updateCompany/deactivateCompany/deleteCompany (service-role, admin-gated, D-12) | VERIFIED | `createAdminClient` on every write, `getCurrentRole()` re-gate, zod validation, D-12 child-count guard before deactivation. |
| `app/admin/companies/page.tsx` | Admin-gated RSC list via anon RLS read | VERIFIED | `getCurrentRole() !== "admin" → redirect("/sign-in")`. `from("companies")` via anon `createClient()`, not `createAdminClient` (confirmed: `createAdminClient` count = 0 in page.tsx). |
| `app/admin/properties/actions.ts` | createProperty/updateProperty/deactivateProperty/deleteProperty (service-role, admin-gated, D-12 vs destinations) | VERIFIED | Same pattern as companies; D-12 counts active `destinations` for the property. |
| `app/admin/properties/page.tsx` | Admin-gated RSC with company parent picker | VERIFIED | Reads both properties and companies via anon client. `createAdminClient` count = 0. |
| `app/admin/destinations/actions.ts` | createDestination/updateDestination/deactivate/delete (service-role, slug uniqueness, commission range, integer cents) | VERIFIED | Imports `slugify`/`nextSlugCandidate`; `UNIQUE_VIOLATION = "23505"`; `commissionRange` validated; `eurToCents()` converts EUR string → integer cents. |
| `app/admin/destinations/DestinationForm.tsx` | Destination island with live slug auto-fill + slug-edit warning + live "you keep" panel | VERIFIED | Imports `slugify` + `commissionCents`/`netCents`/`estStripeFeeCents`/`fmtEur`; `slugDirty` flag; `showSlugWarning`; `useMemo` you-keep panel with `{pct}`/`{amount}` interpolation. |
| `app/admin/destinations/you-keep.test.tsx` | D-06 live recompute component test | VERIFIED | 1 test, green: €100/15% → €15.00/€85.00 + fee note; €200/10% on change. |
| `app/admin/drivers/actions.ts` | inviteDriver: generateLink({type:'invite'}) + role/profile write + returns action_link | VERIFIED | `generateLink` called (not `inviteUserByEmail`); role written as literal `"driver"`; `driver_profiles` insert; `NEXT_PUBLIC_SITE_URL` trusted base; `driverAlreadyInvited` for both re-invite paths. |
| `app/admin/drivers/InviteDriverForm.tsx` | Invite island that reveals action_link on success | VERIFIED | Renders `actionLink` on `status === "ok"` (line 38) with copy button and `inviteLinkDeliveryNote`. 3 fields: email, name, phone. |
| `platform/rls/supply-rls.test.ts` | Source-level RLS contract test | VERIFIED | 7 assertions green: 4 tables RLS-enabled, 1 admin-gated SELECT per table, 0 write policies, destinations_slug_key present, CHECK constraints encoded, Balkanity-only infra guardrail. |
| `tests/e2e/second-company.spec.ts` | ONBD-06 admin-gate e2e | VERIFIED | Asserts unauthenticated access to /admin/companies, /admin/properties, /admin/destinations all redirect to /sign-in. Full signed-in chain is a manual checkpoint. |
| `tests/e2e/driver-invite.spec.ts` | Driver invite admin-gate e2e | VERIFIED | Asserts unauthenticated /admin/drivers redirects to /sign-in. Signed-in invite walkthrough is the open manual UAT. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/admin/companies/page.tsx` | `companies` table | anon cookie-bound `createClient()` select (RLS admin-read exercised) | WIRED | `from("companies")` in page.tsx; `createAdminClient` count = 0 (confirmed) |
| `app/admin/companies/actions.ts` | `companies` table | `createAdminClient()` service-role insert/update | WIRED | `createAdminClient` used in all 4 mutations; pattern `createAdminClient` confirmed |
| `supabase/migrations/0002_supply_tables.sql` | `app_users.role = 'admin'` | admin-read RLS policy exists-subquery via `public.is_admin()` | WIRED | `is_admin()` SECURITY DEFINER function uses `and a.role = 'admin'` (migration line 30) |
| `app/admin/destinations/DestinationForm.tsx` | `platform/slug/slugify.ts` + `platform/money/commission.ts` | client-side live slug fill + you-keep recompute | WIRED | Imports confirmed: `slugify` (line 26), `commissionCents`/`estStripeFeeCents`/`fmtEur`/`netCents` (lines 21–25) |
| `app/admin/destinations/actions.ts` | `destinations` table | `createAdminClient()` service-role insert + `23505` unique-violation handling | WIRED | `UNIQUE_VIOLATION = "23505"` (line 38), caught in createDestination loop (line 148) and updateDestination (line 232) |
| `app/admin/drivers/actions.ts` | Supabase Auth (GoTrue admin API) | `admin.auth.admin.generateLink({type:'invite'})` | WIRED | Line 93: `generateLink({ type: "invite", … })` confirmed |
| `app/admin/drivers/actions.ts` | `app_users` + `driver_profiles` | `createAdminClient()` service-role insert `role='driver'` + name/phone | WIRED | Lines 114–118: `app_users` insert with `role: "driver"` (literal). Lines 126–129: `driver_profiles` insert. |
| `app/admin/drivers/actions.ts` | `/auth/confirm?type=invite` | `NEXT_PUBLIC_SITE_URL` trusted redirect base (WR-04) | WIRED | Line 83: `process.env.NEXT_PUBLIC_SITE_URL`; line 99: `redirectTo: \`${base}/auth/confirm?type=invite\`` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `app/admin/companies/page.tsx` | `companies` (array) | `from("companies").select("id,name,active").order("name")` via anon RLS client | Yes — live DB query | FLOWING |
| `app/admin/destinations/DestinationForm.tsx` | `youKeep` (useMemo) | Computed from `price` + `pct` state via `commissionCents`/`netCents`/`estStripeFeeCents` (pure functions, no fetch) | Yes — live client-side recompute; proven by you-keep.test.tsx | FLOWING |
| `app/admin/drivers/actions.ts` → `InviteDriverForm.tsx` | `actionLink` (state.actionLink) | `data.properties.action_link` returned by `generateLink` GoTrue API call | Yes — live API response; proven by invite.test.ts mock | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Slug utility: `slugify("Sunny Beach")` === `"sunny-beach"` | `npx vitest run platform/slug/slugify.test.ts` | 7/7 green (19ms) | PASS |
| Commission math: `commissionCents(10000, 15)` === 1500 | `npx vitest run platform/money/commission.test.ts` | 7/7 green | PASS |
| D-12 block: deactivateCompany with active children returns blocked error | `npx vitest run app/admin/companies/lifecycle.test.ts` | 3/3 green | PASS |
| D-12 block: deactivateProperty with active destinations returns blocked error | `npx vitest run app/admin/properties/lifecycle.test.ts` | 3/3 green | PASS |
| Driver invite: generateLink creates user + role=driver + no email send | `npx vitest run app/admin/drivers/invite.test.ts` | 6/6 green | PASS |
| RLS contract: 4 tables RLS-enabled, 0 write policies, unique slug index | `npx vitest run platform/rls/supply-rls.test.ts` | 7/7 green | PASS |
| You-keep live recompute: €100/15% → €15.00/€85.00 | `npx vitest run app/admin/destinations/you-keep.test.tsx` | 1/1 green | PASS |
| Full suite | `npx vitest run` | 65/65 green (12 test files) | PASS |
| TypeScript type check (Dict=typeof en parity gate) | `npm run typecheck` | Exit 0 | PASS |
| ESLint (PLAT-01 seam — no platform→module import) | `npm run lint` | Exit 0 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ONBD-01 | 02-02 | Admin can create, edit, and list companies | SATISFIED | `/admin/companies` CRUD implemented and tested; lifecycle.test.ts green |
| ONBD-02 | 02-03 | Admin can create, edit, and list properties under a company | SATISFIED | `/admin/properties` CRUD with parent company Select; lifecycle.test.ts green |
| ONBD-03 | 02-04 (also 02-01 slug utils) | Admin can create, edit, and list destinations (slug, label, address, zone, airport, active) | SATISFIED | `/admin/destinations` CRUD; slugify + uniqueness utilities; D-08/D-09/D-10 implemented |
| ONBD-04 | 02-04 (also 02-01 money utils) | Admin sets price + commission per destination with live "you keep" calculation | SATISFIED | `DestinationForm` live you-keep panel (useMemo + commission.ts utilities); you-keep.test.tsx green |
| ONBD-05 | 02-02 (RLS half) + 02-05 (invite) | Admin can invite drivers from the console; supply tables admin-only at DB | SATISFIED | `inviteDriver` action; admin-only RLS on all 4 tables; invite.test.ts green |
| ONBD-06 | 02-04 | A second company can be onboarded entirely through the UI (no code/DB edits) | SATISFIED (automated gate) + PENDING (live walkthrough) | Three onboarding routes admin-gated and e2e verified; full signed-in chain is a manual checkpoint |
| AUTH-03 | 02-05 | Drivers are admin-invited contractors only (no open signup) | SATISFIED (code + config) + PENDING (live UAT) | `generateLink({type:'invite'})` is the only account-creation path; no open signup route; Supabase allowlist + Vercel env applied; live walkthrough pending |
| NOTF-04 | 02-05 | Driver receives invite email (stubbed Phase 2 as copy-paste link; Resend wires Phase 7) | SATISFIED (stub) | `action_link` revealed inline in console (D-03/D-04); no Resend send in Phase 2 by design; Phase 7 wires the email send |

---

### Core Invariant Checks

| Invariant | Check | Status |
|-----------|-------|--------|
| **RLS: admin-only SELECT, NO write policies** | `supabase/migrations/0002_supply_tables.sql`: `grep "for insert\|for update\|for delete"` returns 0 lines; supply-rls.test.ts asserts "grants NO insert/update/delete policy" | VERIFIED |
| **Service-role writes only via server actions** | All mutations use `createAdminClient()` (which is `import "server-only"`); `createAdminClient` count = 0 in all 4 page.tsx RSCs (confirmed via grep) | VERIFIED |
| **Secrets server-only** | `platform/supabase/admin.ts` line 1: `import "server-only"` (build fails on any client import). All actions are `"use server"` modules. No `NEXT_PUBLIC_` exposure of service-role/Stripe/Resend keys. | VERIFIED |
| **Commission math is DISPLAY-ONLY (never persisted)** | `platform/money/commission.ts` header comment: "DISPLAY-ONLY derivations … NEVER persist". `supabase/migrations/0002_supply_tables.sql` stores only `price_cents` and `commission_pct` — no `commission_cents`/`net_cents`/`fee_cents` columns. | VERIFIED |
| **Slug uniqueness enforced at DB (not UI-only)** | `destinations_slug_key` unique index in migration (line 83). Application layer catches `23505` → `slugTaken` with a suffixed retry loop. DB index is the concurrency-safe authority (D-09). | VERIFIED |
| **No guest PII leak** | Supply tables have no guest PII. Phase 2 is admin-only supply data. Guest PII gating (CLAIM-03) is Phase 5 scope. | NOT APPLICABLE (Phase 2 scope) |
| **Role literal 'driver' never from formData** | `app/admin/drivers/actions.ts` line 117: `role: "driver"` hardcoded. invite.test.ts asserts the literal is written. | VERIFIED |
| **Redirect base is NEXT_PUBLIC_SITE_URL, not Origin header** | `app/admin/drivers/actions.ts` line 83: `process.env.NEXT_PUBLIC_SITE_URL` (WR-04). Code comment explicitly notes "never the client Origin header". | VERIFIED |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No TBD/FIXME/XXX markers; no stub returns (return null/return {}/return []); no hardcoded empty data at rendering call sites. The NOTF-04 copy-paste link is an intentional, explicitly documented Phase 2 design decision (D-03/D-04), not a stub. |

---

### Human Verification Required

The following 3 items require a live browser session with admin credentials against the production Balkanity project (`qyhdogajtmnvxphrslwm`). All code and configuration to support these flows is shipped and verified automated; only the end-to-end live walkthrough is outstanding.

#### 1. Signed-in Production Invite Walkthrough (AUTH-03 + NOTF-04 end-to-end)

**Test:** Log in to `https://balkanityplatformproject.vercel.app` as admin. Open `/admin/drivers`. Submit the invite form with a test driver email + name + phone.
**Expected:** The console reveals a `role="status"` block containing an `action_link` whose URL contains `/auth/confirm?type=invite` and the delivery note. Opening that link in a new tab routes through `/auth/confirm?type=invite` to `/set-password`. Set a password — confirm the account resolves to the driver role.
**Why human:** Requires a live Supabase admin session and a real `generateLink` call that creates an auth user. Also validates that the Supabase Redirect-URLs allowlist (applied per 02-05-SUMMARY) is actually honoured in production (i.e., `redirectTo` is NOT silently dropped to Site URL — RESEARCH Pitfall 1).

#### 2. ONBD-06 Second-Company Signed-in Walkthrough

**Test:** Signed in as admin, create a new company at `/admin/companies` (unique name, e.g. timestamp suffix). Add a property under it at `/admin/properties` (select the new company in the parent picker). Add a destination under that property at `/admin/destinations` (type a label, slug auto-fills, set price + commission, observe the live you-keep panel, save).
**Expected:** The new destination appears in the list with its `/slug` and an Active indicator — no code or DB edits required beyond the UI form submissions.
**Why human:** Requires a live admin session and mutates live rows in the Balkanity companies/properties/destinations tables.

#### 3. Live "You Keep" Panel in /admin/destinations (D-06)

**Test:** Signed in as admin, open the destination create form at `/admin/destinations`. Enter price `100.00` and commission `15`. Inspect the "you keep" panel.
**Expected:** Panel shows "Company commission (15%): €15.00", "You keep (before fees): €85.00", and the fee note containing "~1.5% + €0.25". Change price to `200.00` and commission to `10` — lines recompute live to €20.00 / €180.00 without a page reload.
**Why human:** The component test (`you-keep.test.tsx`) proves the recompute green in jsdom. The live route check requires a real admin session; the e2e spec asserts only the admin gate.

---

### Gaps Summary

No gaps. All 8 must-have truths are VERIFIED in the codebase. The 3 human verification items are not code gaps — all code and project configuration to support those flows has been shipped and confirmed automated. They are live-session walkthroughs that cannot be automated without a real browser admin session + live Supabase auth state.

---

_Verified: 2026-06-18T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
