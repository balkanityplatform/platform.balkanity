---
phase: 01-platform-foundation
plan: 04
subsystem: ui
tags: [tailwind-v4, design-tokens, montserrat, i18n, react-server-components, cookies, vitest, playwright]

# Dependency graph
requires:
  - phase: 01-03
    provides: magic-link sign-in page + admin placeholder console + getCurrentRole role gate
provides:
  - "Tailwind v4 @theme brand tokens (six colours + white) compiled to utilities (bg-teal, text-slate, …)"
  - "Montserrat (next/font, weights 400/600, latin+cyrillic) via --font-montserrat → --font-sans"
  - "StatusDot component — coloured dot + text label per lifecycle state (WCAG 1.4.1)"
  - "Button component — fixed 52px height, ≥44px hit target, teal fill"
  - "LanguageToggle client control — EN/BG, ≥44px hit target, setLang + refresh"
  - "Typed EN/BG dictionary (en.ts source of truth, bg.ts parity-gated by Dict)"
  - "Server-readable lang cookie + getLang/getDict for no-flash SSR"
  - "Re-skinned sign-in + admin surfaces consuming tokens/components/dictionary"
affects: [guest-pwa, driver-pwa, admin-console, transfer-lifecycle, any-frontend-phase]

# Tech tracking
tech-stack:
  added: ["@testing-library/react@^16", "@testing-library/jest-dom@^6"]
  patterns:
    - "Tailwind v4 CSS-first @theme tokens (--color-* / --font-*), no tailwind.config.js"
    - "Typed dictionary parity gate: Dict = { [K in keyof typeof en]: string } so a missing BG key fails tsc"
    - "Server reads lang cookie (getLang) → <html lang> + copy resolved server-side = no flash"
    - "Server-component page shell + thin client island (SignInForm) for interactivity"

key-files:
  created:
    - platform/ui/StatusDot.tsx
    - platform/ui/Button.tsx
    - platform/ui/LanguageToggle.tsx
    - platform/ui/StatusDot.test.tsx
    - platform/i18n/en.ts
    - platform/i18n/bg.ts
    - platform/i18n/dictionary.ts
    - platform/i18n/lang.ts
    - platform/i18n/dictionary.test.ts
    - app/sign-in/SignInForm.tsx
    - tests/e2e/lang-toggle.spec.ts
    - vitest.setup.ts
  modified:
    - app/globals.css
    - app/layout.tsx
    - app/sign-in/page.tsx
    - app/sign-in/actions.ts
    - app/admin/page.tsx
    - vitest.config.ts

key-decisions:
  - "Dict widens values to `string` (not `as const` literals) so different BG translations are valid while a missing/mistyped key still fails tsc"
  - "sign-in page converted to a Server Component shell + SignInForm client island so dictionary copy is resolved server-side (no flash)"
  - "sign-in server action localized via getDict so error/confirmation messages honour the chosen language"
  - "LanguageToggle gained an optional className (default text-slate) so it stays legible on the slate console header (text-white)"

patterns-established:
  - "Brand tokens live only in app/globals.css @theme; components reference the generated utilities"
  - "i18n parity enforced by the type system, not discipline (bg: Dict annotation)"
  - "Language preference is a low-trust UI cookie read server-side; only exact `bg` flips, else EN default"

requirements-completed: [PLAT-03, PLAT-04]

# Metrics
duration: ~11min
completed: 2026-06-17
---

# Phase 01 Plan 04: Brand Design System + EN/BG Language Toggle Summary

**Tailwind v4 @theme brand tokens + Montserrat + StatusDot/Button/LanguageToggle seed components and a tsc-parity-gated EN/BG typed dictionary with a server-readable lang cookie, with the sign-in and admin surfaces re-skinned to consume them — no-flash SSR.**

## Performance

- **Duration:** ~11 min (first task commit 17:40 → last 17:51 local)
- **Started:** 2026-06-17T17:39:00Z (approx)
- **Completed:** 2026-06-17T17:51:00Z (approx)
- **Tasks:** 3
- **Files modified:** 20 (across 3 task commits)

## Accomplishments
- Brand design-system seed: six brand colours + white + Montserrat declared as Tailwind v4 `@theme` tokens, compiled to utilities.
- `StatusDot` pairs a coloured dot with a text label for all 8 lifecycle states (colour never the sole signal, WCAG 1.4.1); proven by a 16-assertion Vitest.
- `Button` is a fixed 52px CTA with a ≥44px hit target; `LanguageToggle` is a ≥44px one-tap EN/BG control.
- Typed EN/BG dictionary where a missing BG key is a `tsc` build error; chosen language persists in a server-readable cookie so SSR renders it with no flash.
- Sign-in + admin surfaces re-skinned through the tokens, the `Button`, and the dictionary; Playwright proves EN → toggle → cookie `bg` → reload renders BG with no EN flash.

## Task Commits

Each task was committed atomically (with hooks, no --no-verify):

1. **Task 1: Brand tokens + Montserrat + StatusDot/Button (TDD)** - `221d0ad` (feat)
2. **Task 2: Typed EN/BG dictionary + server-readable lang cookie** - `0634a1f` (feat)
3. **Task 3: LanguageToggle + re-skin sign-in/admin + lang-toggle e2e** - `cdb261d` (feat)

_TDD note: Task 1's RED test was authored and confirmed failing before the components existed; test + implementation were committed together as a single feat after GREEN (no separate refactor needed)._

## Files Created/Modified
- `app/globals.css` - `@theme` brand tokens (`--color-teal` #029B87 etc.) + `--font-sans` Montserrat var
- `app/layout.tsx` - loads Montserrat (next/font), sets `<html lang>` from `getLang()` (no-flash SSR)
- `platform/ui/StatusDot.tsx` - lifecycle dot + label, token colour per state
- `platform/ui/Button.tsx` - 52px teal CTA, ≥44px hit target
- `platform/ui/LanguageToggle.tsx` - EN/BG client control, ≥44px hit target, `setLang` + refresh
- `platform/ui/StatusDot.test.tsx` - per-state label-present + correct-colour Vitest
- `platform/i18n/en.ts` - EN dictionary (source of truth) + `Dict` contract
- `platform/i18n/bg.ts` - BG translations, `: Dict` parity gate
- `platform/i18n/dictionary.ts` - `getLang` (EN default / exact-`bg`) + `getDict`
- `platform/i18n/lang.ts` - `setLang` server action (cookie write + revalidate)
- `platform/i18n/dictionary.test.ts` - EN-default / exact-bg / garbage-fallback unit proofs
- `app/sign-in/page.tsx` - Server Component shell (dictionary copy, brand 60/30/10)
- `app/sign-in/SignInForm.tsx` - client form island (useActionState, Button CTA)
- `app/sign-in/actions.ts` - localized error/confirmation copy via `getDict`
- `app/admin/page.tsx` - slate console chrome + dictionary copy + LanguageToggle
- `tests/e2e/lang-toggle.spec.ts` - PLAT-04 toggle → cookie → reload-BG smoke
- `vitest.config.ts`, `vitest.setup.ts` - jest-dom matcher wiring for component tests

## Verification Evidence

- **Token compile proof (built CSS):** `.next/static/chunks/2r67agz53exqs.css` contains `color-teal:#029b87`, `.bg-teal`, and `background-color:var(--color-teal)` — confirming the `@theme` tokens compiled to real utilities.
- **StatusDot:** `npx vitest run platform/ui/StatusDot.test.tsx` → 16 passed (label present + correct colour for all 8 states).
- **Button 52px:** `grep -nE "52px|h-\[52px\]" platform/ui/Button.tsx` matches (`h-[52px] min-h-[44px]`).
- **BG-key parity (tsc-failure proof):** removed `emailLabel` from `bg.ts` → `npx tsc --noEmit` failed with `TS2741: Property 'emailLabel' is missing in type ... but required in type 'Dict'`; restored the key → tsc passes. A missing BG translation cannot ship.
- **getLang default:** `platform/i18n/dictionary.test.ts` → 3 passed (EN default with no cookie, BG only on exact `bg`, EN fallback on garbage — T-04-01).
- **lang-toggle e2e:** `npx playwright test tests/e2e/lang-toggle.spec.ts` → 1 passed (EN → toggle → `lang=bg` cookie → reload renders BG CTA, no EN flash).
- **Regression:** existing `tests/e2e/sign-in.spec.ts` → 4 passed after the re-skin.
- **Gates:** `npx tsc --noEmit`, `npx eslint .`, `npx next build` all exit 0; full Vitest suite 25 passed (4 files).

## Decisions Made
- **Dict widens values to `string`** rather than `typeof en` literal types — otherwise a legitimately-different BG translation fails to assign, defeating the purpose. Key presence/typing is still enforced (a missing key fails `tsc`), which is the actual parity requirement.
- **Sign-in became a Server Component shell** (`page.tsx`) wrapping a `SignInForm` client island. The previous page was `"use client"`, which cannot call the server-only `getDict()`; splitting keeps dictionary resolution server-side for no-flash SSR while preserving the `useActionState` interactivity and the unchanged `sendMagicLink` auth behaviour.
- **Server action localized** via `getDict()` so the error/confirmation messages match the selected language (the plan listed `signInError`/`magicLinkSent` as dictionary lookups).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dict literal-type mismatch broke BG parity**
- **Found during:** Task 2 (typed dictionary)
- **Issue:** `export type Dict = typeof en` with `en ... as const` produced literal string types, so every BG translation failed `tsc` (e.g. `Type '"Имейл адрес"' is not assignable to type '"Email address"'`). The parity gate would have rejected all valid translations.
- **Fix:** `export type Dict = { [K in keyof typeof en]: string }` — fixes the key set to `en`'s while widening values to `string`. A missing/mistyped key still fails `tsc` (proven), but real translations are accepted.
- **Files modified:** platform/i18n/en.ts
- **Verification:** `tsc` passes with full BG translations; removing a BG key reproduces the intended `TS2741` failure.
- **Committed in:** 0634a1f (Task 2 commit)

**2. [Rule 1 - Bug] LanguageToggle invisible on slate console header**
- **Found during:** Task 3 (admin re-skin)
- **Issue:** The toggle rendered `text-slate` on the admin header's `bg-slate` surface — slate-on-slate, effectively invisible.
- **Fix:** Added an optional `className` prop (default `text-slate`); admin passes `text-white`.
- **Files modified:** platform/ui/LanguageToggle.tsx, app/admin/page.tsx
- **Verification:** Visual contrast restored; lang-toggle e2e still passes (toggle reachable by accessible name).
- **Committed in:** cdb261d (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes were required for correctness (the Dict fix is load-bearing for the entire parity gate; the contrast fix for a usable control). No scope creep.

## Issues Encountered
- The sign-in spec asserts the CTA via `getByRole("button", { name: "Send magic link" })`; after the re-skin "Send magic link" is also the `<h1>`. The role selector still resolves uniquely to the `Button`, so the existing spec passes unchanged.

## Known Stubs
None. The admin console renders the real empty-state copy (onboarding records arrive in Phase 2 by design, not a stub). No hardcoded empty data flows to the UI.

## User Setup Required
None - no new external service configuration. Existing `.env.local` (Supabase Balkanity ref) already satisfies the sign-in/admin server reads exercised by the e2e specs.

## Threat Flags
None - no new network endpoints, auth paths, or schema. The only new surface is the low-trust `lang` UI-preference cookie, which is in the plan's threat model (T-04-01/04, mitigated by exact-`bg` validation + EN fallback).

## Next Phase Readiness
- Brand token system + Montserrat + the three seed components are in place for every later frontend phase to inherit.
- EN/BG dictionary + cookie pattern is established; new strings are added to `en.ts` (and BG parity is enforced at build time).
- **Pending (D-09, plan 01-05):** the real logo/pictogram brand assets (`Mockups/assets/mark-*.png`, `Balkanity Branding/` pictograms) are NOT yet in the repo. Success Criterion 5 ("real logo/pictogram assets") remains met by Phase 1 only at the token/typography/component level; the asset-dependent work lands in 01-05. No placeholders were invented.

## Self-Check: PASSED

All created files exist on disk and all three task commits (`221d0ad`, `0634a1f`, `cdb261d`) are present in git history.

---
*Phase: 01-platform-foundation*
*Completed: 2026-06-17*
