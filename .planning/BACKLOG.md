# Backlog — Open Items (v1.0 pilot go-live)

The v1.0 build roadmap is 8/8 phases implemented. These are the remaining
verification + go-live items that are NOT new feature work. Captured 2026-06-20.

## 🔴 DNS — verify `send.balkanity.com` in Resend (BLOCKS two phases)

**What:** Add + verify the `send.balkanity.com` domain in Resend (Domains → Add Domain →
publish the MX/SPF/DKIM DNS records at the `balkanity.com` DNS host → Verify). Today only
`balkanity.com` exists in Resend with status `not_started`.

**Why it matters:** the single transactional-email sender is hardcoded to
`noreply@send.balkanity.com` ([platform/notifications/send-email.ts:30](../platform/notifications/send-email.ts)).
Until that subdomain is verified, every send records `outcome=failed`.

**Unblocks when done:**
- **Phase 7 D-15** — the live email-delivery / end-to-end fan-out UAT (the only thing keeping
  Phase 7 from fully closing). See `.planning/phases/07-notifications/07-GATES-EVIDENCE.md`.
- **Phase 8 Gate A email leg** — the reconciliation critical email currently fires
  (`tier=critical`) but logs `failed`. Verifying the domain flips it green.
  See `.planning/phases/08-platform-health/08-GATES-EVIDENCE.md`.

**Owner action:** operator has DNS access pending. No code change required.

## 🟠 Stripe — move the webhook into the deployed key's account (go-live)

**What:** The deployed `STRIPE_SECRET_KEY` belongs to account `acct_1TjISbIVJCasWEpx`
("Balkanity Travel", test mode). The webhook endpoint was created in a different sandbox
(`acct_1TjlSllDYZtQFMXK`). For production, create the webhook in the SAME account as the
deployed key (Developers → Webhooks), event `checkout.session.completed`, URL
`https://balkanityplatformproject.vercel.app/api/stripe/webhook`, and set its signing secret
as the prod `STRIPE_WEBHOOK_SECRET`.

**Note:** Phase 8 Gate A's remediation was proven by a self-signed replay against the prod
secret, so the handler logic is verified — but no real Stripe endpoint delivers to prod yet.

## 🟠 Real-money switch (go-live)

Currently all keys on Vercel prod are **test mode** (`sk_test`, test `whsec`, Resend). Before
the real-money pilot, swap `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` for **live** values
(and re-create the live webhook per the item above). Keep all secrets server-only.

## 🟡 Phase verification gaps (not DNS-blocked)

- **Phase 6** — 5 UAT items pending; run `/gsd:verify-work 6` (driver/admin views UAT).
- **Phase 7** — code + migration 0007 live; only the D-15 email UAT remains (DNS-blocked above).

## 🟢 Pre-existing lint cleanups (low priority)

See `.planning/phases/08-platform-health/deferred-items.md` — 4 react-hooks errors + a few
unused-var warnings in pre-existing driver/admin UI + test files (not introduced by Phase 8).
