# Runbook — 0004 lifecycle trigger + RLS (live Balkanity DB)

**Migration:** `supabase/migrations/0004_transfer_entity.sql`
**Target:** Balkanity Supabase `qyhdogajtmnvxphrslwm` (eu-central-1 session pooler) — **NOT** Kalvia `utyatpadtibqqswsfvtr`.
**Executed:** 2026-06-18, via Management-token `psql` over the IPv4 session pooler (`aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.qyhdogajtmnvxphrslwm`). Direct host `db.<ref>.supabase.co` is IPv6-only and unreachable from this network — the pooler is the working path. NOT via MCP (MCP reaches only Kalvia; see project memory).
**Method:** the entire adversarial run executes inside a single `BEGIN … ROLLBACK` transaction — seed rows are created, every case asserted, then rolled back. The live DB is left pristine (verified `transfers=0 destinations=0 companies=0` after). This mirrors the 03-05 live-gate style.

---

## Task 1 — Apply + verify migration 0004

Applied with `supabase db push --linked` (`SUPABASE_ACCESS_TOKEN` in env). The three `NOTICE … does not exist, skipping` lines are the idempotent `drop … if exists` no-ops on first apply.

| Check | Before | After |
|-------|--------|-------|
| `wp_transfers` column count | 10 | **19** (10 + 9 new) |
| New nullable columns | absent | `guest_name, guest_email, guest_phone, pax, luggage_count, flight_no, arrival_at, notes, driver_id` ✓ |
| Trigger `wp_transfers_transition_guard` | absent | **live** ✓ |
| Policy `wp_transfers_guest_self_read` | absent | **live** ✓ |
| Policy `destinations_public_active_read` | absent | **live** ✓ |
| Indexes `wp_transfers_arrival_at_idx`, `wp_transfers_guest_email_idx` | absent | **live** ✓ |
| Row count (data-loss guard) | 0 | 0 (no rows existed; none lost) |

Acceptance criteria for Task 1: **all met**. Applied to Balkanity only (ref + pooler username + `linked-project.json` name "balkanityplatform's Project" all confirm `qyhdogajtmnvxphrslwm`).

---

## Task 2 — Adversarial trigger + RLS (live, service-role/superuser path)

Connected as the database superuser (`postgres`) — the strongest "service-role" path. Superuser **bypasses RLS but NOT triggers**, so this is the correct adversary for the lifecycle guard.

### (a) Trigger — legal chain — every transition SUCCEEDS

```
requested -> paid       OK   (Pitfall 4 / T-04-TMP2 — the load-bearing webhook transition)
paid      -> claimed    OK
claimed   -> en_route   OK
en_route  -> arrived    OK
arrived   -> picked_up  OK
picked_up -> completed  OK
legal_final_status = completed
```

The live allowed pairs match `platform/transfers/lifecycle.ts` `ALLOWED_TRANSITIONS` exactly.

### (b) Trigger — illegal transitions — each RAISES `check_violation` (SQLSTATE 23514)

| Attempt | Result | SQLSTATE | Message |
|---------|--------|----------|---------|
| `requested -> completed` (skip) | **PASS (raised)** | `23514` | `illegal transfer transition: requested -> completed` |
| `picked_up -> cancelled` (illegal from picked_up) | **PASS (raised)** | `23514` | `illegal transfer transition: picked_up -> cancelled` |
| `completed -> requested` (terminal outbound) | **PASS (raised)** | `23514` | `illegal transfer transition: completed -> requested` |

Proves the trigger fires on the service-role/superuser path — `set status` cannot escape the state machine regardless of who writes. (T-04-TMP1.)

### (c) RLS — guest-self-read isolation on `wp_transfers`

| Reader (role=authenticated, `request.jwt.claims`) | Rows |
|---------------------------------------------------|------|
| owner — `email = owner@example.com` (== row `guest_email`) | **1** ✓ |
| non-owner — `email = stranger@example.com` (≠ `guest_email`) | **0** ✓ (PII boundary holds — T-04-ID1) |

### (c2) RLS — active-destination anon read

| anon select | Rows |
|-------------|------|
| `active = true` destination (`runbook-active`) | **1** ✓ (booking-page columns exposed) |
| `active = false` destination (`runbook-inactive`) | **0** ✓ (T-04-ID3 — inactive/secret destinations hidden) |

`ROLLBACK` executed; post-run live counts `transfers=0 destinations=0 companies=0` — no test data persisted.

Acceptance criteria for Task 2: **all met**.

---

## Task 3 — Full suite + live end-to-end smoke

### Automated suite — GREEN

| Command | Result |
|---------|--------|
| `npm run test` (vitest) | **21 files / 106 tests pass** — incl. the previously-RED Plan-01 specs (`lifecycle.test.ts`, `booking.test.ts`, `confirmation.test.ts`) now GREEN, and `single-writer.test.ts` still finds exactly one `paid` writer |
| `npm run typecheck` | clean ✓ |
| `npm run lint` | 0 errors (2 pre-existing test-file warnings) ✓ |
| `npm run build` | compiles; `/pickup/[slug]`, `/status/[id]`, `/track`, `/pay/success` registered ✓ |

### Live booking→pay→confirm→track smoke — DEFERRED to operator

**Status: NOT RUN here.** The live Stripe round-trip needs the Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`), which is **not installed on this machine**. Per the operator's execution decision, this step is handed off as a human-verify item.

**Operator steps to close the gate:**
1. `stripe listen --forward-to localhost:3000/api/stripe/webhook` (+ `npm run dev`).
2. Open `/pickup/runbook-active` (or a real active slug) → confirm fare + form render.
3. Submit the form → confirm a `status='requested'` `wp_transfers` row is created and the redirect is a Stripe Checkout URL.
4. Complete the TEST Checkout → confirm the webhook flips the row to `paid` (the live trigger now allows requested→paid) and the `[BOOK-06 stub]` confirmation magic link is logged.
5. Click the logged magic link → confirm `/auth/confirm` lands on `/status/<id>` (same browser, PKCE) and the page renders the lifecycle timeline + "Paid €X on {date}" receipt for the guest's own row only.
6. FAIL if any open-redirect, `getSession` on the status path, or stale-SW serve appears.
