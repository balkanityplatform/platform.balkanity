# Walking Skeleton — Balkanity Platform (Welcome Pickup v1)

**Phase:** 1
**Generated:** 2026-06-17

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A seeded admin can request a magic link from the deployed Balkanity PWA, click the emailed link, get a verified server-side session, be resolved to exactly the `admin` role from a real `app_users` row in Supabase, and land on an installable, brand-styled admin console — with the EN/BG toggle flipping the UI and an offline fallback when disconnected.

This single path exercises: Next 16 App Router routing → `@supabase/ssr` cookie auth (anon client, browser + server) → a real Supabase Auth OTP round-trip → a real `app_users` SELECT (DB read) → role-based server-side redirect → Tailwind v4 brand tokens + seed components → Serwist PWA shell → Vercel deployment on the Balkanity project.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.x (App Router, React 19.2) | Locked (CLAUDE.md). Route handlers host future Stripe webhook + Checkout. RSC default. |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, no JS config) | Locked. Brand tokens declared as `--color-*` CSS vars; utilities auto-generated. |
| Data layer | Supabase Postgres (ref `qyhdogajtmnvxphrslwm` ONLY — never Kalvia `utyatpadtibqqswsfvtr`) | Locked. RLS is the real PII boundary in later phases. P1 creates the first table `app_users`. |
| Supabase access | `@supabase/ssr` (`createBrowserClient` / `createServerClient`); three-way split: browser-anon, server-anon (cookie), service-role (`server-only`) | Locked. `auth.getUser()` for authz; `getClaims()` for proxy refresh. Never `@supabase/auth-helpers-nextjs`, never `getSession()` for authz. |
| Auth | Supabase magic-link OTP (passwordless), `shouldCreateUser:false`, admin seeded via SQL (D-01/D-02) | Locked. Single auth pattern reused by guest status (P4) + driver invites (P2). No passwords, no open signup. |
| Session refresh boundary | `proxy.ts` at repo root (Next 16 rename of `middleware.ts`), `export async function proxy`, Node.js runtime | Next 16 deprecated `middleware.ts` → `proxy.ts` (RESEARCH A1, SOTA). CLAUDE.md text said "middleware.ts" — intentional, reviewable deviation. |
| Seam enforcement | ESLint flat config `no-restricted-imports`: `platform/` MUST NOT import `modules/*`; module DB tables use `wp_` prefix, platform tables unprefixed | Locked (PLAT-01, D). Compile-time fail beats code-review discipline. |
| Secret boundary | `server-only` package on every secret-holding module; secrets never `NEXT_PUBLIC_` | Locked (PLAT-05, SC-4, Pitfall 7). Build-time guarantee. |
| i18n | Typed `en.ts`/`bg.ts` dictionaries keyed by string id; language in a server-readable cookie; EN default, one-tap BG (D-04/D-05) | Locked. No i18n library (full i18n out of scope for v1). Server-readable cookie → SSR renders chosen language, no flash. |
| PWA | `@serwist/next` `^9.5` + authored `app/sw.ts` + manifest + precached `/~offline`; NetworkFirst on auth routes (D-06) | Locked. Never `next-pwa`. Stale-cached signed-in shell is a correctness hazard (Pitfall 12). |
| Deployment target | Vercel project `balkanity_platform_project` (team `balkanity-platform-s-projects`) | Locked. Hobby tier. Env vars set in Vercel, never committed. |
| Directory layout | Root-level `app/`, `platform/`, `modules/welcome-pickup/` (no `src/`) — `--no-src-dir` | Claude's discretion (D-08, A5). Keeps seam dirs at root; ESLint paths reference `platform/**` / `modules/**` consistently. |
| Test runners | Vitest (unit/seam) + Playwright (PWA-install / sign-in / lang-toggle smoke) | RESEARCH Validation Architecture. Much of P1 verification is build/lint-gate, not unit tests. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next 16 App Router, TS, Tailwind v4, ESLint flat config, Vitest, Playwright) — Plan 01
- [x] Routing — `/`, `/sign-in`, `/auth/confirm`, `/admin`, `/~offline` — Plans 03 & 05
- [x] Database — real `app_users` SELECT (read) on role resolution; admin row seeded by migration (write via SQL) — Plans 02 & 03
- [x] UI — admin magic-link sign-in form + EN/BG toggle wired to server/cookie — Plans 03 & 04
- [x] Deployment — deployed to the Balkanity Vercel project; documented local full-stack run (`npm run dev`) — Plan 05

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton. Be explicit — this list prevents future phases from re-litigating Phase 1's minimalism.

- Admin password / password reset (rejected — magic link only, D-01)
- Per-surface language defaults; browser locale auto-detect; URL-prefixed locales `/en` `/bg` (deferred, D-04/D-05)
- Offline cached-read of last page (rejected — stale-auth hazard, D-06)
- Inputs, cards, forms, full layout shells (built per-phase when first needed — D-08; only StatusDot, 52px Button, LanguageToggle now)
- Any booking / payment / claim / notification logic (Phases 3–7)
- Supply-side CRUD, companies/properties/destinations, driver invites (Phase 2)
- Guest magic-link status page (Phase 4 — same auth pattern, different surface)
- Any `wp_`-prefixed table or service-role write (pattern established in P1, first real write in P3+)
- RLS beyond `app_users` self-read (full PII RLS is Phase 5)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Admin no-code CRUD for companies/properties/destinations (+ slug links) and driver invites (reuses magic-link auth, seam, client split).
- Phase 3: Code-created Stripe Checkout Session + signature-verified idempotent webhook (sole `paid` author) + `webhook_events` log.
- Phase 4: `wp_transfers` entity + guest booking form on `/pickup/<slug>` + confirmation email + magic-link status page.
- Phase 5: Masked `wp_pool` view + atomic `claim_transfer()` RPC + RLS PII gating (adversarial concurrency + PII gates).
- Phase 6: Driver pool/my-run/detail + admin transfers list/detail with assign/reassign/cancel/refund.
- Phase 7: In-app feed/bell + Resend wrapper with cap guardrails + `email_log` + guest/admin emails + driver digest.
- Phase 8: Reconciliation sweep (catches dropped webhook) + email-cap gauge + stuck-transfer alerts + keep-alive.
