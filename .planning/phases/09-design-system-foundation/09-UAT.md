---
status: testing
phase: 09-design-system-foundation
source: [09-VERIFICATION.md]
started: 2026-06-20T00:00:00Z
updated: 2026-06-20T00:00:00Z
---

## Current Test

number: 1
name: In-browser design-system showcase eyeball
expected: |
  Running in dev mode, visiting /dev/design-system renders the full Phase 9 matrix
  correctly: Tailwind v4 @theme utilities produce the right computed pixel sizes,
  colour/radii/spacing swatches render, the type scale (display/heading/body/label)
  is correct, StatusDot shows all 8 states × {dot, pill}, LifecycleStepper renders
  at each STEPPER_ORDER state plus the cancelled terminal, and the RouteMotif sample
  shows Plane→Badge→Building. Route 404s when NODE_ENV=production.
awaiting: user response

## Tests

### 1. In-browser design-system showcase eyeball
expected: Visiting /dev/design-system in dev mode renders all Phase 9 deliverables correctly across every state/variant (token swatches, type scale, StatusDot × 8 × {dot,pill}, LifecycleStepper at each state + cancelled, RouteMotif). Automated checks confirm the source; the browser render is the definitive check.
result: [pending]

### 2. Transfer Badge brand colour decision (WR-01)
expected: A brand-owner decision on the canonical teal. public/brand/transfer-badge.svg fills with #009B87 while the locked brand primary in app/globals.css is #029b87 — a visually perceptible 2-point hex difference shown side-by-side in RouteMotif. Confirm which hex is canonical, then correct either the SVG or the globals.css token so they agree.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
