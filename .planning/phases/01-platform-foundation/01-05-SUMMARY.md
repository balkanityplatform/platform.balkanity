---
phase: 01-platform-foundation
plan: 05
subsystem: infra
tags: [pwa, serwist, service-worker, manifest, offline, branding, next-image, icons, pictograms]

# Dependency graph
requires:
  - phase: 01-platform-foundation (plan 04)
    provides: brand tokens (teal #029B87 on white), Montserrat font, EN/BG dictionary, re-skinned sign-in/admin
  - phase: 01-platform-foundation (plan 03)
    provides: magic-link auth, /admin role gate, /sign-in surface
provides:
  - Installable PWA shell via @serwist/next (withSerwist + authored app/sw.ts → generated public/sw.js)
  - PWA manifest (name "Balkanity Platform", short_name "Balkanity", theme #029B87 on white, display standalone)
  - Branded /~offline precached fallback page (EN/BG dictionary copy)
  - NetworkFirst guard so auth/sign-in/admin/confirm shells are never served stale (Pitfall 12 / D-06 / T-05-01)
  - Real Balkanity PWA icon set (192, 512, 512-maskable) derived from the committed logo master
  - Real Balkanity mark rendered on sign-in header + admin chrome via next/image
  - Normalized brand pictogram SVG library at platform/ui/pictograms (transfers + 12 more) for Phase 2+
affects: [02-onboarding, guest-booking, driver-pwa, deployment]

# Tech tracking
tech-stack:
  added: ["@serwist/next ^9.5", "serwist ^9.5"]
  patterns:
    - "Serwist requires webpack — project build/dev scripts pin --webpack (Next 16 defaults to Turbopack, which Serwist does not support)"
    - "Real brand masters kept locally under gitignored 'Branding /'; only normalized web-ready derivatives are committed"
    - "PWA icons derived with sips from the 4000x4000 transparent logo master; maskable variant padded onto a white safe zone"

key-files:
  created:
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - public/icons/icon-512-maskable.png
    - public/brand/balkanity-logo.png
    - platform/ui/pictograms/ (transfers.svg + 12 normalized SVGs + README)
    - app/sw.ts
    - app/manifest.ts
    - app/~offline/page.tsx
    - tests/e2e/pwa.spec.ts
  modified:
    - next.config.ts (withSerwist wrapper)
    - app/manifest.ts (real icons array)
    - app/icon.png (real derived favicon)
    - app/sign-in/page.tsx (real mark via next/image)
    - app/admin/page.tsx (real mark on white chip in slate header)
    - .gitignore (Branding / + public/sw*.js)

key-decisions:
  - "Build/dev pinned to --webpack because @serwist/next does not support Next 16 Turbopack; `npx next build` (Turbopack default) fails, `npm run build` (webpack) is the canonical verification command"
  - "Admin mark rendered inside a white rounded chip so the teal-on-transparent logo stays legible on the slate console header while honoring D-07 (teal mark on white)"
  - "Maskable icon built by padding the logo onto a white field at ~80% safe zone so platform icon masks never clip the mark"
  - "Raw 'Branding /' source folder (trailing space, .ai/.eps/.pdf masters) gitignored — kept locally; repo carries only normalized web assets"

patterns-established:
  - "Brand assets: derive/normalize from local masters into public/ + platform/ui; never reference the raw 'Branding /' paths from app code; never re-draw/invent a mark"
  - "PWA: NetworkFirst for auth/admin/confirm document routes; only static shell + /~offline precached"

requirements-completed: [PLAT-02, PLAT-03]

# Metrics
duration: 7min
completed: 2026-06-17
---

# Phase 1 Plan 05: PWA Shell + Real Brand Assets Summary

**Installable Serwist PWA (manifest, service worker, branded /~offline with a NetworkFirst auth guard) wired to the REAL Balkanity logo/pictogram assets — real derived PWA icon set, sign-in/admin mark via next/image, and a normalized pictogram library — with all Task-1 placeholders removed.**

## Performance

- **Duration:** ~7 min (Task 2 run; Task 1 completed in a prior run)
- **Started:** 2026-06-17T15:29:40Z
- **Completed:** 2026-06-17T15:36:19Z
- **Tasks:** 2 of 2 auto tasks complete (Task 1 prior run, Task 2 this run); 1 human-action checkpoint resolved (assets committed); 1 human-verify checkpoint OUTSTANDING (deploy + device)
- **Files modified:** 30 across both 01-05 commits

## Accomplishments
- Installable PWA shell: `withSerwist` wraps `next.config.ts`, authored `app/sw.ts` generates `public/sw.js` (gitignored), manifest declares the Balkanity standalone identity (Task 1).
- Branded `/~offline` fallback precached; auth/sign-in/admin/confirm kept NetworkFirst so a stale signed-in shell can never be served (Pitfall 12 / D-06 / threat T-05-01).
- Real PWA icon set (192, 512, 512-maskable) derived with `sips` from the committed `Balkanity_Logo.png` master (4000x4000, transparent alpha); manifest points at the real paths; placeholders removed.
- Real Balkanity mark rendered on the sign-in header and admin console chrome via `next/image` from `public/brand/balkanity-logo.png`.
- 13 brand pictogram SVGs (incl. the Welcome-Pickup-relevant `transfers.svg`) copied to `platform/ui/pictograms/` under normalized, space-free names for Phase 2+ to consume.
- Raw `Branding /` source masters gitignored — repo carries only normalized web assets (SC-5 met with real assets, not placeholders).

## Task Commits

1. **Task 1: Serwist PWA shell — withSerwist, sw.ts, manifest, branded /~offline** - `353c64c` (feat) — prior run
2. **Task 2: wire real Balkanity brand assets — PWA icons, sign-in/admin mark, pictograms** - `00dac73` (feat) — this run

**Plan metadata:** committed separately with this SUMMARY (docs).

## Files Created/Modified
- `next.config.ts` - wrapped with `withSerwist` (swSrc app/sw.ts → swDest public/sw.js); build pinned to `--webpack`.
- `app/sw.ts` - Serwist worker: precache shell, `/~offline` document fallback, NetworkFirst for auth/admin/confirm.
- `app/manifest.ts` - PWA manifest; icons array now references the real `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-512-maskable.png`.
- `app/~offline/page.tsx` - branded offline fallback (EN/BG dictionary copy).
- `app/icon.png` - favicon replaced with the real derived mark.
- `app/sign-in/page.tsx` - real mark in header via `next/image` from `/brand/balkanity-logo.png`.
- `app/admin/page.tsx` - real mark on a white chip in the slate console header.
- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` - real derived PWA icons.
- `public/brand/balkanity-logo.png` - displayed brand mark (copy of the logo master).
- `platform/ui/pictograms/*.svg` (+ README) - 13 normalized real pictograms.
- `.gitignore` - added `Branding /` (raw masters) and `public/sw*.js` (generated).
- `tests/e2e/pwa.spec.ts` - SW-registers + offline-fallback Playwright spec (Task 1).

**Removed (intentional, in `00dac73`):** `public/icons/placeholder-192.png`, `public/icons/placeholder-512.png`, `public/icons/README.md` (obsolete placeholder doc).

## Decisions Made
- **Build pinned to webpack.** `@serwist/next` does not support Next 16's default Turbopack. The project `build`/`dev` scripts already use `--webpack`; `npm run build` (webpack) is the canonical verification and exits 0, whereas a bare `npx next build` (Turbopack default) fails by design. This is the intended config from Task 1, not a defect.
- **Admin mark on a white chip.** The logo is teal-on-transparent; rendered directly on the slate header it would be illegible. Wrapping it in a small white rounded chip keeps the teal mark on white per D-07 while preserving the slate console chrome.
- **Maskable icon safe-zone padding.** Built by scaling the logo to ~80% and padding onto a white 512 field so platform icon masks (Android adaptive, etc.) never clip the mark.

## Deviations from Plan

None requiring auto-fix rules. One clarification worth recording:

- Task 2's acceptance criteria reference `mark-teal.png` / `mark-white.png`; the user instead committed a single transparent master (`Balkanity_Logo.png`, 4000x4000) plus a circular variant. All real icons/marks were derived from that committed master per the asset-handling guidance — no mark was invented or re-drawn (UI-SPEC D-09 honored). This is an input-naming difference, not a behavior change.

**Total deviations:** 0 auto-fixed. **Impact on plan:** none — implementation matches intent; SC-5 met with real assets.

## Issues Encountered
- A bare `npx next build` failed (Turbopack vs. Serwist+webpack mismatch). Resolved by running the project's canonical `npm run build` (`next build --webpack`), which exits 0 and bundles `public/sw.js`. No code change needed.

## Verification (this run)
- `npm run build` (webpack) → exit 0; `public/sw.js` bundled and gitignored (`git check-ignore public/sw.js` succeeds).
- `npx eslint .` → exit 0.
- `npx tsc --noEmit` → exit 0.
- `app/manifest.ts` references real icon paths (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`); no placeholder names remain.
- `app/sign-in/page.tsx` renders the real mark via `next/image` from `/brand/balkanity-logo.png`.
- `git check-ignore "Branding /…"` succeeds (masters ignored); derived assets are NOT ignored.
- No placeholder icon files remain under `public/icons/`.

## Outstanding Manual Verification (deploy checkpoint — NOT done here)

This is the final `checkpoint:human-verify`. The implementation is complete and green locally; the deploy + real-device walkthrough require the user's Vercel project access and a physical device, so they were intentionally NOT executed. Steps the user must perform:

1. In the **Balkanity** Vercel project (`balkanity_platform_project`, team `balkanity-platform-s-projects` — confirm it is NOT Kalvia `utyatpadtibqqswsfvtr`), set the four env vars:
   - `NEXT_PUBLIC_SUPABASE_URL` (Balkanity Supabase URL, ref `qyhdogajtmnvxphrslwm`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key)
   - `SUPABASE_URL` (server-only)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — NEVER `NEXT_PUBLIC_`)
2. Deploy (`vercel --prod` or Git integration). Capture the deployment URL.
3. On a real mobile device: open the URL → "Add to Home Screen" → launch → confirm the standalone shell shows the real Balkanity mark and teal theme.
4. Toggle airplane mode → navigate → confirm the branded "You're offline" page appears and the signed-in shell is NOT served stale.
5. Magic-link walkthrough on the deployed URL: submit the seeded admin email → open the emailed link → land authenticated on `/admin`.
6. Optional: Lighthouse PWA audit → "installable" passes.

Resume signal: `deployed — <url>, install + offline + magic-link verified`.

## User Setup Required
**External services require manual configuration before deploy.** See the deploy checkpoint above — four Vercel env vars (two public, two server-only) on the Balkanity project, then deploy + real-device PWA/magic-link verification.

## Next Phase Readiness
- Phase 1 foundation is implemented and green locally: scaffold + seam + client split + `app_users` migration + magic-link auth + brand tokens/components + EN/BG toggle + Serwist PWA + real assets.
- `platform/ui/pictograms/transfers.svg` and the rest of the pictogram set are available for Phase 2 onboarding/booking surfaces.
- Sole remaining gate before SC-1 is met: the user-driven Vercel deploy + on-device install/offline/magic-link verification (above).

## Self-Check: PASSED

- Files verified on disk: `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `public/brand/balkanity-logo.png`, `platform/ui/pictograms/transfers.svg`, `app/manifest.ts`, `01-05-SUMMARY.md` — all FOUND.
- Commits verified: `353c64c` (Task 1), `00dac73` (Task 2) — both FOUND.
