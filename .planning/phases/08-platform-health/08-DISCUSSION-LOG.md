# Phase 8: Platform Health - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 8-platform-health
**Areas discussed:** Reconciliation sweep action, Stuck-transfer definition, Supabase tier / keep-alive, Health alert channel, Stuck window, Sweep cadence, Gauge warning threshold

---

## Reconciliation sweep action (HLTH-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Detect + alert only | Flag discrepancy (admin in-app + health row); human investigates/replays; money lock intact | ✓ |
| Auto-remediate via Stripe re-fetch | Sweep re-pulls event from Stripe and applies paid itself (second paid-writer path) | |
| Discuss the trade-off | — | |

**User's choice:** Detect + alert only.
**Notes:** Keeps `paid` set only by the verified webhook; satisfies pilot DoD (catch a dropped webhook).

---

## Stuck-transfer definition (HLTH-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Paid-but-unclaimed near arrival | Alert when paid transfer unclaimed within N hours of arrival | ✓ |
| Multiple stuck conditions | Add claimed-not-arrived + no-driver-action conditions | |
| Let me describe the rules | — | |

**User's choice:** Paid-but-unclaimed near arrival.
**Notes:** Threshold set to 12h (see Stuck window below).

---

## Supabase tier / keep-alive (HLTH-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Free + keep-alive | Stay free; keep-alive prevents 7-day pause that stops cron | ✓ |
| Upgrade to Supabase Pro | No pause; ~$25/mo | |
| Decide during planning | Build keep-alive, defer Pro to go-live | |

**User's choice:** Free + keep-alive.
**Notes:** Build the keep-alive regardless; Pro revisited at go-live.

---

## Health alert channel

| Option | Description | Selected |
|--------|-------------|----------|
| In-app only (cap-safe) | All health alerts in-app only | |
| In-app + email for money issues | Stuck/cap in-app; reconciliation discrepancy also emails admin (critical) | ✓ |
| Discuss thresholds | — | |

**User's choice:** In-app + email for money issues.
**Notes:** Money discrepancy shouldn't wait for someone to open the console; routes through the single sendEmail critical tier.

---

## Stuck window

| Option | Description | Selected |
|--------|-------------|----------|
| 6 hours before arrival | — | |
| 12 hours before arrival | More lead time to react | ✓ |
| 3 hours before arrival | — | |

**User's choice:** 12 hours before arrival.

---

## Sweep cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Every 15 minutes | Catch dropped webhook within ~15 min | ✓ |
| Every 30 minutes | — | |

**User's choice:** Every 15 minutes.

---

## Gauge warning threshold

| Option | Description | Selected |
|--------|-------------|----------|
| At ~90/day (match guardrail) | One consistent threshold with the send-guardrail soft cap | ✓ |
| At ~75/day (earlier) | — | |

**User's choice:** At ~90/day (match guardrail).

## Claude's Discretion

- Reconciliation/health-events table shape (new table vs reuse `notifications`), sweep SQL + lookback window, pg_cron invocation shape (Edge Function vs pg_net→route handler), exact keep-alive mechanism — researcher/planner decide within existing migration/RLS conventions.

## Deferred Ideas

- Supabase Pro upgrade (revisit at go-live).
- Broader stuck-transfer conditions (claimed-not-arrived, no-driver-action).
- Auto-remediation of dropped webhooks (Stripe re-fetch).
