// platform/payments/fee.test.ts — unit contract for the recorded-fee helper
// (SC5 / D-05, BOOK-05). The RECORDED fee is the actual Stripe fee read from the
// expanded balance_transaction — NOT the pre-payment estimate (estStripeFeeCents).
// The helper must:
//   - return bt.fee verbatim (integer cents, no float math, no rounding) for D-05, and
//   - guard a null/absent balance_transaction (Pitfall 5) by returning null rather than
//     throwing (Phase 8 backfills nulls).
//
// NYQUIST BASELINE: platform/payments/fee.ts does NOT exist yet (lands in Plan 03/04).
// The import below throws → this suite is RED now. That is the expected baseline; do
// NOT create the helper to make this green here.
import { describe, expect, it } from "vitest";

// Dynamic import via a runtime specifier so this test file type-checks BEFORE the
// implementation exists (Nyquist baseline). The import still THROWS at runtime until
// Plan 03/04 ships platform/payments/fee.ts — the suite stays RED.
const FEE_MODULE = "@/platform/payments/fee";
async function loadFee(): Promise<{
  recordedFeeCents: (pi: unknown) => number | null;
}> {
  return (await import(/* @vite-ignore */ FEE_MODULE)) as {
    recordedFeeCents: (pi: unknown) => number | null;
  };
}

// Minimal shape of an expanded PaymentIntent → latest_charge → balance_transaction.
// The real helper accepts a Stripe.PaymentIntent; the unit test passes a structurally
// compatible fixture so no network/SDK is needed.
function piWithFee(fee: number | null) {
  return {
    id: "pi_test_123",
    latest_charge: {
      id: "ch_test_123",
      balance_transaction:
        fee === null ? null : { id: "txn_test_123", fee, currency: "eur" },
    },
  };
}

describe("recordedFeeCents contract (D-05)", () => {
  it("returns the exact integer balance_transaction.fee", async () => {
    const { recordedFeeCents } = await loadFee();
    // 1.5% + €0.25 on €45.00 ≈ 92 cents — but the helper must return the SDK value
    // verbatim, never recompute it.
    expect(recordedFeeCents(piWithFee(92))).toBe(92);
  });

  it("does not round or transform the fee value", async () => {
    const { recordedFeeCents } = await loadFee();
    expect(recordedFeeCents(piWithFee(137))).toBe(137);
  });

  it("guards a null balance_transaction by returning null (Pitfall 5), not throwing", async () => {
    const { recordedFeeCents } = await loadFee();
    expect(recordedFeeCents(piWithFee(null))).toBeNull();
  });
});
