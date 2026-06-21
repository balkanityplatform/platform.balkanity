# Phase 11: Driver PWA Rebuild - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the existing driver-facing surface to the mockup identity on the Phase 9 design system: Available transfers as claim cards (no pre-claim PII), a persistent bottom navigation bar, a My Trips list, an en-route trip detail with the horizontal `LifecycleStepper` + Confirm-Arrival CTA, and a restyled Profile. The visual/interaction contract is already locked by `11-UI-SPEC.md`; this phase implements it.

**Presentation-only**: NO change to backend, schema, auth model, RLS, the payment path, the masked `wp_pool()` read, the atomic `claim_transfer` RPC, or the gated `advanceStatus` write. The single exception is a new client-facing **sign-out** affordance on Profile (auth-only — `supabase.auth.signOut()` + redirect; no schema, no new data) — see D-05.

**In scope (the existing driver routes):** `/driver` (+ `PoolView.tsx`), `/driver/run` (+ `RunView.tsx`), `/driver/run/[id]`, `/driver/settings` (the Profile), plus a new shared driver layout + bottom nav.

**Out of scope:** Guest surface (Phase 10, done), Admin surface (Phase 12), any backend/schema/lifecycle/RLS/Checkout change, and every omitted mockup feature recorded in `11-UI-SPEC.md` (live GPS map, route-line tracking, ETA, vehicle make/model/plate, driver avatar photo, driver ratings ★, earnings totals + trend %, call/chat affordances). No un-claim / give-back control (CLAIM-04).
</domain>

<decisions>
## Implementation Decisions

### Bottom Nav & Driver Shell
- **D-01:** Introduce a **shared `app/driver/layout.tsx`** that mounts the `DriverBottomNav` and the slim top header (Alerts bell + Language toggle) **once**, wrapping all driver routes. There is currently NO driver layout — each page renders its own header/nav independently — so this consolidates that into a single source and guarantees consistent chrome. Presentation-only (new layout file; no behaviour change). Page content gets bottom padding ≈ nav height so the last card is never occluded by the fixed nav (per UI-SPEC spacing).
- **D-02:** The bottom nav **stays visible on the en-route trip detail** (`/driver/run/[id]`), with the **My Trips** tab active. The driver returns to the list by tapping My Trips — consistent chrome on every driver screen, no separate back affordance required. (Resolves the UI-SPEC gap: it specified "three driver shells"; the detail route is the 4th and explicitly keeps the nav.)

### Profile (settings) Restyle — Full Rebuild
- **D-03:** The Profile screen gets a **full rebuild** into a real settings surface (not just a light token pass over the existing card). It composes, top to bottom, all four of:
  1. **Driver identity header** — signed-in driver's name + email from the existing verified auth session (`getCurrentRole()` + `auth.getUser()` already in the route). No avatar photo (no backing data); initials-in-a-chip permitted.
  2. **Digest preference card** — the existing `DigestPreferenceCard` (NOTF-05), restyled to the new chrome. Behaviour unchanged (narrow gated service-role read/write keyed to the verified `auth.uid()`).
  3. **Language toggle row** — surface the EN/BG `LanguageToggle` as a settings row on the page (in addition to its presence in the slim top header), so the page reads as a genuine settings screen.
  4. **Sign-out action** — see D-05.
- **D-04 (truthfulness guard):** Even as a "full rebuild," the Profile introduces **no data-less features** — every element above is backed by data we already have (auth session, `driver_profiles.digest_*`, the i18n dict). No earnings, no ratings, no stats, no avatar upload.

### Sign-Out (the one new affordance)
- **D-05:** A **sign-out** control on Profile is the single genuinely-new affordance in this presentation-only phase. **Confirmed there is no existing sign-out anywhere in `app/`** (`signOut` not found). Implement as a small server action calling `supabase.auth.signOut()` then redirecting to `/sign-in`. Auth/session only — **no schema, no RLS, no new table**. Flagged for the planner as the lone deviation from pure re-skin (does not touch the payment/claim/RLS-sensitive paths, so it does not trigger the schema/auth review gate beyond a normal sign-out).

### Testing
- **D-06:** **Rely on the existing driver tests + visual review** — no new component tests required. Existing behavioural tests are the presentation-only guarantee and MUST stay green: `app/driver/run/RunView.test.tsx`, `app/driver/advance.lifecycle.test.ts`, `advance.notify.test.ts`, `advance.ownership.test.ts`. The restyle must not change behaviour, so these continue to cover claim/advance semantics. New visual pieces (claim card, bottom nav, trip card) are eyeballed against the mockups. (Mirrors Phase 10's approach.)

### Claude's Discretion
- New driver-only component file structure and prop shapes (e.g. `app/driver/_nav/DriverBottomNav.tsx`, claim-card / trip-card extraction, the Luggage + 3 nav-tab line icons) — planner/executor's call, provided D-01–D-06 and the full `11-UI-SPEC.md` component inventory hold.
- Exactly where the driver name is sourced (auth metadata vs `driver_profiles`) for the D-03 identity header — pick the simplest already-available field; email alone is acceptable if no name is reliably present.
- How much of the bottom-nav active-state logic is derived from `usePathname()` vs passed as a prop — implementation detail.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (PRIMARY — locked)
- `.planning/phases/11-driver-pwa-rebuild/11-UI-SPEC.md` — the locked visual/interaction contract for this phase: 5 locked decisions (PII masking, omitted map/ratings/earnings, coral "Unclaimed" badge, horizontal stepper, Confirm-Arrival), the component inventory (claim card / bottom nav / My Trips / trip detail / Profile / line pictograms), token vocabulary, type roles, color split, spacing, copywriting contract. MUST read before planning.
- `.planning/phases/09-design-system-foundation/09-UI-SPEC.md` — the Phase 9 foundation contract this surface consumes (token + component vocabulary). Phase 11 adds **zero** new tokens.

### Roadmap / milestone rules
- `.planning/ROADMAP.md` — "Milestone v1.1: UI Rebuild" + "Phase 11: Driver PWA Rebuild" (goal, 5 success criteria, presentation-only/omission rules, `#029B87` brand correction, locked surface order Guest→Driver→Admin). Requirements: DUI-01, DUI-02, DUI-03, DUI-04, DUI-05.

### Prior surface phase (the pattern to mirror)
- `.planning/phases/10-guest-ui-rebuild/10-CONTEXT.md` — Phase 10 (Guest) established the surface-local rebuild pattern this phase follows: restyle all screens (no half-rebranded surfaces), surface-local pieces under the route dir (not `platform/ui/`), leave `LifecycleTimeline` untouched (D-04), EN/BG tsc parity gate, presentation-only guarantee.

### Mockups (visual source of truth — corrections applied)
- `Branding /stitch_balkanity_welcome_pickup/` driver Available / My Trips / trip-detail screens — driver claim-card + trip identity. **Reject**: `#00685a`/`primary` token family (→ `#029B87`), Material Symbols icons (→ Phase 9/10 line pictograms + brand Transfer Badge), and the backend-less features listed in the UI-SPEC omissions.
- `Branding /stitch_balkanity_welcome_pickup/balkanity_path/DESIGN.md` — "Balkanity Path" design language (its `#00685a`-family primary is rejected; brand primary is `#029B87`).

### Phase 9 components to consume verbatim (do NOT re-invent)
- `platform/ui/StatusDot.tsx` — `variant` (dot/pill), `stateLabel()`, cancelled hollow ring.
- `platform/ui/RouteMotif.tsx` — configurable endpoints + committed brand Transfer Badge midpoint.
- `platform/ui/LifecycleStepper.tsx` — horizontal, `STEPPER_ORDER`-driven, shape-encoded states (swaps in for the vertical `LifecycleTimeline` on the detail page).
- `platform/ui/Button.tsx`, `Card.tsx`, `Toast.tsx`, `NotificationBell.tsx`, `LanguageToggle.tsx` — existing primitives to restyle/reuse.
- `app/(guest)/_pass/icons.tsx` — Plane/Building/Calendar/Clock/People line pictograms to reuse; add Luggage + 3 nav-tab icons in the same 1.5px-stroke style.
- `app/globals.css` `@theme` — the token source (color `#029B87`, type roles, radii, 44px touch / 52px CTA, safe-area handling). Phase 11 adds no tokens.
- `platform/i18n/en.ts` + `bg.ts` — EN/BG dictionary with the tsc key-parity gate; every NEW key (nav labels, "Unclaimed" badge, Confirm-Arrival, Profile/identity/sign-out copy) goes in BOTH files.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 9 shared components (`StatusDot`, `RouteMotif`, `LifecycleStepper`, `Button`, `Card`, `Toast`, `NotificationBell`, `LanguageToggle`) — the building blocks the rebuild composes.
- `app/(guest)/_pass/icons.tsx` line pictograms (Phase 10) — reuse; add Luggage + nav-tab icons in the same style.
- `app/driver/settings/DigestPreferenceCard.tsx` — existing digest-preference island, restyled and re-hosted on the rebuilt Profile (D-03).

### Established Patterns
- **No `app/driver/layout.tsx` today** — each driver page renders its own header (`<header>` with logo chip + `LanguageToggle`). D-01 consolidates this into a shared layout.
- Driver routes are server-guarded RSCs that re-verify the DRIVER role via `getCurrentRole()` (revalidated JWT, never cookie-trusting `getSession`) and redirect non-drivers to `/sign-in`. Copy resolved server-side (no-flash, PLAT-04) and handed to client islands as prop bags.
- Masked pool reads via `wp_pool()` (migration 0005) return ONLY the 9 non-PII columns; the claim card renders exactly those — masking is structural at the data layer, never re-implemented in UI.
- Driver self-read of `driver_profiles` has no RLS policy → the settings preference is read with a **narrow service-role select keyed to the verified `auth.uid()`** (the gated-service-role pattern). The D-03 identity header reuses the same already-verified `auth.getUser()` identity.
- EN/BG `tsc` key-parity gate — a missing key fails the build.

### Integration Points
- Claim card → unchanged `claimAction(id)` → atomic `claim_transfer` RPC (first-to-claim-wins / already-claimed; neutral `claimLostToast` on loss, card silently removed). Live refresh (focus + ~25s poll) preserved verbatim.
- Trip detail Confirm-Arrival → unchanged `advanceStatus(id)` gated service-role write; inline `RunView` advance CTAs stay functional (CLAIM-05/06).
- New sign-out action → `supabase.auth.signOut()` + redirect to `/sign-in` (the only new affordance; auth/session only).
</code_context>

<specifics>
## Specific Ideas

- Bottom nav: Available / My Trips / Profile, active tab in teal (icon + label + indicator), 12px/600 labels (the one deliberate 12px exception), ≥44px hit targets, fixed to viewport bottom with `pb-[env(safe-area-inset-bottom)]`.
- Trip detail keeps the bottom nav (My Trips active) rather than a back-chevron full-screen treatment.
- Profile reads as a real settings page: identity header → digest card → language row → sign-out, all on existing data.
- "Unclaimed" pool rows render as the coral DS-02 badge + worded label (presentation choice over the same masked `status='paid' AND driver_id IS NULL` data).
</specifics>

<deferred>
## Deferred Ideas

None raised — discussion stayed within the driver-surface scope. (Guest and Admin rebuilds are their own phases, 10 done and 12 next. All backend-less mockup features are intentionally omitted per the milestone truthfulness rule, not deferred for a later phase.)
</deferred>

---

*Phase: 11-driver-pwa-rebuild*
*Context gathered: 2026-06-22*
