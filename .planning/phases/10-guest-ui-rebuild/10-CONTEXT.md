# Phase 10: Guest UI Rebuild - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the existing guest-facing screens to the boarding-pass "Transfer Pass" identity on the Phase 9 design system. **Presentation-only**: no change to form fields, validation, the lifecycle state machine, the Stripe Checkout flow, RLS reads, or any guest-facing data. The visual contract is already locked by `10-UI-SPEC.md`; this phase implements it.

**In scope:** the guest journey screens — `/pickup/[slug]` (booking), `/status/[id]` (magic-link status), `/pay/success`, `/pay/cancel`, and `/track`.

**Out of scope:** Driver surface (Phase 11), Admin surface (Phase 12), any backend/schema/lifecycle/Checkout behaviour change, and all the omitted mockup features recorded in `10-UI-SPEC.md` (live GPS map, ETA, vehicle, ratings, driver avatar, call/chat, "View Travel Vouchers", barcode, admin nav shells).
</domain>

<decisions>
## Implementation Decisions

### Screen Scope
- **D-01:** Restyle **all guest screens**, not just the two with mockups. `/pickup` (booking) and `/status` (status) get the full mockup-spec rebuild; `/pay/success`, `/pay/cancel`, and `/track` get a **lighter consistent restyle** to the design system so the whole guest journey reads as one branded flow (no half-rebranded screens). The supporting screens follow the same tokens/components but do not need the full pass skeuomorphism.

### Booking Form Restyle Depth
- **D-02:** Re-skin the form **input primitives too**, not just the page chrome. The `BookingForm` / `PaxStepper` inputs get restyled to the design system (input height, focus ring, labels, spacing per `10-UI-SPEC.md`) so the form looks native to the pass. **Fields, order, and validation are unchanged** — this is visual only. Reuse existing primitives (`Button`, `Card`, `PaxStepper`) and the `@theme` tokens; do not introduce new form libraries.

### Shared "Transfer Pass" Component
- **D-03:** Extract **one reusable `TransferPass` shell component** (teal `#029B87` header band, `RouteMotif` airport→property, perforated dashed divider + notch cutouts as decoration) consumed by **both** the booking and status pages. Keeps the pass identity consistent and avoids duplicating the skeuomorphism in two places. The booking page composes: `TransferPass` header → restyled form → pay CTA + Stripe trust footer (per UI-SPEC D-2). The status page composes: `TransferPass` header → horizontal `LifecycleStepper` → driver reveal → receipt block.

### Old Vertical Timeline Disposition
- **D-04:** **Leave `platform/ui/LifecycleTimeline.tsx` in place, untouched.** After `/status` swaps to the horizontal `LifecycleStepper` (DS-04) it has no remaining consumer, but it is kept as dead-but-harmless code (may be reused by a later surface), matching Phase 9's deliberate "leave LifecycleTimeline untouched" stance. Do **not** delete it or its tests in this phase.

### Claude's Discretion
- Component file structure, prop shapes for `TransferPass`, and how much of the supporting-screen restyle is shared vs inline are left to the planner, provided D-01–D-04 hold.
- Test approach (component test for the new `TransferPass` vs relying on existing booking/status tests + visual eyeball) — planner's call. Existing guest tests MUST continue to pass (presentation-only guarantee).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (PRIMARY — locked)
- `.planning/phases/10-guest-ui-rebuild/10-UI-SPEC.md` — the locked visual/interaction contract for this phase (token vocabulary, type roles, color split, the 4 locked layout decisions, omitted-feature list, per-screen structure). MUST read before planning.
- `.planning/phases/09-design-system-foundation/09-UI-SPEC.md` — the Phase 9 foundation contract this surface consumes (token + component vocabulary). Phase 10 adds **zero** new tokens.

### Roadmap / milestone rules
- `.planning/ROADMAP.md` — "Milestone v1.1: UI Rebuild" + "Phase 10: Guest UI Rebuild" (goal, 4 success criteria, presentation-only/omission rules, `#029B87` brand correction).

### Mockups (visual source of truth — corrections applied)
- `Branding /stitch_balkanity_welcome_pickup/guest_transfer_pass_booking/code.html` + `screen.png` — booking pass identity. Reject its `#00685a` primary (→ `#029B87`), Material Symbols icons (→ Phase 9 line pictograms + brand badge), fake barcode, and invented "Est. Pickup".
- `Branding /stitch_balkanity_welcome_pickup/guest_transfer_pass_status/code.html` + `screen.png` — status pass identity. Reject map/call-chat/voucher CTA/admin nav shells and the vertical stepper (→ horizontal `LifecycleStepper`).
- `Branding /stitch_balkanity_welcome_pickup/balkanity_path/DESIGN.md` — "Balkanity Path" design language. Its `#00685a`-family primary is rejected; brand primary is `#029B87`.

### Phase 9 components to consume (do not re-invent)
- `platform/ui/StatusDot.tsx` — `variant` (dot/pill), `stateLabel()`, cancelled hollow ring.
- `platform/ui/RouteMotif.tsx` — configurable endpoints + committed brand Transfer Badge midpoint.
- `platform/ui/LifecycleStepper.tsx` — horizontal, `STEPPER_ORDER`-driven, shape-encoded states.
- `app/globals.css` — the `@theme` token source.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/ui/StatusDot.tsx`, `RouteMotif.tsx`, `LifecycleStepper.tsx` (Phase 9): the building blocks the rebuild composes.
- `platform/ui/Button.tsx`, `Card.tsx`, `PaxStepper.tsx`, `Toast.tsx`: existing primitives to restyle/reuse, not replace.
- `app/globals.css` `@theme`: all tokens (color `#029B87`, type roles, radii, spacing aliases incl. 44px touch / 52px CTA). Phase 10 adds no tokens.

### Established Patterns
- Guest routes already exist (Phase 4) and must keep working: `app/pickup/[slug]/page.tsx` (108 lines), `app/status/[id]/page.tsx` (247 lines), `app/pay/success/page.tsx` (119 lines), `app/track/page.tsx` (27 lines), `app/pay/cancel/page.tsx`.
- i18n is EN/BG with a **tsc key-parity gate** — every new copy key goes in BOTH `platform/i18n/en.ts` and `platform/i18n/bg.ts`. `10-UI-SPEC.md` flags ~8 new keys (pass eyebrow, ref label, grid captions, trust footer, payment-status); all field/validation/driver/expired copy is reused verbatim.
- Status page currently renders the vertical `LifecycleTimeline` → swap to horizontal `LifecycleStepper` (D-04 keeps the old component in place).

### Integration Points
- Booking page → `createBooking` action → Stripe Checkout: **unchanged**. The restyle wraps the existing form; it must not alter the action call or field payload.
- Status page → RLS magic-link read + post-claim driver reveal (first name + phone as plain text): content unchanged, only restyled.
</code_context>

<specifics>
## Specific Ideas

- The "pass" frames the form rather than replacing it (one stacked page on `/pickup`).
- Real truncated transfer ID replaces the mockup's invented "BK-2941-X" reference; no scannable barcode.
- Pay CTA copy: "Pay €{amount} & confirm" + "Secured payment · powered by Stripe" trust footer (from `10-UI-SPEC.md`).
</specifics>

<deferred>
## Deferred Ideas

None raised that fall outside this phase — discussion stayed within the guest-surface scope. (Driver/Admin rebuilds are already their own phases, 11 and 12.)

### Reviewed Todos (not folded)
- `07-resend-domain-and-d15-uat.md` — surfaced as a weak (0.6) keyword match but belongs to **Phase 7 (Notifications)**: it concerns Resend `send.balkanity.com` domain verification + the D-15 live-delivery UAT, not the guest UI. Not folded; remains a Phase 7 sign-off item.
</deferred>

---

*Phase: 10-guest-ui-rebuild*
*Context gathered: 2026-06-20*
