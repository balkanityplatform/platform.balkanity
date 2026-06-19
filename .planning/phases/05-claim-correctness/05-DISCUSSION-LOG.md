# Phase 5: Claim Correctness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 05-claim-correctness
**Areas discussed:** Pool fields, Claim result contract, Claim access, Hold cap, Flight-no PII reclassification

---

## Pool fields (pre-claim masked pool)

| Option | Description | Selected |
|--------|-------------|----------|
| SC1 list only (strict) | date, arrival time, airport, zone, fare, pax, luggage; flight no./name/contact/address/notes all post-claim | |
| SC1 + flight number | Add flight_no to the pre-claim pool for route context | ✓ |
| SC1 + notes | Add free-text notes pre-claim (risk: notes may contain PII) | |

**User's choice:** SC1 + flight number.
**Notes:** Triggered a conflict check — flight no. was a LOCKED PII field (CLAIM-03 + SC3). Resolved separately below.

---

## Claim result contract (loser outcome)

| Option | Description | Selected |
|--------|-------------|----------|
| Typed result row | RPC always returns {ok, reason, transfer}; loser gets ok=false, reason='already_claimed', no PII | ✓ |
| Row or empty set | Winner gets row; loser gets zero rows | |
| Raise exception on loss | Loser triggers a Postgres exception the app catches | |

**User's choice:** Typed result row.
**Notes:** App branches on a value — no exception-as-control-flow.

---

## Claim access (who reads the pool / claims)

| Option | Description | Selected |
|--------|-------------|----------|
| Any signed-in driver | Pool + claim for role='driver' only | |
| Drivers + admins | Admins also see the pool | ✓ (extended) |
| Active-profile drivers only | Require complete driver_profiles row before claiming | |

**User's choice:** Drivers AND admins see the pool. Free-text extension: *"Admins should also see the transfer full details with no mask and should also be able to pick the transfer; admin can be a driver as well."*
**Notes:** → D-06/D-07/D-08. Admins read full unmasked details via existing admin RLS (not via the masked pool); admins may self-claim (driver_id = auth.uid()).

---

## Hold cap (simultaneous active claims per driver)

| Option | Description | Selected |
|--------|-------------|----------|
| No cap | Unlimited active holds; first-to-claim per transfer is the only rule | ✓ |
| Soft cap (e.g. 3) | Cap per-driver active holds inside the RPC | |

**User's choice:** No cap.
**Notes:** Matches CLAIM-04 "multiple active claims". RPC stays purely about the single-transfer race.

---

## Flight-no PII reclassification (conflict resolution)

| Option | Description | Selected |
|--------|-------------|----------|
| Reclassify as operational | Include flight_no pre-claim; amend CLAIM-03 + ROADMAP SC1/SC3/SC4 | ✓ |
| Keep flight no. post-claim | Leave CLAIM-03/SC3 as-is; pool stays strict SC1 | |
| Pool shows airline only | Coarse non-identifying hint; keep flight_no itself PII | |

**User's choice:** Reclassify as operational.
**Notes:** Surfaced because the "SC1 + flight number" pool choice contradicted the locked CLAIM-03 ("flight no." listed as PII) and adversarial gate SC3 ("zero PII keys"). Per the user's call, edited `REQUIREMENTS.md` (CLAIM-01 adds flight no. to pool; CLAIM-03 drops flight no. from PII) and `ROADMAP.md` Phase 5 SC1/SC3/SC4. PII set is now {name, contact, exact address, notes}.

---

## Claude's Discretion

- Adversarial concurrency test harness (how to fire N truly-simultaneous claims so it proves real DB serialization).
- PII-payload adversarial test mechanics (minting a non-claiming driver JWT; asserting zero PII keys).
- Exact `wp_pool` shape/naming, RPC signature/return type (composite vs jsonb), one-vs-two RLS policies.
- Re-appearance of released transfers in the pool (falls out of `driver_id IS NULL`).

## Deferred Ideas

- Per-driver hold cap / fairness throttle — rejected for v1; revisit only if a driver hoards the pool.
- Airline/terminal-only coarse hint — superseded by full flight-no exposure (D-02).
