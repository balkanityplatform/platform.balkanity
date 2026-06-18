# Phase 4: Transfer Entity + Booking Form - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 04-transfer-entity-booking-form
**Areas discussed:** Booking form fields, Status-page access, Lifecycle enforcement

---

## Booking form fields

### Scheduling — how the guest tells us when the transfer is needed

| Option | Description | Selected |
|--------|-------------|----------|
| Date + time fields | Explicit required arrival date + time; flight no. optional metadata | |
| Flight number drives it | Derive arrival time from flight number (needs flight tracking) | ✓ (initial) |
| Date only | Arrival date only; weaker pool ordering | |

**User's choice:** Initially "Flight number drives it" — but flight tracking is out of v1 scope (GROW-03), so this was reconciled below.

### Flight/time reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Flight no. + manual date/time | Flight number required + manual arrival date/time; no flight-tracking dependency | |
| Flight no. + date only | Flight number + date, no precise time | |
| Pull flight tracking into v1 | Add a flight-lookup integration (net-new scope) | ✓ (initial) |

**User's choice:** Initially "Pull flight tracking into v1" — flagged as net-new scope / gold-plating for a 10-transfer pilot; reconciled below.

### Slot flight tracking relative to Phase 4

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to backlog phase | Phase 4 ships flight no. + manual date/time; flight tracking becomes its own future phase | ✓ |
| Insert phase before go-live | Manual now, add an INSERTED flight-tracking phase before pilot launch | |
| Expand Phase 4 now | Integrate a flight API inside Phase 4 | |

**User's choice:** Defer to backlog phase.
**Notes:** Final scheduling decision = flight number (required) + manual arrival date + arrival time in Phase 4; flight tracking promoted from GROW-03 to its own future roadmap phase, built post-pilot.

### Required fields

| Option | Description | Selected |
|--------|-------------|----------|
| Name + pax required | Name + passenger count required; phone/flight/luggage/notes optional | |
| Also require phone | Also make phone required (on top of name + pax) | ✓ |
| Minimal | Only email + date + time required | |

**User's choice:** Also require phone → required set = email, phone, name, pax, flight number, arrival date, arrival time. (Deliberate change from PROJECT.md "phone optional".)

### Passengers & luggage capture

| Option | Description | Selected |
|--------|-------------|----------|
| Pax stepper + bag count | Pax = number stepper (1–8); luggage = number of bags | ✓ |
| Pax + size select | Luggage = small/medium/large/none | |
| Pax + has-luggage toggle | Luggage = yes/no | |

**User's choice:** Pax stepper + bag count (luggage optional).

### Guest name

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, required | Name required, claim-gated PII | ✓ |
| Optional | Name present but optional | |
| No name | No name field | |

**User's choice:** Required.

---

## Status-page access

### Access model

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase magic-link session | Magic link → guest auth session; status page RLS-gated by auth.email() = guest_email | ✓ |
| Signed token link | /status/<token> via service-role, no auth account; bearer URL outside RLS | |
| On-demand OTP | Fresh magic link/OTP each visit | |

**User's choice:** Supabase magic-link session.
**Notes:** Keeps PII gating at the data layer, consistent with Phase 5. Requires a new guest-self-read RLS policy on wp_transfers (migration 0004).

### Driver info shown to guest

| Option | Description | Selected |
|--------|-------------|----------|
| Name + phone post-claim | Driver first name + phone shown after 'claimed' | ✓ |
| Name only | Driver first name only, no phone | |
| No driver details | Timeline only | |

**User's choice:** Name + phone post-claim.

### Re-access if link lost

| Option | Description | Selected |
|--------|-------------|----------|
| Re-request by email | "Track my booking" page → fresh magic link | ✓ |
| Admin re-sends | No self-service; admin re-sends | |
| Defer | Rely on original email | |

**User's choice:** Re-request by email.

---

## Lifecycle enforcement

### Where the transition guards live

| Option | Description | Selected |
|--------|-------------|----------|
| DB trigger (authority) | BEFORE-UPDATE trigger validates every transition, all clients | ✓ |
| Both (trigger + TS guard) | DB trigger + app-layer assertTransition() | |
| App-layer TS guard | Single assertTransition() called by every writer | |

**User's choice:** DB trigger (authority). Migration 0004.

### Map scope

| Option | Description | Selected |
|--------|-------------|----------|
| Complete map now | Define the full 8-state machine now | ✓ |
| Incremental | Phase 4 only requested→paid; extend later | |

**User's choice:** Complete map now (Phase 4 drives requested→paid).

### Cancellation rules

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only, pre-pickup | Admin cancels from requested/paid/claimed/en_route/arrived only | ✓ |
| Admin-only, any non-terminal | Admin cancels from any state except completed | |
| Defer rules to Phase 6 | Include 'cancelled' in map, decide who/when later | |

**User's choice:** Admin-only, pre-pickup.

---

## Claude's Discretion

- Status-page liveness (fetch-fresh NetworkFirst default; Realtime/poll optional).
- Confirmation-email mechanic (generateLink({type:'magiclink'}) carried in the stubbed confirmation email, mirroring the 02-05 driver-invite pattern).
- Guest magic-link account → `guest` role resolution against the 01-03 role layer.
- Inactive-slug handling, abandoned/unpaid `requested`-row handling (cleanup is Phase 8), form layout/microcopy, receipt format details.

## Deferred Ideas

- **Flight tracking** (auto arrival-time lookup from flight number) — promote GROW-03 to a dedicated roadmap phase, built after the pilot. Needs a paid flight API, refresh strategy, delay-handling UX, lookup-failure fallback.
