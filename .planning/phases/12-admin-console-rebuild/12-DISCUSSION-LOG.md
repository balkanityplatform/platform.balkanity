# Phase 12: Admin Console Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 12-admin-console-rebuild
**Areas discussed:** Search overlap, Sort overlap, Settings nav, Responsive + dashboard

---

## Search overlap

| Option | Description | Selected |
|--------|-------------|----------|
| Top-bar only, client-side | Remove the in-page server `q` box; new top-bar search filters loaded rows instantly. One box, satisfies AUI-05. | ✓ |
| Keep both | Leave server `q` search AND add top-bar client search. Two boxes risks confusion. | |
| Top-bar drives server `q` | Single top-bar box but writes URL `q` and re-queries server-side. Misses the "client-side" AUI-05 wording, adds latency. | |

**User's choice:** Top-bar only, client-side
**Notes:** The loaded set already contains what an admin searches day-to-day; the existing server `q` machinery is retired, not kept as a dead path.

---

## Sort overlap

| Option | Description | Selected |
|--------|-------------|----------|
| Attention-pin is the default | Keep coral-pin-then-soonest as default; control switches to plain sorts which drop the pin. | |
| Pin always wins | Coral rows always pinned; control reorders only within non-attention rows. | |
| Control fully overrides | Sort control is sole authority, no implicit pin; default value "Needs attention" reproduces today's behaviour. | ✓ |

**User's choice:** Asked for a recommendation → recommended and locked "Control fully overrides."
**Notes:** Cleanest mental model — one concept (the control), default "Needs attention" = today's coral-pin+soonest, switching gives clean global order with no rows jumping the queue. Pairs with the D-01 client-side search over loaded rows.

---

## Settings nav

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated hub page | New `app/admin/settings/page.tsx` listing the four existing routes. Keeps sidebar to 4 clean items. | ✓ |
| Sidebar sub-expansion | "Settings" expands inline to sub-items. Adds collapsible-nav complexity, taller sidebar. | |
| Direct to first route | "Settings" links to `/admin/companies`. Label-to-destination mismatch. | |

**User's choice:** Dedicated hub page
**Notes:** Presentational hub only — no new CRUD/schema. Active-highlight prefix-match stays simple (`/admin/settings*`).

---

## Responsive + dashboard

### Responsive behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible drawer | Persistent sidebar on desktop; hamburger overlay drawer below ~1024px; table scrolls/stacks. | |
| Desktop-only, simple | Optimize for desktop; narrow screens get sidebar-above-content + table horizontal scroll. | |
| Full responsive rework | Fully responsive at every breakpoint incl. mobile table-to-cards transform. | ✓ |

**User's choice:** Full responsive rework
**Notes:** User's explicit call. Mobile table→cards reuses the existing stacked-`<ul>` layout (reuse, not a new invention). Phase 11 had a responsive nav-placement miss worth not repeating.

### Dashboard composition

| Option | Description | Selected |
|--------|-------------|----------|
| KPI cards + Recent transfers | Four KPI cards + compact top-~5 "Recent transfers" list with "View all". Reuses loaded rows, no new query. | ✓ |
| KPI cards only | Just the four KPI cards; sparse landing. | |
| KPI cards + needs-attention | KPI cards + only the needs-attention subset; duplicates the Transfers filter, often empty. | |

**User's choice:** KPI cards + Recent transfers
**Notes:** Makes the landing a useful at-a-glance view; reuses the same loaded rows + row styling.

---

## Claude's Discretion

- KPI "Total today" date field (`arrival_at` vs paid/created) — implementer picks the one already on the loaded row.
- Signed-in admin identity source — existing verified session; email alone acceptable if no name present.
- Admin-only component file structure / prop shapes; exact drawer-toggle mechanism + breakpoint constant.

## Deferred Ideas

None — discussion stayed within admin-surface scope. All backend-less mockup features are omitted per the v1.1 truthfulness rule, not deferred.
