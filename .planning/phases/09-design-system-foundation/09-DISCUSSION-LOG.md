# Phase 9: Design System Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 9-design-system-foundation
**Areas discussed:** Token naming convention, Status badge form factor, Lifecycle stepper shape, Route/infinity motif API, Visual verification

---

## Token naming convention (DS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Add named utilities | Extend @theme with named tokens (text-heading/body/label, rounded-card, --radius-*, --spacing-*) so surfaces write semantic classes. | ✓ |
| Radii/spacing only, keep [arbitrary] | Add only --radius-* + spacing aliases; keep text-[24px] arbitrary-value convention for type. | |

**User's choice:** Add named utilities (Recommended)
**Notes:** Sets the authoring pattern for all three surfaces; type, radii, and spacing all get semantic tokens. Existing primitives not required to migrate this phase.

---

## Status badge form factor (DS-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One component, variant prop | Extend StatusDot with variant="dot"|"pill"; dot stays default, existing callers unchanged. | ✓ |
| Keep dot only, no pill | Just extend StatusDot's dot; surfaces style their own pills. | |
| Separate StatusBadge (pill) component | New pill component importing the same map. | |

**User's choice:** One component, variant prop (Recommended)
**Notes:** Driven by mockups showing solid coral "Unclaimed" pills on driver claim cards. Single colour/label map; cancelled=hollow coral ring in both variants.

---

## Lifecycle stepper shape (DS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| New separate horizontal component | Ship LifecycleStepper new; leave vertical LifecycleTimeline untouched. | ✓ |
| Refactor LifecycleTimeline w/ orientation prop | One component, orientation prop. | |

**User's choice:** New separate horizontal component (Recommended)

### Follow-up — step list source

| Option | Description | Selected |
|--------|-------------|----------|
| New STEPPER_ORDER const in lifecycle.ts | Add exported 6-step STEPPER_ORDER (Paid→…→Completed). | ✓ |
| Slice LIFECYCLE_ORDER | Derive via LIFECYCLE_ORDER.slice(1). | |

### Follow-up — cancelled rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Replace stepper with cancelled banner/badge | Distinct terminal hollow-coral treatment instead of the 6-step track. | ✓ |
| Show track frozen at last step + cancelled marker | Render track up to stop point, then marker. | |

**Notes:** Keeps lifecycle.ts the single source of truth; horizontal stepper avoids wedging cancelled into the track, mirroring the vertical timeline's off-happy-path handling.

---

## Route/infinity motif API (DS-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable endpoint props | RouteMotif takes start/end {icon,label}, default Plane→Building; fixed center Transfer Badge. | ✓ |
| Fixed Plane→Plane endpoints | Hardcode literal Departure/Arrival plane icons. | |

**User's choice:** Configurable endpoint props (Recommended)
**Notes:** Guest is airport→property, so plane→plane reads oddly; configurable endpoints make the motif reusable across all three surfaces. Midpoint stays the real brand transfers.svg mark.

---

## Visual verification

| Option | Description | Selected |
|--------|-------------|----------|
| Throwaway dev showcase route | Dev-only gallery (/dev/design-system) rendering all components × states/variants + token swatches; plus unit tests. | ✓ |
| Tests only, verify in surface phases | Unit tests now; defer eyeballing to Phase 10. | |

**User's choice:** Throwaway dev showcase route (Recommended)
**Notes:** Phase 9 ships no screens; the showcase lets the foundation be eyeballed before surfaces consume it. Not linked in user-facing nav; may be kept or removed.

---

## Claude's Discretion

- Exact token names within the chosen convention, component/file naming, and the precise dev showcase route path — left to planning, consistent with existing `platform/ui/` conventions.

## Deferred Ideas

- Migrating existing `platform/ui/` primitives from arbitrary-value classes to named tokens (opportunistic, not required this phase).
- Per-state timestamp surfacing in the timeline/stepper (data concern, later).
- Omitted mockup features with no backing data (live map, ratings, earnings, Analytics nav, manifest export, KPI goal %) — out of v1.1 per ROADMAP.
