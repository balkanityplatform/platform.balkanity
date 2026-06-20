---
phase: 09-design-system-foundation
plan: 02
subsystem: design-system
tags: [ui, status-badge, wcag, presentation-only]
requires:
  - "platform/ui/StatusDot.tsx (existing TransferState union + STATE_META map)"
  - "platform/ui/Button.tsx (variant-prop pattern analog)"
provides:
  - "StatusVariant type (dot|pill) exported from StatusDot"
  - "StatusDot variant prop (default dot) — pill = solid filled badge"
  - "cancelled = hollow coral ring (border-2 border-coral bg-transparent) in both variants"
affects:
  - "Driver claim cards (Phase 11) consume variant=pill"
  - "LifecycleStepper terminal cancelled treatment (DS-04) reuses the hollow ring"
tech-stack:
  added: []
  patterns:
    - "One colour/label source map, two renderers (T-04-02 single source of truth)"
    - "Variant prop mirrors Button.tsx (exported union + defaulted prop)"
key-files:
  created: []
  modified:
    - "platform/ui/StatusDot.tsx"
    - "platform/ui/StatusDot.test.tsx"
decisions:
  - "D-03: variant prop on existing StatusDot (not a new component); default dot keeps every Phase 2-8 caller byte-equivalent"
  - "D-04: cancelled renders as the hollow-ring dot+label in BOTH variants — it is the off-happy-path terminal state, never a filled pill"
  - "pill carries the colour fill on a status-pill badge with white label; dot (and cancelled in both variants) carries colour on the round status-dot"
metrics:
  duration: 4min
  completed: 2026-06-20
---

# Phase 9 Plan 2: StatusDot Variant + Cancelled Hollow Ring Summary

Extended the existing `StatusDot` with a `variant` prop (`"dot"` default / `"pill"` solid filled badge) driven by the one `STATE_META` colour/label map, and made `cancelled` a hollow coral ring (2px, transparent fill) in both variants — the single status-rendering change this phase ships — with the worded WCAG 1.4.1 label always present.

## What Was Built

- **`StatusVariant = "dot" | "pill"`** exported from `StatusDot.tsx`; new `variant?: StatusVariant` prop defaulting to `"dot"` (mirrors `Button.tsx`'s exported-union + defaulted-prop pattern). Every existing caller (`LifecycleTimeline` + all Phase 2–8 surfaces) is unchanged.
- **`"dot"` renderer:** the original inline `gap-[4px]` dot+label markup verbatim — 10px `rounded-full` shape with `data-testid="status-dot"` + `aria-hidden="true"`, 14px/600 slate label.
- **`"pill"` renderer:** a solid filled badge — the per-state colour fills a `rounded-full` `status-pill` container, worded label in white on top (still WCAG 1.4.1).
- **`cancelled` (D-04):** renders as the hollow-ring dot+label (`border-2 border-coral bg-transparent`, NOT `bg-coral`) in BOTH variants — treated as the off-happy-path terminal state, never a filled pill. Label "Cancelled" still renders.
- **`STATE_META` stays the single source** consumed by both renderers (T-04-02 Don't-Hand-Roll). Extracted `CANCELLED_RING` and `LABEL_CLASS` constants to avoid per-branch duplication.
- **Tests extended:** `describe.each(["dot","pill"])` covers the worded label + shape class per state in both variants; a default-variant assertion; a pill solid-badge assertion; a cancelled hollow-ring assertion across both variants (asserts `border-coral` and NOT `bg-coral`).

## How It Works

`StatusDot({ state, variant = "dot" })` reads `{ colorClass, label }` from `STATE_META[state]`, then branches:
1. `cancelled` → hollow-ring dot+label (both variants), the terminal off-path treatment.
2. `variant === "pill"` (non-cancelled) → solid `status-pill` badge with white label.
3. default `"dot"` → original `status-dot` markup, untouched.

The colour carrier differs by variant — the dot variant (and cancelled everywhere) carries the class on the round `status-dot`; the pill carries the fill on the `status-pill` badge — so the test queries the correct element per variant.

## Verification

- `npx vitest run platform/ui/StatusDot.test.tsx` — 36 passed.
- `npm run typecheck` (`tsc --noEmit`) — clean (exported `StatusVariant`, defaulted prop).
- `npm test` (full suite) — 197 passed | 6 skipped; existing default-dot callers unaffected.
- Source gates: `grep "StatusVariant"`, `grep "border-2 border-coral"`, `grep "bg-transparent"` in `StatusDot.tsx` and `grep "pill"` in the test all match; `data-testid="status-dot"` + `aria-hidden="true"` preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Per-variant shape-class test queried the wrong element**
- **Found during:** Task 1 GREEN (own RED scaffolding)
- **Issue:** The shared `it.each(CASES)` "maps … shape class" assertion queried `data-testid="status-dot"` in all variants, but the pill variant carries the colour fill on the `status-pill` badge (no `status-dot` element for non-cancelled pills) → 7 false failures.
- **Fix:** The assertion now selects the colour carrier per variant — `status-pill` for non-cancelled pills, `status-dot` for the dot variant and for cancelled in both variants.
- **Files modified:** `platform/ui/StatusDot.test.tsx`
- **Commit:** a03ea07

## TDD Gate Compliance

This plan was authored test-first: the extended test suite was written and confirmed RED (5→7 failures: `StatusVariant` absent, pill unsupported, cancelled still solid `bg-coral`) before the implementation turned it GREEN (36 passing). Test and implementation landed in one `feat` commit (a03ea07) since the task is a single feature change; no separate `test(...)` RED commit was created. The RED state was verified in-session prior to the GREEN implementation.

## Self-Check: PASSED

- FOUND: platform/ui/StatusDot.tsx
- FOUND: platform/ui/StatusDot.test.tsx
- FOUND commit: a03ea07
