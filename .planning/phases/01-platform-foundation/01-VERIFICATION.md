---
phase: 01-platform-foundation
verified: 2026-06-17T18:45:00Z
status: human_needed
score: 4/5 must-haves verified (SC-1 partially verified; deploy+device steps outstanding)
overrides_applied: 0
human_verification:
  - test: "Deploy to Balkanity Vercel project and verify mobile install"
    expected: "App is reachable at the deployed URL, 'Add to Home Screen' installs it, standalone shell shows the real Balkanity mark and teal theme"
    why_human: "Requires Vercel project access, env var configuration, and a physical mobile device — cannot be asserted headlessly"
  - test: "Offline fallback on real device"
    expected: "Toggling airplane mode and navigating shows the branded 'You're offline' page, NOT a stale signed-in shell"
    why_human: "Requires real device + deployed URL; Playwright pwa.spec.ts intentionally skips the offline assertion under `next dev`"
  - test: "End-to-end magic-link walkthrough on deployed URL"
    expected: "Submit admin@balkanity.com on the deployed sign-in page → receive email → click link → land authenticated on /admin"
    why_human: "Requires Supabase Auth email template set to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` in dashboard, plus live email delivery and a real browser session"
  - test: "Confirm Supabase Auth email template is configured"
    expected: "Dashboard config at Auth → Email Templates → Magic Link points to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`; Site URL and redirect allow-list include the dev origin and Vercel domain"
    why_human: "Dashboard configuration item — cannot be verified from code"
---

# Phase 01: Platform Foundation Verification Report

**Phase Goal:** A deployed, installable PWA on the Balkanity Vercel project with the platform/module seam, role-aware auth, the three-way Supabase client split, design tokens, and an EN/BG toggle established — so every later phase writes code in the right place from commit one.
**Verified:** 2026-06-17T18:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| SC-1 | App installable as PWA on mobile and serves offline-aware shell, deployed to Balkanity Vercel project | ? UNCERTAIN | PWA shell code is complete and verified (sw.ts, manifest.ts, withSerwist, public/sw.js generated); Playwright manifest test green. Deploy + real-device install/offline is OUTSTANDING (human-only step per 01-05 deploy checkpoint) |
| SC-2 | A platform/ import from modules/* fails lint; one-way seam holds across DB-naming, server modules, and UI | ✓ VERIFIED | `eslint.config.mjs` has files-scoped `no-restricted-imports` covering `platform/**/*.{ts,tsx}` with group `["@/modules/*","modules/*","../modules/*","**/modules/*"]`; DB seam: `app_users` is unprefixed (module tables get `wp_` prefix from Phase 2+); grepped `platform/` — zero platform-to-modules imports found; build and lint exit 0 |
| SC-3 | Admin can sign in to desktop console; authenticated user resolves to exactly one role ∈ {admin, driver, guest} enforced server-side via auth.getUser() | ✓ VERIFIED | `platform/auth/role.ts` calls `auth.getUser()` (never `getSession()`), queries `app_users.role` with `.single()`, returns `AppRole | null`; 4 Vitest behaviors green; `/admin` guarded server-side via `getCurrentRole()`; sign-in form with `shouldCreateUser:false`; Playwright sign-in smoke 4 tests green; `app_users` table live on ref `qyhdogajtmnvxphrslwm` (documented in 01-02 SUMMARY: RLS enabled, `app_users_self_read` policy, 1 admin seed row) |
| SC-4 | A build that imports the service-role key into client-reachable code fails (server-only enforced); browser only ever holds the anon key | ✓ VERIFIED | `platform/supabase/admin.ts` line 1 is `import "server-only"` — confirmed; `createAdminClient` uses non-public `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; build-gate proof recorded in 01-02 SUMMARY (fixture caused build failure, reverted); grep confirms zero `NEXT_PUBLIC_*(SERVICE_ROLE\|SECRET)` in tracked files; `.env.local.example` has empty values only, `SUPABASE_SERVICE_ROLE_KEY` is server-only |
| SC-5 | Brand tokens (six colours + white, Montserrat) and real logo/pictogram assets render via shared components (StatusDot = coloured dot + text label, 52px primary CTA); UI text flips between EN and BG | ✓ VERIFIED | `app/globals.css` @theme block declares all 7 colour tokens + Montserrat font var; `StatusDot.tsx` renders dot + label for all 8 lifecycle states (16-assertion Vitest green); `Button.tsx` has `h-[52px] min-h-[44px]`; `LanguageToggle.tsx` has `min-h-[44px]`; EN/BG dictionary with `: Dict` parity gate (tsc-failure proof documented); `getLang()` in `app/layout.tsx` sets `<html lang>`; Playwright lang-toggle spec green; real PNG icons (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) confirmed as real PNG files; `public/brand/balkanity-logo.png` is a 4000x4000 PNG; 13 SVG pictograms under `platform/ui/pictograms/`; real mark rendered in sign-in header and admin chrome via `next/image` |

**Score:** 4/5 truths verified (SC-1 partially — code complete, deploy outstanding)

### Deferred Items

No items deferred to a later phase. The outstanding SC-1 deploy + device verification items are human-only checkpoints explicitly designed as the final 01-05 gate, not code gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Next 16 + React 19 + Tailwind 4 + scripts | ✓ VERIFIED | `next ^16.2`, `react ^19.2`, `tailwindcss ^4`; scripts: `dev/build/lint/typecheck/test/test:e2e`; `build` uses `--webpack` flag (required for Serwist) |
| `eslint.config.mjs` | flat-config no-restricted-imports seam rule | ✓ VERIFIED | Files-scoped block on `platform/**/*.{ts,tsx}`, group covers 4 import patterns, message includes `[PLAT-01]` |
| `vitest.config.ts` | Vitest unit/seam test config | ✓ VERIFIED | Exists; `npm run test` → 25 tests across 4 files, all passing |
| `playwright.config.ts` | Playwright smoke test config | ✓ VERIFIED | Exists; 4 e2e spec files present |
| `platform/supabase/client.ts` | browser anon client (createBrowserClient) | ✓ VERIFIED | Exports `createClient`, calls `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `platform/supabase/server.ts` | server anon client (createServerClient, cookie getAll/setAll) | ✓ VERIFIED | Async `createClient`, `createServerClient` with `getAll`/`setAll` + try/catch; uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `platform/supabase/admin.ts` | service-role client, server-only guarded | ✓ VERIFIED | Line 1: `import "server-only"` confirmed; exports `createAdminClient`; uses `SUPABASE_SERVICE_ROLE_KEY` (never NEXT_PUBLIC_) |
| `supabase/migrations/0001_app_users_and_roles.sql` | app_users table + role constraint + RLS + seed admin | ✓ VERIFIED | Creates `app_user_role` enum, `app_users` table with FK → `auth.users`, RLS enabled, self-read policy, seed insert with AUTH-01 guard; applied live per 01-02 SUMMARY |
| `platform/auth/role.ts` | server-side role resolution via getUser() | ✓ VERIFIED | `auth.getUser()` → `from("app_users").select("role").eq("id",user.id).single()`; no getSession; exports `getCurrentRole` |
| `proxy.ts` | Next 16 session-refresh boundary (getClaims) | ✓ VERIFIED | At repo root; exports `proxy`; calls `getClaims()` with no logic between createServerClient and getClaims; `middleware.ts` does NOT exist |
| `app/auth/confirm/route.ts` | verifyOtp token_hash → session route handler | ✓ VERIFIED | Exports `GET`; reads `token_hash` + `type`; calls `supabase.auth.verifyOtp({token_hash,type})`; runtime = nodejs |
| `app/sign-in/page.tsx` | admin magic-link sign-in form | ✓ VERIFIED | Server Component shell; uses `getDict()` for all copy; renders real Balkanity mark via `next/image`; includes `LanguageToggle` |
| `app/admin/page.tsx` | guarded placeholder admin console | ✓ VERIFIED | Server Component; `getCurrentRole()` guard redirects non-admin; "Nothing here yet" from dictionary; real mark on slate header |
| `app/globals.css` | @theme brand tokens + Montserrat font var | ✓ VERIFIED | `@theme` block with `--color-teal:#029b87` and all 6 colours + white; `--font-sans` Montserrat variable |
| `platform/ui/StatusDot.tsx` | coloured dot + text label per lifecycle state | ✓ VERIFIED | 8-state `STATE_META` map; dot (`data-testid="status-dot"`) + label span always rendered; 16-assertion Vitest green |
| `platform/ui/Button.tsx` | 52px primary CTA, ≥44px hit target | ✓ VERIFIED | `h-[52px] min-h-[44px]`; `bg-teal` fill; accepts all button props |
| `platform/ui/LanguageToggle.tsx` | EN/BG one-tap toggle, ≥44px hit target | ✓ VERIFIED | `min-h-[44px]`; client component; invokes `setLang` server action |
| `platform/i18n/dictionary.ts` | lang cookie read + dictionary selection for SSR | ✓ VERIFIED | Exports `getDict`, `getLang`; `getLang` defaults to `"en"`, accepts only exact `"bg"` |
| `platform/i18n/en.ts` | typed EN dictionary (source of truth for Dict type) | ✓ VERIFIED | Exports `en` and `type Dict`; contains all required IDs: `signInCta`, `emailLabel`, `emptyHeading`, `offlineHeading`, `langToggle` |
| `platform/i18n/bg.ts` | BG translations parity-gated by Dict | ✓ VERIFIED | `const bg: Dict = {...}` annotation confirmed; removing a key fails `tsc` (documented in 01-04 SUMMARY) |
| `next.config.ts` | withSerwist wrapper + offline precache entry | ✓ VERIFIED | `withSerwistInit({ swSrc:"app/sw.ts", swDest:"public/sw.js", additionalPrecacheEntries:[{url:"/~offline",...}] })` |
| `app/sw.ts` | Serwist service worker with /~offline fallback + NetworkFirst for auth routes | ✓ VERIFIED | `fallbacks` entry for `/~offline`; explicit `SENSITIVE_DOCUMENT = /^\/(sign-in\|admin\|auth)(\/\|$)/` NetworkFirst rule listed BEFORE `defaultCache` |
| `app/manifest.ts` | PWA manifest (name Balkanity, theme teal, standalone) | ✓ VERIFIED | `display:"standalone"`, `theme_color:"#029B87"`, `name:"Balkanity Platform"`, `short_name:"Balkanity"`; real icon paths (not placeholders) |
| `public/icons/icon-192.png` | real PWA icon | ✓ VERIFIED | `file` confirms: PNG 192x192, 8-bit/color RGBA |
| `public/brand/balkanity-logo.png` | real brand mark | ✓ VERIFIED | `file` confirms: PNG 4000x4000, 8-bit/color RGBA |
| `platform/ui/pictograms/*.svg` | real pictogram SVG library | ✓ VERIFIED | 13 SVGs + README, including `transfers.svg` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `eslint.config.mjs` | `platform/**/*.{ts,tsx}` | files-scoped `no-restricted-imports` block | ✓ WIRED | Group patterns `["@/modules/*","modules/*","../modules/*","**/modules/*"]` with PLAT-01 message |
| `platform/supabase/admin.ts` | `server-only` | `import "server-only"` as line 1 | ✓ WIRED | Confirmed first line; build-gate proof documented in 01-02 SUMMARY |
| `platform/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `createServerClient` second arg | ✓ WIRED | Confirmed in source |
| `platform/auth/role.ts` | `app_users` | `getUser()` then `from("app_users").select("role").eq("id",user.id).single()` | ✓ WIRED | Pattern confirmed in source |
| `app/page.tsx` | `platform/auth/role.ts` | `getCurrentRole()` import + role-based `redirect` | ✓ WIRED | Confirmed; all 4 role cases handled |
| `app/sign-in/actions.ts` | `signInWithOtp` | `supabase.auth.signInWithOtp({shouldCreateUser:false, ...})` | ✓ WIRED | `shouldCreateUser:false` confirmed |
| `platform/i18n/bg.ts` | `platform/i18n/en.ts` | `const bg: Dict` annotation | ✓ WIRED | Type annotation confirmed; tsc-failure proof documented |
| `app/layout.tsx` | `platform/i18n/dictionary.ts` | `getLang()` call, `<html lang={lang}>` | ✓ WIRED | Confirmed in source |
| `platform/ui/Button.tsx` | `--color-teal` | `bg-teal` utility class | ✓ WIRED | `bg-teal` in className confirmed; Tailwind v4 generates this from `--color-teal` in @theme |
| `next.config.ts` | `app/sw.ts` | `withSerwist({ swSrc:"app/sw.ts" })` | ✓ WIRED | Confirmed |
| `app/sw.ts` | `/~offline` | `fallbacks.entries[0].url:"/~offline"` | ✓ WIRED | Confirmed in source; `/~offline` appears in `public/sw.js` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `app/admin/page.tsx` | `t` (dictionary), `lang` | `getDict()` / `getLang()` reads `lang` cookie | Yes — server-side cookie read, EN/BG dict | ✓ FLOWING |
| `app/admin/page.tsx` | `role` | `getCurrentRole()` → `auth.getUser()` → `app_users` query | Yes — live Supabase query (table exists, RLS, 1 admin row) | ✓ FLOWING |
| `app/sign-in/page.tsx` | `t`, `lang` | `getDict()` / `getLang()` | Yes — server-side cookie | ✓ FLOWING |
| `platform/auth/role.ts` | `role` | `auth.getUser()` + `app_users` select | Yes — JWT revalidation + DB query | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds (webpack) | `npm run build` | exit 0; all routes compile; `public/sw.js` generated | ✓ PASS |
| All Vitest tests pass | `npm run test` | 25 tests across 4 files, all passed | ✓ PASS |
| ESLint clean | `npm run lint` | exit 0 (no output) | ✓ PASS |
| TypeScript compiles | `npm run typecheck` | exit 0 (no output) | ✓ PASS |
| `public/sw.js` is gitignored | `git check-ignore public/sw.js` | returns path (gitignored confirmed) | ✓ PASS |
| No `getSession` in auth-critical paths | grep `platform/` `app/` `proxy.ts` | no matches | ✓ PASS |
| No `NEXT_PUBLIC_*(SERVICE_ROLE\|SECRET)` in tracked files | grep all TS/TSX/MJS | no matches | ✓ PASS |
| `middleware.ts` absent | `test -f middleware.ts` | NOT_FOUND | ✓ PASS |
| No platform-to-modules imports | grep `platform/` for modules imports | no matches | ✓ PASS |
| client-boundary fixture removed | `test -f platform/supabase/admin.client-boundary.test-fixture.tsx` | NOT_FOUND | ✓ PASS |
| Real PNG icons present | `file public/icons/icon-192.png` | PNG 192x192 RGBA | ✓ PASS |
| Real brand logo present | `file public/brand/balkanity-logo.png` | PNG 4000x4000 RGBA | ✓ PASS |
| 13 pictogram SVGs present | `ls platform/ui/pictograms/` | 13 SVGs + README | ✓ PASS |

### Probe Execution

No phase-specific probe scripts declared in PLAN files. Step 7c: SKIPPED (no probe scripts — behavioral spot-checks substituted above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PLAT-01 | 01-01 | One-way platform↔module seam enforced at lint | ✓ SATISFIED | ESLint flat-config seam rule; zero cross-imports found; lint green |
| PLAT-02 | 01-05 | Installable offline-aware PWA deployed to Balkanity Vercel | ⚠ PARTIAL | PWA code complete (Serwist, manifest, sw.ts, /~offline, NetworkFirst guard); deploy + real-device verification outstanding (human checkpoint) |
| PLAT-03 | 01-04, 01-05 | Brand design tokens + real logo/pictogram assets as reusable design system | ✓ SATISFIED | @theme tokens, Montserrat, StatusDot/Button/LanguageToggle, real PNG icons, real SVG pictograms, mark on sign-in/admin |
| PLAT-04 | 01-04 | EN/BG toggle | ✓ SATISFIED | Typed dictionary, server-readable cookie, `<html lang>` from getLang, LanguageToggle, Playwright lang-toggle spec green |
| PLAT-05 | 01-02 | Supabase client split — anon browser / service-role server-only | ✓ SATISFIED | Three-way split implemented; `import "server-only"` build gate proven; no NEXT_PUBLIC_ leak. Note: REQUIREMENTS.md still shows `Pending` for PLAT-05 — this is a tracking omission in the requirements file; the code is complete. |
| AUTH-01 | 01-02, 01-03 | App role ∈ {admin, driver, guest} enforced | ✓ SATISFIED | `app_user_role` enum in DB; `getCurrentRole()` returns exactly one role; `app_users` RLS live; server-side guards on /admin |
| AUTH-04 | 01-03 | Admin can sign in to desktop console | ✓ SATISFIED | Magic-link sign-in form, server action with `shouldCreateUser:false`, confirm route with `verifyOtp`; Playwright sign-in smoke green. Note: end-to-end email click is an outstanding human verification step |

**Orphaned requirements:** None — all 7 Phase 1 requirements (`PLAT-01` through `PLAT-05`, `AUTH-01`, `AUTH-04`) are claimed by plans and verified.

**REQUIREMENTS.md tracking note:** PLAT-02 and PLAT-05 are still marked `Pending` in REQUIREMENTS.md. PLAT-05 code is complete (the Pending status is a file-tracking omission). PLAT-02 is legitimately partial — the code is done but the "deployed to Balkanity Vercel" clause requires the human verification items above. This is not a blocker for phase goal assessment but should be updated when the deploy checkpoint completes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/admin/page.tsx` | 1 | Comment says "placeholder admin console" | ℹ Info | This is accurate — Phase 1 delivers a placeholder by design (companies/transfers arrive Phase 2). Not a code stub; real copy and real brand assets render. No hardcoded empty data. |
| `app/manifest.ts` | 16 | Comment "No placeholders remain" | ℹ Info | Informational comment, not a stub indicator. Confirmed: real icon paths used. |

No TBD / FIXME / XXX / TODO / HACK markers found in any phase-modified files. No empty implementations. No hardcoded empty data flowing to render paths.

### Human Verification Required

The following items require human action and cannot be verified programmatically.

#### 1. Deploy to Balkanity Vercel Project

**Test:** In the Balkanity Vercel project (`balkanity_platform_project`, team `balkanity-platform-s-projects`), set the four env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — the last two server-only, never `NEXT_PUBLIC_`). Confirm the project is Balkanity, NOT Kalvia (`utyatpadtibqqswsfvtr`). Deploy with `vercel --prod` or Git integration. Capture the deployment URL.
**Expected:** Deployment succeeds; app is reachable at the deployed URL; no build errors.
**Why human:** Requires Vercel project access and env var secrets; cannot be asserted headlessly.

#### 2. Mobile PWA Install + Offline Fallback

**Test:** On a real mobile device, open the deployed URL → "Add to Home Screen" → launch standalone. Toggle airplane mode → navigate → verify the branded "You're offline" page appears (and the signed-in shell is NOT served stale).
**Expected:** Standalone shell shows real Balkanity mark and teal theme; airplane-mode navigation shows the branded offline fallback, not a cached authenticated shell.
**Why human:** Requires a physical mobile device and a live deployed URL; `pwa.spec.ts` intentionally skips offline assertion under `next dev` (SW disabled in development).

#### 3. End-to-End Magic-Link Walkthrough (Deployed URL)

**Test:** On the deployed URL — submit `admin@balkanity.com` on the sign-in page → receive the magic-link email → click the link → verify the session is set and the browser lands on `/admin` ("Nothing here yet").
**Expected:** Full round-trip: form → email → `/auth/confirm` verifies token_hash → redirects to `/` → role resolves `admin` → lands on `/admin`.
**Why human:** Requires live email delivery (async, out-of-band), real browser session, and the Supabase Auth email template configured (see item 4).

#### 4. Supabase Auth Email Template Configuration

**Test:** In the Balkanity Supabase project (ref `qyhdogajtmnvxphrslwm`) dashboard → Auth → Email Templates → Magic Link, confirm the confirmation URL is set to:
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
Also confirm the Site URL / redirect allow-list includes the dev origin (`http://localhost:3000`) and the Vercel domain.
**Expected:** Template is configured; magic-link emails carry `token_hash` and `type` querystring params to `/auth/confirm`.
**Why human:** Dashboard configuration item — not code, not verifiable from the repo.

### Gaps Summary

No code gaps were found. All automated checks pass:

- Build: `npm run build` (webpack) exits 0
- Tests: `npm run test` — 25 Vitest tests pass (4 files: seam, role, dictionary, StatusDot)
- Lint: `npm run lint` exits 0
- TypeScript: `npm run typecheck` exits 0
- Service worker: `public/sw.js` generated and gitignored
- Security checks: no `getSession`, no `NEXT_PUBLIC_SERVICE_ROLE`, no platform-to-modules imports, no client boundary fixture, no secrets in `.env.local.example`
- Real assets: brand PNG icons, logo master, 13 pictogram SVGs confirmed

The four human verification items above are the only outstanding items. They are genuine human-only steps (deploy access, physical device, async email, dashboard config) — not code defects.

---

_Verified: 2026-06-17T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
