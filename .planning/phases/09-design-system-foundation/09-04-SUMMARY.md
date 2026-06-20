---
phase: 09-design-system-foundation
plan: 04
subsystem: design-system
tags: [ui, lifecycle, stepper, ds-04, wcag, presentation-only]
requires:
  - "platform/transfers/lifecycle.ts STEPPER_ORDER (09-01)"
  - "platform/ui/StatusDot.tsx STATE_META + cancelled hollow ring (09-02)"
provides:
  - "platform/ui/LifecycleStepper.tsx — horizontal step-styled lifecycle stepper (DS-04)"
  - "platform/ui/StatusDot.tsx stateLabel() — read-only label accessor over STATE_META"
affects:
  - "Guest status pass, Driver trip detail, Admin row/detail (future surface phases 10/11/12)"
tech-stack:
  added: []
  patterns:
    - "Don't-Hand-Roll: consume STEPPER_ORDER + STATE_META, declare no local order/label array"
    - "Shape-encodes-state beyond colour (WCAG 1.4.1): teal+check / amber / grey ring"
    - "cancelled = distinct terminal short-circuit, never wedged into the track (D-08)"
key-files:
  created:
    - platform/ui/LifecycleStepper.tsx
    - platform/ui/LifecycleStepper.test.tsx
  modified:
    - platform/ui/StatusDot.tsx
decisions:
  - "Added an additive stateLabel(state) accessor to StatusDot so the stepper derives worded labels from the single STATE_META source instead of a parallel array (D-06)"
  - "current='completed' is the terminal happy-path case: the last step shows BOTH the completed (teal+check) treatment AND aria-current='step' — all 6 steps read as done"
  - "A current not on STEPPER_ORDER (e.g. 'requested', which the stepper omits) yields index -1 → every step renders pending, the correct pre-paid resting state"
metrics:
  duration: 4min
  completed: 2026-06-20
---

# Phase 9 Plan 4: LifecycleStepper Summary

Shipped the new horizontal, step-styled `LifecycleStepper` (DS-04) — renders Paid → Claimed → En route → Arrived → Picked up → Completed from a passed-in `current` state, each step encoding completed/active/pending beyond colour (teal circle + white check / amber solid circle / grey `#66676F` outline ring) with an always-present worded label, and a distinct hollow-coral-ring "Cancelled" terminal treatment — consuming `STEPPER_ORDER` + `StatusDot`/`STATE_META` with zero hand-rolled arrays. The existing vertical `LifecycleTimeline` is byte-unchanged.

## What Was Built

### Task 1 — Horizontal LifecycleStepper (DS-04, D-05/06/07/08) — TDD

- **RED** (`b41fd78`): `platform/ui/LifecycleStepper.test.tsx` — 5 specs covering step count (== STEPPER_ORDER, 6), all 6 worded labels, completed/active/pending shape classification + `aria-current` on the active step, the terminal `completed` all-done case, and the `cancelled` distinct terminal treatment that suppresses the 6-step track. Failed at module-resolve (component absent).
- **GREEN** (`565cf46`): `platform/ui/LifecycleStepper.tsx` — a NEW separate component (D-05, no orientation-prop refactor of `LifecycleTimeline`). Iterates `STEPPER_ORDER` imported from `lifecycle.ts` (D-06), prop `{ current: TransferState }`. Classifies each step against `current`'s index: Completed (`idx < current`) = teal circle + white inline check; Active (`idx === current`) = amber solid circle with `aria-current="step"`; Pending (`idx > current` / off-track) = grey outline ring (`border border-grey bg-transparent`). Worded labels derived from the single `STATE_META` source via a new additive `stateLabel()` accessor on `StatusDot` (D-06 — no parallel array). `current === "cancelled"` short-circuits to a distinct terminal banner rendering `<StatusDot state="cancelled" />` (hollow coral ring + "Cancelled") instead of the track (D-08). Named tokens (`rounded-full`, `gap-*`, theme colour utilities) per D-02; top-of-file comment cites DS-04 + D-05/06/07/08 + the Don't-Hand-Roll lock.
- **REFACTOR**: none needed — implementation was clean on first GREEN.

## Verification

- `npx vitest run platform/ui/LifecycleStepper.test.tsx` → 5 passed.
- `npm run typecheck` → exits 0 (clean).
- `npx vitest run platform/ui/StatusDot.test.tsx` → 36 passed (additive `stateLabel` export, no behaviour change).
- Full `npx vitest run` → 202 passed, 6 skipped (no regression).
- `git status --short platform/ui/LifecycleTimeline.tsx` → empty (byte-unchanged, as required).
- Source grounding: `grep STEPPER_ORDER` matches; no inline `"paid"…"claimed"…"en_route"` array; `aria-current` present; cancelled path renders `<StatusDot state="cancelled" />` (not a 7th track step).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] STATE_META was module-private — added an additive `stateLabel()` accessor**
- **Found during:** Task 1 (GREEN). The plan requires deriving step labels "from StatusDot's STATE_META" (D-06, no hand-rolled label array), but `STATE_META` is a private const in `StatusDot.tsx` and not exported.
- **Fix:** Added a 3-line read-only `export function stateLabel(state)` over the same `STATE_META` map. Purely additive — no change to `StatusDot`'s rendering, props, or existing exports; all 36 StatusDot tests stay green.
- **Files modified:** `platform/ui/StatusDot.tsx`
- **Commit:** `565cf46`
- **Note:** `StatusDot.tsx` was not in this plan's `files_modified`, but the additive accessor is the minimal way to honour the Don't-Hand-Roll lock without re-implementing a label array; it ships in the GREEN commit alongside the consumer.

## Known Stubs

None — the component is fully wired to its real data sources (`STEPPER_ORDER`, `STATE_META`, `StatusDot`). The connector-segment styling and worded labels render real lifecycle state; no placeholder/mock data.

## Self-Check: PASSED

- FOUND: platform/ui/LifecycleStepper.tsx
- FOUND: platform/ui/LifecycleStepper.test.tsx
- FOUND: platform/ui/StatusDot.tsx (stateLabel added)
- FOUND commit b41fd78 (test/RED)
- FOUND commit 565cf46 (feat/GREEN)
