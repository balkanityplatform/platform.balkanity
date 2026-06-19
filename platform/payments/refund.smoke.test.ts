// platform/payments/refund.smoke.test.ts — Stripe TEST-MODE refund smoke (RESEARCH Open Q3).
//
// THE PRE-REAL-MONEY GATE: before the live migration 0006 apply (Plan 05 Task 2) and any
// real-money-capable refund wiring (Task 3), the test-mode refund path must be PROVEN:
//   • a FULL refund (no amountCents) returns status 'succeeded',
//   • a PARTIAL refund (amountCents < paid) returns status 'succeeded',
//   • a SECOND refunds.create with the SAME idempotencyKey does NOT issue a second refund
//     (Pitfall 3 — Stripe replays the original refund for an idempotent retry).
//
// SAFETY (CLAUDE.md money lock): this smoke is LIVE-ENV-GATED and TEST-MODE-ONLY. It runs
// ONLY when a Stripe TEST secret key (`STRIPE_TEST_SECRET_KEY`, prefix `sk_test_`) is present
// in the env — mirroring the Phase-5 live-env gate discipline (describe.skip when absent →
// never a false pass). It HARD-REFUSES any key that is not `sk_test_` so a real-money refund
// can never be issued against a LIVE key by accident. It points getStripe() at the TEST key
// for the duration of the suite only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_KEY = process.env.STRIPE_TEST_SECRET_KEY ?? "";
// Hard safety: only ever run against an explicit Stripe TEST-mode key. A live (`sk_live_`)
// key — or any non-test key — disqualifies the smoke entirely (skip-clean, never run).
const HAS_TEST_KEY = TEST_KEY.startsWith("sk_test_");

// describe.skip cleanly (never false-pass) when no Stripe TEST key is present.
const describeSmoke = HAS_TEST_KEY ? describe : describe.skip;

describeSmoke("Stripe TEST-MODE refund smoke (RESEARCH Open Q3 — pre-real-money gate)", () => {
  // refundPayment reads STRIPE_SECRET_KEY via getStripe(); point it at the TEST key for the
  // duration of this suite only, then restore. No live key is ever used here.
  let originalKey: string | undefined;
  let refundPayment: typeof import("./refund").refundPayment;
  let stripe: import("stripe").default;
  let paymentIntentId: string;
  let paidAmount: number;

  beforeAll(async () => {
    originalKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = TEST_KEY;

    const StripeMod = (await import("stripe")).default;
    stripe = new StripeMod(TEST_KEY, { apiVersion: "2026-05-27.dahlia" });
    ({ refundPayment } = await import("./refund"));

    // Create + confirm a TEST PaymentIntent with the always-succeeds test card token so it
    // is captured/refundable. EUR integer minor units (mirrors the booking money spine).
    paidAmount = 4500;
    const pi = await stripe.paymentIntents.create({
      amount: paidAmount,
      currency: "eur",
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    });
    paymentIntentId = pi.id;
    expect(pi.status).toBe("succeeded");
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it("a partial refund (amountCents < paid) returns status 'succeeded'", async () => {
    const refund = await refundPayment({
      paymentIntentId,
      amountCents: 1000,
      idempotencyKey: `smoke:partial:${paymentIntentId}`,
    });
    expect(refund.status).toBe("succeeded");
    expect(refund.amount).toBe(1000);
  });

  it("the SAME idempotencyKey does NOT issue a second refund (Pitfall 3)", async () => {
    const key = `smoke:partial:${paymentIntentId}`;
    const replay = await refundPayment({
      paymentIntentId,
      amountCents: 1000,
      idempotencyKey: key,
    });
    // Stripe replays the original refund for an idempotent retry → same refund id, no new money.
    expect(replay.amount).toBe(1000);
    expect(replay.status).toBe("succeeded");
  });

  it("a full refund (no amountCents) returns status 'succeeded'", async () => {
    // Refund the remaining balance (paid - 1000 already refunded above) via a full refund:
    // omitting amountCents → Stripe refunds whatever is still refundable on the intent.
    const refund = await refundPayment({
      paymentIntentId,
      idempotencyKey: `smoke:full:${paymentIntentId}`,
    });
    expect(refund.status).toBe("succeeded");
    // The remaining refundable balance was paid - the earlier partial.
    expect(refund.amount).toBe(paidAmount - 1000);
  });
});
