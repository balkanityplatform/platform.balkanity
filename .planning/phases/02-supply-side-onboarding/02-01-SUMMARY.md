---
phase: 02-supply-side-onboarding
plan: 01
subsystem: testing
tags: [slugify, money, integer-cents, i18n, zod, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-platform-seam-auth
    provides: "Vitest (jsdom) Wave 0 baseline, Dict=typeof en i18n parity contract, platform/ module namespace"
provides:
  - "slugify() URL-safe slug transform (D-08) with Cyrillic-empty fallback (Pitfall 2)"
  - "nextSlugCandidate() collision-suffix helper for the destinations server action (Plan 04)"
  - "commissionCents/netCents/estStripeFeeCents/fmtEur integer-cents display math (D-05/D-06/D-07)"
  - "Complete Phase 2 EN/BG dictionary keys (UI-SPEC Copywriting Contract) — no later plan touches en.ts/bg.ts"
  - "zod ^4.4 promoted from transitive hoist to explicit dependency for Plans 02-05 form validation"
affects: [02-02, 02-03, 02-04, 02-05, companies, properties, destinations, drivers]

# Tech tracking
tech-stack:
  added: [zod ^4.4 (explicit)]
  patterns:
    - "Pure leaf utilities ship with co-located Vitest tests (TDD RED->GREEN)"
    - "Money as integer cents only, display-only derivations never persisted"
    - "Dictionary parity enforced by tsc (Dict=typeof en) — bg.ts mirrors en.ts key set"

key-files:
  created:
    - platform/slug/slugify.ts
    - platform/slug/slugify.test.ts
    - platform/slug/uniqueness.test.ts
    - platform/money/commission.ts
    - platform/money/commission.test.ts
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Hand-rolled slugify (no library) per CLAUDE.md 'simplest thing that works'; Cyrillic-only labels slugify to '' and fall back to 'dest' via nextSlugCandidate (D-08, Pitfall 2)"
  - "Money kept as integer cents, round-half-up; commission/net/fee are display-only and never persisted (D-05/D-06/D-07)"
  - "Stripe fee line is an estimate-only note (EEA 1.5% + EUR0.25); real fee logic deferred to Phase 3 (D-06)"
  - "zod made an explicit dependency (was a vetted transitive hoist) — no new supply-chain surface"

patterns-established:
  - "Leaf-level pure functions written test-first and unblocked for downstream CRUD slices"
  - "All Phase 2 user-facing copy lives in the dictionary; JSX never hard-codes strings (PLAT-04)"

requirements-completed: [ONBD-03, ONBD-04]

# Metrics
duration: 8min
completed: 2026-06-18
---

# Phase 2 Plan 01: Leaf Utilities & Copy Summary

**Test-first slugify (D-08, Cyrillic-empty fallback) + integer-cents commission/net/fee math (D-05/D-06/D-07) + the complete Phase 2 EN/BG dictionary, with zod promoted to an explicit dependency.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-18T16:36:00Z
- **Completed:** 2026-06-18T16:39:30Z
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- `slugify()` + `nextSlugCandidate()` pure helpers covering ONBD-03 slug rules: NFKD diacritic strip, url-safe hyphenation, 80-char cap, and the documented Cyrillic-empty → `dest` fallback — proven by 12 green Wave 0 unit tests.
- `commissionCents`/`netCents`/`estStripeFeeCents`/`fmtEur` integer-cents display math (ONBD-04) with round-half-up and the EEA 1.5% + €0.25 fee estimate — proven by 7 green unit tests incl. 0%/100% endpoints.
- All UI-SPEC Copywriting Contract keys added to `en.ts` (canonical EN values verbatim) and `bg.ts` (Bulgarian translations), with the `tsc` `Dict = typeof en` parity gate green — no later plan needs to touch the dictionaries.
- `zod ^4.4` made an explicit `dependencies` entry (previously a transitive hoist); lockfile updated.
- Full suite green: 7 test files, 45 tests.

## Task Commits

Each task was committed atomically (TDD tasks combine RED+GREEN in one commit since the failing-test state was verified live before implementing):

1. **Task 1: slugify utility + Wave 0 tests (RED→GREEN)** — `a4ae047` (feat)
2. **Task 2: commission/money utility + Wave 0 tests + explicit zod dep** — `cbe27c7` (feat)
3. **Task 3: Phase 2 UI-SPEC copy keys in en.ts + bg.ts (parity gate)** — `f6040b6` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `platform/slug/slugify.ts` — `slugify()` + `nextSlugCandidate()` pure URL-safe slug primitives.
- `platform/slug/slugify.test.ts` — 7 tests pinning slug rules incl. Cyrillic-empty + diacritics.
- `platform/slug/uniqueness.test.ts` — collision-suffix resolver tests (`x` → `x-2`, empty-base `dest`).
- `platform/money/commission.ts` — integer-cents commission/net/fee + `fmtEur`, display-only.
- `platform/money/commission.test.ts` — 7 tests incl. rounding + 0%/100% endpoints, fee floor.
- `platform/i18n/en.ts` — extended with all Phase 2 copy keys (EN canonical values).
- `platform/i18n/bg.ts` — identical key set with Bulgarian translations (parity gate).
- `package.json` / `package-lock.json` — `zod ^4.4` as an explicit dependency.

## Decisions Made

None beyond the plan — executed exactly as specified. (Plan decisions D-05/D-06/D-07/D-08 and Pitfall 2 fallback all implemented as written.)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm install` reported 2 pre-existing moderate-severity vulnerabilities. These are out of scope for this plan (not introduced by the zod promotion; zod@4.4.3 was already resolved and vetted in Phase 1) and were left untouched.

## User Setup Required

None - no external service configuration required. This plan is pure functions + static config only (no DB, routes, auth, or network — confirmed by the threat model: no trust boundary crossed).

## Threat Flags

None — no new security-relevant surface. The plan's threat register dispositions hold: T-02-01 (accept, no PII path), T-02-02 (mitigate via integer-cents + unit-pinned rounding, achieved), T-02-SC (accept, no new package).

## Next Phase Readiness

- Plans 02-05 can import finished, tested primitives (`slugify`, `nextSlugCandidate`, commission math) and a complete bilingual dictionary — no later plan needs to invent transforms or touch `en.ts`/`bg.ts`, avoiding serial write conflicts across the parallel CRUD slices.
- `zod` is ready for server-side form validation in the CRUD slices.
- No blockers.

## Self-Check: PASSED

All 5 created source files exist on disk; all 3 task commits (`a4ae047`, `cbe27c7`, `f6040b6`) found in git history.

---
*Phase: 02-supply-side-onboarding*
*Completed: 2026-06-18*
