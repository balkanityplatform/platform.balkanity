# Phase 1: Platform Foundation - Research

**Researched:** 2026-06-17
**Domain:** Greenfield scaffolding — Next 16 App Router PWA + Tailwind v4 + Supabase auth/roles + platform/module seam
**Confidence:** HIGH (stack locked + versions registry-verified; wiring confirmed against current official docs)

## Summary

Phase 1 scaffolds the entire Balkanity PWA from an empty repo and establishes five
foundations every later phase inherits: the one-way `platform/ ← modules/` seam (ESLint
`no-restricted-imports`), the three-way Supabase client split (`@supabase/ssr`), role-aware
magic-link auth resolving to exactly one of `{admin, driver, guest}`, the brand design-token
layer (Tailwind v4 `@theme`) with a minimal seed component set + EN/BG cookie toggle, and an
installable Serwist PWA shell with a branded offline fallback. The whole stack is locked in
CLAUDE.md and every pinned version was re-verified against the npm registry this session —
the planner's job is to wire, not to choose.

Three findings materially update CLAUDE.md's documented patterns because Next.js 16 shipped
breaking convention changes after the project doc was written. **(1) `middleware.ts` is
deprecated and renamed to `proxy.ts`** (function export `proxy`, codemod available) — CLAUDE.md
says "middleware.ts at repo root." **(2) Supabase now recommends `getClaims()` (fast local JWT
verification) for the session-refresh/proxy path**, while `auth.getUser()` (network revalidation)
remains correct for the actual role-gating authorization decision that Success Criterion 3
mandates — these are complementary, not contradictory. **(3) The current env var is
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (the renamed anon/publishable key). All three are
flagged in the Assumptions Log because they touch CLAUDE.md/locked-decision text and need a
quick user/planner ack.

**BLOCKER (D-09):** The real brand assets (`Mockups/assets/mark-*.png`, `Balkanity Branding/`
pictograms, `Mockups/design/` prototypes, `PRD.md`/`PRD-BG.md`) are **still absent from the repo**
(verified by `ls` this session). Success Criterion 5 ("real logo/pictogram assets") cannot be
met by placeholders. The token/typography/component/i18n work is unblocked and can proceed; only
the logo/icon-rendering tasks must wait for the user to commit assets.

**Primary recommendation:** Scaffold with `npx create-next-app@latest` (TypeScript + Tailwind v4
+ ESLint flat config + App Router), restructure into the `platform/` ⁄ `modules/welcome-pickup/`
seam, wire the three Supabase clients from the current `@supabase/ssr` shapes below, add
`proxy.ts` (not `middleware.ts`) for session refresh, enforce the seam + `server-only` boundary
via ESLint `no-restricted-imports`, and deploy the thin slice (admin magic-link sign-in → one
real `app_users` read → role redirect → installable shell) to the Balkanity Vercel project.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Admin signs in via **Supabase magic link (passwordless)** — the single auth pattern reused everywhere. No password storage/reset flow.
- **D-02:** First admin account created via **seed migration / manual SQL** insert (email + admin role), not env allowlist or first-user-is-admin. Rides the flagged first-migration gate (`app_users` + roles) — **sign-off required before applying**.
- **D-03:** Root routing is **role-based redirect**: signed-in users route to their surface by role (admin → `/admin`; `/driver` reserved); unauthenticated `/` redirects to admin sign-in. Guests/drivers never depend on `/`.
- **D-04:** **English default** with one-tap BG toggle, **single default across all three surfaces**. No per-surface defaults, no browser auto-detect.
- **D-05:** Language persists in a **cookie** (server-readable for SSR, no flash). UI strings in **plain typed EN/BG JSON dictionary objects** (`en.ts`/`bg.ts`) keyed by string id — **no i18n library**.
- **D-06:** Offline = **precached app shell + branded "You're offline" fallback page**. All auth/booking/claim routes stay **NetworkFirst (never served stale)** — guards Pitfall 12.
- **D-07:** Installed identity: home-screen name **"Balkanity"** (long name "Balkanity Platform"), theme/splash **`#029B87` (teal)** on white, **`display: standalone`**.
- **D-08:** **Minimal proof set only**: tokens (six colours + white), Montserrat, **StatusDot** (dot + label), **52px primary Button**, **EN/BG toggle**. Inputs/cards/layout shells deferred. No foundation gold-plating.
- **D-09 (BLOCKER):** Real brand assets + `Mockups/design/` + `PRD.md`/`PRD-BG.md` are **not yet in the repo**; user commits them before planning relies on them. SC-5 not met by placeholders.

### Claude's Discretion
- Exact seam directory layout (`platform/` + `modules/welcome-pickup/` vs `src/...`), how the role is stored/resolved server-side, Serwist precache manifest contents, middleware/session-refresh (now `proxy.ts`) implementation, and what the admin sees post-login (near-empty placeholder console is fine — onboarding is Phase 2).

### Deferred Ideas (OUT OF SCOPE)
- Optional admin password (rejected — magic link only).
- Per-surface language defaults (rejected — single EN default).
- Offline cached-read of last page (rejected — stale-auth/status hazard, Pitfall 12).
- Broader component starter kit (inputs/cards/layout shells — built per-phase when first needed).
- URL-prefixed locale (`/en`, `/bg`) (deferred — heavier than v1 needs).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | One-way platform↔module seam across DB schema, server modules, UI | ESLint `no-restricted-imports` flat-config `patterns/group` (Pattern 1); `wp_` table prefix convention; seam dir layout (Project Structure) |
| PLAT-02 | Installable, offline-aware PWA shell (Serwist) on Balkanity Vercel | `@serwist/next` `withSerwist` + `app/sw.ts` + `manifest` (Pattern 4); `/~offline` fallback; Vercel deploy targeting (Environment Availability) |
| PLAT-03 | Brand tokens (six colours + white, Montserrat) + real assets as design system | Tailwind v4 `@theme` `--color-*`/`--font-*` (Pattern 5); StatusDot + 52px Button; **assets blocked by D-09** |
| PLAT-04 | EN/BG toggle for UI strings | Typed `en.ts`/`bg.ts` dictionary + cookie persistence + server-readable for SSR (Pattern 6); no i18n lib |
| PLAT-05 | Supabase clients split — anon on browser, service-role server-only (never shipped) | Three-way client split (Pattern 2) + `server-only` import guard (Pattern 3) |
| AUTH-01 | App role ∈ {admin, driver, guest} enforced across app | `app_users` schema + role resolution via `auth.getUser()` (Pattern 2/role section); flagged migration |
| AUTH-04 | Admin can sign in to the desktop console | `signInWithOtp({ shouldCreateUser:false })` + `/auth/confirm` `verifyOtp` route handler (Pattern 2) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-link send (`signInWithOtp`) | API / Backend (server action or route handler) | Frontend Server (SSR form) | Server-only call; uses anon client with cookie session |
| Magic-link verify (`verifyOtp` on callback) | API / Backend (`/auth/confirm` route handler) | — | Exchanges token_hash → session server-side; sets auth cookies |
| Session refresh on every request | Frontend Server (`proxy.ts`) | — | `getClaims()` refresh; runs at the network boundary before render |
| Role resolution (authz decision) | API / Backend (server component / server util via `getUser()`) | Database (RLS on `app_users`) | Authz revalidates JWT server-side; DB enforces row access |
| Role-based root redirect | Frontend Server (`/` server component or `proxy.ts`) | — | Decided server-side from resolved role |
| Anon DB reads (RLS-scoped) | Browser **and** Frontend Server | Database (RLS) | Browser client + server client both anon; RLS is the boundary |
| Service-role writes (none in P1; pattern established) | API / Backend (server-only module) | — | `server-only` guard; never client-reachable |
| Design tokens / utilities | CDN / Static (compiled CSS) | Browser | Tailwind v4 compiles `@theme` to CSS vars + utilities at build |
| EN/BG language resolution | Frontend Server (read cookie in RSC) | Browser (toggle writes cookie) | Server-readable cookie → SSR renders correct language, no flash |
| PWA shell / offline fallback | Browser (service worker) | CDN / Static (precache) | Serwist SW precaches shell; `/~offline` served on document failure |

## Standard Stack

> All packages are the **locked stack from CLAUDE.md**, already vetted there. Every version below was **re-verified against the npm registry this session** (`npm view <pkg> version`, 2026-06-17). They carry `[VERIFIED: npm registry]` because they were discovered from the authoritative project doc (CLAUDE.md) AND confirmed on-registry — not from open web search.

### Core
| Library | Version (verified 2026-06-17) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `16.2.9` (`^16.2`) | App Router framework | Locked. Current stable. **Note:** v16 deprecates `middleware.ts` → `proxy.ts` (see State of the Art). `[VERIFIED: npm registry]` |
| `react` / `react-dom` | `19.2.7` (`^19.2`) | UI runtime, RSC default | Locked transitive of Next 16. `[VERIFIED: npm registry]` |
| `tailwindcss` | `4.3.1` (`^4`) | CSS-first `@theme` design tokens | Locked. v4 needs no JS config; tokens are CSS vars. `[VERIFIED: npm registry]` |
| `@tailwindcss/postcss` | `4.3.1` (`^4`) | Tailwind v4 PostCSS plugin | Locked. v4 runs via PostCSS plugin (`postcss.config.mjs`). `[VERIFIED: npm registry]` |
| `@supabase/supabase-js` | `2.108.2` (`^2.108`) | DB/Auth client base | Locked. `[VERIFIED: npm registry]` |
| `@supabase/ssr` | `0.12.0` (`^0.12`) | App Router cookie auth (`createServerClient`/`createBrowserClient`) | Locked + current. **Never** `@supabase/auth-helpers-nextjs`. `[VERIFIED: npm registry]` |
| `server-only` | `0.0.1` | Build-time guard: server module imported from client → build fails | Locked enforcement of the key-leak boundary (Pitfall 7). `0.0.1` is the correct/published version (a tiny marker package). `[VERIFIED: npm registry]` |
| `typescript` | `6.0.3` (current) | End-to-end types | Note: TS 6.x is current (newer than typical training). `create-next-app` pins a compatible range. `[VERIFIED: npm registry]` |
| `eslint` | `10.5.0` (current) | Flat-config lint; hosts `no-restricted-imports` seam rule | Note: ESLint 10.x uses flat config (`eslint.config.mjs`) exclusively. `[VERIFIED: npm registry]` |

### Supporting
| Library | Version (verified 2026-06-17) | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@serwist/next` | `9.5.11` (`^9.5`) | SW build integration (`withSerwist` next.config wrapper) | PWA shell + offline. **Never** `next-pwa`. `[VERIFIED: npm registry]` |
| `serwist` | `9.5.11` (`^9.5`) | Workbox-based SW runtime authored in `app/sw.ts` | Installed alongside `@serwist/next`; same major. `[VERIFIED: npm registry]` |

### Not used in Phase 1 (deferred)
| Library | Why deferred |
|---------|--------------|
| `idb` | Offline write/queue out of scope; P1 offline = shell + read-only fallback (D-06). |
| `zod` | No trust-boundary input beyond the email field in P1; introduce in Phase 3/4 booking/webhook. |
| `stripe`, `resend`, `react-email` | No payments/email in P1 (Phases 3/4/7). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `proxy.ts` (Next 16 name) | `middleware.ts` (legacy name) | `middleware.ts` is deprecated in v16; still works for now but the convention is `proxy.ts`. Use `proxy.ts` for a greenfield repo. |
| `@serwist/next` | Hand-rolled service worker | Hand-rolled is viable if offline stays trivial, but Serwist gives precache + fallback routing for free and is the CLAUDE.md lock. |
| Typed dictionary i18n (`en.ts`/`bg.ts`) | `next-intl` / `i18next` | Full i18n framework explicitly out of scope (Out of Scope table); dictionary + cookie is sufficient for a 2-language toggle. |

**Installation:**
```bash
# Scaffold (App Router + TS + Tailwind v4 + ESLint flat config)
npx create-next-app@latest balkanity --typescript --tailwind --eslint --app --no-src-dir

# Supabase clients + server boundary guard
npm install @supabase/supabase-js@^2.108 @supabase/ssr@^0.12 server-only

# PWA (Serwist — next-pwa successor)
npm install @serwist/next@^9.5 serwist@^9.5
```
*(`--no-src-dir` chosen so `platform/`, `modules/`, `app/` sit at repo root; planner may instead use `src/` — Claude's discretion per D-08. Pick one and keep the ESLint paths consistent.)*

**Version verification (run this session):** `npm view` confirmed every version above on the npm registry on 2026-06-17. Values match CLAUDE.md pins exactly.

## Package Legitimacy Audit

> slopcheck was **unavailable** this session (`pip install slopcheck` failed in sandbox). Per protocol, packages would normally be tagged `[ASSUMED]`. **Mitigating factor:** every package is from CLAUDE.md's already-vetted locked stack (with documented HIGH-confidence Context7/official sources) AND was confirmed on the npm registry this session with a known publisher. The planner should still keep a lightweight ack, but these are not unverified web-search discoveries.

| Package | Registry | Source Repo | slopcheck | Disposition |
|---------|----------|-------------|-----------|-------------|
| `next` | npm | github.com/vercel/next.js | unavailable | Approved (locked stack, registry-confirmed) |
| `react` / `react-dom` | npm | github.com/facebook/react | unavailable | Approved |
| `tailwindcss` / `@tailwindcss/postcss` | npm | github.com/tailwindlabs/tailwindcss | unavailable | Approved |
| `@supabase/supabase-js` | npm | github.com/supabase/supabase-js | unavailable | Approved |
| `@supabase/ssr` | npm | github.com/supabase/ssr | unavailable | Approved |
| `server-only` | npm | github.com/vercel/next.js (React/Vercel) | unavailable | Approved (marker package; `0.0.1` is correct) |
| `@serwist/next` / `serwist` | npm | github.com/serwist/serwist | unavailable | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.
**Note for planner:** No external package needs a `checkpoint:human-verify` gate beyond the standard ack — all are first-party framework/official packages. Re-run `slopcheck install` if it becomes available, but do not block on it.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
   Guest/Driver/Admin     │            Browser (PWA, installed)            │
   device                 │  ┌────────────┐   ┌─────────────────────────┐ │
        │  install        │  │ Serwist SW │   │ Browser Supabase client │ │
        │  prompt ───────▶│  │ precache   │   │ (ANON / publishable key)│ │
        ▼                 │  │ + /~offline│   └────────────┬────────────┘ │
   manifest.webmanifest   │  └─────┬──────┘                │ RLS-scoped   │
                          └────────│───────────────────────│──────────────┘
                                   │ network                │
                                   ▼ (NetworkFirst for      ▼
                          ┌────────────────────────auth/status routes)────┐
                          │            Next.js Frontend Server             │
                          │  proxy.ts  ── getClaims() refresh on every req │
                          │     │ (renamed from middleware.ts, Next 16)    │
                          │     ▼                                          │
                          │  app/ RSC + Route Handlers                     │
                          │   • / → role-based redirect                    │
                          │   • /sign-in → signInWithOtp(shouldCreateUser  │
                          │                 :false)  [anon server client]  │
                          │   • /auth/confirm → verifyOtp(token_hash)      │
                          │   • /admin (placeholder console)               │
                          │   reads role via auth.getUser() ──┐            │
                          │   server-only/* (service-role) ◀──┼─ build     │
                          └───────────────────────────────────┼──guard────┘
                                   │ anon (RLS)                │ service-role
                                   ▼                           ▼ (server-only)
                          ┌──────────────────────────────────────────────┐
                          │   Supabase (ref qyhdogajtmnvxphrslwm ONLY)     │
                          │   Postgres: app_users(id, email, role) + RLS   │
                          │   Auth: magic-link OTP (passwordless)          │
                          └──────────────────────────────────────────────┘

   SEAM (compile-time, ESLint no-restricted-imports):
   modules/welcome-pickup/*  ──may import──▶  platform/*
   platform/*                ──MUST NOT import──▶  modules/*   (lint error)
```

### Recommended Project Structure
```
balkanity/
├── app/                        # Next routes — thin; delegates to platform/ & modules/
│   ├── layout.tsx              # loads Montserrat, lang from cookie, manifest link
│   ├── page.tsx                # / → role-based redirect (D-03)
│   ├── sign-in/page.tsx        # admin magic-link form (AUTH-04)
│   ├── auth/confirm/route.ts   # verifyOtp token_hash → session
│   ├── admin/page.tsx          # placeholder console ("Nothing here yet")
│   ├── ~offline/page.tsx       # branded offline fallback (D-06)
│   ├── sw.ts                   # Serwist service worker (authored)
│   ├── manifest.ts             # PWA manifest (or manifest.webmanifest)
│   └── globals.css             # @import "tailwindcss"; @theme { brand tokens }
├── platform/                   # PLATFORM-WIDE, module-agnostic — never imports modules/
│   ├── supabase/
│   │   ├── client.ts           # createBrowserClient (anon)
│   │   ├── server.ts           # createServerClient (anon, cookie getAll/setAll)
│   │   └── admin.ts            # service-role client — `import "server-only"` at top
│   ├── auth/role.ts            # getUser() → resolve {admin,driver,guest}
│   ├── i18n/{en.ts,bg.ts,dictionary.ts,useLang}  # typed dicts + cookie helpers
│   └── ui/{StatusDot,Button,LanguageToggle}.tsx  # brand seed components
├── modules/
│   └── welcome-pickup/         # module code — MAY import platform/, never reverse
├── proxy.ts                    # session refresh (renamed from middleware.ts)
├── supabase/migrations/        # 0001_app_users_and_roles.sql (FLAGGED — sign-off)
├── eslint.config.mjs           # flat config + no-restricted-imports seam rule
├── next.config.ts              # withSerwist(...) wrapper
└── postcss.config.mjs          # @tailwindcss/postcss
```

### Pattern 1: One-way seam via ESLint `no-restricted-imports` (flat config)
**What:** `platform/` must never import from `modules/*`; modules may import platform.
**When to use:** The PLAT-01 seam enforcement. Lives in `eslint.config.mjs`.
**Example:**
```js
// Source: eslint.org/docs/latest/rules/no-restricted-imports (flat config "patterns/group")
// eslint.config.mjs — applied ONLY to files under platform/
import { defineConfig } from "eslint/config"; // or plain array export

export default [
  // ...next/core-web-vitals + next/typescript...
  {
    files: ["platform/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/modules/*", "modules/*", "../modules/*", "**/modules/*"],
          message: "platform/ must not import from modules/ — the seam is one-way (modules → platform only). [PLAT-01]"
        }]
      }]
    }
  }
];
```
**Verification (Success Criterion 2):** add a temporary `import x from "@/modules/welcome-pickup/anything"` inside any `platform/` file → `npx eslint .` must error. Remove after proving it.
**Also enforce the seam across the other two layers (PLAT-01 says "DB-naming, server modules, and UI"):**
- DB: module tables use the `wp_` prefix; platform tables (`app_users`) are unprefixed.
- UI/server modules: the directory rule above covers both since components and server utils both live under `platform/` vs `modules/`.

### Pattern 2: Three-way Supabase client split (current `@supabase/ssr` shapes)
**What:** Browser anon client, server anon client (cookie-bound), service-role server-only client.
**When to use:** PLAT-05 + AUTH-01/04. Concrete shapes below are from the **current** Vercel `with-supabase` example (fetched 2026-06-17).

```ts
// platform/supabase/client.ts  — BROWSER (anon / publishable key)
// Source: vercel/next.js examples/with-supabase/lib/supabase/client.ts (canary, 2026-06-17)
import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // renamed anon key — see SOTA
  );
}
```
```ts
// platform/supabase/server.ts  — SERVER (anon, cookie getAll/setAll)
// Source: vercel/next.js examples/with-supabase/lib/supabase/server.ts (canary, 2026-06-17)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
// Create a NEW client per call (do not cache in a global — Fluid compute caveat).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component; safe to ignore if proxy refreshes sessions */ }
        },
      } },
  );
}
```
```ts
// platform/supabase/admin.ts  — SERVICE ROLE (server-only; NEVER client-reachable)
// `server-only` makes the build FAIL if a client component imports this (Pitfall 7 / SC-4).
import "server-only";
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,                 // non-public
    process.env.SUPABASE_SERVICE_ROLE_KEY!,    // NEVER NEXT_PUBLIC_
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
// Phase 1 has no service-role write yet; this establishes the pattern + the build guard.
```
**Magic-link sign-in (AUTH-04 / D-01) + role resolution (AUTH-01):**
```ts
// sign-in (server action or route handler) — anon server client
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
}); // shouldCreateUser:false → no open signup (admin seeded via D-02 migration)

// app/auth/confirm/route.ts — exchange token_hash for a session
// Supabase email template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
const { error } = await supabase.auth.verifyOtp({ token_hash, type }); // type: "email"

// platform/auth/role.ts — AUTHZ decision MUST use getUser() (revalidates JWT)
const { data: { user } } = await supabase.auth.getUser(); // NOT getSession()
if (!user) return null;
const { data } = await supabase.from("app_users").select("role").eq("id", user.id).single();
return data?.role as "admin" | "driver" | "guest" | undefined; // exactly one
```

### Pattern 3: `server-only` boundary (Success Criterion 4)
**What:** `import "server-only"` at the top of any module holding the service-role or Stripe secret key.
**When to use:** `platform/supabase/admin.ts` and any future secret-holding module.
**Verification (SC-4):** add a client component (`"use client"`) that imports `createAdminClient` → `next build` must fail with the `server-only` error. Remove after proving. Also grep that no `SUPABASE_SERVICE_ROLE_KEY` / `STRIPE_SECRET_KEY` appears under any `NEXT_PUBLIC_` name.

### Pattern 4: Serwist PWA (Next 16 + Vercel)
**What:** `withSerwist` next.config wrapper + authored `app/sw.ts` + manifest + `/~offline` precached fallback.
**When to use:** PLAT-02. Shapes from Serwist official docs (fetched 2026-06-17).
```ts
// next.config.ts
import withSerwistInit from "@serwist/next";
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "<git-hash-or-uuid>" }],
});
export default withSerwist({ /* next config */ });
```
```ts
// app/sw.ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
declare global { interface WorkerGlobalScope extends SerwistGlobalConfig {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined; } }
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true, clientsClaim: true, navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: { entries: [{ url: "/~offline",
    matcher({ request }) { return request.destination === "document"; } }] },
});
serwist.addEventListeners();
```
**Pitfall 12 guard (D-06):** `defaultCache` includes NetworkFirst for pages, but for v1 explicitly ensure **auth, sign-in, `/admin`, `/auth/confirm`, and any future booking/claim/status routes are NetworkFirst or excluded from runtime caching** — never CacheFirst/StaleWhileRevalidate. A stale-cached signed-in shell or status page is a correctness hazard. The branded `/~offline` page is the only intentionally-precached navigational fallback.

### Pattern 5: Tailwind v4 brand tokens via `@theme`
**What:** Brand palette + Montserrat declared as CSS vars; Tailwind auto-generates utilities.
**When to use:** PLAT-03. Source: tailwindcss.com/docs/theme (fetched 2026-06-17).
```css
/* app/globals.css */
@import "tailwindcss";
@theme {
  --color-teal:  #029B87;   /* → bg-teal / text-teal / ring-teal ; primary, links, claimed */
  --color-teal2: #047982;   /* secondary / avatars / paid */
  --color-amber: #FEBE21;   /* in-progress / en_route / live */
  --color-coral: #E44B4B;   /* alerts / unclaimed / cancelled / errors */
  --color-slate: #2F4858;   /* headings / text / dark surfaces / sidebar */
  --color-grey:  #66676F;   /* muted / completed */
  --color-white: #FFFFFF;   /* base surface */
  --font-sans: "Montserrat", ui-sans-serif, system-ui, sans-serif;
}
```
**Naming note (flag for planner):** the UI-SPEC writes tokens as `--teal` etc., but Tailwind v4 **requires the `--color-*` prefix** to auto-generate `bg-/text-/border-` utilities. Declare them as `--color-teal` (Tailwind exposes the raw CSS var as `--color-teal`; you can still alias `--teal: var(--color-teal)` if other CSS references the short name). Keep the StatusDot lifecycle map (UI-SPEC) intact — only the declaration prefix changes.
**Montserrat:** self-host via `next/font/local` or `next/font/google` and precache the woff2 in the Serwist manifest so the offline shell renders branded. Weights 400 + 600 for Phase 1.
**Seed components (D-08):** `Button` (height fixed 52px, teal fill, ≥44px hit target), `StatusDot` (coloured dot + 14px/600 text label — colour never the sole signal, WCAG 1.4.1), `LanguageToggle` (≥44px hit target).

### Pattern 6: EN/BG typed dictionary + cookie (no i18n lib)
**What:** `en.ts`/`bg.ts` keyed by string id; language in a server-readable cookie; SSR renders correct language with no flash.
**When to use:** PLAT-04 / D-04 / D-05.
```ts
// platform/i18n/en.ts
export const en = {
  signInCta: "Send magic link",
  magicLinkSent: "Check your email — we've sent you a sign-in link.",
  emptyHeading: "Nothing here yet",
  offlineHeading: "You're offline",
  // ...all UI-SPEC Copywriting Contract ids
} as const;
export type Dict = typeof en; // bg.ts must satisfy Dict (type-safe parity)
```
```ts
// reading language in a server component (no flash)
import { cookies } from "next/headers";
const lang = (await cookies()).get("lang")?.value === "bg" ? "bg" : "en"; // EN default (D-04)
const t = lang === "bg" ? bg : en;
```
The toggle is a small client component that writes the `lang` cookie (e.g. via a server action or `document.cookie`) and refreshes; because the cookie is read server-side, SSR output is already in the chosen language. `<html lang={lang}>` set in `app/layout.tsx`.

### Anti-Patterns to Avoid
- **`@supabase/auth-helpers-nextjs`** — deprecated; use `@supabase/ssr` (CLAUDE.md "What NOT to Use").
- **`getSession()` for authorization** — trusts the cookie unverified; use `getUser()` for authz, `getClaims()` only for the proxy refresh (CLAUDE.md).
- **`next-pwa`** — unmaintained vs Next 16; use Serwist (CLAUDE.md).
- **Service-role / secret keys in `NEXT_PUBLIC_`** — full RLS bypass leaks to browser (Pitfall 7 / SC-4).
- **CacheFirst on auth/status/booking routes** — stale-auth hazard (Pitfall 12 / D-06).
- **Running code between `createServerClient` and `getClaims()/getUser()` in `proxy.ts`** — official Supabase warning; causes random logouts.
- **Caching the Supabase server client in a module-global** — breaks under Vercel Fluid compute; create per-request.
- **Targeting the Kalvia project** (`utyatpadtibqqswsfvtr`) — all Supabase/Vercel work is Balkanity (`qyhdogajtmnvxphrslwm`) only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session refresh / cookie sync | Custom JWT cookie juggling | `@supabase/ssr` `proxy.ts` `updateSession` (getAll/setAll) | Subtle cookie-sync bugs cause random logouts; the official shape handles it |
| JWT verification for authz | Manual JWT decode | `auth.getUser()` (network) / `getClaims()` (local verify) | Hand-decoded JWTs skip signature/expiry checks → spoofable |
| Service-worker precache/offline | Hand-written `fetch` SW | Serwist (`defaultCache` + `fallbacks`) | Cache versioning, navigation preload, fallback routing are easy to get wrong |
| Server/client secret boundary | Code review / naming hope | `server-only` package | Build-time guarantee, not a convention |
| Seam enforcement | Code-review discipline | ESLint `no-restricted-imports` | Compile-time fail beats human vigilance (the whole point of PLAT-01) |
| i18n parity | Untyped string maps | Typed `Dict` (bg satisfies `typeof en`) | Type system catches a missing BG key at build |

**Key insight:** Phase 1's value is that every boundary (seam, secret, auth) is enforced by a tool that fails the build/lint, not by discipline — so later phases physically cannot land code in the wrong place.

## Runtime State Inventory

> Greenfield repo — no prior runtime state exists. This section is included because the phase introduces the FIRST stateful elements; the inventory documents what later rename/refactor phases would need to track.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None yet. P1 creates the first table (`app_users`) + the seed admin row (D-02). | New migration + seed insert (flagged — sign-off) |
| Live service config | Supabase Auth email template must be edited to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (lives in Supabase dashboard, NOT git). Vercel env vars (Supabase URL/keys) live in Vercel, not git. | Manual dashboard config — capture in plan as an explicit non-code task |
| OS-registered state | None — Vercel-hosted; no local daemons/cron in P1. | None |
| Secrets/env vars | New: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only). All set in Vercel + `.env.local` (gitignored). | Create env vars in Vercel for the Balkanity project |
| Build artifacts | `public/sw.js` is generated by Serwist at build — must be gitignored (already in `.gitignore` patterns) and never hand-edited. | Add `public/sw*.js` to `.gitignore` |

## Common Pitfalls

### Pitfall 1: Service-role / secret key leaks to the client (CLAUDE.md Pitfall 7)
**What goes wrong:** A secret ends up in a `NEXT_PUBLIC_` var or a server module is imported by a client component → bundled into browser JS → full RLS bypass.
**Why it happens:** No build-time guard; naming drift.
**How to avoid:** `import "server-only"` at the top of every secret-holding module; never `NEXT_PUBLIC_` for service-role/Stripe secret. SC-4 verification proves the build fails on violation.
**Warning signs:** `grep -r "NEXT_PUBLIC_.*SERVICE_ROLE\|NEXT_PUBLIC_.*SECRET"` returns anything.

### Pitfall 2: SW serves stale auth/status (CLAUDE.md Pitfall 12)
**What goes wrong:** A cached signed-in shell or status page is served after sign-out / status change → user sees wrong/stale state.
**Why it happens:** Default caching strategy applied to dynamic routes.
**How to avoid:** Auth/sign-in/admin/booking/claim/status routes stay NetworkFirst or are excluded from runtime cache; only the static shell + `/~offline` are precached (D-06).
**Warning signs:** Signed-out user still sees `/admin` content offline.

### Pitfall 3: Seam erosion (CLAUDE.md Pitfalls 9/13)
**What goes wrong:** `platform/` quietly imports from `modules/`, coupling the platform to a module.
**Why it happens:** Convenience; no enforcement.
**How to avoid:** ESLint `no-restricted-imports` rule (Pattern 1) errors on it; CI runs `eslint .`. Verify with the temporary forbidden import (SC-2).
**Warning signs:** lint passes but a `platform/` file references a `wp_`-prefixed concept.

### Pitfall 4: `middleware.ts` vs `proxy.ts` confusion (Next 16)
**What goes wrong:** Following older docs, you create `middleware.ts`; it's deprecated and emits warnings, or you mix the `middleware` and `proxy` function names.
**Why it happens:** Training data + most blog posts predate the Next 16 rename.
**How to avoid:** Use `proxy.ts` with `export async function proxy(...)` (or `export default`). Run `npx @next/codemod@canary middleware-to-proxy .` if any legacy file appears.
**Warning signs:** build/dev console warns "middleware is deprecated."

### Pitfall 5: `getSession()` used for authz
**What goes wrong:** Authorization decisions trust an unverified cookie → spoofable.
**How to avoid:** `getUser()` for the role decision (SC-3 mandates it); `getClaims()` only for the proxy refresh.
**Warning signs:** `grep -rn "getSession" platform/ app/` outside of a non-authz read.

### Pitfall 6: Targeting the wrong Supabase/Vercel project
**What goes wrong:** Migrations/env land on Kalvia (`utyatpadtibqqswsfvtr`).
**How to avoid:** Confirm the linked ref is `qyhdogajtmnvxphrslwm` before every migration/deploy; if any tool reports Kalvia, STOP (CLAUDE.md constraint).
**Warning signs:** `supabase status` / dashboard shows a non-Balkanity ref.

## Code Examples

All verified patterns are inline in Architecture Patterns above (Patterns 1–6), each tagged with its source. Key sources: Vercel `with-supabase` example (clients + proxy), Serwist docs (SW), Tailwind v4 docs (`@theme`), ESLint docs (`no-restricted-imports`), Supabase passwordless docs (`signInWithOtp`/`verifyOtp`).

## State of the Art

| Old Approach (training / CLAUDE.md text) | Current Approach (verified 2026-06-17) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` at repo root, `export function middleware` | **`proxy.ts`, `export function proxy`** (codemod: `middleware-to-proxy`) | Next.js v16.0.0 | CLAUDE.md says "middleware.ts" — use `proxy.ts` for greenfield. `middleware.ts` still works but deprecated. |
| `getUser()` everywhere / "never getSession" | **`getClaims()` for proxy session-refresh** (fast local JWT verify); `getUser()` for authz decisions | Supabase asymmetric-key rollout (2025) | Use both: `getClaims()` in `proxy.ts`, `getUser()` in role resolution (still satisfies SC-3's `getUser()` mandate). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (publishable key naming) | Supabase key rename (2025) | Use the publishable-key env name; the browser still only holds the publishable/anon-tier key (SC-4 still holds). |
| `tailwind.config.js` JS object | **CSS-first `@theme` in globals.css**, `--color-*` prefix for utilities | Tailwind v4 | No JS config; tokens are CSS vars. |
| ESLint `.eslintrc` | **Flat config `eslint.config.mjs`** (ESLint 10) | ESLint 9→10 | Seam rule goes in flat config `files`-scoped block. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs` — replaced by `@supabase/ssr`.
- `next-pwa` — replaced by Serwist.
- `middleware.ts` convention — replaced by `proxy.ts` (Next 16).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next 16 uses `proxy.ts` (not `middleware.ts`); CLAUDE.md's "middleware.ts at repo root" is superseded | State of the Art / Pattern 2 | LOW — verified from official Next docs; but contradicts CLAUDE.md text, so planner should confirm the rename is acceptable (functionally identical; codemod exists). `middleware.ts` still works if the team prefers continuity. |
| A2 | `getClaims()` in proxy + `getUser()` for authz satisfies SC-3's `auth.getUser()` mandate | State of the Art / Pattern 2 | LOW — SC-3 explicitly requires `getUser()` for the role decision, which this honors; `getClaims()` is only the refresh path. Confirm the planner keeps `getUser()` on the authz path. |
| A3 | Env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (renamed anon key) | Pattern 2 / SOTA | LOW — from current Vercel example; the Balkanity project may still expose the legacy `ANON_KEY` name. Verify the actual key name in the Supabase dashboard for ref `qyhdogajtmnvxphrslwm`. |
| A4 | `app_users(id uuid PK ref auth.users, email, role enum/text)` with role ∈ {admin,driver,guest} is the right schema; admin seeded by SQL insert | Project Structure / Pattern 2 | MEDIUM — this is the FLAGGED first migration (D-02). Exact column set, role storage (enum vs text vs separate roles table), and RLS policy need sign-off before applying. Researcher recommends a single `role` text/enum column for v1 simplicity (one role per user, per AUTH-01 "exactly one"). |
| A5 | Repo uses root-level `platform/`/`modules/`/`app/` (no `src/`) | Project Structure | LOW — Claude's discretion (D-08); planner picks `src/` or root and keeps ESLint paths consistent. |
| A6 | Brand tokens must be declared `--color-*` (not `--teal`) for Tailwind v4 utility generation | Pattern 5 | LOW — verified from Tailwind v4 docs; UI-SPEC's `--teal` naming is a declaration detail, semantics unchanged. |

**If this table is empty:** it is not — six assumptions need planner/user acknowledgment. Most are LOW risk; A4 (schema) is the flagged sign-off gate.

## Open Questions (RESOLVED)

1. **D-09 brand assets not in repo (BLOCKER for SC-5).**
   - What we know: `Mockups/`, `Balkanity Branding/`, `PRD.md`, `PRD-BG.md` are all confirmed **absent** (`ls` 2026-06-17).
   - What's unclear: final committed paths and exact filenames of the marks/pictograms.
   - Recommendation: Planner sequences logo/icon-rendering tasks AFTER an asset-commit checkpoint; token/typography/component/i18n tasks proceed now. Do not satisfy SC-5 with placeholders.
   - **RESOLVED:** Plan 01-05 gates logo/pictogram rendering behind a `checkpoint:human-action` asset-commit; token/typography/component/i18n work proceeds in 01-04. SC-5 is explicitly NOT satisfied by placeholders.

2. **First-migration schema shape (`app_users` + roles) — flagged/irreversible.**
   - What we know: needs `id` (FK to `auth.users`), `email`, `role ∈ {admin,driver,guest}`, RLS, and a seed admin insert (D-02).
   - What's unclear: enum vs text for role; one-role-column vs roles table; exact RLS policies.
   - Recommendation: Planner surfaces the migration SQL for sign-off BEFORE applying (CLAUDE.md review gate). Recommend single `role` enum/text column (AUTH-01 = exactly one role).
   - **RESOLVED:** Plan 01-02 places a `checkpoint:decision` (role storage shape) + `checkpoint:human-verify` (SQL sign-off) before the `autonomous: false` [BLOCKING] schema-push task targeting ref `qyhdogajtmnvxphrslwm`.

3. **`middleware.ts` vs `proxy.ts` (CLAUDE.md text vs Next 16).**
   - What we know: Next 16 deprecated `middleware.ts` → `proxy.ts`; codemod exists; both function today.
   - Recommendation: Greenfield → use `proxy.ts`. Planner confirms with user (trivial, but it contradicts a CLAUDE.md sentence).
   - **RESOLVED:** SKELETON.md and Plan 01-03 use `proxy.ts` (with `getClaims()` for refresh, `getUser()` for authz); the deviation from CLAUDE.md's "middleware.ts" sentence is flagged in-plan as intentional.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build/dev | (assumed — repo is a JS project) | check `node -v` ≥ 20 for Next 16 | none — must install |
| npm | Install/scaffold | ✓ (npm registry reachable; `npm view` worked) | — | — |
| Supabase CLI | Local migrations + `gen types` | unverified this session | — | Use Supabase MCP `apply_migration` / dashboard SQL editor (remote) |
| Stripe CLI | not needed in P1 | — | — | — |
| Vercel CLI | Deploy + env (P1 deploy to Balkanity) | unverified | — | Vercel dashboard / Git integration |
| slopcheck | Package legitimacy gate | ✗ (pip install failed) | — | All packages are first-party locked stack, registry-confirmed — gate is informational |
| ctx7 | Context7 docs fallback | ✗ (not installed) | — | Used WebFetch against official docs (Serwist/Tailwind/Next/Supabase) — equivalent coverage |

**Missing dependencies with no fallback:** none blocking — Node/npm/Supabase access all functional; remote Supabase MCP (`apply_migration`, `list_tables`, `get_advisors`) is available for the flagged migration if the local CLI is absent.
**Missing dependencies with fallback:** slopcheck (mitigated by registry verification + locked stack), ctx7 (mitigated by WebFetch to official docs).

## Validation Architecture

> `nyquist_validation: true` in config — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None yet — greenfield. Recommend **Vitest** (fast, ESM-native, Next 16 compatible) for unit/seam tests; **Playwright** for the install/PWA + sign-in smoke. |
| Config file | none — see Wave 0 |
| Quick run command | `npx vitest run` (once added) |
| Full suite command | `npx vitest run && npx playwright test` (once added) |

Note: much of Phase 1's verification is **build/lint-gate** rather than runtime tests — the seam (ESLint), the secret boundary (`next build` with `server-only`), and PWA installability (Lighthouse/manual). These are first-class verification commands, not unit tests.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-01 | platform/ importing modules/ fails lint | lint-gate | `npx eslint platform/` (with temp forbidden import → expect error) | ❌ Wave 0 (eslint.config.mjs) |
| PLAT-05 / SC-4 | client import of service-role module fails build | build-gate | `npx next build` (with temp client import → expect failure) | ❌ Wave 0 |
| PLAT-05 | no secret in NEXT_PUBLIC_ | grep-gate | `! grep -rn "NEXT_PUBLIC_.*\(SERVICE_ROLE\|SECRET\)" .` | n/a (grep) |
| PLAT-02 | installable PWA + offline fallback | smoke / manual | Playwright: SW registers, `/~offline` served when offline; Lighthouse PWA installable | ❌ Wave 0 (playwright) |
| PLAT-03 | brand tokens compile to utilities | unit/build | assert `bg-teal` class present in built CSS; visual check StatusDot/Button | ❌ Wave 0 |
| PLAT-04 | EN/BG toggle flips strings + persists cookie | integration/smoke | Playwright: toggle → cookie set → reload renders BG | ❌ Wave 0 |
| AUTH-01 / SC-3 | user resolves to exactly one role via getUser() | unit/integration | Vitest on `platform/auth/role.ts` (mock supabase) | ❌ Wave 0 |
| AUTH-04 | admin can sign in (magic link) | smoke (manual link) | Playwright sign-in form → confirm route sets session (magic link is async/manual) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx eslint . && npx tsc --noEmit` (seam + types) + relevant `vitest run <file>`
- **Per wave merge:** `npx vitest run` + `npx next build` (proves server-only + Serwist build)
- **Phase gate:** full suite + manual PWA-install/Lighthouse + magic-link sign-in walkthrough green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `eslint.config.mjs` — seam `no-restricted-imports` rule (PLAT-01)
- [ ] Vitest install + config (`vitest.config.ts`) + `platform/auth/role.test.ts`
- [ ] Playwright install + config + PWA-install/sign-in/lang-toggle smoke specs
- [ ] CI script wiring `eslint`, `tsc --noEmit`, `next build` as gates

## Security Domain

> `security_enforcement: true`, ASVS level 1 — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase magic-link OTP (passwordless, D-01); `shouldCreateUser:false` (no open signup); `verifyOtp` server-side |
| V3 Session Management | yes | `@supabase/ssr` cookie sessions; `proxy.ts` refresh via `getClaims()`; HttpOnly auth cookies managed by Supabase |
| V4 Access Control | yes | Role resolved server-side via `getUser()` (never `getSession()`); RLS on `app_users`; role-based redirect (D-03) |
| V5 Input Validation | yes (light) | P1's only input is the sign-in email — validate format server-side before `signInWithOtp` (zod arrives Phase 3/4 for richer inputs) |
| V6 Cryptography | no (delegated) | JWT signing/verification handled by Supabase + WebCrypto (`getClaims`); never hand-roll |
| V7/V8 Secrets/Data protection | yes | `server-only` guard on service-role key (SC-4); secrets never `NEXT_PUBLIC_`; `.env.local` gitignored |

### Known Threat Patterns for Next 16 + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key bundled to client | Information Disclosure / Elevation | `server-only` import + no `NEXT_PUBLIC_` secret (SC-4 build-gate) |
| JWT/cookie spoofing for authz | Spoofing / Elevation | `getUser()` (revalidates) for authz, not `getSession()` |
| Open signup via magic link | Elevation of Privilege | `shouldCreateUser:false`; admin seeded by SQL (D-02) |
| Stale-cached signed-in shell (SW) | Tampering / Info Disclosure | NetworkFirst on auth/status routes (Pitfall 12 / D-06) |
| Seam erosion coupling platform to module | (architectural integrity) | ESLint `no-restricted-imports` build-gate (PLAT-01) |
| Wrong-project migration (Kalvia) | (operational) | Confirm ref `qyhdogajtmnvxphrslwm` before any migration/deploy |
| RLS bypass via missing policy on `app_users` | Info Disclosure | Enable RLS + explicit policies on the first migration (flagged sign-off) |

## Sources

### Primary (HIGH confidence)
- nextjs.org/docs/app/api-reference/file-conventions/proxy — `middleware.ts`→`proxy.ts` rename, v16.0.0, codemod, function export, Node.js runtime default
- tailwindcss.com/docs/theme — `@theme`, `--color-*`/`--font-*` → utility generation
- eslint.org/docs/latest/rules/no-restricted-imports — flat-config `patterns/group/message`
- serwist.pages.dev/docs/next/getting-started — `withSerwist`, `app/sw.ts`, `/~offline` fallback, manifest
- supabase.com/docs/guides/auth/auth-email-passwordless — `signInWithOtp({shouldCreateUser})`, `verifyOtp`, `emailRedirectTo`
- github.com/vercel/next.js examples/with-supabase (canary, fetched 2026-06-17) — current `client.ts`/`server.ts`/`proxy.ts` shapes, `getClaims()`, publishable-key env
- npm registry (`npm view`, 2026-06-17) — all pinned versions confirmed
- CLAUDE.md — locked stack, Verified Provider Facts, What NOT to Use, integration patterns

### Secondary (MEDIUM confidence)
- WebSearch (Supabase docs/issues/Medium, 2026) — `getClaims` vs `getUser` guidance (verified against official supabase.com discussion #40985 / docs)
- WebSearch (Supabase docs, 2026) — `/auth/confirm` route + `verifyOtp(token_hash)` pattern (verified against supabase.com server-side nextjs guide)

### Tertiary (LOW confidence)
- none relied upon for prescriptive guidance.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked in CLAUDE.md + every version re-verified on npm registry.
- Architecture: HIGH — client/proxy shapes from the current official Vercel example; Serwist/Tailwind/ESLint from official docs.
- Pitfalls: HIGH — drawn from CLAUDE.md's documented pitfalls + verified Next 16 / Supabase behavior changes.
- Schema (`app_users`): MEDIUM — exact shape is the flagged sign-off decision (A4 / Open Question 2).
- Brand assets: BLOCKED — D-09 assets absent; SC-5 cannot complete until committed.

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable locked stack; re-verify Next/Supabase if the phase slips a month — both moved this cycle)
