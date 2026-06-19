# Phase 6: Driver & Admin Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 6-Driver & Admin Views
**Areas discussed:** Pool refresh & claim feedback, "My run" & status advance, Admin transfers list, Admin actions & refund

---

## Pool refresh & claim feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch on focus + light poll | Re-fetch on focus + low-frequency poll while open; simplest, free-tier-safe | ✓ |
| Supabase Realtime push | Instant updates via realtime subscription; more moving parts | |
| Pull-to-refresh only | Manual only; can look stale | |

| Option (on win) | Description | Selected |
|--------|-------------|----------|
| Open the transfer detail | Land on full-PII detail; uses RPC's returned row | ✓ |
| Jump to "My run" | Land on run hub | |
| Stay in pool + confirmation | Toast + keep browsing | |

| Option (on lose) | Description | Selected |
|--------|-------------|----------|
| Toast + card auto-removes | Neutral toast, card slides out | ✓ |
| Inline card state flip | Card flips to muted 'Claimed' | |
| Silent removal | No message | |

**User's choice:** Refetch on focus + light poll; win → open transfer detail; lose → toast + card auto-removes.
**Notes:** Aligns with CLAUDE.md "simplest thing that works" and the NetworkFirst rule; lost claim must feel normal, not failed.

---

## "My run" & status advance

| Option (advance) | Description | Selected |
|--------|-------------|----------|
| Inline next-step CTA on each run card | One 52px CTA per card, advance in place | ✓ |
| Advance only on transfer detail | List read-only, CTA on detail | |
| Inline CTA + full stepper on detail | Two advance surfaces | |

| Option (progress) | Description | Selected |
|--------|-------------|----------|
| Compact read-only timeline + CTA | Reuse LifecycleTimeline, CTA drives change | ✓ |
| CTA + status dot only | No timeline on card | |
| Tappable stage stepper | Timeline is the control | |

| Option (on complete) | Description | Selected |
|--------|-------------|----------|
| Drops off + 'Completed today' collapsed | Leaves active run into collapsed section | ✓ |
| Disappears immediately | Gone from run | |
| Stays, visually marked done | Remains until end of day | |

**User's choice:** Inline next-step CTA per card; compact read-only LifecycleTimeline; completed drops into "Completed today" collapsed section.
**Notes:** Satisfies SC3 (arrived available from the run); keeps the active run focused (SC2).

---

## Admin transfers list

| Option (sort) | Description | Selected |
|--------|-------------|----------|
| Soonest arrival first, attention pinned | Arrival asc, coral attention rows on top | ✓ |
| Newest bookings first | Recently paid on top | |
| Grouped by status | Sectioned by lifecycle status | |

| Filter/search controls (multi-select) | Description | Selected |
|--------|-------------|----------|
| Status filter | Lifecycle status filter | ✓ |
| 'Needs attention' quick filter | One-tap to coral rows | ✓ |
| Search (guest name / flight no. / destination) | Free-text across human fields | ✓ |
| Driver / company filter | Narrow by driver/company | (deferred) |

| Option (stuck rule) | Description | Selected |
|--------|-------------|----------|
| Unclaimed near arrival + arrived-not-picked-up | Two time-based at-risk signals | ✓ |
| Only unclaimed | Simplest | |
| Unclaimed + stalled in any non-terminal state | Most thorough, noisier | |

**User's choice:** Soonest-arrival sort with attention pinned; status + needs-attention + search controls (driver/company deferred); stuck = unclaimed-near-arrival + arrived-not-picked-up.
**Notes:** "Needs attention" is the admin's primary triage lens. Stuck thresholds left as planner discretion.

---

## Admin actions & refund

| Confirm + reason (multi-select) | Description | Selected |
|--------|-------------|----------|
| Cancel | Destructive/terminal | ✓ |
| Refund | Money out, irreversible fee loss | ✓ |
| Reassign / release | Affects a driver's run | ✓ |
| Assign | Lower-risk, reversible | (one-tap, no reason) |

| Option (cancel/refund) | Description | Selected |
|--------|-------------|----------|
| Separate, with a refund shortcut | Distinct actions; cancel offers 'also refund?' | ✓ |
| Fully independent | No linkage | |
| Cancel auto-refunds | Always full refund on cancel | |

| Option (refund amount) | Description | Selected |
|--------|-------------|----------|
| Full or partial (default full) | Editable amount + fee disclosure | ✓ |
| Full only | One-tap full refund | |

**User's choice:** Confirm + reason on cancel/refund/reassign-release (assign one-tap); cancel & refund separate with a refund shortcut; full-or-partial refund (default full) with the fee-not-recovered disclosure.
**Notes:** Prepaid/non-refundable default per PROJECT.md; OPS-04 needs a NEW server-only refund hook (stripe.refunds.create); the irrecoverable processing fee must be disclosed every refund.

---

## Claude's Discretion

- Exact poll interval; concrete stuck-time thresholds; component naming/decomposition; driver pool empty-state copy; admin detail page layout; shared driver-picker for assign/reassign.
- Offline behavior beyond NetworkFirst (no offline claim/advance — conflicts with the atomic-claim guarantee).

## Deferred Ideas

- Driver/company filter on the admin list (low pilot volume).
- Stuck-transfer alerts / reconciliation / email-cap gauge (Phase 8).
- Notifications on claimed/arrived + admin booking alert (Phase 7).
- Per-driver hold cap / fairness throttle (rejected in Phase 5).
- Offline claim/advance (queued writes) — out of scope.
