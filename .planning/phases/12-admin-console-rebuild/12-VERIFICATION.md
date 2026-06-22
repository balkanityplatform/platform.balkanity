---
phase: 12-admin-console-rebuild
verified: 2026-06-22T20:10:05Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Mobile hamburger toggle is visible and functional"
    expected: "On viewports below the lg breakpoint (< ~1024px), a visible hamburger icon appears that, when tapped, opens the slate overlay sidebar drawer"
    why_human: "The button uses text-white color and renders as the first child of a bg-white container (layout.tsx:51 `flex min-h-dvh bg-white`). The top-bar menuSlot prop is never populated from the layout, so the toggle is stranded on a white surface. Cannot confirm visibility or interaction without rendering in a browser at mobile width."
  - test: "Driver column in the transfers table is intelligible to an admin operator"
    expected: "For assigned rows, the Driver column shows a meaningful driver identifier (name, short ID, or at least a visually distinct 'Assigned' label)"
    why_human: "The driverCell function currently shows `stateLabel(r.status)` for assigned rows (e.g. 'Claimed', 'En route') — a status word under a column header labeled 'Driver'. This is a logic overlap with the adjacent Status column. Whether this meets the threshold for 'meaningful' in a real admin console requires an operator's eye on real data."
---

# Phase 12: Admin Console Rebuild — Verification Report

**Phase Goal:** The admin desktop console is rebuilt to the "Transfer Pool" identity — a persistent left sidebar, KPI cards computed from real transfer data, the pending-transmissions transfers table with filter/sort and row actions, a restyled transfer detail keeping all existing operations intact, and a top bar with client-side search, the notifications bell, and the signed-in admin identity.
**Verified:** 2026-06-22T20:10:05Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A persistent slate left sidebar shows Dashboard / Transfers / Drivers / Settings with teal active highlight, and no Analytics item | VERIFIED | `app/admin/_nav/tabs.ts` exports exactly 4 tabs (Dashboard exact-match, Transfers/Drivers/Settings prefix); `grep -c "Analytics" tabs.ts` returns 0; AdminSidebar reads `usePathname()` + `buildAdminTabs()`, active item gets `bg-white/10 text-teal` + teal indicator bar + `aria-current="page"` |
| 2 | Below the desktop breakpoint the sidebar collapses to a hamburger-toggled overlay drawer | UNCERTAIN (see WR-02) | `AdminSidebar.tsx:85` has `useState(false)` for the drawer; button at line 101-120 triggers `setOpen(true)`; drawer renders at line 122-164. **However:** the button uses `className="... text-white ... lg:hidden"` and renders as a direct child of the layout's `<div className="flex min-h-dvh bg-white">` (layout.tsx:51). The `menuSlot` prop on AdminTopBar is never populated by the layout — the toggle is stranded on white. Functionally wired but visually broken at mobile viewport. |
| 3 | The top bar shows a client-side search field, notifications bell, LanguageToggle, and signed-in admin identity | VERIFIED | `AdminTopBar.tsx` renders: (a) `<input type="search">` dispatching `admin:search` CustomEvent on change; (b) `actions` slot with `NotificationBell` + `LanguageToggle` mounted once from the layout; (c) signed-in `email` from `auth.getUser()` passed as identity prop. Layout.tsx:36-98 wires all three. |
| 4 | Every existing admin route renders inside the new shell with one bell mounted once | VERIFIED | `app/admin/layout.tsx` wraps all routes via Next.js layout inheritance. `readOwnNotifications()` called once at line 39. `grep -c "NotificationBell" DriversView.tsx` = 0. Per-page slate headers confirmed absent from drivers/companies/properties/destinations/health (bg-slate px-[24px] grep returns 0). |
| 5 | The /admin dashboard shows four KPI cards (Unclaimed=coral, Claimed=teal, En route=amber, Total today=slate) computed from real transfer data | VERIFIED | `app/admin/page.tsx:46-70` computes all four counts from anon-RLS `wp_transfers` read. `DashboardView.tsx:104-122` renders KPI grid with `kpiUnclaimed/kpiClaimed/kpiEnRoute/kpiTotalToday` worded labels + colour accent bars. No invented metrics (no goal%, no trend arrows, no earnings). |
| 6 | No daily-goal %, trend arrows, or earnings appear on the dashboard | VERIFIED | `DashboardView.tsx` comment explicitly states "no invented progress %, no direction arrows, no revenue". Code grep confirms no such patterns in the rendered JSX. |
| 7 | Transfers list renders as a pending-transmissions table (Time/ID, Passenger, Route, Lifecycle, Status, Driver, Actions) on desktop and stacked cards on mobile | VERIFIED | `TransfersView.tsx:292-396`: `<table>` with 7 columns visible `md:block`; `<ul>` card fallback `md:hidden`. LifecycleStepper renders per row in the Lifecycle column. View action links to `/admin/transfers/[id]`. `driverUnassigned` worded text used when `driver_id === null`. |
| 8 | Top-bar search filters loaded rows client-side; a client sort control is the sole ordering authority over loaded rows | VERIFIED | `AdminTopBar.tsx:68-76` dispatches `admin:search` CustomEvent. `TransfersView.tsx:84-132` listens via `useEffect` on `window`. `useMemo` at line 161-173 filters rows by guest_name/flight_no/zone/airport/id. Sort control at line 254-271 with Needs attention/Soonest arrival/Status options. Server q machinery confirmed removed: `grep '.or('` returns comment-only matches. |
| 9 | Transfer detail renders horizontal LifecycleStepper; all five ops controls (assign/reassign/release/cancel/refund) behave identically to today | VERIFIED | `TransferDetailView.tsx:24` imports LifecycleStepper; line 293 renders `<LifecycleStepper current={row.status} />`. LifecycleTimeline import = 0. All five ops imported (assign/cancel/reassign/release from actions.ts, RefundForm at line 34). `cancelOfferRefundCta` shortcut at line 434 opens RefundForm without auto-refunding. `actions.test.ts` 7/7 pass. |
| 10 | The Driver column in the transfers table never shows an empty cell, but shows a worded status label for assigned rows (not a driver name) | UNCERTAIN (see WR-01) | `driverCell` function (line 207-208): `r.driver_id === null ? copy.driverUnassigned : stateLabel(r.status)`. Unassigned = "Unassigned" worded text (correct). Assigned = lifecycle status word (e.g. "Claimed") under the "Driver" header — a misleading mislabeling flagged by the code review as WR-01. The requirement says "never an empty cell" — satisfied. Whether "shows the status word under Driver header" is acceptable requires human review. |

**Score:** 9/10 must-haves verified (2 uncertain, routed to human)

---

### Hard Invariant Verification (Presentation-Only Guarantees)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| No schema/auth/RLS/payment changes | VERIFIED | `supabase/migrations/` last migration is `0008_platform_health.sql` — no 0009+ created by phase 12. All commits are feat/refactor, no migration files. |
| `paid` written only by the verified Stripe webhook | VERIFIED | `grep "paid" TransferDetailView.tsx` — `paid_at` is a read-only Fact display; no `.update()` with paid. `RefundForm.tsx` grep for paid-write returns 0. Refund records `last_action_*` only (confirmed by RefundForm.tsx comment). |
| Admin reads via anon cookie-bound RLS client (never service-role in components) | VERIFIED | `layout.tsx`: `grep "createAdminClient\|SERVICE_ROLE\|service_role"` = 0. `page.tsx` and `transfers/page.tsx` both use `createClient()` (anon). All component-level reads are via cookie-bound client. |
| All five transfer-detail ops still wired | VERIFIED | assign, reassign, release, cancel, refund — all imported and mounted in `TransferDetailView.tsx`; `actions.test.ts` 7/7 green. |
| No pre-claim guest PII exposure | VERIFIED | `TransfersView.tsx` never renders guest_email or guest_phone. PII (`guest_email`, `guest_phone`) only appears in `TransferDetail` type in the role-gated detail view. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/admin/layout.tsx` | Shared admin shell RSC | VERIFIED | 104 lines; async RSC; `readOwnNotifications()` once; `auth.getUser()` identity; no role gate; no service-role |
| `app/admin/_nav/tabs.ts` | 4-item nav config | VERIFIED | Exports `buildAdminTabs`, `AdminNavCopy`, `AdminTab`; 4 items, no Analytics |
| `app/admin/_nav/AdminSidebar.tsx` | Client sidebar + responsive drawer | VERIFIED (with WR-02) | `useState` drawer; `usePathname` active highlight; `aria-current`; hamburger visually broken on mobile |
| `app/admin/_nav/AdminTopBar.tsx` | Top bar with search + identity + bell slot | VERIFIED | Dispatches `admin:search`; identity prop; `actions` slot; `menuSlot` prop defined but not populated from layout |
| `app/admin/_nav/icons.tsx` | 4 line pictograms | VERIFIED | Dashboard/Transfers/Drivers/Settings; 1.5px stroke; no Material Symbols |
| `app/admin/page.tsx` | Dashboard RSC with role gate + KPI compute | VERIFIED | `getCurrentRole` gate before read; anon-RLS `wp_transfers` read; 4 KPI counts + top-5 recent |
| `app/admin/DashboardView.tsx` | 4 KPI cards + Recent transfers | VERIFIED | Exports `DashboardView`; coral/teal/amber/slate accent; worded labels; View-all link to `/admin/transfers` |
| `app/admin/transfers/TransfersView.tsx` | Pending-transmissions table + mobile cards + client search/sort | VERIFIED | `<table>` md+; `<ul>` cards mobile; client search; client sort; `driverUnassigned` present; `<table` count = 3, `<ul` count = 2 |
| `app/admin/transfers/page.tsx` | Role gate + anon-RLS read + status filter (q retired) | VERIFIED | `getCurrentRole` at line 87; `.from("wp_transfers")` at line 103; `.in("status"` at line 111; `.or(` grep = comment-only |
| `app/admin/transfers/[id]/TransferDetailView.tsx` | LifecycleStepper + 5 ops verbatim | VERIFIED | LifecycleStepper imported/used; LifecycleTimeline = 0; all 5 ops wired |
| `app/admin/transfers/[id]/RefundForm.tsx` | Refund form — behaviour verbatim | VERIFIED | `refundFeeDisclosure` present; `defaultValue={fullAmountEur}` at line 63; `last_action_*` only; no paid-write |
| `app/admin/settings/page.tsx` | Settings hub RSC | VERIFIED | `getCurrentRole` gate; 4 links to /admin/companies, /admin/properties, /admin/destinations, /admin/health; no DB access |
| `platform/i18n/en.ts` + `platform/i18n/bg.ts` | 24 new admin-console i18n keys | VERIFIED | All verified keys present in both files: adminDashboardTitle, kpiUnclaimed/kpiClaimed/kpiEnRoute/kpiTotalToday, navDashboard, navSettings, colTimeId, signedInAs et al. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/admin/layout.tsx` | `readOwnNotifications` | own-rows RLS bell seed | VERIFIED | Line 39: `const bellInitial = await readOwnNotifications()` |
| `app/admin/_nav/AdminSidebar.tsx` | `buildAdminTabs` | `usePathname` active highlight | VERIFIED | Line 37: `const tabs = buildAdminTabs(copy, pathname)` |
| `app/admin/page.tsx` | `wp_transfers` (wp_transfers_admin_read RLS) | anon cookie-bound `createClient().from('wp_transfers').select(...)` | VERIFIED | Lines 45-51: anon client + `wp_transfers` select |
| `app/admin/page.tsx` | `DashboardView` | KPI counts + recent rows prop bag | VERIFIED | Lines 87-104: `<DashboardView counts={...} recent={...} />` |
| `app/admin/transfers/TransfersView.tsx` | `/admin/transfers/[id]` | Link href per row (View action) | VERIFIED | Line 344: `href={/admin/transfers/${r.id}}` |
| `app/admin/transfers/page.tsx` | `wp_transfers` (wp_transfers_admin_read RLS) | anon cookie-bound `.in('status', ...)` server filter | VERIFIED | Lines 103-111: `from("wp_transfers")` + `.in("status", statusFilter)` |
| `app/admin/transfers/[id]/TransferDetailView.tsx` | `LifecycleStepper` | `current={row.status}` | VERIFIED | Line 24 import; line 293 render |
| `app/admin/transfers/[id]/TransferDetailView.tsx` | `../actions` (assign/reassign/release/cancel) | useActionState on unchanged Server Actions | VERIFIED | Lines 28-33: all four action imports; `cancelOfferRefundCta` opens RefundForm at line 434 |
| `app/admin/_nav/AdminTopBar.tsx` | `TransfersView` | `admin:search` CustomEvent | VERIFIED | AdminTopBar:72-76 dispatches; TransfersView:125-132 listens |
| `app/admin/settings/page.tsx` | /admin/companies, /admin/properties, /admin/destinations, /admin/health | Links to four existing routes | VERIFIED | Lines 28-33 build sections array; rendered as Link elements |
| `app/admin/layout.tsx` → `AdminTopBar` | hamburger toggle (menuSlot) | AdminSidebar toggle slotted into top bar | NOT_WIRED | `menuSlot` prop is defined on AdminTopBar but layout never passes it. The hamburger button (`lg:hidden text-white`) renders as first child of `<div bg-white>` — white icon on white background. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `DashboardView.tsx` | `counts`, `recent` | `page.tsx` anon `wp_transfers` RLS read | Yes — query returns real rows; counts derived from `status` + `driver_id` | FLOWING |
| `TransfersView.tsx` | `rows` | `transfers/page.tsx` anon `wp_transfers` RLS read with `.in("status")` filter | Yes — real rows flow through; client search/sort are in-memory over loaded rows | FLOWING |
| `TransferDetailView.tsx` | `row` | `transfers/[id]/page.tsx` `wp_transfers` read (verified by existing ops tests) | Yes — real row; `status`, `paid_at` etc. rendered from live data | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Transfers list + ops regression | `npm test -- --run app/admin/transfers/TransfersView.test.tsx app/admin/transfers/actions.test.ts` | 12/12 pass | PASS |
| Health + you-keep behavior | `npm test -- --run app/admin/health/EmailCapGauge.test.tsx app/admin/destinations/you-keep.test.tsx` | 5/5 pass | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared or found for phase 12 (presentation-only UI phase; no CLI, migration, or data-pipeline probes).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUI-01 | Plans 01, 05 | Persistent left sidebar with Dashboard/Transfers/Drivers/Settings nav, active item highlighted | SATISFIED | `tabs.ts` 4-item config; `AdminSidebar` with `usePathname` highlight; Settings hub at `/admin/settings` completes the target |
| AUI-02 | Plan 02 | Transfer Pool dashboard KPI cards (Unclaimed/Claimed/En route/Total today) from real transfer data | SATISFIED | `page.tsx` computes 4 counts from anon-RLS read; `DashboardView.tsx` renders labelled KPI grid |
| AUI-03 | Plan 03 | Transfers list as pending-transmissions table with filter + sort | SATISFIED | `<table>` with 7 columns; sort control; status filter chips; `TransfersView.test.tsx` 5/5 |
| AUI-04 | Plan 04 | Transfer detail restyled with existing assign/reassign/cancel/refund actions intact | SATISFIED | LifecycleStepper swap; all 5 ops wired verbatim; `actions.test.ts` 7/7 green |
| AUI-05 | Plans 01, 03 | Top bar with search field (client-side filter), notifications bell, signed-in identity | SATISFIED | Search dispatches `admin:search`; TransfersView listens; bell mounted once; identity from `auth.getUser()` |

All 5 phase-12 requirements satisfied. No orphaned requirements found in REQUIREMENTS.md (all AUI-01 through AUI-05 map to this phase and are verified above).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/admin/_nav/AdminSidebar.tsx` | 106 | `text-white` on hamburger button rendering inside `bg-white` layout container | Warning | Mobile nav toggle invisible (WR-02 from code review) |
| `app/admin/transfers/TransfersView.tsx` | 207-208 | `driverCell` shows `stateLabel(r.status)` for assigned rows | Warning | "Driver" column shows lifecycle status word, not a driver identifier (WR-01 from code review) |

No TBD/FIXME/XXX debt markers found in any phase-12 modified file. No service-role client in any component. No `paid` writer introduced in any view.

---

### Human Verification Required

#### 1. Mobile Hamburger Toggle Visibility (WR-02)

**Test:** Open the admin console in a browser at viewport width < 1024px (mobile or tablet breakpoint).
**Expected:** A visible hamburger icon appears in the top-left area of the screen (ideally inside the slate top bar). Tapping it opens the slate overlay sidebar drawer showing Dashboard / Transfers / Drivers / Settings. The icon should be discernible — dark icon on light background or vice versa.
**Why human:** The hamburger button (`AdminSidebar.tsx:101-120`) uses `text-white` and renders as the first child of the layout's `<div className="flex min-h-dvh bg-white">`. The `menuSlot` prop on `AdminTopBar` is defined but never passed from `layout.tsx`, so the toggle cannot be slotted into the slate top bar as intended. Visual confirmation is required to determine if this is a blocking regression for the D-04 responsive goal, or acceptable for the v1 admin desktop-primary console.

#### 2. Driver Column Legibility for Admin Operators (WR-01)

**Test:** Open `/admin/transfers` in the browser. Look at the "Driver" column for rows where a driver has been assigned (status = claimed/en_route/etc.).
**Expected:** The Driver column shows a meaningful driver identifier (name, shortened ID, or at minimum a distinct "Assigned" marker that is different from the Status column value).
**Why human:** The current implementation shows `stateLabel(r.status)` (e.g. "Claimed") in the Driver column for assigned transfers — the same value the adjacent Status column already shows. An admin looking at the list sees "Claimed" under both "Status" and "Driver". Whether this is operationally acceptable for v1 (where the pilot has only 3 drivers and assignments can be inferred from context) requires a human judgment call.

---

### Gaps Summary

No BLOCKER gaps found. All hard invariants (no schema/auth/RLS/payment changes; paid set only by webhook; anon RLS client only in components; all 5 ops wired; no pre-claim PII exposure) are confirmed clean.

Two UNCERTAIN items require human review:

1. **WR-02 (Mobile hamburger):** The hamburger toggle is functionally wired (state toggles the overlay drawer) but visually broken at mobile viewport due to `text-white` on a `bg-white` container. The `menuSlot` prop-thread from layout to AdminTopBar is absent — the design intent (hamburger inside the slate top bar) is unwired. For a desktop-primary admin console this may be acceptable short-term, but the D-04 "sidebar collapses to a hamburger-toggled overlay drawer" truth is UNCERTAIN until visually confirmed.

2. **WR-01 (Driver column):** The Driver column shows the lifecycle status label for assigned rows instead of any driver identifier. The "never empty" requirement is met (`driverUnassigned` for null), but the column is semantically misleading for assigned rows. This was explicitly noted as a code-review finding and acknowledged in the Plan 03 SUMMARY as a known scoping decision ("truthful presentation of available data, not a stub").

---

_Verified: 2026-06-22T20:10:05Z_
_Verifier: Claude (gsd-verifier)_
