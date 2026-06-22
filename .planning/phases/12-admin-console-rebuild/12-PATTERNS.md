# Phase 12: Admin Console Rebuild - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 11 (5 new, 6 modified)
**Analogs found:** 11 / 11 (all have a strong in-repo analog — Phase 11 driver consolidation is the dominant model)

> Presentation-only re-skin. The single dominant analog is the **Phase 11 driver layout/nav consolidation** (`app/driver/layout.tsx` + `app/driver/_nav/*`), which D-04 directly mirrors. All Phase 9 primitives (`Card`, `LifecycleStepper`, `StatusDot`, `NotificationBell`, `LanguageToggle`, `Button`) are consumed verbatim — do NOT re-invent them, and do NOT add anything to `platform/ui/`. Surface-local chrome lives under `app/admin/` (mirroring `app/driver/_nav/` and `app/(guest)/_pass/`).

---

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `app/admin/layout.tsx` | NEW | layout (RSC shell) | request-response | `app/driver/layout.tsx` | exact (mirror) |
| `app/admin/_nav/AdminSidebar.tsx` | NEW | nav island | event-driven (pathname) | `app/driver/_nav/DriverBottomNav.tsx` | exact (mirror) |
| `app/admin/_nav/AdminTopBar.tsx` (search + identity + bell + lang) | NEW | nav/chrome island | event-driven / client-filter | `app/driver/_nav/DriverTopNav.tsx` + `TransfersView.tsx` search form | role-match |
| `app/admin/_nav/tabs.ts` | NEW | config | n/a | `app/driver/_nav/tabs.ts` | exact (mirror) |
| `app/admin/_nav/icons.tsx` | NEW | utility (svg) | n/a | `app/driver/_ui/icons.tsx` + `app/(guest)/_pass/icons.tsx` | exact (mirror) |
| `app/admin/page.tsx` → `DashboardView` (KPI cards + Recent transfers) | MODIFIED + new view | component (RSC + island) | CRUD-read (derive) | `app/driver/settings/page.tsx` (Card composition) + `TransfersView.tsx` (row styling) | role-match |
| `app/admin/transfers/TransfersView.tsx` | MODIFIED | component (client island) | CRUD-read / client-filter+sort | itself (in-place restyle: `<ul>`→`<table>`, keep `<ul>` as mobile card fallback) | self |
| `app/admin/transfers/page.tsx` | MODIFIED (light) | controller (RSC read) | CRUD-read | itself — retire `q` server-search machinery per D-01 | self |
| `app/admin/transfers/[id]/TransferDetailView.tsx` | MODIFIED | component (client island + ops) | request-response (server actions) | itself — swap `LifecycleTimeline`→`LifecycleStepper` | self |
| `app/admin/transfers/[id]/RefundForm.tsx` | MODIFIED (light) | component (action form) | request-response | itself — DS chrome only, behaviour verbatim | self |
| `app/admin/settings/page.tsx` | NEW | component (RSC hub) | request-response (nav grouping) | `app/admin/page.tsx` nav-list + `app/driver/settings/page.tsx` Card layout | role-match |
| `app/admin/drivers/DriversView.tsx` (+ companies/properties/destinations/health) | MODIFIED (light) | component | CRUD | itself — drop per-page `<header>` (now in shell) | self |

---

## Pattern Assignments

### `app/admin/layout.tsx` (NEW — layout RSC shell)

**Analog:** `app/driver/layout.tsx` (the Phase 11 consolidation — D-04 mirrors this exactly).

This is the single most important pattern to copy. The driver layout: (1) is an `async` RSC, (2) resolves copy + lang server-side with `Promise.all([getDict(), getLang()])` (no-flash), (3) seeds the bell ONCE via `readOwnNotifications()` (caller-auth own-rows RLS — never service-role), (4) mounts persistent nav + chrome around `{children}`, (5) hands resolved copy as prop-bags to client nav islands.

Driver layout imports + RSC shape (`app/driver/layout.tsx:15-32`):
```tsx
import Image from "next/image";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { readOwnNotifications } from "@/platform/notifications/feed";
import { NotificationBell } from "@/platform/ui/NotificationBell";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { DriverBottomNav } from "./_nav/DriverBottomNav";
import { DriverTopNav } from "./_nav/DriverTopNav";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const bellInitial = await readOwnNotifications();   // own-rows RLS seed, ONCE
```

Bell + LanguageToggle prop-bag (copy `app/driver/layout.tsx:60-75` verbatim — same `alerts*` keys, reused for admin):
```tsx
<NotificationBell initial={bellInitial} lang={lang} copy={{
  alertsTrigger: t.alertsTrigger, alertsTriggerAria: t.alertsTriggerAria,
  alertsPanelTitle: t.alertsPanelTitle, markAllReadCta: t.markAllReadCta,
  alertsEmptyHeading: t.alertsEmptyHeading, alertsEmptyBody: t.alertsEmptyBody,
  alertsLoadFailed: t.alertsLoadFailed,
}} />
<LanguageToggle current={lang} label={t.langToggle} />
```

**Admin deltas (NOT in the driver analog):**
- **NO role gate in the layout.** Driver layout does not gate (each page re-gates `getCurrentRole()` server-side). Keep that — every admin RSC page already runs `if ((await getCurrentRole()) !== "admin") redirect("/sign-in")` BEFORE its read (see `app/admin/transfers/page.tsx:85-87`). Do NOT add a read/write to the layout beyond the bell seed.
- **Slate chrome, not white.** Driver chrome is `bg-white` (warm-light surface). Admin is the SLATE variant: sidebar + top bar `bg-slate`, content `bg-white`. The existing admin pages already use `bg-slate px-[24px] py-[16px]` headers with a white logo chip (`rounded-[6px] bg-white px-[8px] py-[4px]`) — see `app/admin/page.tsx:33-44`. Carry that slate+white-chip treatment into the shell.
- **Layout = sidebar (left, persistent ≥1024px / drawer below) + top bar + `<main>`**, not a top header + bottom nav. The structural skeleton (RSC resolves copy, seeds bell once, wraps children, hands prop-bags) is identical; only the placement differs.
- **Signed-in identity:** read from the existing session in the layout RSC via `supabase.auth.getUser()` (see the exact pattern in `app/driver/settings/page.tsx:54-78` — email always present, name optional; `signedInAs` label). Discretion: email alone is acceptable (mirrors Phase 11 D-03).

---

### `app/admin/_nav/AdminSidebar.tsx` (NEW — client nav island)

**Analog:** `app/driver/_nav/DriverBottomNav.tsx` (+ `DriverTopNav.tsx` for the desktop persistent variant).

Active-highlight via `usePathname` prefix match, prop-bag copy (no `lang`), per-item `aria-current`, redundant non-colour cue. Copy the island shape (`DriverBottomNav.tsx:14-24`):
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildDriverTabs, type DriverNavCopy } from "./tabs";

export function DriverBottomNav({ copy }: { copy: DriverBottomNavCopy }) {
  const pathname = usePathname();
  const tabs = buildDriverTabs(copy, pathname);
```

Active-item link pattern (`DriverBottomNav.tsx:32-49`) — `aria-current`, teal active text, ≥44px hit target, redundant teal indicator (colour is never the sole cue):
```tsx
<Link href={href} aria-current={active ? "page" : undefined}
  className={`flex min-h-[44px] ... ${active ? "text-teal" : "text-grey"}`}>
  <Icon className="h-[22px] w-[22px]" />
  <span className="text-[14px] font-semibold leading-none">{label}</span>
  <span aria-hidden="true" className={`... ${active ? "bg-teal" : "bg-transparent"}`} />
</Link>
```

**Admin deltas:**
- Vertical left sidebar (slate), 4 items stacked: Dashboard / Transfers / Drivers / Settings. On slate, active = teal icon+label (the redundant indicator stays).
- Responsive (D-04): persistent fixed slate panel ~240–256px at `md`/`lg`+; below, a hamburger-toggled overlay drawer (this toggle is the one piece of client state the driver nav lacks — add a `useState` open/close; breakpoint constant is implementer discretion). The desktop-persistent vs mobile-drawer split mirrors the `DriverTopNav` (md+) / `DriverBottomNav` (<md) responsive pairing.
- Labels at 14px/600 (Label role) — NOT the driver nav's 12px exception (the slate sidebar has room; UI-SPEC Typography requires ≥14px here).

---

### `app/admin/_nav/tabs.ts` (NEW — single source of truth for nav items)

**Analog:** `app/driver/_nav/tabs.ts` (copy verbatim, re-target hrefs).

The exact `buildDriverTabs(copy, pathname)` shape (`tabs.ts:30-55`) — typed copy bag, returns `{href, label, Icon, active}[]`, with **prefix-vs-exact** active rules that map 1:1 to the admin needs:
```ts
{ href: "/admin", label: copy.navDashboard, Icon: DashboardIcon,
  active: pathname === "/admin" },                         // EXACT — must not light under children
{ href: "/admin/transfers", ..., active: pathname.startsWith("/admin/transfers") },  // PREFIX (covers /[id])
{ href: "/admin/drivers", ..., active: pathname.startsWith("/admin/drivers") },
{ href: "/admin/settings", ..., active: pathname.startsWith("/admin/settings") }, // PREFIX keeps parent lit
```
Note the comment in the driver analog (`tabs.ts:37-40`): "Available → active ONLY on exact `/driver`" — apply the identical exact-match rule to `/admin` so Dashboard does not light under `/admin/transfers`.

---

### `app/admin/_nav/icons.tsx` (NEW — 4 sidebar line pictograms)

**Analog:** `app/driver/_ui/icons.tsx` (which is itself the EXACT analog of `app/(guest)/_pass/icons.tsx`).

Copy the `baseProps` helper verbatim (`app/driver/_ui/icons.tsx:16-29`) — `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth: 1.5`, round caps, `aria-hidden: true`:
```tsx
import type { SVGProps } from "react";
function baseProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round",
    strokeLinejoin: "round", "aria-hidden": true, ...props };
}
export function AvailableTabIcon(props: SVGProps<SVGSVGElement>) {
  return (<svg {...baseProps(props)}><path d="M8 6h12M8 12h12M8 18h12" />...</svg>);
}
```
Declare exactly 4 new glyphs: **Dashboard / Transfers / Drivers / Settings**, in the same 1.5px-stroke style. **NEVER** Material Symbols, **NEVER** a re-drawn logo / invented loop (STATE.md ASSET guardrail; see the header comment at `app/driver/_ui/icons.tsx:5-7`). Reuse existing guest glyphs (Plane/Building/etc.) by import where useful — do not re-declare them.

---

### `app/admin/page.tsx` → new `DashboardView` (MODIFIED RSC + new view) — KPI cards + Recent transfers

**Analogs:** (a) `app/driver/settings/page.tsx` for `Card`-composition layout; (b) `app/admin/transfers/page.tsx` for the read + `getCurrentRole` gate; (c) `TransfersView.tsx` for the row/card styling reused in "Recent transfers".

KPI counts derive from the **existing admin transfer read — NO new query/endpoint** (D-03/D-05). Reuse the read in `app/admin/transfers/page.tsx:99-120` (anon cookie-bound `createClient()`, `wp_transfers` select, `wp_transfers_admin_read` RLS gate). Compute the four counts in the RSC from the loaded rows: Unclaimed = `status==='paid' && driver_id===null`, Claimed = `status==='claimed'`, En route = `status==='en_route'`, Total today = `arrival_at` (or paid/created — Discretion) on the current local day.

`Card` primitive (consume verbatim, `platform/ui/Card.tsx:10-18`) — `rounded-md border border-grey/30 bg-white p-[24px]`, className passthrough — is the KPI card chrome. Card composition layout pattern (`app/driver/settings/page.tsx:82-105`):
```tsx
<section className="mx-auto flex max-w-2xl flex-col gap-[16px] px-[24px] py-[48px]">
  <Card className="flex items-center gap-[16px]">...</Card>
```

**Deltas:** Replace the placeholder `emptyHeading`/`emptyBody` landing copy + the nav-list (`app/admin/page.tsx:66-95` — that nav list MOVES to the sidebar + settings hub). New: title `adminDashboardTitle` ("Transfer Pool"), a responsive KPI grid (4→2→1), then a "Recent transfers" section reusing the top-~5 rows with `TransfersView`'s row styling + a "View all" link to `/admin/transfers`. KPI accent colours: Unclaimed=coral, Claimed=teal, En route=amber, Total today=slate — each ALWAYS paired with its worded Label (WCAG 1.4.1). Drop this page's own slate `<header>` (now in the shell).

---

### `app/admin/transfers/TransfersView.tsx` (MODIFIED — `<ul>`→`<table>` + client search/sort)

**Analog:** itself. The current stacked `<ul>` (`TransfersView.tsx:205-245`) **becomes the mobile-card fallback** (D-04) — table on desktop, this `<ul>` on mobile. Do not invent a new mobile layout; reuse the existing list rows.

Existing row markup to preserve as the mobile card (`TransfersView.tsx:206-243`) — `min-h-[56px]`, `StatusDot`, the coral needs-attention left border + text badge (WCAG 1.4.1 — `TransfersView.tsx:236-240`), `Link` to `/admin/transfers/${r.id}`:
```tsx
<Link href={`/admin/transfers/${r.id}`}
  className={`flex min-h-[56px] ... ${r.needsAttention ? "border-l-4 border-l-coral" : ""}`}>
  ... <StatusDot state={r.status} /> ...
  {r.needsAttention ? <span className="... bg-coral ... text-white">{copy.needsAttentionBadge}</span> : null}
</Link>
```

**Deltas (D-01 / D-02 / D-04):**
- **Desktop `<table>`** columns: Time/ID · Passenger · Route (`RouteMotif` compact or airport→zone text) · Lifecycle (mini `LifecycleStepper`) · Status (`StatusDot` + label) · Driver (name or `driverUnassigned` "Unassigned") · Actions (View / Assign / Cancel). Row height floor `min-h-[56px]`. New i18n keys: `colTimeId`/`colPassenger`/`colRoute`/`colLifecycle`/`colStatus`/`colDriver`/`colActions`, `rowActionView`, `driverUnassigned`.
- **REMOVE the in-page server `q` search form** (`TransfersView.tsx:136-146`) — D-01: the shell top-bar search is the single search affordance, client-side over loaded rows. Keep the existing `applyParams`/`toggleStatus` chip filters (`TransfersView.tsx:78-103`) — those remain a server URL-param re-query (unchanged).
- **Add a client sort control** (`adminSortLabel` + `sortAttention`/`sortArrival`/`sortStatus`) — sole ordering authority over loaded rows, default "Needs attention" (reproduces today's coral-pin+arrival order, currently done server-side in `app/admin/transfers/page.tsx:147-150`). The search-form pattern itself (`useState` + controlled input + `focus-visible:outline-teal`, `TransfersView.tsx:75,137-145`) is the shape to reuse for the top-bar client search.
- Drop this page's slate `<header>` (now in the shell). Widen `max-w-2xl` → wider console column (e.g. `max-w-6xl`) for the table.
- **Tests:** `app/admin/transfers/TransfersView.test.tsx` must stay green (behaviour unchanged) — restyle only.

---

### `app/admin/transfers/page.tsx` (MODIFIED — light, retire `q` machinery)

**Analog:** itself. Keep the `getCurrentRole` gate, the anon RLS read, the `.in` status filter, the needs-attention compute (`app/admin/transfers/page.tsx:80-150`). D-01 retires the server `q` path: remove the `.or(ilike)` + in-RSC destination search (`page.tsx:113-136`) and the `q` searchParam plumbing, since search becomes client-side. The status filter + needs-attention quick filter stay server-side. Do NOT touch the RLS read shape or the `wp_transfers` select.

---

### `app/admin/transfers/[id]/TransferDetailView.tsx` (MODIFIED — swap stepper, restyle, ops verbatim)

**Analog:** itself. The five ops controls (`AssignForm`, `ReasonDialog` for reassign/release/cancel, cancel's refund offer, `RefundForm`) are preserved **verbatim** (D-06 / AUI-04). The ONLY behavioural-adjacent change is **DS-04**: swap the vertical `LifecycleTimeline` for the horizontal `LifecycleStepper`.

Current (`TransferDetailView.tsx:24, 298-301`):
```tsx
import { LifecycleTimeline } from "@/platform/ui/LifecycleTimeline";
...
<div className="flex flex-col gap-[16px]">
  <LifecycleTimeline current={row.status} />
</div>
```
Replace with the Phase 9 horizontal stepper (consume verbatim — `platform/ui/LifecycleStepper.tsx:45`, prop is `current={TransferState}`; it handles `cancelled` short-circuit + worded labels itself, do not hand-roll labels):
```tsx
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
...
<LifecycleStepper current={row.status} />
```

Preserve untouched: the `Fact` block (`TransferDetailView.tsx:99-106`), both `dl` grids (`:304-332`), all five ops buttons + dialogs (`:336-459`), the `useActionState` + pending-disable + coral/teal token split (destructive=coral, positive=teal, 52px CTAs). Server actions (`assign`/`reassign`/`release`/`cancel`/`refund`) and their authz are NOT touched. Drop this page's slate `<header>` (now in the shell); restyle the `dl` grids as DS `Fact` blocks; widen content column.

---

### `app/admin/transfers/[id]/RefundForm.tsx` (MODIFIED — light DS chrome only)

**Analog:** itself. Behaviour verbatim (D-12): full-amount pre-fill editable down, always-shown `refundFeeDisclosure` (`RefundForm.tsx:47,66`), records `last_action_*` only, **NEVER sets `paid`**. Already built on the `Button` + `TextField` primitives (`RefundForm.tsx:16-18`). Restyle is visual-only; do not change the `refund` action wiring or the disclosure.

---

### `app/admin/settings/page.tsx` (NEW — hub page)

**Analogs:** `app/admin/page.tsx:77-94` (the existing console section-nav list — the cards/links pattern) + `app/driver/settings/page.tsx` (RSC + Card composition + `getCurrentRole` gate).

A presentational hub (D-03): `getCurrentRole()!=='admin'` redirect, resolve copy/lang, then render cards/links to the four EXISTING routes. Reuse the nav-list link styling verbatim (`app/admin/page.tsx:85-93`):
```tsx
{[
  { href: "/admin/companies", label: t.companiesTitle },
  { href: "/admin/properties", label: t.propertiesTitle },
  { href: "/admin/destinations", label: t.destinationsTitle },
  { href: "/admin/health", label: t.healthTitle },
].map((section) => (
  <Link key={section.href} href={section.href}
    className="inline-flex min-h-[44px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate hover:bg-slate/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
    {section.label}
  </Link>
))}
```
New keys: `adminSettingsTitle` ("Settings"), `navSettings`. Reuse `companiesTitle`/`propertiesTitle`/`destinationsTitle`/`healthTitle`. **NO new CRUD, no new schema** — purely a navigation grouping of routes that already exist. No slate `<header>` (shell owns it).

---

### `app/admin/drivers/DriversView.tsx` + companies/properties/destinations/health (MODIFIED — light restyle)

**Analog:** each itself. The shared change across all: **remove the per-page slate `<header>` chip** (logo + bell + LanguageToggle, e.g. `DriversView.tsx:62-85`) — the shell now owns the single bell + language toggle (D-04 / Phase 11 carry-forward). Drop the page's `NotificationBell` mount (superseded by the shell's single bell — `DriversView.tsx:73-78`). Light DS restyle to sit inside the new shell; invite-form / roster / CRUD behaviour unchanged.

---

## Shared Patterns

### Shell consolidation (THE governing pattern — Phase 11 D-04)
**Source:** `app/driver/layout.tsx`
**Apply to:** `app/admin/layout.tsx` + every modified admin page (each DROPS its own `<header>`).
One `async` layout RSC resolves copy/lang (`Promise.all([getDict(), getLang()])`), seeds the bell ONCE via `readOwnNotifications()`, mounts persistent nav + chrome, hands prop-bags to client nav islands. Per-page `<header>` chips are removed in favour of the shell.

### Server role gate (unchanged — never in the layout)
**Source:** `app/admin/transfers/page.tsx:85-87`
**Apply to:** every admin RSC page (not the layout).
```tsx
if ((await getCurrentRole()) !== "admin") redirect("/sign-in");
```
`getCurrentRole()` revalidates the JWT (never cookie-trusting `getSession`). Runs BEFORE any read. The nav highlight carries NO authz.

### Active-nav highlight (usePathname prefix/exact)
**Source:** `app/driver/_nav/tabs.ts` + `DriverBottomNav.tsx:21-22`
**Apply to:** `AdminSidebar` via `app/admin/_nav/tabs.ts`. Exact match for `/admin` (Dashboard), prefix match for the rest (keeps parent lit on child routes). `aria-current="page"` on the active item; colour is never the sole cue (redundant teal indicator).

### Prop-bag copy islands (no `lang` in client nav)
**Source:** `app/driver/_nav/DriverBottomNav.tsx` (modeled on `LanguageToggle`)
**Apply to:** `AdminSidebar`, `AdminTopBar`. Labels arrive already dictionary-resolved from the layout RSC; the island stays a pure presentational client component.

### 1.5px-stroke line pictograms (no Material Symbols)
**Source:** `app/driver/_ui/icons.tsx:16-29` (= `app/(guest)/_pass/icons.tsx`)
**Apply to:** `app/admin/_nav/icons.tsx`. Copy `baseProps` verbatim; declare 4 new glyphs only. NEVER Material Symbols / re-drawn logo / invented loop.

### Phase 9 primitives consumed verbatim (zero new `platform/ui/`)
**Source:** `platform/ui/{Card,LifecycleStepper,StatusDot,NotificationBell,LanguageToggle,Button,TextField,RouteMotif}.tsx`
**Apply to:** all admin surfaces. `Card` = KPI/content chrome (`Card.tsx:10-18`); `LifecycleStepper current={status}` replaces `LifecycleTimeline` on the detail (`LifecycleStepper.tsx:45`); `StatusDot` = status pills (worded label always present, WCAG 1.4.1). New chrome lives under `app/admin/`, NOT `platform/ui/`.

### Slate surface variant
**Source:** `app/admin/page.tsx:33-44` (existing slate header + white logo chip)
**Apply to:** the shell sidebar + top bar (`bg-slate`); content area `bg-white`. Logo on a white chip (`rounded-[6px] bg-white px-[8px] py-[4px]`). Teal reserved for active-nav, positive CTAs, links, focus rings; coral for destructive/unclaimed/needs-attention.

### EN/BG key-parity gate (tsc-enforced)
**Source:** `platform/i18n/en.ts` (`Dict = typeof en`) + `bg.ts`
**Apply to:** every new key (`adminDashboardTitle`, `kpiUnclaimed`/`kpiClaimed`/`kpiEnRoute`/`kpiTotalToday`, `navDashboard`/`navSettings`, `adminSettingsTitle`, `colTimeId`/`colPassenger`/`colRoute`/`colLifecycle`/`colStatus`/`colDriver`/`colActions`, `rowActionView`, `driverUnassigned`, `adminSortLabel`/`sortAttention`/`sortArrival`/`sortStatus`, `signedInAs`) — added to BOTH `en.ts` and `bg.ts` or `tsc` fails the build. Reuse existing admin/ops keys verbatim (per UI-SPEC Copywriting Contract).

### Existing tests stay green (Phase 11 D-06)
**Source:** `app/admin/transfers/TransfersView.test.tsx`, `actions.test.ts`, `destinations/you-keep.test.tsx`, `health/EmailCapGauge.test.tsx`
**Apply to:** the whole restyle. Behaviour must not change — these behavioural tests are the regression gate. New visual pieces (sidebar, top bar, KPI cards, table) are eyeballed against the mockups + UI-SPEC; no new component tests required.

---

## No Analog Found

None. Every file has a strong in-repo analog. The single closest-to-novel piece is the **mobile drawer toggle** in `AdminSidebar` (D-04) — there is no existing hamburger-overlay drawer in the codebase, but its base (a `usePathname` nav island) is the driver nav, and the toggle is a trivial `useState` add (breakpoint constant + toggle mechanism are explicit implementer discretion per CONTEXT D-04).

---

## Metadata

**Analog search scope:** `app/admin/`, `app/driver/`, `app/(guest)/`, `platform/ui/`, `platform/i18n/`
**Files scanned:** ~18 read in full/part
**Pattern extraction date:** 2026-06-22
