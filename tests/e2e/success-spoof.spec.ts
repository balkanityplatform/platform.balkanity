import { expect, test } from "@playwright/test";

// tests/e2e/success-spoof.spec.ts — HTTP adversarial gate (SC2, BOOK-05, Pitfall 3).
//
// Stripe redirects the guest to `success_url` (`/pay/success?t=<transfer-id>`) AFTER
// Checkout. That redirect is SPOOFABLE — a guest (or attacker) can open the success URL
// directly without ever paying. The success page must therefore be DISPLAY-ONLY: hitting
// it must NEVER write `status: 'paid'`. The only writer of `paid` is the
// signature-verified webhook (see single-writer.test.ts). This spec proves a direct
// success-page hit, with NO webhook firing, leaves the transfer un-paid.
//
// NYQUIST BASELINE: /pay/success does NOT exist yet (lands in Plan 04). This assertion
// is RED now — that is the expected baseline; do NOT stub the page here.
//
// PREREQUISITES (gated behind Plan 05 — live TEST DB seeding):
//   - The success page (Plan 04) must exist to render a status.
//   - A seeded `wp_transfers` row in `requested` state is required to prove the page
//     does NOT flip it to `paid`. Until Plan 05 wires seeding, the page-renders-non-paid
//     assertion is documented; the live state-read is gated.
//   - Runs in Stripe TEST mode only (D-02). No real money moves.

// A seeded-but-unpaid transfer id. Plan 05 replaces this with a real seeded row id.
const SEEDED_TRANSFER_ID = "22222222-2222-2222-2222-222222222222";

test("direct success_url hit (no webhook) never shows paid (SC2, Pitfall 3)", async ({
  page,
}) => {
  // Simulate a guest spoofing the post-Checkout redirect: open the success page
  // directly without any webhook delivery.
  await page.goto(`/pay/success?t=${SEEDED_TRANSFER_ID}`);

  // The page is display-only: it must NOT render a paid/confirmed state for a transfer
  // that was never marked paid by the webhook. It should show a pending/non-paid status.
  const body = page.locator("body");

  // Negative assertion: no "paid"/"confirmed" success affordance is rendered.
  await expect(body).not.toContainText(/\bpaid\b/i);

  // TODO(Plan 05): with live TEST-DB seeding + service-role read, additionally assert
  // the seeded transfer row's status is still "requested" (the page wrote nothing).
});
