---
phase: 12-admin-console-rebuild
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - app/admin/DashboardView.tsx
  - app/admin/_nav/AdminSidebar.tsx
  - app/admin/_nav/AdminTopBar.tsx
  - app/admin/_nav/icons.tsx
  - app/admin/_nav/tabs.ts
  - app/admin/companies/CompaniesView.tsx
  - app/admin/companies/page.tsx
  - app/admin/destinations/DestinationsView.tsx
  - app/admin/destinations/page.tsx
  - app/admin/drivers/DriversView.tsx
  - app/admin/drivers/page.tsx
  - app/admin/health/page.tsx
  - app/admin/layout.tsx
  - app/admin/page.tsx
  - app/admin/properties/PropertiesView.tsx
  - app/admin/properties/page.tsx
  - app/admin/settings/page.tsx
  - app/admin/transfers/TransfersView.tsx
  - app/admin/transfers/[id]/RefundForm.tsx
  - app/admin/transfers/[id]/TransferDetailView.tsx
  - app/admin/transfers/page.tsx
  - platform/i18n/bg.ts
  - platform/i18n/en.ts
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This is the v1.1 presentation-only admin-console rebuild: a shared slate shell (sidebar + top bar + single notification bell), a KPI dashboard, a transfers list/detail, and the onboarding consoles (companies/properties/destinations/drivers) plus settings + health.

**Invariant check — all clean (no Critical).** Every RSC page re-gates `getCurrentRole() === "admin"` BEFORE any read, and the gate stays on the page (never in the layout). All reads go through the anon cookie-bound `createClient` (RLS-enforced); no service-role client appears in any reviewed component. No `paid` write is introduced anywhere — the dashboard/transfers views are read-only, and the ops actions delegate to the existing `../actions` server actions (out of scope here). Admin-side guest PII (`guest_email`/`guest_phone`) is only read on the role-gated detail page, never in a pre-claim/driver-visible surface. The four payment/auth/RLS invariants are preserved.

The defects found are correctness, robustness, and quality issues in the presentation layer. The most material is a mislabeled "Driver" column that displays the transfer *status* instead of any driver identity (WR-01), and an invisible mobile navigation toggle (WR-02) that leaves the console without working mobile nav.

## Warnings

### WR-01: "Driver" column renders the transfer status, not the driver

**File:** `app/admin/transfers/TransfersView.tsx:207-208` (rendered at `:341` desktop, `:385` mobile)
**Issue:** The driver cell is computed as:
```js
const driverCell = (r: TransferRow) =>
  r.driver_id === null ? copy.driverUnassigned : stateLabel(r.status);
```
When a driver IS assigned, the cell renders `stateLabel(r.status)` — the lifecycle status label (e.g. "Claimed", "En route") — under a column header that says "Driver". The row payload (`TransferRow`) only carries `driver_id` (a UUID), never a driver name, so the column can never show the intended information and instead duplicates the adjacent Status column with a misleading header. This is a logic/data error, not a style choice: an operator reading the Driver column sees a status word for assigned rows and "Unassigned" for unassigned rows.
**Fix:** Either surface a real driver identifier (carry a `driver_label`/`driver_name` through the RSC read shape in `app/admin/transfers/page.tsx` and render it here), or — if the roster join is out of v1 scope — show a truthful placeholder for assigned rows (e.g. a shortened `driver_id` or a worded "Assigned" token) rather than the status:
```js
const driverCell = (r: TransferRow) =>
  r.driver_id === null ? copy.driverUnassigned : (r.driver_name ?? shortId(r.driver_id));
```

### WR-02: Mobile sidebar hamburger is white-on-white (invisible) and never slotted into the top bar

**File:** `app/admin/_nav/AdminSidebar.tsx:101-120`, `app/admin/layout.tsx:51,67-98`
**Issue:** On `<lg`, the persistent `<aside>` is hidden (`hidden ... lg:flex`) and `AdminSidebar` renders its hamburger `<button>` (`text-white hover:bg-white/10`, lines 101-120) directly as the first child of the layout's outer container, which is `className="flex min-h-dvh bg-white"` (layout line 51). A white stroke icon on a white background is invisible — the only mobile entry point to navigation cannot be seen. Compounding this, `AdminTopBar` defines a `menuSlot` prop + `menuSlotLabel` copy expressly so the toggle "sits in the top bar below the desktop breakpoint" (AdminTopBar `:43-45,:55-59`; layout comment `:52-53`), but `layout.tsx` never passes `menuSlot` to `AdminTopBar`. The documented design (hamburger inside the slate top bar) is unwired, leaving the toggle stranded on a white surface.
**Fix:** Either render the hamburger inside the slate top bar (move it into the `menuSlot`), or give the standalone button a visible color against the white layout background. The cleanest fix matches the stated design — slot it:
```tsx
// AdminSidebar should expose the toggle so the layout can place it in the top bar,
// or change the standalone button to a slate-on-white treatment:
className="... text-slate hover:bg-slate/10 lg:hidden"
```

### WR-03: `single()` on the detail read throws on a missing/duplicate row instead of rendering the empty state

**File:** `app/admin/transfers/[id]/page.tsx:32-36`
**Issue:** The detail read uses `.single()`. `.single()` returns a PostgREST error (and `data === null`) when zero rows match or more than one matches; the surrounding code reads `data` without checking `error`, so a bad/expired/unknown `id` (or an RLS-filtered row) produces `data = null`. `TransferDetailView` does handle `row === null` (renders the empty state), so this does not crash — but `.single()` emits a console error and, depending on the client wrapper, can reject. The intent ("not found → empty state") is better served by `.maybeSingle()`, which returns `data: null` with no error for the zero-row case.
**Fix:** Use `.maybeSingle()` so a not-found id resolves cleanly to the empty-state branch:
```js
const { data } = await supabase.from("wp_transfers")
  .select("*, destinations(zone,airport,address)")
  .eq("id", id)
  .maybeSingle();
```

### WR-04: Silent error swallowing — failed reads render as "empty", masking RLS/query failures

**File:** `app/admin/page.tsx:46-53`, `app/admin/transfers/page.tsx:118-119`, `app/admin/companies/page.tsx:25-34`, `app/admin/properties/page.tsx:29-58`, `app/admin/destinations/page.tsx:30-75`, `app/admin/drivers/page.tsx:30-47`
**Issue:** Every onboarding/list RSC destructures only `{ data }` and falls back to `data ?? []`, discarding the PostgREST `{ error }`. A genuine failure (RLS denial, dropped DB connection, schema drift) is indistinguishable from a legitimately empty table: the page silently shows the empty state. The health page (`app/admin/health/page.tsx:73-113`) demonstrates the correct pattern — it checks `error`, throws, and renders a distinct `healthLoadFailed` state. The list pages do not, so an operator cannot tell "no companies yet" from "the read failed." For an admin console this materially degrades operability (e.g. a deactivated company that vanishes from the list looks like data loss).
**Fix:** Capture and branch on `error`, rendering a distinct load-failure state (a `*LoadFailed`-style key already exists for health):
```js
const { data, error } = await supabase.from("companies").select("id,name,active").order("name");
// pass `loadFailed={Boolean(error)}` to the view, or render a failure message
```

### WR-05: Dashboard "Recent transfers" / "Total today" tie KPIs to `arrival_at` ordering, producing misleading figures

**File:** `app/admin/page.tsx:51,63-84`
**Issue:** The dashboard orders by `arrival_at ASC` then slices the first 5 rows as "Recent transfers" (`:51,:73`). With ascending order the first 5 rows are the *earliest* arrivals in the entire table — typically the oldest/past transfers, not the most recent — so the "Recent transfers" panel shows the least-recent rows. Separately, "Total today" (`:63-70`) counts rows whose `arrival_at` is on the current local day; the comment concedes there is no `created_at`/`paid_at` in the select, so "today's transfers" is really "transfers arriving today." Both are labeled as recency/throughput signals but are computed from arrival time, which can diverge sharply (a transfer booked today for an arrival next week is invisible to "today"; a long-completed transfer arriving today is counted). This risks an operator trusting wrong numbers on the primary KPI surface.
**Fix:** For "Recent," either order by a creation timestamp (`created_at` desc, widening the select if the column exists) or relabel the panel to "Next arrivals" to match the data. For "Total today," relabel to "Arriving today" so the figure is truthful, or count against a creation timestamp if same-day bookings are the intended metric.

### WR-06: Cross-component search relies on an untyped global `window` CustomEvent with no replay/initial-sync

**File:** `app/admin/_nav/AdminTopBar.tsx:62-83`, `app/admin/transfers/TransfersView.tsx:84-85,125-173`
**Issue:** The top-bar search broadcasts `window.dispatchEvent(new CustomEvent("admin:search", { detail }))` and `TransfersView` listens for it. This is a fragile seam: (a) it is a stringly-typed global event with no shared contract — a typo in either `"admin:search"` literal silently breaks search with no compile error; (b) there is no initial sync — if `TransfersView` mounts after the top bar already holds a query (e.g. client navigation back to the list), the list does not pick up the in-flight term until the next keystroke; (c) the event escapes component scope entirely, so any other island could dispatch/intercept it. For a presentation-only filter over loaded rows this is tolerable, but it is the kind of loose coupling that rots. The `onSearchChange` callback prop exists but is never used by the layout, so the event is the only live path.
**Fix:** Centralize the event name in one shared constant imported by both files (eliminating the duplicated string literal), and have `TransfersView` seed its initial term from a shared source (e.g. a context or a `lastSearch` ref the top bar also writes) so a late mount is consistent. At minimum, export the `"admin:search"` literal from one module and import it in both.

## Info

### IN-01: `fmtEur` currency formatting is inconsistent across views

**File:** `app/admin/transfers/TransfersView.tsx:383` / `app/admin/DashboardView.tsx:169` (`${fmtEur(...)} €`) vs `app/admin/destinations/DestinationsView.tsx:108` (`€${fmtEur(...)}`)
**Issue:** `fmtEur` returns a bare number string (`(cents/100).toFixed(2)`, `platform/money/commission.ts:32`). Callers manually append the symbol, but inconsistently: transfers/dashboard render a trailing `" €"` (e.g. `12.50 €`) while destinations render a leading `€` with no space (e.g. `€12.50`). Same data, two formats in one console.
**Fix:** Pick one placement convention (or add a `fmtEurWithSymbol` helper) and apply it across all admin money renders.

### IN-02: `now` computed in render of an async RSC with an eslint-disable to silence the purity lint

**File:** `app/admin/transfers/page.tsx:121-124`
**Issue:** `const now = Date.now();` is computed in the RSC body with `// eslint-disable-next-line react-hooks/purity`. The reasoning (an async RSC renders once per request) is sound, but the same `needsAttention` window logic is duplicated as inert dead branches: `computeNeedsAttention` branch (a) at `:62-68` is explicitly documented as "already covered by the always-true branch" — it can never be reached because the `unclaimed` early-return at `:56` already returned. Dead, self-acknowledged code.
**Fix:** Remove the unreachable branch (a) (`:62-68`); keep the comment as a one-liner if the future intent matters. The `Date.now()` disable is acceptable.

### IN-03: `editCta` is sourced from `saveChangesCta` across all onboarding consoles

**File:** `app/admin/companies/page.tsx:47`, `app/admin/properties/page.tsx:78`, `app/admin/destinations/page.tsx:101`
**Issue:** Every console maps `editCta: t.saveChangesCta`, so the "Edit" affordance is labeled with the "Save changes" string. This is likely a copy/paste oversight — the button that *opens* the inline editor reads "Save changes," which is semantically wrong (nothing is saved by clicking it; it reveals the form). There is no dedicated `editCta` key in the dictionaries.
**Fix:** Add an `editCta` key (e.g. EN "Edit" / BG "Редактиране") to both dictionaries and reference it, rather than reusing `saveChangesCta`.

### IN-04: Hardcoded non-dictionary fact labels on the transfer detail view

**File:** `app/admin/transfers/[id]/TransferDetailView.tsx:299-324`
**Issue:** Several `Fact` labels are English string literals ("Phone", "Arrival", "Flight", "Passengers", "Luggage", "Notes", "Fare", "Stripe fee", "Paid at", "Payment intent") while the surrounding labels (email/zone/airport/address) are dictionary-resolved. In BG locale these facts render in English, breaking the bilingual contract the rest of the console upholds.
**Fix:** Move these labels into `platform/i18n/en.ts` + `bg.ts` and pass them through the copy prop bag like the others.

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
