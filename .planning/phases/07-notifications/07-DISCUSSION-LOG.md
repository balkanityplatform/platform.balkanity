# Phase 7: Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 7-Notifications
**Areas discussed:** In-app feed/bell scope, Driver daily digest, Email cap priority tiers, Email delivery & invite send

---

## In-app feed/bell scope (NOTF-01)

### Bell audience
| Option | Description | Selected |
|--------|-------------|----------|
| Drivers only | Primary channel for drivers; admin/guest have other surfaces | |
| Drivers + Admin | Drivers get pool/run feed; admin gets bell for new bookings | ✓ |
| All three actors | Guests too — marginal value | |

### Driver events
| Option | Description | Selected |
|--------|-------------|----------|
| New pool transfer + changes to my run | New claimable + reassign/release/cancel of owned run | ✓ |
| New pool transfers only | Bell only for new claimable | |
| Pool + my-run + admin messages | Adds generic admin→driver channel (scope creep) | |

### Live update
| Option | Description | Selected |
|--------|-------------|----------|
| Poll on focus + interval | Simplest; matches Phase 6 pool refresh | ✓ |
| Supabase Realtime | Instant push; more complexity than pilot needs | |

### Read state
| Option | Description | Selected |
|--------|-------------|----------|
| Unread badge + mark-read on open + mark-all | Standard, clear | ✓ |
| Unread badge, auto-read on feed open only | Simpler | |
| No unread tracking | Lightest | |

**User's choice:** Drivers + Admin; new pool + my-run changes; poll on focus + interval; unread badge + mark-read + mark-all.
**Notes:** Admin bell trigger interpreted as new paid booking (+ cap-near alarm, set in cap area). Confirmed in wrap-up.

---

## Driver daily digest (NOTF-05)

### Digest body
| Option | Description | Selected |
|--------|-------------|----------|
| Claimable pool snapshot + my runs today | Actionable morning summary | ✓ |
| Just a count of new claimable transfers | Minimal | |
| Pool + my runs + yesterday's completed | Adds recap (low value) | |

### Default state
| Option | Description | Selected |
|--------|-------------|----------|
| Off by default — opt-in | Protects cap; matches NOTF-05 'opt-in' | ✓ |
| On by default — opt out | Higher engagement, more cap burn | |

### Send time
| Option | Description | Selected |
|--------|-------------|----------|
| Per-driver toggle + time picker | Self-chosen time per NOTF-05 | ✓ |
| Toggle only, fixed time for all | Drops 'self-chosen time' | |

**User's choice:** Pool snapshot + my runs today; off by default opt-in; per-driver toggle + time picker.
**Notes:** Time-based trigger rides Phase 8 Supabase cron; Phase 7 builds content + preference + invokable send.

---

## Email cap priority tiers (NOTF-06)

### Tiers
| Option | Description | Selected |
|--------|-------------|----------|
| Critical always / best-effort dropped | Confirmation+invite critical; admin alert+digest droppable | ✓ |
| Three explicit tiers | Finer control, more config | |
| All equal, hard stop | Could block a paid guest's confirmation | |

### Threshold
| Option | Description | Selected |
|--------|-------------|----------|
| Soft block best-effort at ~90/day | Matches CLAUDE.md guardrail | ✓ |
| Hard block everything at 100 | No safety margin | |

### Alarm
| Option | Description | Selected |
|--------|-------------|----------|
| Admin in-app notification, no extra email | Free against cap | ✓ |
| Admin in-app + one alert email | Spends a send | |
| Log only | Easy to miss | |

### Dropped send
| Option | Description | Selected |
|--------|-------------|----------|
| Log as skipped, no auto-retry | In-app carries info; Phase 8 reviews | ✓ |
| Queue for next day | Staleness risk + dedup logic | |

**User's choice:** All recommended (2-tier, soft block ~90, admin in-app alarm, log skipped no retry).
**Notes:** Guest assigned/arrived rank just under critical (best-effort-high).

---

## Email delivery & invite send (NOTF-04 + delivery reality)

### Delivery
| Option | Description | Selected |
|--------|-------------|----------|
| Verify a sending subdomain | send.balkanity.com, noreply@send.balkanity.com | ✓ |
| Verify the apex balkanity.com | Mixes reputation | |
| Stay on test sender | No real-user delivery | |

### Invite send
| Option | Description | Selected |
|--------|-------------|----------|
| Email it + keep inline link fallback | Best of both | |
| Email only | Cleaner UX, no fallback | ✓ |
| Keep manual copy-paste only | Contradicts NOTF-04 plan | |

### Fallback if domain not verified
| Option | Description | Selected |
|--------|-------------|----------|
| Config-flagged graceful fallback | Dev/CI keep working | |
| Require domain verified to mark phase done | Hard completion gate | ✓ |
| Always send to test inbox | Can't validate real addressing | |

**User's choice:** Verify send.balkanity.com; invite email-only; real delivery is a completion gate.
**Notes:** Claude caveat (accepted): unit tests still mock Resend so CI doesn't depend on live sends — the gate applies to phase completion/UAT, not the test suite.

---

## Wrap-up clarifications

**Guest 'driver assigned' email content:** Driver first name + phone (phone is required for airport coordination; revealed to paying guest post-assignment).
**Email language:** Guest in booking language (EN/BG, fall back EN); admin/driver in EN.

---

## Claude's Discretion
- `notifications` / `email_log` table shapes; digest-preference storage.
- Email template authoring approach (plain HTML vs react-email).
- Polling cadence value; whether admin bell reuses the driver bell component.

## Deferred Ideas
- Supabase Realtime for the bell (post-pilot).
- Guest in-app bell / generic admin→driver messaging (out of v1 scope).
- Visual email-cap gauge, stuck-transfer alerts, reconciliation, keep-alive, digest cron trigger (Phase 8).
- Next-day queue for cap-dropped emails (rejected for v1).
