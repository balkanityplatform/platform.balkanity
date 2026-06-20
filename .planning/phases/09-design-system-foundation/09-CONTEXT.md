# Phase 9: Design System Foundation - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The shared "Balkanity Path" design-system foundation: map the brand tokens into the Tailwind v4 CSS-first `@theme`, and ship the three reusable building blocks every surface consumes — the status badge (DS-02), the route/infinity motif (DS-03), and the lifecycle stepper (DS-04). Requirements DS-01–DS-04.

**Presentation-only.** Touches ONLY `app/globals.css` (`@theme` tokens) and shared presentational components under `platform/ui/` (plus the lifecycle-order const in `platform/transfers/lifecycle.ts` and a dev-only showcase route). NO backend, schema, auth, RLS, or payment-path changes. This is the hard prerequisite ordered before any Guest (10) / Driver (11) / Admin (12) surface work — no surface screens are built here.

The UI-SPEC (`09-UI-SPEC.md`) already locks *what* to build (palette, type scale, spacing, status colour map, copy). This discussion locked *how* the components expose their APIs to the three downstream surface phases.

</domain>

<decisions>
## Implementation Decisions

### DS-01 — Token convention
- **D-01:** Add **named semantic utilities** to the `@theme`, not just raw aliases. Surfaces author with semantic classes rather than arbitrary values (`text-[24px]`).
  - **Typography tokens** for the four roles: heading (24px), body (16px), label (14px), display (28px mobile / 32px desktop). Implemented with the loaded 400/600 weight pair (700 permitted only for the display/headline-xl role per UI-SPEC).
  - **Radii** `--radius-*`: 4 / 8 (DEFAULT) / 12 / 16 / 24px + full (9999px).
  - **Spacing** aliases: `--spacing-touch-target` 44, `--spacing-cta-height` 52, base 8, gutter/margin 16 (mobile) / 32 (tablet+desktop).
  - Confirm `#029B87` primary; **no `#00685a` anywhere**; **no JS `tailwind.config`** introduced (Tailwind v4 CSS-first only). Montserrat already wired.
- **D-02:** Existing components currently use arbitrary values (`text-[14px]`, `h-[52px]`); migrating them is NOT required this phase, but new Phase 9 components and all downstream surfaces should consume the named tokens.

### DS-02 — Status badge form factor
- **D-03:** Extend the existing `StatusDot` with a **`variant` prop**: `"dot"` (default — current inline dot+label, existing callers unchanged) and `"pill"` (solid filled badge, e.g. coral "Unclaimed" on a driver claim card). One component, one source of the colour/label map.
- **D-04:** Both variants keep the always-present worded label (WCAG 1.4.1) and the **cancelled = hollow coral ring (2px, transparent fill)** treatment — the one status-rendering change this phase introduces (cancelled stops being a solid coral dot).

### DS-04 — Lifecycle stepper
- **D-05:** Ship a **new, separate `LifecycleStepper`** (horizontal, step-styled) component. The existing vertical `LifecycleTimeline` is left **untouched** — no orientation-prop refactor. Both consume the same state/colour map.
- **D-06:** The stepper is driven by a **new exported `STEPPER_ORDER`** const in `platform/transfers/lifecycle.ts` — the 6 steps **Paid → Claimed → En route → Arrived → Picked up → Completed** (NOT the 7-step `LIFECYCLE_ORDER`, which starts at `requested`). Keeps the lifecycle file the single source of truth; the stepper must not hand-roll a local array.
- **D-07:** Step styling encodes state beyond colour (UI-SPEC): Completed step = teal circle + white check; Active = amber solid circle; Pending = grey `#66676F` outline ring.
- **D-08:** When state is **`cancelled`**, the stepper renders a **distinct terminal treatment** (hollow coral ring + "Cancelled" label) **instead of** the 6-step track — mirrors how `LifecycleTimeline` treats cancelled as off-the-happy-path. Do NOT wedge cancelled into the horizontal track.

### DS-03 — Route / infinity motif
- **D-09:** `RouteMotif` takes **configurable endpoint props** — `start` and `end`, each an `{ icon, label }` — defaulting to Plane → Building. Surfaces pass their own (e.g. "SOF Airport" → property name). Reusable across Guest (airport→property), Driver, and Admin route visualizations.
- **D-10:** The midpoint connective element is the **fixed real brand Transfer Badge** — a teal circle with the white two-arrow exchange icon from `platform/ui/pictograms/transfers.svg` (already committed), auto-centered between the two endpoints. NEVER re-draw the logo or invent an infinity loop. Where no brand asset exists for an endpoint (Plane), a simple 1.5px-stroke line pictogram is permitted.

### Verification
- **D-11:** Build a **throwaway dev-only showcase route** (e.g. `/dev/design-system` or equivalent under a dev/non-prod path) that renders every Phase 9 deliverable across all states/variants — `StatusDot` × 8 states × {dot, pill}, `LifecycleStepper` at each state + cancelled, a `RouteMotif` sample, token swatches, and the type scale — so the foundation can be eyeballed in-browser this phase before surfaces consume it. NOT linked from any user-facing nav; may be kept for reference or removed later.
- **D-12:** Unit tests cover the colour/state maps and the `STEPPER_ORDER`/lifecycle logic (extends the existing `StatusDot.test.tsx` pattern).

### Claude's Discretion
- Exact token names within the chosen convention (e.g. `text-heading` vs `text-display` naming), file/component naming, and the precise dev showcase route path are left to planning, consistent with the existing `platform/ui/` conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (read first — locks what to build)
- `.planning/phases/09-design-system-foundation/09-UI-SPEC.md` — the verified visual + interaction contract for this phase: full palette/token map, type scale, 8px spacing scale, radii, status colour mapping, copywriting contract, and the four-component inventory. The authoritative *what*; this CONTEXT.md captures the *how* (component APIs).
- `Branding /stitch_balkanity_welcome_pickup/balkanity_path/DESIGN.md` — "Balkanity Path" source design language (referenced by the UI-SPEC). **Caveat:** its `#00685a`-family primary is REJECTED — brand primary is `#029B87`.

### Roadmap / requirements
- `.planning/ROADMAP.md` §"Phase 9: Design System Foundation" — goal, DS-01–04 requirement IDs, success criteria, presentation-only non-goals, and the locked surface order (9 → 10 → 11 → 12).
- `.planning/STATE.md` — v1.1 milestone guardrails (presentation-only; ASSET guardrail: never re-draw the logo / invent icons).

### Existing code (single sources of truth — consume, don't re-implement)
- `app/globals.css` — current `@theme` block (correct `#029B87` palette + Montserrat already wired); this phase confirms + extends, never redefines the primary.
- `platform/ui/StatusDot.tsx` (+ `StatusDot.test.tsx`) — state union `TransferState`, the per-state colour/label map, and the dot+label contract to extend with the `pill` variant.
- `platform/ui/LifecycleTimeline.tsx` — the existing vertical timeline (left untouched); reference for emphasis/opacity cues and cancelled handling.
- `platform/transfers/lifecycle.ts` — `LIFECYCLE_ORDER` (7 happy-path states) + `ALLOWED_TRANSITIONS`; add the new 6-step `STEPPER_ORDER` here.
- `platform/ui/pictograms/transfers.svg` — the real brand Transfer Badge mark for the route-motif midpoint. `platform/ui/pictograms/README.md` — pictogram inventory/conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatusDot` (`platform/ui/StatusDot.tsx`): holds the authoritative `TransferState` union + colour/label map; extend in place with `variant="dot"|"pill"`. All existing callers stay on the default dot.
- `lifecycle.ts` (`platform/transfers/lifecycle.ts`): authoritative lifecycle order + transition map (mirrors the migration-0004/0006 DB trigger). Add `STEPPER_ORDER` here, not in the component.
- `LifecycleTimeline` (`platform/ui/LifecycleTimeline.tsx`): the starting-point pattern for the new horizontal `LifecycleStepper`; reuse its colour/state map consumption, build a distinct horizontal renderer.
- `transfers.svg` pictogram: ready-committed brand mark for the route-motif midpoint.
- `Button.tsx`, `Card.tsx`, `TextField.tsx`, etc. under `platform/ui/`: existing primitive conventions (arbitrary-value classes today) the new components + tokens should align with.

### Established Patterns
- Tailwind v4 CSS-first `@theme` with `--color-*` / `--font-*` generating brand utilities; no JS config (locked).
- "Single source of truth" discipline: state union + colour map in `StatusDot`, lifecycle order in `lifecycle.ts` — components consume, never hand-roll (T-04-02 "Don't-Hand-Roll" lock). The new tokens, `STEPPER_ORDER`, and `variant` prop must honor this.
- Status = coloured dot/badge PLUS worded label, never colour alone (WCAG 1.4.1).
- EN/BG i18n dictionary parity gate (`platform/i18n` en.ts/bg.ts) — any user-facing string (e.g. showcase labels) goes through it; tsc fails on a missing key.
- Component unit test pattern: `StatusDot.test.tsx`.

### Integration Points
- `app/globals.css` `@theme` — where the named typography/radii/spacing tokens land.
- New components under `platform/ui/` (`LifecycleStepper`, `RouteMotif`, extended `StatusDot`).
- `platform/transfers/lifecycle.ts` — new `STEPPER_ORDER` export.
- Dev showcase route under `app/` (dev-only path), consuming all of the above.

</code_context>

<specifics>
## Specific Ideas

- Status pill example the user has in mind: solid coral "Unclaimed" pill on a driver claim card — the concrete driver of the `variant="pill"` decision.
- Route motif read: airport → property (e.g. "SOF Airport" → property name), which is why endpoints are configurable rather than literal Plane→Plane.
- Cancelled in the horizontal stepper should read as a clean terminal banner/badge, not a frozen partial track.

</specifics>

<deferred>
## Deferred Ideas

- Migrating the existing `platform/ui/` primitives (`Button`, `TextField`, etc.) from arbitrary-value classes to the new named tokens — optional cleanup, not required for Phase 9; can happen opportunistically as surface phases touch them.
- Full per-state timestamp surfacing in the timeline/stepper (the empty timestamp slot in `LifecycleTimeline`) — out of scope; a surface/data concern for later.
- Omitted mockup features with no backing data (live GPS map, driver ratings, earnings analytics, Analytics nav, "Download Manifest", invented KPI goal %) — explicitly out of v1.1 per ROADMAP; not part of any phase.

None of these block Phase 9. Discussion stayed within the presentation-only foundation scope.

</deferred>

---

*Phase: 9-design-system-foundation*
*Context gathered: 2026-06-20*
