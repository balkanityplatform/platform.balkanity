---
phase: 02-supply-side-onboarding
plan: 04
subsystem: admin-console
tags: [nextjs-app-router, server-actions, service-role, zod, rls, crud, destinations, slug, commission, e2e]

# Dependency graph
requires:
  - phase: 02-supply-side-onboarding
    provides: "02-03: /admin/properties CRUD pattern (RSC anon read + service-role write behind getCurrentRole() re-gate, create-only parent Select); 02-02: live supply schema (destinations table + unique destinations_slug_key + price_cents/commission_pct CHECKs + admin-only RLS); 02-01: slugify/nextSlugCandidate + commission/net/fee integer-cents utils + Phase-2 dictionary keys; 02-02 UI primitives (TextField/Select/DataList/Button)"
provides:
  - "/admin/destinations end-to-end CRUD (ONBD-03/04): RSC list (anon RLS read of destinations + parent property/company) + create/edit island with parent-property Select, live slug auto-fill (D-08), slug-edit coral warning (D-10), live 'you keep' panel (D-06), and service-role create/update/deactivate/delete actions with slug uniqueness (23505 → slugTaken, D-09) + commission-range/integer-cents validation"
  - "ONBD-06 acceptance bar proven: the no-code company→property→destination onboarding surface exists and is uniformly admin-gated at all three levels (e2e), with the full signed-in chain documented as a manual checkpoint"
  - "D-06 live 'you keep' recompute proven green by a co-located component test (€100/15% → €15.00/€85.00 + fee note; €200/10% → €20.00/€180.00)"
affects: [pickup, payments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vertical-slice reuse extended a third time: destinations copy the properties slice (RSC anon read + service-role write + getCurrentRole() re-gate), adding the slug + pricing fields and the live client-side 'you keep' recompute"
    - "Slug uniqueness write path (new): server-side slugify() base + nextSlugCandidate suffix probe, with the DB destinations_slug_key unique index as the race-safe authority (catch Postgres 23505 → slugTaken) — never re-implements the suffix loop"
    - "Live display-only client recompute: DestinationForm imports the pure platform/money/commission utils (commissionCents/netCents/estStripeFeeCents/fmtEur) to render the 'you keep' panel in useMemo — never persisted, the admin client is never imported into the island"
    - "Session-free e2e proof split: client-side calculations behind the admin gate are proven green by a @testing-library/react component test (fireEvent, no user-event dep); the live signed-in route walkthrough stays a documented manual checkpoint (mirrors sign-in/driver-invite specs)"

key-files:
  created:
    - app/admin/destinations/page.tsx
    - app/admin/destinations/DestinationsView.tsx
    - app/admin/destinations/DestinationForm.tsx
    - app/admin/destinations/actions.ts
    - app/admin/destinations/you-keep.test.tsx
    - tests/e2e/second-company.spec.ts
    - tests/e2e/you-keep.spec.ts
  modified: []

key-decisions:
  - "Parent-property Select is create-only; updateDestination keeps the parent FK fixed (mirrors updateProperty/companies — identity is never re-keyed). The edit form sends no property_id."
  - "Slug live-fill stops once the admin hand-edits the slug (slugDirty flag) — their typed value wins; in EDIT mode the auto-fill never overwrites the stored slug, and any divergence raises the D-10 coral warning."
  - "Create slug write: probe the admin-typed slug first, then nextSlugCandidate suffixes off the slugify() base; only Postgres 23505 is retryable (any other error → generic saveFailed). The DB unique index is the authority (D-09)."
  - "'You keep' panel renders only for a positive price; commission/net/fee are derived in a useMemo from the pure commission utils — display-only, integer cents, never persisted (D-05/D-06/D-07)."
  - "Used @testing-library/react fireEvent for the live-recompute component test instead of adding @testing-library/user-event — avoided a new dependency (a package install is the non-auto-fixable Rule-3 exclusion; fireEvent already ships with the installed testing-library)."

patterns-established:
  - "Two-gate write security carried to destinations (admin-only RLS + getCurrentRole() re-gate); plus the new unique-slug write path (server slugify base + nextSlugCandidate probe + 23505 authority) that Phase 4's /pickup/<slug> consumes."

requirements-completed: [ONBD-03, ONBD-04, ONBD-06]

# Metrics
duration: 5min
completed: 2026-06-18
---

# Phase 2 Plan 04: Destinations Vertical Slice + ONBD-06 Acceptance Bar Summary

**Shipped /admin/destinations — the third (leaf) level of the supply hierarchy — as an end-to-end no-code CRUD surface (ONBD-03/04): an admin creates, edits, lists, and soft-deactivates a bookable destination under a chosen property, with the slug auto-filling from the label (editable, URL-safe + globally-unique on save via the DB unique index, 23505 → slugTaken), the coral "breaks shared links" warning on slug edit (D-10), and a live "you keep" panel (commission/net/estimated-fee, D-06). The plan closes the ONBD-06 acceptance bar — the no-code company→property→destination chain is admin-gated at all three levels (e2e) with the full signed-in walkthrough documented as a manual checkpoint — and proves the D-06 live recompute green with a co-located component test.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 3 of 3 executed
- **Files:** 7 created, 0 modified

## Accomplishments

- **/admin/destinations RSC list (Task 1):** admin-gate (`getCurrentRole() !== "admin" → redirect("/sign-in")`); anon cookie-bound reads of both the destinations list (embedding the parent `properties(name,companies(name))` chain → flattened to property + company names) and the active properties list for the parent picker — the admin-read RLS policies are the data-layer gate (never service-role on the read path; `grep createAdminClient page.tsx === 0`).
- **DestinationsView + DestinationForm islands (Task 1):** slate console chrome reused; `DataList` rows render `label · /slug · property — company · €price` + active/inactive `StatusDot` + Edit/Deactivate ghost actions; the empty state and a create form (gated on ≥1 active property) sit above. `DestinationForm` adds the parent-property `Select` (create-only), a label-driven LIVE slug auto-fill (`slugify(label)` until the admin hand-edits, D-08), an inline `slugInvalid` blur check, the coral `slugEditWarning` (D-10) when an edited slug diverges from the stored one, and a live "you keep" panel (D-06) recomputing `commissionCents`/`netCents`/`estStripeFeeCents`/`fmtEur` in a `useMemo` with `{pct}`/`{amount}` interpolated. EUR price → integer cents on submit; commission sent as a whole percent.
- **Service-role-gated mutations (Task 2):** `createDestination`/`updateDestination`/`deactivateDestination`/`deleteDestination` each re-gate `getCurrentRole() !== "admin"`, zod-validate FormData (`property_id` uuid, non-empty label, URL-safe slug → `slugInvalid`, integer `price_cents ≥ 0`, whole-percent commission 0–100 → `commissionRange`), and write via `createAdminClient()`. Create probes the admin-typed slug then `nextSlugCandidate` suffixes off the `slugify()` base; the DB `destinations_slug_key` unique index is the race-safe authority — Postgres `23505` is caught → `t.slugTaken` (D-09). Update skips the uniqueness probe when the slug is unchanged and surfaces a `23505` collision on change. Deactivate sets `active=false` (destinations are leaves — D-11, no child check); delete is a plain hard delete (the Phase-4 `wp_transfers` FK `on delete restrict` is the backstop). Generic dict-keyed errors only — no provider-detail leak.
- **ONBD-06 + D-06 proofs (Task 3):** `tests/e2e/second-company.spec.ts` asserts all three onboarding routes (`/admin/companies`, `/admin/properties`, `/admin/destinations`) are admin-gated (the deterministic precondition for the no-code chain) and documents the full signed-in ONBD-06 walkthrough as a manual checkpoint (mirrors `sign-in`/`driver-invite`, whose live round-trips are manual-only). `tests/e2e/you-keep.spec.ts` asserts the `/admin/destinations` gate and documents the D-06 manual recompute steps (€15.00/€85.00). `app/admin/destinations/you-keep.test.tsx` (component test, `fireEvent`) PROVES the live recompute green: €100.00 + 15% → "Company commission (15%): €15.00" / "You keep (before fees): €85.00" / fee note "~1.5% + €0.25", and €200.00 + 10% → €20.00 / €180.00 on change.

## Task Commits

1. **Task 1: Destinations RSC list + form island (slug auto-fill + live you-keep panel)** — `d9efcbb` (feat)
2. **Task 2: Destinations server actions (service-role, slug uniqueness, commission range)** — `d4ae357` (feat)
3. **Task 3: second-company (ONBD-06) + you-keep (D-06) e2e specs + live-recompute component test** — `6b6f5e6` (test)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified

- `app/admin/destinations/page.tsx` — admin-gated RSC; anon RLS reads of destinations (with parent property + company) + active properties for the picker; prop-bag handoff.
- `app/admin/destinations/DestinationsView.tsx` — slate console chrome + DataList (label · /slug · property — company · €price) + per-row Edit/Deactivate + empty state; create form gated on ≥1 active property.
- `app/admin/destinations/DestinationForm.tsx` — create/edit island; parent-property Select (create-only), live slug auto-fill (D-08) + slug-edit coral warning (D-10), live "you keep" panel (D-06), EUR→cents on submit; inline + generic dict-keyed error slots.
- `app/admin/destinations/actions.ts` — create/update/deactivate/delete service-role actions; admin re-gate + zod (uuid/slug/price/commission) + slug uniqueness (nextSlugCandidate probe, 23505 → slugTaken) + integer cents.
- `app/admin/destinations/you-keep.test.tsx` — green automated proof of the live "you keep" recompute (D-06).
- `tests/e2e/second-company.spec.ts` — ONBD-06: three-level onboarding admin gate (deterministic) + manual full-chain checkpoint.
- `tests/e2e/you-keep.spec.ts` — D-06: /admin/destinations gate (deterministic) + manual recompute checkpoint.

## Decisions Made

- **Parent-property Select is create-only.** `updateDestination` keeps the parent FK fixed (mirrors `updateProperty`/companies — identity is never re-keyed); the edit form sends no `property_id`.
- **Slug live-fill yields to the admin.** Auto-fill from `slugify(label)` stops once the slug field is hand-edited (`slugDirty`); in EDIT mode it never overwrites the stored slug, and any divergence raises the D-10 coral warning.
- **DB unique index is the slug authority (D-09).** Create probes the typed slug then `nextSlugCandidate` suffixes off the `slugify()` base, but always catches Postgres `23505` → `slugTaken`; only `23505` is retryable (any other error → generic `saveFailed`).
- **"You keep" is display-only.** Rendered only for a positive price, derived in a `useMemo` from the pure commission utils — integer cents, never persisted (D-05/D-06/D-07); the admin client is never imported into the island.
- **`fireEvent` over a new dependency.** The live-recompute component test uses `@testing-library/react` `fireEvent` (already installed) rather than adding `@testing-library/user-event` — a package install is the non-auto-fixable Rule-3 exclusion, and `fireEvent` proves the same live recompute.

## Deviations from Plan

None — plan executed exactly as written. One within-plan implementation choice worth noting (not a deviation): the D-06 live recompute is proven green by a co-located **component** test (`you-keep.test.tsx`) in addition to the `tests/e2e/you-keep.spec.ts` the plan names, because the form lives behind the RSC admin gate and the automated runner provisions no live admin session — the same constraint that keeps the `sign-in`/`driver-invite` round-trips manual. The e2e specs assert the deterministic admin-gate portion and document the full signed-in walkthrough as a manual checkpoint, matching the established repo pattern. No package was installed (used `fireEvent`).

## Issues Encountered

- `@testing-library/user-event` is not installed (first component-test draft imported it). Resolved without a dependency install by switching to `@testing-library/react` `fireEvent` (the package-install exclusion of Rule 3). Typecheck, lint, the new component test, the two e2e specs, and the full vitest suite all pass.

## Threat Surface

All six threats in the plan's register are handled as designed:

- **T-02-EOP4** (non-admin write) — `getCurrentRole()` re-gate in every action; admin-only RLS + no anon write policy at the DB.
- **T-02-TMP5** (duplicate/forged slug) — DB `destinations_slug_key` is the authority; `23505` caught → `slugTaken`; server-side `slugify()` rejects non-URL-safe input → `slugInvalid`.
- **T-02-TMP6** (out-of-range/float commission, negative price) — zod `commission_pct` 0–100 (`commissionRange`) + integer `price_cents ≥ 0`; DB CHECK constraints are the backstop; integer cents only (no float persisted).
- **T-02-ID3** (slug leaking PII) — accepted; the slug is admin-tuned, label-derived, carries no guest PII or property context in the URL (D-09).
- **T-02-ID4** (service-role to client) — `createAdminClient` only in the `"use server"` actions; never imported by the page/view/form (verified: `grep createAdminClient page.tsx === 0`); the live "you keep" math uses the pure commission util.
- **T-02-V5c** (malformed input) — zod parse at the action boundary; generic dict-keyed `slugInvalid`/`commissionRange`/`fieldRequired`/`saveFailed`, no provider detail leaked.

No new security-relevant surface beyond the plan's threat model.

## Known Stubs

None. Both reads are wired to live tables; the create form's parent picker is wired to the live active-properties list; all four mutations write to the live `destinations` table. The "you keep" panel is a real live recompute (proven by the component test), not a placeholder.

## Next Phase Readiness

- `/admin/destinations` produces the globally-unique slug that Phase 4's `/pickup/<slug>` will resolve to exactly one active destination; the unique-slug write path (server slugify base + nextSlugCandidate probe + DB `destinations_slug_key` 23505 authority) is the surface that guarantee rests on.
- The RSC-read + service-role-write + re-gate pattern is now applied three times (companies, properties, destinations); the destinations slice additionally establishes the unique-slug write path and the live display-only money recompute.
- No blockers. (Standing phase-3 open decision: settlement currency EUR vs BGN — affects the fee-display note only, not this plan's stored data.)

## Self-Check: PASSED

All 7 created files exist on disk; all three task commits (`d9efcbb`, `d4ae357`, `6b6f5e6`) found in git history; full vitest suite (12 files / 65 tests), the two new e2e specs (6 tests), typecheck, and lint all green.

---
*Phase: 02-supply-side-onboarding*
*Completed: 2026-06-18*
