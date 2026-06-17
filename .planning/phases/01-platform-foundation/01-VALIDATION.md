---
phase: 1
slug: platform-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 1 verification is largely **build/lint-gate** (ESLint seam, `next build` + `server-only`, PWA installability) rather than unit tests — those gates are first-class verification commands.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None yet — greenfield. Vitest (unit/seam) + Playwright (PWA install / sign-in / lang-toggle smoke). Wave 0 installs both. |
| **Config file** | none — Wave 0 adds `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs` |
| **Quick run command** | `npx eslint . && npx tsc --noEmit && npx vitest run` |
| **Full suite command** | `npx vitest run && npx next build && npx playwright test` |
| **Estimated runtime** | ~60–120 seconds (build dominates) |

---

## Sampling Rate

- **After every task commit:** Run `npx eslint . && npx tsc --noEmit` (seam + types) plus the relevant `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run && npx next build` (proves `server-only` boundary + Serwist build)
- **Before `/gsd-verify-work`:** Full suite green + manual PWA-install/Lighthouse + magic-link sign-in walkthrough
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| PLAT-01 | `platform/` importing `modules/*` fails lint | lint-gate | `npx eslint platform/` (temp forbidden import → expect error) | ❌ W0 (`eslint.config.mjs`) | ⬜ pending |
| PLAT-02 | installable PWA + offline fallback shell | smoke/manual | Playwright: SW registers, `/~offline` served offline; Lighthouse PWA installable | ❌ W0 (playwright) | ⬜ pending |
| PLAT-03 | brand tokens compile to utilities | unit/build | assert `bg-teal`-class present in built CSS; StatusDot/Button render | ❌ W0 | ⬜ pending |
| PLAT-04 | EN/BG toggle flips strings + persists cookie | integration/smoke | Playwright: toggle → cookie set → reload renders BG | ❌ W0 | ⬜ pending |
| PLAT-05 / SC-4 | client import of service-role/secret module fails build | build-gate | `npx next build` (temp client import → expect failure) | ❌ W0 | ⬜ pending |
| PLAT-05 | no secret in `NEXT_PUBLIC_` | grep-gate | `! grep -rnE "NEXT_PUBLIC_.*(SERVICE_ROLE\|SECRET)" .` | n/a (grep) | ⬜ pending |
| AUTH-01 / SC-3 | user resolves to exactly one role via `getUser()` | unit/integration | Vitest on `platform/auth/role.ts` (mock supabase) | ❌ W0 | ⬜ pending |
| AUTH-04 | admin can sign in (magic link) | smoke (manual link) | Playwright sign-in form → confirm route sets session | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `eslint.config.mjs` — seam `no-restricted-imports` rule (PLAT-01)
- [ ] Vitest install + `vitest.config.ts` + `platform/auth/role.test.ts`
- [ ] Playwright install + `playwright.config.ts` + PWA-install / sign-in / lang-toggle smoke specs
- [ ] CI script wiring `eslint`, `tsc --noEmit`, `next build` as gates

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA installable on a real mobile device | PLAT-02 | Install prompt + home-screen launch can't be fully asserted headlessly | On mobile Safari/Chrome, open the deployed URL, "Add to Home Screen", launch, confirm standalone shell + offline fallback |
| Admin magic-link sign-in end-to-end | AUTH-04 | Magic link is delivered async by email | Submit admin email → open emailed link → lands on `/auth/confirm` → session set → redirected to admin console |
| Correct Supabase project targeted | PLAT-05 (ops) | Wrong-project (Kalvia) risk is operational, not codeable | Confirm linked ref is `qyhdogajtmnvxphrslwm` before any migration/deploy |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
