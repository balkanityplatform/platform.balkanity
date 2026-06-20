# Phase 10: Guest UI Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 10-guest-ui-rebuild
**Areas discussed:** Screen scope, Booking-form restyle depth, Shared Transfer Pass component, Old vertical timeline disposition

---

## Screen scope

| Option | Description | Selected |
|--------|-------------|----------|
| All guest screens | Booking + status to full spec, plus a light consistent restyle of pay/success, pay/cancel, /track | ✓ |
| Mockup screens only | Only /pickup and /status; others done later | |
| Booking + status + pay results | /pickup, /status, pay/success + pay/cancel; leave /track as-is | |

**User's choice:** All guest screens
**Notes:** Avoids a half-rebranded guest flow. Supporting screens follow the same tokens/components with a lighter treatment (no full pass skeuomorphism).

---

## Booking-form restyle depth

| Option | Description | Selected |
|--------|-------------|----------|
| Re-skin form inputs too | Restyle page chrome AND the BookingForm/PaxStepper input primitives | ✓ |
| Wrapper/chrome only | Restyle only the page/pass shell; leave form inputs as-is | |

**User's choice:** Re-skin form inputs too
**Notes:** Fields, order, and validation are unchanged — visual only. Reuse existing primitives + @theme tokens.

---

## Shared Transfer Pass component

| Option | Description | Selected |
|--------|-------------|----------|
| One shared TransferPass | Single reusable pass-shell consumed by both booking and status | ✓ |
| Per-page, no shared component | Restyle each page independently | |
| Let the planner decide | No strong preference | |

**User's choice:** One shared TransferPass
**Notes:** Consistent identity + less duplication. Booking composes header→form→CTA; status composes header→LifecycleStepper→driver reveal→receipt.

---

## Old vertical timeline disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it in place | Keep LifecycleTimeline.tsx untouched (dead-but-harmless) | ✓ |
| Remove it | Delete LifecycleTimeline.tsx + references/tests | |

**User's choice:** Leave it in place
**Notes:** Matches Phase 9's deliberate "leave LifecycleTimeline untouched" stance; lowest risk. May be reused by a later surface.

---

## Claude's Discretion

- Component file structure and `TransferPass` prop shapes.
- How much of the supporting-screen (pay/track) restyle is shared vs inline.
- Test approach (new component test vs existing tests + visual), provided existing guest tests keep passing.

## Deferred Ideas

- None outside phase scope.
- Reviewed-not-folded: `07-resend-domain-and-d15-uat.md` — belongs to Phase 7 (Resend domain + D-15 UAT), weak keyword match only.
