---
phase: quick-260622-x4g
plan: 01
subsystem: admin-destinations
tags: [admin, i18n, presentation-only, ux]
requires: [destinations.slug, platform/ui/Button]
provides: [CopyBookingLink, copyBookingLinkCta, bookingLinkCopiedLabel]
affects: [app/admin/destinations]
tech_stack:
  added: []
  patterns: [surface-local-client-component, post-mount-origin-resolve, aria-live-copied-state]
key_files:
  created:
    - app/admin/destinations/CopyBookingLink.tsx
  modified:
    - platform/i18n/en.ts
    - platform/i18n/bg.ts
    - app/admin/destinations/DestinationsView.tsx
    - app/admin/destinations/page.tsx
decisions:
  - "URL built client-side from window.location.origin + /pickup/<slug> post-mount; relative fallback before resolve so the row is never blank and SSR never reads window"
  - "CopyBookingLink rendered for ACTIVE rows only (D-11 — inactive destinations stop resolving /pickup, so no live link)"
  - "Redundant relative /<slug> meta token dropped for active rows (full URL now shown by the control); kept for inactive rows as their only slug reference"
metrics:
  duration: 6min
  completed: 2026-06-22
---

# Quick 260622-x4g: Copyable Public Booking URL on Destination Rows Summary

Active `/admin/destinations` rows now show the full public booking URL (`origin + /pickup/<slug>`) with an accessible Copy button that flips to "Copied" — replacing the bare, misleading relative `/<slug>` token that operators had to expand by hand.

## What Was Built

- **`CopyBookingLink.tsx`** — surface-local `"use client"` component (not `platform/ui/`). Resolves `window.location.origin` post-mount via `useEffect` (relative `/pickup/<slug>` fallback before resolve; SSR never touches `window`; Vercel domain never hardcoded). Copies via `navigator.clipboard.writeText`, sets `copied=true`, resets after 1500ms with a `setTimeout` cleared on unmount and on repeat-click. The Button `aria-label` carries the action wording in BOTH states (WCAG 1.4.1, never colour/icon alone); the visible label is wrapped in `aria-live="polite"`.
- **EN/BG keys** — `copyBookingLinkCta` ("Copy booking link" / "Копирай линк за резервация") + `bookingLinkCopiedLabel` ("Copied" / "Копирано") added beside `slugLabel` in both dictionaries (Dict-parity `Dict = typeof en` gate holds).
- **`DestinationsView.tsx`** — `DestinationsViewCopy` extended with the two keys; imports + renders `CopyBookingLink` in the per-row actions slot for ACTIVE rows only (alongside Edit/Deactivate, not while editing). Active-row meta no longer prepends the redundant `/<slug>` token; inactive rows keep it.
- **`page.tsx`** — threads `t.copyBookingLinkCta` + `t.bookingLinkCopiedLabel` into the copy bag. No DB/query/action changes.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | EN/BG keys + CopyBookingLink component | 78eb273 | en.ts, bg.ts, CopyBookingLink.tsx |
| 2 | Wire keys + render for active rows | 5191bb7 | DestinationsView.tsx, page.tsx |

## Verification

- Task 1 grep gate: PASS (both locales have the keys; component has `navigator.clipboard.writeText` + `"use client"`).
- Task 2 grep gate: PASS (`CopyBookingLink` referenced in DestinationsView; `copyBookingLinkCta` in page.tsx).
- **`npx tsc --noEmit`: exit 0** — clean project-wide, including the Dict-parity gate. No new errors in `app/admin/destinations` or `platform/i18n`.

## Deviations from Plan

None - plan executed exactly as written.

## Presentation-Only Compliance

Zero backend/schema/auth/RLS/payment changes. Only the five planned files were touched. The slug already existed on the destination row; this surfaced an existing link client-side. The active-only render preserves D-11 (inactive destinations show no live/copyable link).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: app/admin/destinations/CopyBookingLink.tsx
- FOUND: commit 78eb273
- FOUND: commit 5191bb7
