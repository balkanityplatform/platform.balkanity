# Phase 11: Driver PWA Rebuild - Research

**Researched:** 2026-06-22
**Domain:** Presentation-layer rebuild of the existing driver PWA surface (Next 16 App Router RSC + client islands, Tailwind v4 `@theme`, Supabase caller-auth/service-role)
**Confidence:** HIGH

## Summary

This is a **pure presentation-only re-skin** of four already-working driver routes. Every backend primitive the driver UI touches — the masked `wp_pool()` RPC, the atomic `claim_transfer` RPC (via `claimTransfer`/`claimAction`), the gated service-role `advanceStatus` write, the claiming-driver RLS reads, and magic-link/password auth — **already exists and must be reused verbatim**. The single genuinely-new artifact is a small **sign-out server action** (auth-only, no schema). The research deliverable that matters most is the concrete EXISTING-code-to-reuse map, which is below with exact file paths, function signatures, and prop shapes. `[VERIFIED: codebase]` for all reuse claims — every file was read in this session.

The rebuild composes Phase 9 shared primitives (`StatusDot`, `RouteMotif`, `LifecycleStepper`, `Button`, `Toast`, `NotificationBell`, `LanguageToggle`) and mirrors the Phase 10 guest surface-local pattern (new presentational pieces live under `app/driver/`, never in `platform/ui/`). It consumes the existing Tailwind v4 `@theme` tokens in `app/globals.css` and adds **zero new tokens**. All new user-facing strings flow through the EN/BG dictionary parity gate (`platform/i18n/en.ts` + `bg.ts`), which fails `tsc` on a missing key.

Two structural changes beyond styling: (1) introduce a shared `app/driver/layout.tsx` that mounts the new `DriverBottomNav` + slim top header once (today each page renders its own `<header>`), and (2) the trip-detail page (`app/driver/run/[id]/page.tsx`) must **add a Confirm-Arrival advance CTA** (it currently has none — advance lives only inline in `RunView`) and **swap `LifecycleTimeline` → `LifecycleStepper`**. Both are presentation/wiring-only over existing actions.

**Primary recommendation:** Restyle in place. Build `app/driver/layout.tsx` + `app/driver/_nav/DriverBottomNav.tsx`, extract claim-card / trip-card presentational pieces under `app/driver/`, swap the detail page to `LifecycleStepper` and wire its Confirm-Arrival CTA to the existing `advanceStatus(id)`, restyle Profile into a real settings page, and add a `signOutAction`. Touch NO `platform/transfers/*`, NO migrations, NO RLS, NO `claim.ts`/`advanceStatus` authz logic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pre-claim pool listing (no PII) | API / DB (`wp_pool()` SECURITY DEFINER) | Frontend Server (RSC reads it) | Masking is structural at the RPC; UI renders only the 9 returned columns — never re-implements masking |
| Claim a transfer (first-to-claim-wins) | API / DB (`claim_transfer` atomic UPDATE) | Frontend Server action (`claimAction`) | Concurrency resolved by one conditional UPDATE in the DB; the action is a thin caller-auth wrapper |
| Advance status / Confirm-Arrival | API (gated service-role action `advanceStatus`) | Browser island (CTA) | Drivers have no RLS write policy; the in-action ownership check + lifecycle map are the gate |
| Post-claim trip detail (full PII) | API / DB (claiming-driver RLS) | Frontend Server (RSC reads it) | RLS scopes the row to the owning driver; full PII is legitimate post-claim |
| Bottom nav active state | Browser / Client (`usePathname()`) | — | Pure client routing/highlight; no server involvement |
| Profile identity header | Frontend Server (RSC, `auth.getUser()`) | — | Already-verified session; no new data source |
| Digest preference | API (gated service-role action) | Browser island | Existing `saveDigestPreference`; `driver_profiles` has no self-write RLS |
| Sign-out | API (new auth-only server action) | Browser (Profile button) | `supabase.auth.signOut()` + redirect; session-only, no schema |
| i18n copy resolution | Frontend Server (RSC `getDict`) | — | No-flash SSR; copy handed to islands as prop bags |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Introduce a shared `app/driver/layout.tsx` that mounts the `DriverBottomNav` and the slim top header (Alerts bell + Language toggle) once, wrapping all driver routes. There is currently NO driver layout. Presentation-only. Page content gets bottom padding ≈ nav height so the last card is never occluded by the fixed nav.
- **D-02:** The bottom nav stays visible on the en-route trip detail (`/driver/run/[id]`), with the My Trips tab active. The driver returns to the list by tapping My Trips — no separate back affordance. (The detail route is the 4th driver shell and explicitly keeps the nav.)
- **D-03:** The Profile screen gets a full rebuild into a real settings surface composing, top to bottom: (1) Driver identity header — signed-in driver's name + email from the existing verified auth session (`getCurrentRole()` + `auth.getUser()`); no avatar photo; initials-in-a-chip permitted. (2) Digest preference card — the existing `DigestPreferenceCard` (NOTF-05), restyled; behaviour unchanged. (3) Language toggle row — surface the EN/BG `LanguageToggle` as a settings row (in addition to the top header). (4) Sign-out action — see D-05.
- **D-04 (truthfulness guard):** Even as a full rebuild, the Profile introduces NO data-less features — every element is backed by data we already have (auth session, `driver_profiles.digest_*`, the i18n dict). No earnings, no ratings, no stats, no avatar upload.
- **D-05:** A sign-out control on Profile is the single genuinely-new affordance. Confirmed there is no existing sign-out anywhere in `app/`. Implement as a small server action calling `supabase.auth.signOut()` then redirecting to `/sign-in`. Auth/session only — no schema, no RLS, no new table. Lone deviation from pure re-skin; does not trigger the schema/auth review gate beyond a normal sign-out.
- **D-06:** Rely on the existing driver tests + visual review — no new component tests required. Existing behavioural tests MUST stay green: `app/driver/run/RunView.test.tsx`, `app/driver/advance.lifecycle.test.ts`, `advance.notify.test.ts`, `advance.ownership.test.ts`. New visual pieces (claim card, bottom nav, trip card) are eyeballed against the mockups.

### Claude's Discretion

- New driver-only component file structure and prop shapes (e.g. `app/driver/_nav/DriverBottomNav.tsx`, claim-card / trip-card extraction, the Luggage + 3 nav-tab line icons) — planner/executor's call, provided D-01–D-06 and the full `11-UI-SPEC.md` component inventory hold.
- Exactly where the driver name is sourced (auth metadata vs `driver_profiles`) for the D-03 identity header — pick the simplest already-available field; email alone is acceptable if no name is reliably present.
- How much of the bottom-nav active-state logic is derived from `usePathname()` vs passed as a prop — implementation detail.

### Deferred Ideas (OUT OF SCOPE)

None raised — discussion stayed within the driver-surface scope. Guest (Phase 10, done) and Admin (Phase 12) rebuilds are their own phases. All backend-less mockup features (live GPS map, route-line tracking, ETA, vehicle make/model/plate, driver avatar photo, driver ratings ★, earnings totals + trend %, call/chat affordances) are intentionally OMITTED per the v1.1 truthfulness rule — not deferred for a later phase. No un-claim / give-back control (CLAIM-04).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUI-01 | Available transfers render as claim cards (pickup time, pax, "Unclaimed" badge, route w/ motif, date, price, Claim CTA) showing **no guest PII** pre-claim | Reuse `wp_pool()` via `supabase.rpc("wp_pool")` (already in `app/driver/page.tsx` + `refetchPool` in `actions.ts`); render only the 9 columns of `PoolRow`. Compose `RouteMotif` (airport→zone), coral `StatusDot variant="pill" state=...`/worded "Unclaimed" badge, `fmtEur`, line icons. PII masking is structural at the RPC — never re-implemented. |
| DUI-02 | Bottom navigation bar: Available / My Trips / Profile, active tab highlighted | New `app/driver/layout.tsx` (D-01) mounts `app/driver/_nav/DriverBottomNav.tsx`. Routes: `/driver`, `/driver/run`, `/driver/settings`. Active via `usePathname()`. New i18n keys `navAvailable`/`navMyTrips`/`navProfile`. 12px/600 labels (the one deliberate exception), ≥44px hit targets, `pb-[env(safe-area-inset-bottom)]`. |
| DUI-03 | My Trips: claimed/past transfers as trip cards (date, status, route, pax, duration, details link) — no earnings/ratings | Restyle `app/driver/run/RunView.tsx`. Keep `arrival_at` ASC ordering + the `completedTodayTitle`/`Completed today` partition (RunView.test.tsx asserts both in source). Use `StatusDot` per-row real state, `RouteMotif`/compact route line, teal details link to `/driver/run/[id]`. |
| DUI-04 | En-route trip detail: claimed passenger info, route card, DS-04 stepper, passenger note, Confirm-Arrival CTA wired to existing advance-status — no live map | Restyle `app/driver/run/[id]/page.tsx`: **swap `LifecycleTimeline` → `LifecycleStepper current={status}`**; **ADD** a next-forward-edge advance CTA (none today) wired to existing `advanceStatus(id)` — "Confirm arrival" for en_route via new key `driverConfirmArrivalCta`, other edges reuse `advanceTo*Cta`. Needs a small client island for the CTA (the page is an RSC). |
| DUI-05 | Claim action invokes the existing atomic claim RPC and reflects first-to-claim-wins / already-claimed in the UI | Reuse `claimAction(id)` from `app/driver/actions.ts` unchanged; preserve the win→`/driver/run/<id>` push, neutral `claimLostToast` + silent card removal on `already_claimed`, coral `claimFailedToast` otherwise, and the focus+~25s `refetchPool` poll. |
</phase_requirements>

## Standard Stack

This phase introduces **no new dependencies**. It consumes the locked stack already installed and used by the driver surface.

### Core (already installed — reuse, do not re-add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | `^16.2` (16.2.9) | App Router RSC + client islands + server actions | Locked stack (CLAUDE.md) |
| react | `^19.2` (19.2.7) | UI runtime; `useState`/`useTransition`/`usePathname` for the nav island | Locked transitive of Next 16 |
| tailwindcss | `^4` | CSS-first `@theme` tokens consumed via semantic classes | Locked; tokens live in `app/globals.css` |
| @supabase/ssr | `^0.12` | `createServerClient` caller-auth client (`platform/supabase/server`) | Locked; the only auth client for reads + claim |
| @supabase/supabase-js | `^2.108` | RPC + service-role client (`platform/supabase/admin`) | Locked |

### Supporting (existing internal modules — the reuse surface)
| Module | Path | Purpose |
|--------|------|---------|
| `getCurrentRole` | `platform/auth/role.ts` | Server-side role gate (revalidated JWT; never `getSession`) |
| `getDict` / `getLang` | `platform/i18n/dictionary.ts` | No-flash SSR copy resolution |
| `createClient` | `platform/supabase/server.ts` | Caller-auth cookie-bound client |
| `createAdminClient` | `platform/supabase/admin.ts` | Service-role client (only inside gated actions) |
| `fmtEur` | `platform/money/commission.ts` | Money formatting for the fare |
| `ALLOWED_TRANSITIONS` / `STEPPER_ORDER` | `platform/transfers/lifecycle.ts` | Lifecycle map + the 6-step stepper order (do NOT hand-roll) |
| `claimTransfer` / `ClaimResult` | `platform/transfers/claim.ts` | The atomic claim wrapper (called by `claimAction`) |

**Installation:** None. `npm install` is NOT required for this phase.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. All code reuses already-installed, already-vetted dependencies (verified across Phases 1–10). No registry queries, no slopcheck run needed.

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs)
**Packages flagged as suspicious [SUS]:** none (no installs)

## Architecture Patterns

### System Architecture Diagram

```
                         DRIVER (mobile PWA, warm-light)
                                     │
          ┌──────────────────────────┴───────────────────────────┐
          │            app/driver/layout.tsx  (NEW, D-01)          │
          │   slim top header: logo · NotificationBell · Lang      │
          │   {children}  ← page content (bottom-padded)           │
          │   DriverBottomNav (NEW) : Available · My Trips · Profile│
          └──────────────────────────┬───────────────────────────┘
                                     │ usePathname() → active tab
        ┌───────────────┬────────────┴───────────┬────────────────┐
        ▼               ▼                         ▼                ▼
  /driver          /driver/run            /driver/run/[id]   /driver/settings
  (RSC page)       (RSC page)             (RSC page)          (RSC page)
     │                 │                       │                  │
  getCurrentRole gate  getCurrentRole gate   getCurrentRole gate  getCurrentRole gate
     │                 │                       │                  │
  rpc("wp_pool")   select own rows         select own row     auth.getUser()
  (9 masked cols)  (claiming-driver RLS)   (claiming-driver   + service-role read
     │                 │                    RLS, full PII)     driver_profiles.digest
     ▼                 ▼                       ▼                  ▼
  PoolView         RunView                 [NEW] DetailView    Profile (rebuilt)
  (client island)  (client island)        client island       identity · digest ·
     │                 │                    (LifecycleStepper   lang row · sign-out
     │                 │                     + Confirm-Arrival)       │
     ▼                 ▼                       ▼                  ▼
 claimAction(id)   advanceStatus(id)      advanceStatus(id)   signOutAction (NEW)
     │                 │                       │                  │
  claimTransfer    gated service-role      gated service-role  supabase.auth
  → claim_transfer write (ownership +      write (same action) .signOut()
   atomic UPDATE    lifecycle map +                            → redirect /sign-in
  (first-to-claim)  optimistic .eq guard)
     │
  win → push /driver/run/<id>
  lose(already_claimed) → neutral toast + drop card
```

### Recommended Project Structure
```
app/driver/
├── layout.tsx                 # NEW (D-01): mounts top header + DriverBottomNav once
├── _nav/
│   └── DriverBottomNav.tsx    # NEW (DUI-02): client island, usePathname active state
├── _ui/                       # NEW (discretion): surface-local presentational pieces
│   ├── icons.tsx              # NEW: Luggage + 3 nav-tab line icons (1.5px stroke)
│   ├── ClaimCard.tsx          # NEW (optional extract): the masked claim card
│   └── TripCard.tsx           # NEW (optional extract): the My Trips card
├── page.tsx                   # KEEP (RSC) — already reads wp_pool; header moves to layout
├── PoolView.tsx               # RESTYLE (claim cards); keep claim/poll/PII logic verbatim
├── actions.ts                 # KEEP claimAction/refetchPool/advanceStatus VERBATIM
├── run/
│   ├── page.tsx               # KEEP (RSC); header moves to layout
│   ├── RunView.tsx            # RESTYLE (trip cards); keep ordering + Completed-today
│   └── [id]/
│       ├── page.tsx           # RESTYLE (RSC): swap timeline→stepper; pass row to island
│       └── DetailView.tsx     # NEW client island: stepper + Confirm-Arrival CTA
└── settings/
    ├── page.tsx               # RESTYLE (RSC): add identity header + lang row + sign-out
    ├── actions.ts             # KEEP saveDigestPreference VERBATIM; ADD signOutAction
    └── DigestPreferenceCard.tsx  # RESTYLE chrome only; behaviour unchanged
```
*(Whether to extract `ClaimCard`/`TripCard` or restyle inline is Claude's discretion per CONTEXT.)*

### Pattern 1: RSC server-guard → resolve copy → hand prop bag to client island
**What:** Every driver route is `getCurrentRole() !== "driver" → redirect("/sign-in")`, then `getDict()`/`getLang()`, then read data, then render a client island with an explicit copy prop bag (no `getDict` in the island).
**When to use:** All four driver routes — preserve this exactly.
**Example:**
```typescript
// Source: app/driver/page.tsx (codebase, verbatim pattern)
export const dynamic = "force-dynamic";
export default async function DriverPoolPage() {
  if ((await getCurrentRole()) !== "driver") redirect("/sign-in");
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("wp_pool");
  // ...map to PoolRow[], render <PoolView copy={{...}} .../>
}
```

### Pattern 2: Shared layout mounting fixed bottom nav (NEW, D-01)
**What:** `app/driver/layout.tsx` is an RSC that resolves `lang` + bell data once, renders the slim top header and the fixed `DriverBottomNav`, and gives `{children}` bottom padding so the last card clears the nav.
**When to use:** D-01 — consolidates the 3 duplicated `<header>` blocks.
**Caveat:** The current pages each render `NotificationBell` with `bellInitial` from `readOwnNotifications()`. Moving the bell to the layout means the **layout** must call `readOwnNotifications()` (it is a layout RSC, so it can). Pages then stop rendering their own header. Verify the bell still seeds correctly from the layout.
**Example shape:**
```typescript
// app/driver/layout.tsx (new)
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const bellInitial = await readOwnNotifications();
  return (
    <div className="min-h-dvh bg-white pb-[calc(64px+env(safe-area-inset-bottom))]">
      <header /* logo · NotificationBell · LanguageToggle */ />
      <main>{children}</main>
      <DriverBottomNav lang={lang} copy={{ navAvailable, navMyTrips, navProfile }} />
    </div>
  );
}
```

### Pattern 3: Detail page needs a client island for the advance CTA (NEW for DUI-04)
**What:** `app/driver/run/[id]/page.tsx` is currently a pure RSC with NO advance CTA. To add Confirm-Arrival you need a small **client island** (`"use client"`) that holds the CTA + `useTransition` + `advanceStatus(id)` call + error toast — the RSC reads the row and passes `{id, status, copy}` to it.
**When to use:** DUI-04 — the CTA cannot live in the RSC (server actions are invoked from client interaction).
**Reuse:** Copy the exact `onAdvance`/`nextEdgeCta` logic from `RunView.tsx` (lines 67–83, 129–146); only the en_route label changes to the new `driverConfirmArrivalCta` key.

### Pattern 4: Dictionary parity gate for every new string
**What:** Add each new key to BOTH `platform/i18n/en.ts` and `platform/i18n/bg.ts`. `Dict = typeof en`; `bg: Dict` — a missing/extra key fails `tsc`.
**New keys this phase:** `navAvailable`, `navMyTrips`, `navProfile`, `driverUnclaimedBadge`, `driverConfirmArrivalCta`, `driverSignOutCta`, plus any detail-grid caption keys to replace the current hardcoded English ("Arrival", "Flight", "Fare", "Passengers", "Luggage", "Guest name", "Guest phone", "Notes" in `[id]/page.tsx` lines 107–121) and any trip-card captions. Reuse existing keys verbatim where present (`claimTransferCta`, `claimLostToast`, `claimFailedToast`, `poolEmptyHeading/Body`, `myRunTitle`, `runEmptyHeading/Body`, `completedTodayTitle`, `advanceTo*Cta`, `advanceFailedToast`, `airportLabel`, `zoneLabel`, `addressLabel`).

### Anti-Patterns to Avoid
- **Re-implementing PII masking in the UI:** NEVER filter PII in the island. The `wp_pool()` RPC returns only 9 columns by construction; the card renders what it gets. Adding a PII column to the card requires a base-table read, which the pool path never does.
- **Calling the service-role client from a client component:** `advanceStatus`/`saveDigestPreference`/`signOutAction` are `"use server"` actions; the service-role client (`createAdminClient`) is used only inside them.
- **Using `getSession()` for authz:** Forbidden (CLAUDE.md). All gates use `getCurrentRole()` → `auth.getUser()`.
- **Adding an un-claim / give-back control:** Explicitly forbidden (CLAIM-04). Cancelled is a rendered status, not a driver action.
- **Hand-rolling lifecycle order or labels:** Use `STEPPER_ORDER`, `ALLOWED_TRANSITIONS`, and `stateLabel()` — never parallel arrays.
- **Introducing data-less mockup features:** No map, ratings, earnings, ETA, vehicle, avatar, call/chat (truthfulness rule).
- **Adding new `@theme` tokens or a JS `tailwind.config`:** Phase 11 adds zero tokens; consume existing semantic classes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lifecycle step order | A `["paid","claimed",...]` array | `STEPPER_ORDER` (`platform/transfers/lifecycle.ts`) | Single source; the stepper already consumes it |
| Status labels/colors | A per-state label/color map | `StatusDot` + `stateLabel()` (`platform/ui/StatusDot.tsx`) | DS-02 contract, WCAG label always present, cancelled hollow ring |
| Next forward edge resolution | An `if status === ...` chain | `ALLOWED_TRANSITIONS[status].find(s => s!=="cancelled" && s!=="paid")` (already in `RunView.tsx` + `actions.ts`) | Same logic both call sites already use |
| Route departure→arrival visual | A custom flexbox + lines | `RouteMotif` (`platform/ui/RouteMotif.tsx`) | DS-03; serves the committed brand Transfer Badge |
| Horizontal progress stepper | A custom stepper | `LifecycleStepper` (`platform/ui/LifecycleStepper.tsx`) | DS-04; shape-encodes state beyond color |
| Claim concurrency | Any client-side claim resolution | `claimAction(id)` → `claimTransfer` → `claim_transfer` RPC | Atomic conditional UPDATE in the DB is the only race-safe path |
| Money formatting | `toFixed`/manual cents math | `fmtEur` (`platform/money/commission.ts`) | Already used in PoolView/detail |
| Primary CTA geometry | A raw `<button>` | `Button` (52px / ≥44px, teal/ghost) | Brand-locked geometry |
| Toast | A custom toast | `Toast` (`platform/ui/Toast.tsx`, tones neutral/error) | Existing tone contract |
| Line icons | Material Symbols / re-drawn logo | Reuse `app/(guest)/_pass/icons.tsx`; add Luggage + nav icons same style | ASSET guardrail — never invent/redraw |
| Sign-out | A custom auth flow | `supabase.auth.signOut()` + `redirect("/sign-in")` in a `"use server"` action | Standard Supabase SSR sign-out |

**Key insight:** This surface is a *composition* problem, not a *construction* problem. Every hard part (concurrency, masking, lifecycle, status rendering, money, brand assets) is already solved upstream; the phase's job is to arrange them per `11-UI-SPEC.md` without touching their internals.

## Runtime State Inventory

> This is a presentation-only re-skin, not a rename/refactor/migration. No stored data, service config, OS state, secrets, or build artifacts carry a string being changed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys/collections/IDs change. `wp_pool()`, `wp_transfers`, `driver_profiles`, RPC names all unchanged. | None |
| Live service config | None — no n8n/Datadog/Tailscale/Cloudflare config touched. | None |
| OS-registered state | None — no Task Scheduler/pm2/launchd/systemd. pg_cron schedules (health/digest) unchanged. | None |
| Secrets/env vars | None — no env var names referenced or renamed. `signOutAction` uses the existing session cookie only. | None |
| Build artifacts | None — no package rename, no compiled binaries. | None |

**Nothing found in any category** — verified by reading all in-scope files: the only new write is `supabase.auth.signOut()` (session cookie clear), which touches no persistent state.

## Common Pitfalls

### Pitfall 1: Bell/header duplication when consolidating into the layout (D-01)
**What goes wrong:** Each page currently renders its own `<header>` with `NotificationBell` seeded from `readOwnNotifications()`. If the layout adds the header but pages don't remove theirs, the bell renders twice and seeds twice.
**Why it happens:** Three independent headers (`PoolView`, `RunView`, `settings/page`) plus the detail page's own back-link header.
**How to avoid:** Move the header markup + `readOwnNotifications()` into `app/driver/layout.tsx`; delete the `<header>` blocks from `PoolView.tsx`, `RunView.tsx`, `[id]/page.tsx`, and `settings/page.tsx`; remove `bellInitial`/`bellCopy`/`langToggle` props that the layout now owns (or keep passing only what the island still needs). Verify no double-render.
**Warning signs:** Two bells/logos on a screen; two notification fetches in the network tab.

### Pitfall 2: Detail page has no advance CTA today — it must be added, not restyled
**What goes wrong:** Treating DUI-04 as "restyle the existing CTA" — but `app/driver/run/[id]/page.tsx` currently renders NO advance button (it's a read-only RSC). The advance CTA only exists inline in `RunView`.
**Why it happens:** The detail page was a pure display page in Phase 6.
**How to avoid:** Add a new client island (`DetailView.tsx`) that holds the next-forward-edge CTA wired to `advanceStatus(id)`, reusing `RunView`'s `nextEdgeCta`/`onAdvance` logic. The RSC stays the data + role gate.
**Warning signs:** Plan says "restyle the Confirm-Arrival button" with no task to *create* one.

### Pitfall 3: Stale pool from the service worker (already mitigated — don't regress)
**What goes wrong:** A SW-cached `/driver` document/data serves a stale pool, causing failed claims.
**Why it happens:** Default precaching would cache the pool.
**How to avoid:** `app/sw.ts` already forces NetworkFirst for `/^\/(sign-in|admin|auth|driver|status|pickup|track)(\/|$)/` documents (Pitfall 12). The `/driver` path is covered. Do NOT add caching that bypasses this; keep `export const dynamic = "force-dynamic"` on the pool page. The focus+~25s `refetchPool` poll is the live-refresh backstop.
**Warning signs:** Claim "already claimed" rate spikes; pool not updating on focus.

### Pitfall 4: Breaking the RunView.test.tsx source-grep contract
**What goes wrong:** Restyling `RunView.tsx` removes the `arrival_at` ordering or the `completedTodayTitle`/`Completed today` partition string, and the source-level test fails.
**Why it happens:** The test asserts the *source* contains `arrival_at`, `completedTodayTitle || "Completed today"`, and a `"completed"` literal — not just runtime behaviour.
**How to avoid:** Keep the ASC sort and the Completed-today `<details>` partition (restyle, don't remove). Keep the `"completed"` status literal in the partition logic.
**Warning signs:** `RunView.test.tsx` red after a restyle commit.

### Pitfall 5: The coral "Unclaimed" badge is a presentation choice over `status='paid'` data
**What goes wrong:** Trying to change the masked row's `status` to "unclaimed" (there is no such state).
**Why it happens:** The mockup labels pool rows "Unclaimed"; the data state is `status='paid' AND driver_id IS NULL`.
**How to avoid:** Render a coral DS-02 badge with the worded label "Unclaimed" (`driverUnclaimedBadge`) as a presentation layer over the same masked rows — do not introduce a new status or change `StatusDot`'s map. (Today `PoolView` renders `StatusDot state="paid"`; the rebuild presents these as the coral "Unclaimed" badge.)
**Warning signs:** A plan task to edit `STATE_META` or add a `"unclaimed"` `TransferState`.

### Pitfall 6: New string shipped without its BG translation
**What goes wrong:** `tsc` build fails because a key exists in `en.ts` but not `bg.ts` (or hardcoded English in JSX).
**How to avoid:** Add every new key to BOTH dictionaries; replace the detail page's hardcoded captions ("Arrival"/"Flight"/"Fare"/"Passengers"/"Luggage"/"Guest name"/"Guest phone"/"Notes") with dictionary keys.
**Warning signs:** `tsc` error `Property 'x' is missing in type` on `bg.ts`.

## Code Examples

### Reading the masked pool (verbatim — reuse, do not change)
```typescript
// Source: app/driver/page.tsx (codebase)
const supabase = await createClient();
const { data } = await supabase.rpc("wp_pool"); // 9 masked columns; zero PII by construction
```

### Claim with first-to-claim-wins handling (verbatim — reuse)
```typescript
// Source: app/driver/PoolView.tsx (codebase)
const result = await claimAction(id);
if (result.ok) { router.push(`/driver/run/${id}`); return; }      // WIN
if (result.reason === "already_claimed") {                         // LOSE (neutral)
  setToast({ message: copy.claimLostToast, tone: "neutral" });
  setRows((prev) => prev.filter((r) => r.id !== id)); return;
}
setToast({ message: copy.claimFailedToast, tone: "error" });      // ERROR
```

### Next-forward-edge advance CTA (reuse this logic on the detail island)
```typescript
// Source: app/driver/run/RunView.tsx (codebase) — copy into DetailView.tsx
const next = ALLOWED_TRANSITIONS[status].find((s) => s !== "cancelled" && s !== "paid");
// en_route → label = copy.driverConfirmArrivalCta (NEW); others reuse advanceTo*Cta
const result = await advanceStatus(id);
if (!result.ok) setToast(copy.advanceFailedToast);
```

### Swap the detail stepper (the one component swap)
```tsx
// app/driver/run/[id]/page.tsx — replace:
//   <LifecycleTimeline current={row.status as TransferState} />
// with:
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
<LifecycleStepper current={row.status as TransferState} />
```

### Sign-out action (NEW — the lone new write)
```typescript
// app/driver/settings/actions.ts (new export) — auth/session only
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/platform/supabase/server";
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
```

### RouteMotif on the claim card (compose existing endpoints)
```tsx
// Source: platform/ui/RouteMotif.tsx — pass already-translated labels
import { RouteMotif } from "@/platform/ui/RouteMotif";
<RouteMotif
  start={{ icon: <PlaneIcon />, label: r.airport ?? copy.airportLabel }}
  end={{ icon: <BuildingIcon />, label: r.zone ?? copy.zoneLabel }}
/>
```

## State of the Art

| Old Approach (current driver UI, Phase 6) | Current Approach (this rebuild) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Each driver page renders its own `<header>` | One shared `app/driver/layout.tsx` | Phase 11 (D-01) | DRY chrome; bottom nav mounted once |
| Top-right-only nav (logo + lang) | Persistent bottom nav (Available/My Trips/Profile) | Phase 11 (DUI-02) | Mockup identity; thumb-reachable |
| Detail page uses vertical `LifecycleTimeline`, no advance CTA | Horizontal `LifecycleStepper` + Confirm-Arrival CTA | Phase 11 (DUI-04) | DS-04 consistency; advance from detail |
| Pool rows show `StatusDot state="paid"` | Coral "Unclaimed" DS-02 badge (presentation over same data) | Phase 11 (DUI-01) | Matches mockup; no data change |
| Settings = digest card only | Full settings page (identity · digest · lang · sign-out) | Phase 11 (D-03/D-05) | Real Profile; sign-out finally exists |
| Hardcoded English detail captions | Dictionary-keyed EN/BG captions | Phase 11 | i18n parity |

**Deprecated/outdated within scope:** none — the locked stack (Next 16 / React 19 / Tailwind v4 / `@supabase/ssr`) is current and unchanged. `LifecycleTimeline` is NOT deprecated; it remains in use elsewhere (RunView keeps it unless the trip-card design replaces it — detail page is the only mandated swap).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Driver `name` is available from `auth.getUser()` user_metadata OR `driver_profiles.name` for the D-03 identity header | User Constraints / Pattern | LOW — CONTEXT D-03 explicitly permits email-alone fallback; `driver_profiles.name` is read elsewhere (`actions.ts` line 70) so it exists, but per-driver population isn't guaranteed. Use email if name absent. |
| A2 | Moving `NotificationBell` + `readOwnNotifications()` into the layout still seeds the bell correctly across all four routes | Pitfall 1 / Pattern 2 | LOW — layouts are RSCs and can call `readOwnNotifications()`; verify no double-fetch. Alternatively keep the bell per-page and put only the bottom nav in the layout (also valid). |
| A3 | The `Completed today` cards on My Trips should keep `LifecycleTimeline`-free compact rows (current behaviour) | Component Inventory | LOW — UI-SPEC says trip cards use `StatusDot`; the completed partition is a compact list today and can stay so. |

**All other claims are `[VERIFIED: codebase]`** (every in-scope file read this session) or `[CITED: CLAUDE.md / 11-UI-SPEC.md / 11-CONTEXT.md / REQUIREMENTS.md]`.

## Open Questions (RESOLVED)

1. **Bell placement after layout consolidation**
   - What we know: The bell currently lives in each page's header, seeded by `readOwnNotifications()`.
   - What's unclear: Whether to move the bell into the layout (cleaner) or leave it per-page and only mount the bottom nav from the layout.
   - Recommendation: Move both header + bell into the layout (D-01 says the top header with the bell + language toggle is mounted once). Confirm during planning that pages drop their headers.
   - RESOLVED: Per D-01, the header + bell move into `app/driver/layout.tsx` (Plan 01 Task 3); pages drop their per-page headers and Plan 02 Task 2 removes the duplicate bell (Pitfall-1 double-bell cleanup).

2. **Trip-card route rendering: full `RouteMotif` vs compact line**
   - What we know: UI-SPEC says "`RouteMotif` (or compact route line)".
   - What's unclear: Whether the full motif (with Transfer Badge) is too tall in a dense My Trips list.
   - Recommendation: Use the full `RouteMotif` on the claim card and trip-detail hero; a compact teal route line is acceptable on My Trips cards (executor's visual call per discretion).
   - RESOLVED: Delegated to executor discretion per CONTEXT.md "Claude's Discretion" and Plan 03 Task 1 — full `RouteMotif` on claim card + trip-detail hero; compact teal route line acceptable on dense My Trips cards.

## Environment Availability

> No new external dependencies. This is a code/markup change against the already-running stack. The dev server (`next dev`), `tsc`, and Vitest are the only tools needed and are already in use (Phases 1–10). Supabase/Vercel are unchanged and not provisioned by this phase.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js dev/build | Render + tsc gate | ✓ | ^16.2 | — |
| Vitest (jsdom) | D-06 existing-test gate | ✓ | (Phase 1 baseline) | — |
| Supabase (Balkanity ref) | Live data for UAT only | ✓ | hosted | local stack |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

> `workflow.nyquist_validation` is `true` (config.json). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) — established Phase 1 baseline (Playwright/chromium also present) |
| Config file | (Vitest config in repo root / package scripts; Phase 1 Wave 0) |
| Quick run command | `npx vitest run app/driver` |
| Full suite command | `npx vitest run` then `npx tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DUI-05 | Claim invokes atomic RPC; first-to-claim-wins/already-claimed surfaced | unit (existing) | `npx vitest run app/driver` (claim path unchanged; `claimAction` untouched) | ✅ (claim covered by Phase 5/6 concurrency gates; `actions.ts` unchanged) |
| DUI-04 | Advance is legal-edge-only, ownership-gated, idempotent | unit (existing) | `npx vitest run app/driver/advance.lifecycle.test.ts app/driver/advance.ownership.test.ts app/driver/advance.notify.test.ts` | ✅ MUST stay green |
| DUI-03 | My Trips arrival-ASC order + Completed-today partition | unit (existing source-grep) | `npx vitest run app/driver/run/RunView.test.tsx` | ✅ MUST stay green |
| DUI-01 | Pool renders only 9 masked columns; zero PII keys | manual + source review | grep `PoolRow`/`wp_pool` shows no PII keys; visual review vs mockup | ✅ structural (RPC); ❌ no new automated test (D-06) |
| DUI-02 | Bottom nav present, active tab highlighted | manual visual (D-06) | eyeball vs mockup; `usePathname()` active state | ❌ visual review (D-06: no new component tests) |
| i18n parity | Every new key in EN+BG | type (existing gate) | `npx tsc --noEmit` (fails on missing BG key) | ✅ enforced by `bg: Dict` |

### Sampling Rate
- **Per task commit:** `npx vitest run app/driver && npx tsc --noEmit`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite + tsc green; all four named driver tests green (D-06); visual UAT of the four screens vs mockups before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] None new — D-06 mandates relying on existing tests + visual review; NO new component tests are required. The presentation-only guarantee IS the four existing behavioural tests staying green.
- [ ] Confirm the existing Vitest config picks up `app/driver/**` (it already runs the named tests today).

*(No framework install needed; no new test files mandated by the phase.)*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` (config.json). Section included. This phase is presentation-only; the security posture is **preserved, not modified** — the value is ensuring the rebuild does not regress existing controls.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control (existing — preserve) |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentRole()` → `auth.getUser()` (revalidated JWT) on every route; never `getSession`. Sign-out via `supabase.auth.signOut()`. |
| V3 Session Management | yes | `@supabase/ssr` cookie session; sign-out clears it + redirects to `/sign-in`. No new session surface. |
| V4 Access Control | yes | Role gate redirects non-drivers; claiming-driver RLS scopes detail/run reads; `advanceStatus` ownership check (`driver_id === auth.uid()`) bypassing RLS via service-role only inside the gated action. |
| V5 Input Validation | yes (unchanged) | `advanceStatus`/`claimAction` derive identity server-side from `auth.uid()`, never client-supplied ids. `saveDigestPreference` keeps its zod schema. No new user input except sign-out (no payload). |
| V6 Cryptography | no | No crypto in this surface. |
| V1 Data Protection (PII) | yes (critical) | Pre-claim cards render ONLY the 9 masked `wp_pool()` columns — zero guest PII. Full PII only post-claim via claiming-driver RLS. This is the core invariant to NOT regress. |

### Known Threat Patterns for {Next 16 RSC + Supabase + driver PWA}

| Pattern | STRIDE | Standard Mitigation (existing — preserve) |
|---------|--------|---------------------|
| Guest PII leak to an unclaimed driver | Information Disclosure | Structural masking at `wp_pool()` (SECURITY DEFINER, 9 cols); UI never reads the base table pre-claim |
| Cross-driver advance/claim (forged id) | Elevation / Tampering | Identity from `auth.uid()` server-side; ownership `.eq("driver_id", user.id)` + `.eq("status", current)` optimistic guard |
| Stale-cached signed-in document via SW | Information Disclosure | `app/sw.ts` NetworkFirst for `/driver` (Pitfall 12); `force-dynamic` page |
| Authz via spoofable cookie session | Spoofing | `getCurrentRole()` revalidates the JWT; `getSession` forbidden |
| Double-claim under concurrency | Tampering | Atomic conditional UPDATE in `claim_transfer` RPC (DB-side) |

**Security verdict:** No new high-risk surface. The sole new write (`signOutAction`) is a standard session clear with no payload, no schema, no RLS change — it does not touch payment/claim/PII paths. `security_block_on: high` is satisfied: nothing high-risk is introduced.

## Project Constraints (from CLAUDE.md)

- **Presentation-only milestone (v1.1):** NO backend, schema, auth model, RLS, or payment changes. Preserve the atomic claim RPC, masked `wp_pool` (no pre-claim PII), single-writer `paid`, magic-link/password auth.
- **Locked stack:** Next 16 App Router, React 19, Tailwind v4 **CSS-first `@theme` only** (no JS `tailwind.config`), `@supabase/ssr` `^0.12` (never `@supabase/auth-helpers-nextjs`).
- **Authz:** Always `auth.getUser()` (via `getCurrentRole()`); never `getSession()` for authorization.
- **PII boundary:** Never expose guest PII to unclaimed drivers — enforced at the data/RLS layer, never UI-only masking.
- **Service-role safety:** Keep service-role key server-only; never in `NEXT_PUBLIC_` or client components. Service-role client used only inside `"use server"` actions.
- **Brand:** Primary `#029B87` (reject the mockups' `#00685a`). Never re-draw the logo or invent an infinity loop; use the committed `public/brand/transfer-badge.svg` + 1.5px-stroke line pictograms. Never Material Symbols.
- **Review gate:** Schema/auth/RLS/payment changes need sign-off before applying — this phase should touch NONE; the lone sign-out action is auth/session-only and does not trip the gate beyond a normal sign-out.
- **Infra guardrail:** Any Supabase/Vercel work targets Balkanity (`qyhdogajtmnvxphrslwm`) only, never Kalvia. (No infra work expected this phase.)
- **i18n:** Every user-facing string through the EN/BG dictionary parity gate (`tsc` fails on a missing key).
- **Philosophy:** Simplest thing that works; flag gold-plating; presentation-only — no new data-less features.

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `app/driver/page.tsx`, `PoolView.tsx`, `actions.ts`, `run/page.tsx`, `run/RunView.tsx`, `run/[id]/page.tsx`, `settings/page.tsx`, `settings/DigestPreferenceCard.tsx`, `settings/actions.ts`, `RunView.test.tsx`, `advance.lifecycle.test.ts` — the EXISTING reuse surface.
- Codebase: `platform/ui/{LifecycleStepper,StatusDot,RouteMotif,Button,LanguageToggle}.tsx`, `platform/auth/role.ts`, `platform/i18n/{dictionary,en}.ts`, `app/(guest)/_pass/{icons,TransferPass}.tsx`, `app/globals.css`, `app/layout.tsx`, `app/sw.ts` — the shared primitives + tokens.
- `.planning/phases/11-driver-pwa-rebuild/11-CONTEXT.md` — locked decisions D-01..D-06.
- `.planning/phases/11-driver-pwa-rebuild/11-UI-SPEC.md` — locked visual/interaction contract + component inventory.
- `.planning/REQUIREMENTS.md` — DUI-01..DUI-05 + Out of Scope table.
- `./CLAUDE.md` — locked stack + project constraints.
- `.planning/STATE.md` — Phase 6/9/10 accumulated decisions confirming the reuse contract.

### Secondary (MEDIUM confidence)
- None needed — all claims grounded in read source.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all reuse modules read directly.
- Architecture: HIGH — every route, action, and component read; reuse map is exact.
- Pitfalls: HIGH — derived from read source (no advance CTA on detail page, header duplication, RunView source-grep test, SW NetworkFirst, "Unclaimed" presentation-over-data).

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable — internal codebase, locked stack; re-verify only if driver routes or Phase 9 primitives change before planning).
