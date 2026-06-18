import { expect, test } from "@playwright/test";

// tests/e2e/webhook-forged.spec.ts — HTTP adversarial gate (SC2, BOOK-05, T-spoof).
//
// The Stripe webhook is the ONLY money-authoritative path. An attacker who POSTs a
// forged `checkout.session.completed` (bad or missing `stripe-signature`) must be
// REJECTED with HTTP 400 and cause ZERO state change — no webhook_events row for the
// forged event id, and any seeded transfer stays unpaid. If a forged POST could mark a
// transfer paid, the entire payment guarantee collapses.
//
// NYQUIST BASELINE: /api/stripe/webhook does NOT exist yet (lands in Plan 04). These
// assertions are RED now — that is the expected baseline; do NOT stub the route here.
//
// PREREQUISITES (gated behind Plan 05 — live TEST DB seeding):
//   - The webhook route (Plan 04) must exist for the 400 assertions to pass.
//   - The "zero state change" check needs a seeded `wp_transfers` row and a
//     service-role read helper (or the guest success display page) to confirm the row
//     stays `requested`. Until Plan 05 wires seeding, only the HTTP-400 portion is
//     exercisable; the state-change assertions are documented and skipped via
//     test.fixme where they require live DB state.
//   - Runs in Stripe TEST mode only (D-02). No real money moves.

const WEBHOOK_PATH = "/api/stripe/webhook";

// A structurally-plausible but UNSIGNED forged event. `deadbeef` is a junk v1 signature
// the server's constructEvent must reject.
const FORGED_EVENT_ID = "evt_forged";
const FORGED_BODY = JSON.stringify({
  id: FORGED_EVENT_ID,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_forged_123",
      object: "checkout.session",
      payment_status: "paid",
      metadata: { transfer_id: "00000000-0000-0000-0000-000000000000" },
    },
  },
});

test("forged stripe-signature -> 400, zero state change (SC2)", async ({ request }) => {
  const res = await request.post(WEBHOOK_PATH, {
    headers: {
      "content-type": "application/json",
      // Bad signature: well-formed shape, junk v1 digest — must fail constructEvent.
      "stripe-signature": "t=1,v1=deadbeef",
    },
    data: FORGED_BODY,
  });

  expect(res.status()).toBe(400);

  // Zero state change: the forged event must NOT have been recorded. With a seeded
  // transfer + service-role read helper (Plan 05), assert no webhook_events row for
  // `evt_forged` and the transfer is still `requested`.
  // TODO(Plan 05): wire live TEST-DB seeding + service-role read to assert the row
  // count for FORGED_EVENT_ID is 0 and the seeded transfer.status === "requested".
});

test("missing stripe-signature header -> 400 (SC2)", async ({ request }) => {
  const res = await request.post(WEBHOOK_PATH, {
    headers: { "content-type": "application/json" },
    data: FORGED_BODY,
  });

  // No signature at all is just as invalid as a forged one — both must 400.
  expect(res.status()).toBe(400);
});
