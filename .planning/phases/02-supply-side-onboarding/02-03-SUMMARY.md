---
phase: 02-supply-side-onboarding
plan: 03
subsystem: admin-console
tags: [nextjs-app-router, server-actions, service-role, zod, rls, crud, properties]

# Dependency graph
requires:
  - phase: 02-supply-side-onboarding
    provides: "02-02: live supply schema (companies/properties/destinations/driver_profiles) + admin-only RLS, /admin/companies CRUD pattern (RSC anon read + service-role write behind getCurrentRole() re-gate), shared UI primitives (TextField/Select/DataList/Button variant=ghost), co-located app/** vitest include"
provides:
  - "/admin/properties end-to-end CRUD (ONBD-02): RSC list (anon RLS read of properties + parent company) + create/edit islands with a required parent-company Select + service-role create/update/deactivate/delete actions"
  - "D-12 bottom-up deactivation guard for properties→destinations enforced in deactivateProperty (deactivatePropertyBlocked), backed by FK on delete restrict; proven by lifecycle.test.ts"
  - "Properties rows surface the parent-company name (name — Company) so the two-level supply hierarchy is legible in the existing single-label DataList"
affects: [02-04, destinations, pickup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vertical-slice reuse: properties slice copies the companies slice verbatim, adding only the parent-company Select (create-only — parent fixed once created) and swapping the child table to destinations for D-12"
    - "Embedded parent read: from('properties').select('...,companies(name)') normalised (object|array) in the RSC to a flat companyName for the view"

key-files:
  created:
    - app/admin/properties/page.tsx
    - app/admin/properties/PropertiesView.tsx
    - app/admin/properties/PropertyForm.tsx
    - app/admin/properties/actions.ts
    - app/admin/properties/lifecycle.test.ts
  modified: []

key-decisions:
  - "Parent-company Select is create-only; updateProperty changes the name only (the parent FK is fixed once created) — mirrors the companies edit form which never re-keys identity"
  - "Parent company name is appended to the DataList row label (name — Company) rather than extending the shared single-label DataList primitive — smallest change that surfaces the hierarchy without touching a primitive other plans depend on"
  - "Create form is gated on companies.length > 0 (a property must nest under a company); the picker's eligible parents are active companies only (eq active true)"
  - "deleteProperty (childless hard delete) reuses deactivatePropertyBlocked copy when destinations exist — no new copy key, FK on delete restrict is the DB backstop (same pattern as deleteCompany)"

patterns-established:
  - "Two-gate write security carried to properties: admin-only RLS (no write policy) at the DB + getCurrentRole() re-gate in every service-role action"

requirements-completed: [ONBD-02]

# Metrics
duration: 3min
completed: 2026-06-18
---

# Phase 2 Plan 03: Properties Vertical Slice Summary

**Shipped /admin/properties — the second level of the supply hierarchy — as an end-to-end no-code CRUD surface (ONBD-02): an admin creates, edits, lists, and soft-deactivates a property under a chosen parent company, with the create form's required company Select enforcing the FK and the D-12 bottom-up guard (block deactivate while active destinations exist) enforced server-side and proven by a lifecycle test.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-18T14:01:23Z
- **Completed:** 2026-06-18T14:04:15Z
- **Tasks:** 2 of 2 executed
- **Files:** 5 created, 0 modified

## Accomplishments

- **/admin/properties RSC list (Task 1):** admin-gate (`getCurrentRole() !== "admin" → redirect("/sign-in")`); anon cookie-bound reads of both the properties list (with embedded parent `companies(name)`) and the active companies list for the picker — the admin-read RLS policies are the data-layer gate (defence-in-depth, never service-role on the read path).
- **PropertiesView + PropertyForm islands (Task 1):** slate console chrome reused from the companies slice; `DataList` rows render `name — Company` + active/inactive `StatusDot` + Edit/Deactivate ghost actions; the empty state and a create form (gated on ≥1 company) sit above. `PropertyForm` adds the required parent-company `Select` (create-only) over the shared `TextField`/`Button`, with inline `fieldRequired` + generic `saveFailed` error slots.
- **Service-role-gated mutations (Task 2):** `createProperty`/`updateProperty`/`deactivateProperty`/`deleteProperty` each re-gate `getCurrentRole() !== "admin"`, zod-validate FormData (`company_id` uuid + non-empty trimmed `name` → generic `fieldRequired`), and write via `createAdminClient()`. `createProperty` inserts `{ company_id, name, active: true }`.
- **D-12 enforcement + test (Task 2):** `deactivateProperty` counts active `destinations` for the property and returns `deactivatePropertyBlocked` when > 0 (FK `on delete restrict` is the DB backstop); `deleteProperty` hard-deletes only childless rows. `lifecycle.test.ts` proves block + allow + non-admin re-gate (3 tests). Full suite green (10 files / 58 tests); typecheck + lint clean.

## Task Commits

1. **Task 1: Properties RSC list + form island with parent-company picker** — `11790e3` (feat)
2. **Task 2: Properties server actions (service-role, admin-gated) + D-12 lifecycle test** — `7765dc7` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified

- `app/admin/properties/page.tsx` — admin-gated RSC; anon RLS reads of properties (with parent company) + active companies for the picker; prop-bag handoff.
- `app/admin/properties/PropertiesView.tsx` — slate console chrome + DataList (name — company) + per-row Edit/Deactivate (inline `DeactivateButton` wraps useActionState) + empty state; create form gated on ≥1 company.
- `app/admin/properties/PropertyForm.tsx` — create/edit island; adds the required parent-company `Select` (create-only) over `TextField` + `Button`; inline + generic dict-keyed error slots.
- `app/admin/properties/actions.ts` — create/update/deactivate/delete service-role actions; admin re-gate + zod (company_id uuid + name); D-12 enforcement against destinations.
- `app/admin/properties/lifecycle.test.ts` — D-12 block + allow + non-admin re-gate (3 tests, green).

## Decisions Made

- **Parent Select is create-only.** `updateProperty` changes the name only; the parent FK is fixed once created (mirrors the companies edit form, which never re-keys identity). Simplest correct behavior — re-parenting a property has no v1 use case.
- **Parent name appended to the DataList label** (`name — Company`) rather than extending the shared single-label `DataList` primitive — the smallest change that surfaces the hierarchy without modifying a primitive that Plans 04/05 also depend on.
- **Create form gated on ≥1 active company.** A property must nest under a company; the picker offers active companies only (`eq("active", true)`).
- **deleteProperty copy reuse.** Childless-only hard delete reuses `deactivatePropertyBlocked` when destinations exist — no new copy key; FK `on delete restrict` is the DB backstop (same pattern as `deleteCompany`).

## Deviations from Plan

None — plan executed exactly as written. The companies slice (02-02) supplied every primitive, dictionary key, and pattern the plan referenced; no auto-fixes, blocking fixes, or architectural decisions were required.

## Issues Encountered

None. Typecheck, lint, the co-located lifecycle test, and the full suite all passed on first run.

## Threat Surface

All five threats in the plan's register are mitigated as designed and unchanged:

- **T-02-EOP3** (non-admin write) — `getCurrentRole()` re-gate in every action; admin-only RLS + no anon write policy at the DB.
- **T-02-TMP3** (forged company_id) — zod `.uuid()` at the boundary; `references companies(id)` FK rejects a non-existent parent.
- **T-02-TMP4** (deactivate-order bypass) — D-12 in `deactivateProperty` + FK `on delete restrict`; proven by `lifecycle.test.ts`.
- **T-02-ID2** (service-role to client) — `createAdminClient` only in the `"use server"` actions; never imported by PropertiesView/PropertyForm (verified: `grep createAdminClient app/admin/properties/page.tsx` === 0).
- **T-02-V5b** (malformed input) — zod parse at the action boundary; generic dict-keyed `fieldRequired`/`saveFailed`.

No new security-relevant surface beyond the plan's threat model.

## Known Stubs

None. Both reads are wired to live tables; the create form is wired to the live companies list; all four mutations write to the live `properties` table.

## Next Phase Readiness

- `/admin/properties` supplies the parent rows that the destinations slice (Plan 04) selects against — a destination nests under a property the same way a property nests under a company.
- The RSC-read + service-role-write + re-gate + D-12 pattern is now applied twice (companies, properties); Plan 04 (destinations + /pickup slug) extends it with the unique-slug write path.
- No blockers.

## Self-Check: PASSED

All 5 created source files exist on disk; both task commits (`11790e3`, `7765dc7`) found in git history; full suite (10 files / 58 tests), typecheck, and lint all green.

---
*Phase: 02-supply-side-onboarding*
*Completed: 2026-06-18*
