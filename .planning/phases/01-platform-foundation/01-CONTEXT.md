# Phase 1: Platform Foundation - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the deployed, installable PWA skeleton that every later phase builds on:
the one-way platform↔module seam, role-aware auth (admin sign-in + the
`{admin, driver, guest}` role machinery), the three-way Supabase client split,
brand design tokens + a minimal seed component set, and the EN/BG toggle —
deployed to the **Balkanity** Vercel project against Supabase ref
`qyhdogajtmnvxphrslwm` (never Kalvia).

Nothing books, pays, or claims in this phase. Supply-side CRUD is Phase 2,
driver invites Phase 2, guest magic-link status Phase 4. Phase 1 stands up the
foundation so all later code lands in the right place from commit one.

**Already locked (do not re-litigate):**
- Stack: Next 16 (App Router) / React 19 / Tailwind 4 / Supabase / `@serwist/next` (never `next-pwa`)
- Client split: anon on browser, service-role server-only (`server-only` enforced); `@supabase/ssr` for cookie sessions; always `auth.getUser()`, never `getSession()` for authz
- Seam **enforcement**: ESLint `no-restricted-imports` (modules import platform, never the reverse); module DB tables use the `wp_` prefix
- Roles resolve server-side to exactly one of `{admin, driver, guest}`
- Brand: six colours + white, Montserrat; StatusDot = coloured dot + text label; 52px primary CTA, ≥44px hit targets
- **Claude/researcher/planner own** (not user decisions): exact seam folder layout, Serwist precache config, ESLint rule specifics, middleware/session-refresh mechanics, migration mechanics

</domain>

<decisions>
## Implementation Decisions

### Admin Sign-in & Bootstrap
- **D-01:** Admin signs in via **Supabase magic link (passwordless)** — the single auth pattern reused by guest status (Phase 4) and driver invites (Phase 2). No password storage/reset flow anywhere.
- **D-02:** The first admin account is created via a **seed migration / manual SQL** insert (email + admin role), not an env allowlist or first-user-is-admin. This rides the flagged first-migration gate (`app_users` + roles) — **sign-off required before applying**.
- **D-03:** Root routing is **role-based redirect**: signed-in users route to their surface by role (admin → `/admin`; `/driver` reserved for later); an unauthenticated visit to `/` redirects to the admin sign-in. Guests and drivers never depend on `/` — they enter via `/pickup/<slug>` (Phase 4) and invite links (Phase 2).

### EN/BG Language
- **D-04:** **English is the default** language with a one-tap BG toggle, using a **single default across all three surfaces** (international guests are the constraint; staff flip to BG and it persists). No per-surface defaults, no browser auto-detect.
- **D-05:** Language choice persists in a **cookie** (survives reloads, readable server-side so SSR renders the correct language with no flash). UI strings live in **plain typed EN/BG JSON dictionary objects** (e.g. `en.ts` / `bg.ts`) keyed by string id — **no i18n library** (full i18n framework is out of scope for v1).

### PWA Identity & Offline
- **D-06:** Offline behavior = **precached app shell + a branded "You're offline" fallback page**. All auth/booking/claim routes stay **NetworkFirst (never served stale)** — guards Pitfall 12 (stale auth/status from SW cache).
- **D-07:** Installed-app identity: home-screen name **"Balkanity"** (longer name "Balkanity Platform"), theme/splash colour **`--teal #029B87`** on white, **`display: standalone`**. Icon uses the real teal/white mark once assets land (see precondition below).

### Design System Seed
- **D-08:** Build the **minimal proof set** only: design tokens (six colours + white as CSS vars per Tailwind v4 `@theme`), Montserrat, **StatusDot** (coloured dot + label), the **52px primary Button**, and the **EN/BG toggle control**. Inputs, cards, and layout shells are deferred to the phases that first need them — no foundation gold-plating.

### Planning Precondition (BLOCKER) ⚠️
- **D-09:** The real brand assets (`mark-white.png`, `mark-teal.png`, plane/route pictograms), the `Mockups/design/` HTML prototypes, and `PRD.md` / `PRD-BG.md` are **referenced as source-of-truth but are not yet in the repo**. The user will **commit them before planning proceeds**. Researcher and planner MUST confirm these exist (and capture their final paths) before relying on them; Success Criterion 5 ("real logo/pictogram assets") is not met by placeholders.

### Claude's Discretion
- Exact seam directory layout (e.g. `platform/` + `modules/welcome-pickup/` vs `src/...`), how the role is stored/resolved server-side, Serwist precache manifest contents, middleware session-refresh implementation, and what the admin sees post-login (a near-empty placeholder console is fine — onboarding is Phase 2).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Phase Specs (in repo)
- `CLAUDE.md` — the locked Technology Stack table (pinned versions: next 16.2.9, react 19.2.7, @supabase/ssr 0.12.0, @supabase/supabase-js 2.108.2, serwist/@serwist/next 9.5.11, stripe 22.2.1, resend 6.12.4), integration patterns, "What NOT to Use", and Verified Provider Facts
- `.planning/PROJECT.md` §Context, §Constraints, §Key Decisions — platform/module boundary definition, brand tokens, infra guardrail (Balkanity ref `qyhdogajtmnvxphrslwm`, never Kalvia `utyatpadtibqqswsfvtr`)
- `.planning/REQUIREMENTS.md` — PLAT-01..05, AUTH-01, AUTH-04 (the seven requirements this phase covers)
- `.planning/ROADMAP.md` §"Phase 1: Platform Foundation" — goal, five success criteria, and Notes (review/sign-off gate, Serwist lock, Pitfalls 7/9/12/13)

### Brand & Design (NOT YET IN REPO — see D-09; confirm paths once committed)
- `Mockups/assets/mark-white.png`, `Mockups/assets/mark-teal.png` — real logo marks (never re-draw)
- `Balkanity Branding/` — plane/route pictograms (never invent icons)
- `Mockups/design/` — `admin`, `guest`, `guest status`, `driver`, `index.html` interactive prototypes (rebuilt as Next.js + Tailwind in later phases; reference for brand chrome in Phase 1)
- `PRD.md` (EN) and `PRD-BG.md` (BG) — product requirement docs cited in the brief

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None — greenfield repo.** No `package.json`, no `app/`/`src/`, no prior components. Phase 1 scaffolds the Next 16 App Router project from scratch.

### Established Patterns
- No code patterns exist yet. Phase 1 *establishes* the foundational patterns (seam layout, client split, token wiring, dictionary-based i18n) that all later phases follow.

### Integration Points
- This phase creates the integration surface: the `app/` route tree (`/`, admin sign-in, `/admin`, reserved `/driver`), `middleware.ts` for session refresh, the Supabase client modules, the design-token layer, and the seam directory boundary enforced by ESLint.

</code_context>

<specifics>
## Specific Ideas

- One installable PWA serves all three actors (no separate apps).
- "Balkanity" is the installed app's public face; module naming ("Welcome Pickup") stays internal.
- Magic link is deliberately the *one* auth mechanism for the whole platform — admin entry in Phase 1 is the first instance of it.
- The first-migration (`app_users` + roles + the seed admin insert) is the flagged/irreversible schema gate — surface it for sign-off before applying.

</specifics>

<deferred>
## Deferred Ideas

- **Optional admin password** (faster repeat logins) — considered and rejected for v1; magic link only.
- **Per-surface language defaults** (EN guest / BG staff) — considered; single EN default chosen for simplicity. Revisit only if pilot feedback shows staff friction.
- **Offline cached-read of last page** — explicitly rejected (stale-auth/status hazard, Pitfall 12).
- **Broader component starter kit** (inputs, cards, layout shells) — built per-phase when first needed, not now.
- **URL-prefixed locale (`/en`, `/bg`)** — deferred; heavier than a v1 toggle needs.

None of the above are scope creep into other phases — they are within-Phase-1 alternatives that were considered and set aside.

</deferred>

---

*Phase: 1-Platform Foundation*
*Context gathered: 2026-06-17*
