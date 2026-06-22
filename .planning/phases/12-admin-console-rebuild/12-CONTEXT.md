# Phase 12: Admin Console Rebuild - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the existing admin desktop console to the slate **"Transfer Pool"** identity on the Phase 9 design system: a persistent left sidebar (Dashboard / Transfers / Drivers / Settings), KPI cards computed from real transfer data, the pending-transmissions transfers table with filter + sort + row actions, a restyled transfer detail keeping every existing operation intact, and a top bar with client-side search, the notifications bell, and the signed-in admin identity. The visual/interaction contract is already locked by `12-UI-SPEC.md` (six locked decisions); this phase implements it and settles the HOW decisions the UI-SPEC left open.

**Presentation-only**: NO change to backend, schema, auth model, RLS, the payment path, the unmasked `wp_transfers_admin_read` RLS read, the five gated ops Server Actions (`assign` / `reassign` / `release` / `cancel` / `refund`), the `refundPayment` hook, or the single-writer `paid` invariant. KPI cards, the table, and both search/sort controls read the EXISTING admin transfer query (anon cookie-bound RLS-gated client) — no new endpoint. The role gate (`getCurrentRole() === "admin"`) runs server-side before any read on every route — unchanged. The new `/admin/settings` hub page is a navigation grouping of routes that already exist — no new CRUD, no new schema.

**In scope (existing admin routes):** `/admin` (→ Dashboard), `/admin/transfers` (+ `TransfersView.tsx`), `/admin/transfers/[id]` (+ `TransferDetailView.tsx`, `RefundForm.tsx`), `/admin/drivers`, the supply CRUD (`companies/`, `properties/`, `destinations/`) + `health/`, plus a new shared `app/admin/layout.tsx` (sidebar + top bar) and a new `/admin/settings` hub page.

**Out of scope:** Guest surface (Phase 10, done), Driver surface (Phase 11, done), any backend/schema/lifecycle/RLS/Checkout change, and every omitted mockup feature recorded in `12-UI-SPEC.md` (Analytics nav page, "Download Manifest" export, KPI daily-goal %, trend arrows, revenue/earnings, ratings, live GPS map). No new ops action, no changed action behaviour, no changed authz.
</domain>

<decisions>
## Implementation Decisions

These resolve the HOW questions the `12-UI-SPEC.md` left open or that the existing code created tension with. The six UI-SPEC "Locked Decisions" remain authoritative for all visual/structural choices — these do not re-litigate them.

### Search — single top-bar, client-side (AUI-05)
- **D-01:** The new top-bar search is the **single** search affordance. **Remove the existing in-page server-side `q` search box** from `TransfersView.tsx`. The top-bar search filters the **already-loaded transfer rows client-side** (guest name / flight no. / destination / truncated ID) — no URL `q` param, no server round-trip per keystroke. It is mounted once in the admin shell (top bar) but only filters when the Transfers list is the active surface (it operates over that page's loaded set). This satisfies AUI-05's "client-side filter of loaded transfers" cleanly and avoids two confusing search boxes. (The existing server `q` machinery in the RSC is removed/retired, not kept as a dead second path.)

### Sort — client control is sole authority
- **D-02:** The new client **sort control is the sole ordering authority** over the loaded rows — there is no separate hidden coral "pin" rule layered underneath. The control's **default value is "Needs attention,"** which reproduces today's behaviour exactly (needs-attention/coral rows first, then soonest arrival). Switching to **"Soonest arrival"** or **"Status"** gives a clean, predictable global ordering with no rows jumping the queue. Sort runs client-side over the loaded set, pairing naturally with the D-01 client-side search. The existing status-filter chips + needs-attention quick filter remain a **server URL-param re-query** (unchanged) — filter narrows the loaded set server-side; sort/search reorder/filter that loaded set client-side.

### Settings — dedicated hub page
- **D-03:** The sidebar **"Settings"** item targets a **new `app/admin/settings/page.tsx` hub page** that lists the four existing routes (Companies `/admin/companies`, Properties `/admin/properties`, Destinations `/admin/destinations`, Platform health `/admin/health`) as cards/links. This keeps the sidebar to a clean 4 items, gives a real landing target, and keeps the `usePathname` prefix-match active-highlight simple (`/admin/settings*`). It is a presentational hub only — **no new CRUD, no new schema**. The grouped supply CRUD + health pages get a light DS restyle to sit in the new shell.

### Responsive — full responsive console
- **D-04:** Build the console **fully responsive**, not desktop-only. Persistent fixed slate sidebar (~240–256px) on desktop (≥ ~1024px); below that the sidebar **collapses to a hamburger-toggled overlay drawer**. The transfers **table transforms to stacked cards on mobile** — reusing the *current* stacked-`<ul>` layout as the mobile fallback (table on desktop, cards on mobile), so the mobile view is reuse, not a new invention. KPI cards reflow to a responsive grid (4→2→1). This is the user's explicit call (admins are desktop-primary, but the surface must hold up on tablet/phone — and Phase 11 had a responsive nav-placement miss worth not repeating).

### Dashboard composition — KPI cards + Recent transfers
- **D-05:** The Dashboard ("Transfer Pool") shows the four KPI cards **plus a "Recent transfers" section** below them: a compact list of the top ~5 rows with a **"View all" link to `/admin/transfers`**. It reuses the same loaded rows + table/card row styling — **no new query/endpoint**. This makes the landing page a useful at-a-glance view rather than four bare numbers. (Replaces the current placeholder `emptyHeading`/`emptyBody` landing copy.)

### Claude's Discretion
- **KPI "Total today" date field** — implementer picks the date field already available on the loaded row (`arrival_at` vs paid/created date), per UI-SPEC Decision 3.
- **Signed-in admin identity source** — read from the existing verified session (`auth.getUser()` already in the route); email alone is acceptable if no name is reliably present (mirrors Phase 11 D-03 discretion).
- New admin-only component file structure and prop shapes (e.g. `app/admin/_nav/AdminShell.tsx`, sidebar/top-bar/KPI-card/table extraction, the 4 sidebar line icons) — planner/executor's call, provided D-01–D-05 and the full `12-UI-SPEC.md` component inventory hold.
- Exact drawer-toggle mechanism and breakpoint constant for D-04 — implementation detail, provided the desktop/persistent + mobile/drawer + table→cards behaviours hold.

### Carried forward from Phases 10–11 (not re-asked)
- Surface-local chrome (sidebar, top bar, KPI card, table, settings hub) lives under `app/admin/` (mirroring `app/driver/_nav/` and `app/(guest)/_pass/`), **NOT** in `platform/ui/`. Phase 9 primitives consumed verbatim.
- Consolidate the per-page slate `<header>` chips into **one shared `app/admin/layout.tsx`** mounting the sidebar + top bar (incl. the single `NotificationBell` + `LanguageToggle`) — mirrors Phase 11's `app/driver/layout.tsx` consolidation. No admin layout exists today.
- EN/BG `tsc` key-parity gate: every new key (sidebar labels, Dashboard title, 4 KPI labels, column headers, row actions, sort control, signed-in-identity label, settings-hub titles) goes in BOTH `en.ts` and `bg.ts`.
- **Testing = existing behavioural tests stay green + visual review** (Phase 11 D-06). The restyle must not change behaviour, so `app/admin/transfers/TransfersView.test.tsx`, `app/admin/destinations/you-keep.test.tsx`, `app/admin/health/EmailCapGauge.test.tsx` and any ops/refund tests continue to cover semantics. New visual pieces (sidebar, top bar, KPI cards, table) are eyeballed against the mockups + UI-SPEC. No new component tests required.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (PRIMARY — locked)
- `.planning/phases/12-admin-console-rebuild/12-UI-SPEC.md` — the locked visual/interaction contract for this phase: 6 locked decisions (omit backend-less features, 4-item sidebar, 4 KPI cards from real data, pending-transmissions table, client-side top-bar search, all five ops preserved), the component inventory (admin shell / sidebar / top bar / KPI cards / transfers table / transfer detail / drivers / settings hub), slate-surface color split, type roles, spacing, and the copywriting contract (every new i18n key). MUST read before planning.
- `.planning/phases/09-design-system-foundation/09-UI-SPEC.md` — the Phase 9 foundation contract this surface consumes (token + component vocabulary). Phase 12 adds **zero** new tokens.

### Roadmap / milestone rules
- `.planning/ROADMAP.md` — "Milestone v1.1: UI Rebuild" + "Phase 12: Admin Console Rebuild" (goal, 5 success criteria, presentation-only/omission rules, `#029B87` brand correction, locked surface order Guest→Driver→Admin, "Slate console surfaces"). Requirements: AUI-01, AUI-02, AUI-03, AUI-04, AUI-05.

### Prior surface phases (the patterns to mirror)
- `.planning/phases/11-driver-pwa-rebuild/11-CONTEXT.md` — Phase 11 (Driver) established the shared-layout consolidation pattern (one `layout.tsx` mounting nav + chrome once), surface-local pieces under the route dir, presentation-only guarantee, existing-tests-stay-green testing approach (D-06). Directly mirrored by D-04 (shell) and the carried-forward testing decision.
- `.planning/phases/10-guest-ui-rebuild/10-CONTEXT.md` — Phase 10 (Guest) established the surface-local rebuild pattern this milestone follows: restyle all screens (no half-rebranded surfaces), surface-local pieces under the route dir, EN/BG tsc parity gate, presentation-only.

### Mockups (visual source of truth — corrections applied)
- `Branding /stitch_balkanity_welcome_pickup/` admin Transfer Pool dashboard / transfers table / transfer detail screens. **Reject**: `#00685a`/`primary` token family (→ `#029B87`), Material Symbols icons (→ Phase 9/10/11 line pictograms + brand Transfer Badge), and the backend-less features listed in the UI-SPEC omissions.
- `Branding /stitch_balkanity_welcome_pickup/balkanity_path/DESIGN.md` — "Balkanity Path" design language (its `#00685a`-family primary is rejected; brand primary is `#029B87`).

### Phase 9 components / tokens to consume verbatim (do NOT re-invent)
- `platform/ui/StatusDot.tsx` (+ `stateLabel()`), `platform/ui/LifecycleStepper.tsx` (replaces the detail's vertical `LifecycleTimeline`, DS-04), `platform/ui/RouteMotif.tsx`, `platform/ui/NotificationBell.tsx`, `platform/ui/LanguageToggle.tsx`, `platform/ui/Button.tsx`, `platform/ui/Card.tsx`.
- `app/(guest)/_pass/icons.tsx` + driver nav icons — reuse line pictograms; add the 4 sidebar-nav line icons (Dashboard / Transfers / Drivers / Settings) in the same 1.5px-stroke style.
- `public/brand/transfer-badge.svg`, `public/brand/balkanity-logo.png` — committed brand assets (Transfer Badge midpoint, sidebar logo chip). NEVER Material Symbols / re-drawn logo / invented infinity loop (STATE.md ASSET guardrail).
- `app/globals.css` `@theme` — token source. Phase 12 adds no tokens.
- `platform/i18n/en.ts` + `bg.ts` — EN/BG dictionary with the tsc key-parity gate.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 9 shared primitives (`StatusDot`, `LifecycleStepper`, `RouteMotif`, `Button`, `Card`, `NotificationBell`, `LanguageToggle`) — the building blocks the rebuild composes.
- `app/admin/transfers/TransfersView.tsx` — the current stacked-`<ul>` list IS the mobile-card fallback for D-04 (table on desktop, this on mobile). It already owns the status-filter chips + needs-attention quick filter (server URL-param re-query — kept) and currently a server `q` search + server coral-pin sort (the latter two are reshaped by D-01/D-02).
- `app/admin/transfers/[id]/TransferDetailView.tsx` + `RefundForm.tsx` — the five ops controls to preserve verbatim and restyle; swap vertical `LifecycleTimeline` → horizontal `LifecycleStepper current={status}`.
- `app/(guest)/_pass/icons.tsx` + driver nav icons — line-pictogram source for the 4 new sidebar icons.

### Established Patterns
- **No `app/admin/layout.tsx` today** — every admin page renders its own slate `<header>` chip independently. The shared-layout consolidation (D-04 / carry-forward) mirrors exactly what Phase 11 did for `app/driver/`.
- Admin routes are server-guarded RSCs that re-verify the ADMIN role via `getCurrentRole()` (revalidated JWT, never cookie-trusting `getSession`) before any read; copy resolved server-side (no-flash) and handed to client islands as prop bags.
- The transfers RSC owns the read + the `.in`/`.or` status filter + needs-attention compute + sort; the client island (`TransfersView`) is presentational over those rows. D-01/D-02 add client-side search + client sort over the loaded set without moving the read off the RSC.
- Active-nav highlight via `usePathname` prefix match (mirrors `DriverBottomNav`) — used for the new sidebar incl. `/admin/settings*`.
- EN/BG `tsc` key-parity gate — a missing key fails the build.

### Integration Points
- KPI cards + table + Recent-transfers section all derive from the **existing admin transfer read** — no new query/endpoint (D-05, D-03 stay presentation-only).
- Top-bar search/sort operate on the rows already loaded by the transfers RSC (D-01/D-02) — client-side only.
- The five ops Server Actions, `refundPayment` hook, and the `paid` single-writer invariant are untouched — detail restyle is visual only (D-06 ops preserved verbatim per UI-SPEC).
- `NotificationBell` + `readOwnNotifications()` feed mounts ONCE in the new shell top bar (replacing the per-page bells).
</code_context>

<specifics>
## Specific Ideas

- Single top-bar search box (no second in-page search); instant client-side filter of loaded rows.
- Sort control with three options — "Needs attention" (default, = today's coral-pin+soonest), "Soonest arrival", "Status" — sole ordering authority, no hidden pin.
- `/admin/settings` hub = a small page of cards/links to Companies / Properties / Destinations / Platform health.
- Sidebar: persistent on desktop, hamburger overlay drawer on narrow; transfers table → stacked cards on mobile (reuse existing `<ul>` layout).
- Dashboard = four KPI cards (Unclaimed coral / Claimed teal / En route amber / Total today slate) + a "Recent transfers" top-~5 list with "View all".
</specifics>

<deferred>
## Deferred Ideas

None raised — discussion stayed within the admin-surface scope. All backend-less mockup features (Analytics page, Manifest export, KPI daily-goal %, trends, earnings, ratings, GPS map) are intentionally **omitted** per the v1.1 truthfulness rule, not deferred for a later phase.
</deferred>

---

*Phase: 12-admin-console-rebuild*
*Context gathered: 2026-06-22*
