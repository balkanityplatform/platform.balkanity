# 03 — Stripe Webhook Replay Runbook (SC3)

> Operator runbook for the **replay idempotency gate (SC3)**: a replayed Stripe
> `event.id` must produce **exactly one effect** — one `webhook_events` row and an
> unchanged `wp_transfers.paid_at` on the second delivery. This is a **manual**
> verification (it requires the Stripe CLI driving a live webhook) and is executed at
> the Plan 05 phase gate. **Everything below runs in Stripe TEST mode (D-02) — no real
> money moves.**

---

## Why this is manual

The replay gate cannot be a unit test: it needs the real Stripe CLI to mint a
signature-valid `checkout.session.completed`, forward it to a running webhook, and then
re-deliver the same `event.id`. The idempotency authority is the database
(`webhook_events.event_id` UNIQUE + insert-first `ON CONFLICT DO NOTHING`), so the gate
only means something against a live TEST DB and a running route. See
`03-VALIDATION.md` §"Manual-Only Verifications".

The Stripe CLI is **not installed on the build machine** — install it as step 0 when
running this runbook (Plan 05).

---

## Prerequisites

- [ ] Plan 03 shipped `platform/payments/stripe.ts` + `checkout.ts` + `fee.ts`.
- [ ] Plan 04 shipped `app/api/stripe/webhook/route.ts` (the only `paid` writer).
- [ ] Migration `0003_payments_spine.sql` applied to the Balkanity ref
      `qyhdogajtmnvxphrslwm` (NEVER Kalvia `utyatpadtibqqswsfvtr`) — UNIQUE
      `webhook_events (event_id)` present.
- [ ] A seeded `wp_transfers` row in `requested` state to pay against.
- [ ] Stripe Dashboard in **TEST mode** (toggle top-right); `STRIPE_SECRET_KEY` is a
      `sk_test_…` key.

---

## Step 0 — Install the Stripe CLI + log in

```bash
brew install stripe/stripe-cli/stripe   # macOS
stripe login                            # opens browser; authorize TEST mode
stripe --version                        # confirm install
```

## Step 1 — Forward live webhook events to the local route

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This prints a signing secret:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

Copy the `whsec_…` value into `STRIPE_WEBHOOK_SECRET` in `.env.local` (server-only —
NEVER `NEXT_PUBLIC_`; do not commit it to any tracked file). Restart `npm run dev` so
the route picks up the new secret. Keep this `stripe listen` terminal open.

## Step 2 — Drive a real signed `checkout.session.completed`

Create a Checkout Session for the seeded transfer (via the app's checkout entry point
for the seeded `wp_transfers` row), complete it with a Stripe **TEST card**
(`4242 4242 4242 4242`, any future expiry, any CVC). Stripe delivers a signed
`checkout.session.completed` through the `stripe listen` tunnel.

In the `stripe listen` terminal, capture the delivered event id:

```
2026-06-18 20:00:00  --> checkout.session.completed [evt_1AbCdEfGhIjKlMnOpQrStUvW]
```

Record that `evt_…` id:

```bash
EVENT_ID=evt_1AbCdEfGhIjKlMnOpQrStUvW   # <- paste the real id from the listen output
```

## Step 3 — Confirm the FIRST delivery had exactly one effect

Via the Supabase CLI / Management-token psql (IPv4 pooler — NOT MCP, which reaches
Kalvia), against the Balkanity ref `qyhdogajtmnvxphrslwm`:

```sql
-- Exactly one webhook_events row for this event id.
select count(*) from webhook_events where event_id = 'evt_1AbCdEfGhIjKlMnOpQrStUvW';
-- expect: 1

-- The transfer is now paid, with a paid_at timestamp set ONCE.
select status, paid_at from wp_transfers where id = '<seeded-transfer-id>';
-- expect: status = 'paid', paid_at = <T1, the first-delivery timestamp>
```

Note the exact `paid_at` value (call it `T1`).

## Step 4 — REPLAY the same event

```bash
stripe events resend "$EVENT_ID"
```

Stripe re-delivers the identical `event.id` to the route. The webhook handler must
insert-first against the UNIQUE `event_id` (`ON CONFLICT DO NOTHING`) and short-circuit:
the duplicate is recorded as already-seen and NO second `paid` write occurs.

## Step 5 — Assert exactly-one-effect after replay (the SC3 gate)

```sql
-- STILL exactly one row — the UNIQUE constraint rejected the duplicate insert.
select count(*) from webhook_events where event_id = 'evt_1AbCdEfGhIjKlMnOpQrStUvW';
-- expect: 1  (NOT 2)

-- paid_at is UNCHANGED from T1 — the replay produced no second effect.
select status, paid_at from wp_transfers where id = '<seeded-transfer-id>';
-- expect: status = 'paid', paid_at = T1  (the SAME timestamp as Step 3)
```

**PASS criteria (SC3):**

- `webhook_events` count for the event id is **1 before and after** the replay.
- `wp_transfers.paid_at` is **identical** (`T1`) before and after the replay.
- No duplicate `paid` write, no second `webhook_events` row.

If the count becomes `2` or `paid_at` changes, the idempotency contract is broken —
the UNIQUE constraint or the insert-first ordering is wrong; do not pass the gate.

---

## Cleanup

- `^C` the `stripe listen` terminal.
- Reset the seeded `wp_transfers` row if rerunning.
- All of the above is TEST mode (D-02); no live charges were created.
