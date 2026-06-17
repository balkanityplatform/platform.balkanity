---
phase: 01-platform-foundation
plan: 01
subsystem: infra
tags: [nextjs, react, tailwind, eslint, vitest, playwright, typescript, pwa, seam]

# Dependency graph
requires: []
provides:
  - Buildable Next 16 App Router project (React 19 + Tailwind v4 + TS) from a previously-empty repo
  - One-way platform/ ⁄ modules/welcome-pickup/ seam enforced at lint time (PLAT-01)
  - Vitest (jsdom) unit/seam runner + Playwright chromium smoke runner — Wave 0 green baseline
  - npm scripts dev/build/lint/typecheck/test/test:e2e
  - .env.local.example documenting browser-safe vs server-only Supabase vars
affects:
  - "01-02 (app_users migration + Supabase clients land under platform/)"
  - "01-03 (proxy.ts + role redirect + auth specs)"
  - "01-04 (brand @theme tokens in globals.css)"
  - "01-05 (Serwist PWA wrap of next.config + e2e specs)"
  - "all later plans (every plan inherits the seam + test runners)"

# Tech tracking
tech-stack:
  added:
    - "next ^16.2, react ^19.2, react-dom ^19.2"
    - "tailwindcss ^4, @tailwindcss/postcss ^4"
    - "eslint ^9 + eslint-config-next 16.2.9 (flat config)"
    - "typescript ^5"
    - "vitest ^4, @vitejs/plugin-react ^6, jsdom ^29"
    - "@playwright/test ^1.61 (+ chromium browser)"
  patterns:
    - "ESLint flat-config files-scoped no-restricted-imports for the one-way seam"
    - "Vitest jsdom unit/seam tests; Playwright chromium mobile e2e (Pixel 7)"
    - "Server-only vs NEXT_PUBLIC_ env var separation documented in .env.local.example"

key-files:
  created:
    - "package.json"
    - "tsconfig.json"
    - "next.config.ts"
    - "postcss.config.mjs"
    - "eslint.config.mjs"
    - "vitest.config.ts"
    - "playwright.config.ts"
    - "app/layout.tsx"
    - "app/page.tsx"
    - "app/globals.css"
    - ".env.local.example"
    - "platform/.gitkeep"
    - "modules/welcome-pickup/.gitkeep"
    - "platform/seam.test.ts"
    - "tests/e2e/smoke.spec.ts"
  modified:
    - ".gitignore"

key-decisions:
  - "Scaffolded via create-next-app into a temp dir, merged into the repo to preserve CLAUDE.md/.planning/.git/.gitignore"
  - "Pinned caret ranges (next ^16.2, react ^19.2) per CLAUDE.md, not the exact create-next-app pins"
  - "globals.css ships @import \"tailwindcss\" only — brand tokens deferred to 01-04 per plan"
  - "ESLint global ignores scoped to project source (.claude/, .planning/ excluded) so eslint . is green"
  - "Added a Playwright config-validity smoke spec so playwright --list exits 0 from an empty e2e suite"

patterns-established:
  - "One-way seam: platform/ MUST NOT import modules/ (lint error); modules/ MAY import platform/"
  - "Wave 0 test baseline: non-empty green Vitest + parseable Playwright before any feature code"

requirements-completed: [PLAT-01]

# Metrics
duration: 12min
completed: 2026-06-17
---

# Phase 01 Plan 01: Platform Foundation Scaffold Summary

**Next 16 App Router + React 19 + Tailwind v4 project scaffolded with a lint-enforced one-way platform/modules seam (PLAT-01) and a green Vitest + Playwright Wave 0 baseline.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-17T12:29:05Z
- **Completed:** 2026-06-17T12:41:00Z (approx)
- **Tasks:** 3
- **Files modified:** 16 created/modified (excluding lockfile + generated artifacts)

## Accomplishments
- Greenfield Next 16 App Router project builds (`next build` exits 0) and type-checks (`tsc --noEmit` exits 0) with the locked stack pinned to CLAUDE.md ranges
- One-way `platform/ ⁄ modules/welcome-pickup/` seam created and enforced at lint time via ESLint flat-config `no-restricted-imports` — a platform→modules import is a lint error (PLAT-01), proven with a temporary forbidden import and reverted
- Vitest (jsdom) + Playwright (chromium, mobile) installed and configured; `npx vitest run` reports 2 passing seam tests and `npx playwright test --list` exits 0 — Wave 0 baseline every later plan inherits
- `.env.local.example` documents browser-safe (`NEXT_PUBLIC_*`) vs server-only Supabase vars with no secret under a `NEXT_PUBLIC_` name

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next 16 App Router project with locked stack** — `ab6ffcc` (feat)
2. **Task 2: Create the platform/modules seam and enforce it via ESLint no-restricted-imports** — `5abd423` (feat)
3. **Task 3: Install and configure Vitest + Playwright (Wave 0 test infrastructure)** — `9455aee` (test)

_TDD note: Task 3's seam smoke test passed on first run because the structural invariant (seam dirs) was the deliverable of Task 2 — see Issues Encountered._

## Files Created/Modified
- `package.json` — locked stack + dev/build/lint/typecheck/test/test:e2e scripts
- `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` — scaffold configs (next.config not yet Serwist-wrapped; that lands in 01-05)
- `eslint.config.mjs` — flat config + files-scoped `no-restricted-imports` seam rule + project-scoped global ignores
- `app/layout.tsx` — minimal `<html lang="en">` + title "Balkanity Platform" (Montserrat/lang cookie deferred)
- `app/page.tsx` — placeholder root (role redirect deferred to 01-03)
- `app/globals.css` — `@import "tailwindcss"` only (brand tokens deferred to 01-04)
- `.env.local.example` — browser-safe vs server-only Supabase var documentation
- `.gitignore` — added node_modules, .next, public/sw*.js, test-results, playwright-report, coverage, *.tsbuildinfo, next-env.d.ts
- `platform/.gitkeep`, `modules/welcome-pickup/.gitkeep` — seam boundary directories
- `platform/seam.test.ts` — Vitest seam smoke (2 passing)
- `vitest.config.ts`, `playwright.config.ts` — test runner configs
- `tests/e2e/.gitkeep`, `tests/e2e/smoke.spec.ts` — Playwright Wave 0 baseline

## Decisions Made
- Scaffolded into a temp dir and merged generated files in (rather than `create-next-app .`) to preserve the existing CLAUDE.md, README.md, .planning/, .git/, and the repo's `.gitignore` secret rules.
- Pinned `next ^16.2`, `react ^19.2`, `react-dom ^19.2` (CLAUDE.md ranges) instead of the exact versions create-next-app emits.
- Removed the create-next-app demo SVGs (`next.svg`, `vercel.svg`, etc.) since the placeholder page does not reference them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped ESLint global ignores to project source**
- **Found during:** Task 2 (seam enforcement verification)
- **Issue:** `npx eslint .` walked into `.claude/gsd-core/` harness tooling (CommonJS `.cjs` files) and produced hundreds of `no-require-imports` errors unrelated to project code, making the lint gate unusable.
- **Fix:** Added `.claude/**`, `.planning/**`, `node_modules/**`, `test-results/**`, `playwright-report/**`, `coverage/**` to the ESLint flat-config `globalIgnores`.
- **Files modified:** `eslint.config.mjs`
- **Verification:** `npx eslint .` exits 0; the seam proof still fires (temp platform→modules import → exit 1 with PLAT-01 message).
- **Committed in:** `5abd423` (Task 2 commit)

**2. [Rule 3 - Blocking] Added a Playwright config-validity smoke spec**
- **Found during:** Task 3 (Playwright verification)
- **Issue:** `npx playwright test --list` exits 1 ("No tests found") on an empty `tests/e2e/` (only `.gitkeep`), failing the acceptance criterion that it must exit 0 (config parses). The real PWA/sign-in/lang specs are owned by later plans (01-03/01-05).
- **Fix:** Added `tests/e2e/smoke.spec.ts`, a pure config-level assertion (no webServer/navigation) giving the e2e suite one listable, runnable test as a Wave 0 baseline.
- **Files modified:** `tests/e2e/smoke.spec.ts`
- **Verification:** `npx playwright test --list` exits 0 and lists the chromium project.
- **Committed in:** `9455aee` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both unblocked the plan's own verification commands without expanding scope — neither adds product behavior; both establish the lint/e2e gates later plans depend on. No scope creep.

## Issues Encountered
- **`eslint platform/` on an empty dir errors (exit 2).** Before Task 3, `platform/` held only `.gitkeep`, so ESLint 9 reports "all files matching the glob are ignored." The seam proof was therefore validated against the real `lint` script (`npx eslint .`), where the temporary forbidden import correctly produced exit 1 with the PLAT-01 message. Once `platform/seam.test.ts` landed in Task 3, `npx eslint platform/` exits 0 as the acceptance criterion specifies. No code change needed beyond Task 3's ordering.
- **TDD RED passed immediately.** Per the fail-fast rule, a passing RED test was investigated: the seam-directory invariant was already true because Task 2 created the directories — the test is a structural Wave 0 smoke (the deliverable of this plan), not a behavior awaiting implementation. Expected and correct, not a skipped RED gate.

## User Setup Required
None — no external service configuration required in this plan. Supabase URL/keys and `.env.local` population begin in plan 01-02 (env vars documented here in `.env.local.example`).

## Next Phase Readiness
- Scaffold, seam, and test runners are ready; later plans can land code under `platform/`/`modules/` and add specs without bootstrapping.
- Deferred-by-design (not blockers): brand `@theme` tokens (01-04), Serwist PWA wrap of `next.config.ts` (01-05), `proxy.ts` + role redirect + Supabase clients (01-02/01-03).
- Known carry-forward: `npm install` reported 2 moderate-severity advisories in the transitive tree (typical for a fresh Next scaffold) — not addressed this plan; revisit at the phase security gate if relevant.

## Self-Check: PASSED

All 16 declared files exist on disk; all 3 task commits (`ab6ffcc`, `5abd423`, `9455aee`) are present in git history.

---
*Phase: 01-platform-foundation*
*Completed: 2026-06-17*
