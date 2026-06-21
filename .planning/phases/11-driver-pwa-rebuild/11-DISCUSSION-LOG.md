# Phase 11: Driver PWA Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 11-driver-pwa-rebuild
**Areas discussed:** Bottom-nav mount strategy, Bottom nav on trip detail, Profile restyle depth, Profile content, Test approach

---

## Bottom-nav mount strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Shared driver layout | Introduce `app/driver/layout.tsx` that mounts `DriverBottomNav` + slim top header once, wrapping all driver routes. Cleanest, single source, consistency. | ✓ |
| Per-page include | Each driver page imports/renders `DriverBottomNav` itself; no new layout; risk of drift. | |

**User's choice:** Shared driver layout
**Notes:** Scouting confirmed no `app/driver/layout.tsx` exists today — each page renders its own header. Consolidating into a layout is presentation-only. → CONTEXT D-01.

---

## Bottom nav on the trip-detail page (/driver/run/[id])

| Option | Description | Selected |
|--------|-------------|----------|
| Hide nav, show back | Full-screen pushed detail: hide bottom nav, add back chevron returning to My Trips (native convention). | |
| Keep nav visible | Show bottom nav on the detail page (My Trips active); return by tapping the tab; consistent chrome. | ✓ |

**User's choice:** Keep nav visible
**Notes:** Resolves the UI-SPEC's "three driver shells" gap — the detail route is the 4th and keeps the nav. → CONTEXT D-02.

---

## Profile (settings) restyle depth

| Option | Description | Selected |
|--------|-------------|----------|
| Light restyle (UI-SPEC) | Token-align the existing digest card + header only. Minimal, matches UI-SPEC wording. | |
| Full rebuild | Rebuild settings into a real Profile/settings surface. | ✓ |

**User's choice:** Full rebuild
**Notes:** Followed up to scope it against the truthfulness rule (no Profile mockup exists). → CONTEXT D-03/D-04.

---

## Profile content (follow-up, multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Driver identity header | Name + email from existing auth session; initials chip ok, no avatar photo. | ✓ |
| Digest preference card | Existing `DigestPreferenceCard` (NOTF-05), restyled. | ✓ |
| Language toggle row | EN/BG toggle surfaced as a settings row. | ✓ |
| Sign-out action | Sign-out control (none exists in the app today). | ✓ |

**User's choice:** All four
**Notes:** Confirmed via grep that no `signOut` exists anywhere in `app/` — sign-out is the one genuinely-new affordance (auth-only, no schema). All four elements backed by existing data → no data-less gold-plating. → CONTEXT D-03/D-04/D-05.

---

## Test approach for new driver pieces

| Option | Description | Selected |
|--------|-------------|----------|
| Rely on existing + visual | Keep existing driver tests green (presentation-only guarantee); eyeball new visuals. Mirrors Phase 10. | ✓ |
| Add component tests | Add focused tests (claim card renders zero PII, nav active-tab). | |

**User's choice:** Rely on existing + visual
**Notes:** Existing behavioural tests (`RunView.test.tsx`, `advance.*.test.ts`) cover claim/advance semantics unchanged by a restyle. → CONTEXT D-06.

---

## Claude's Discretion

- New driver-only component file structure + prop shapes (`DriverBottomNav`, claim-card / trip-card extraction, Luggage + nav-tab icons).
- Driver-name source for the identity header (auth metadata vs `driver_profiles`); email-only acceptable.
- Active-state derivation (`usePathname()` vs prop) for the bottom nav.

## Deferred Ideas

None — discussion stayed within the driver-surface scope. Backend-less mockup features (map, ratings, earnings) are intentionally omitted per the milestone truthfulness rule, not deferred.
