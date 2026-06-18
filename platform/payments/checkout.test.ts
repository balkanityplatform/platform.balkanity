// platform/payments/checkout.test.ts — unit contract for the code-created Checkout
// Session (SC5, BOOK-05). Mocks the Stripe SDK and asserts the helper calls
// stripe.checkout.sessions.create with the money-critical arguments:
//   - mode: "payment"            (one-off, not a subscription)
//   - currency: "eur"            (D-01 — EUR only)
//   - unit_amount: INTEGER cents (no floats, no ×100 at the boundary — passed straight)
//   - metadata.transfer_id       (binds the Session to the transfer row; this is how the
//                                  webhook later resolves which transfer to mark paid —
//                                  NOT a dashboard Payment Link, CLAUDE.md lock)
//
// NYQUIST BASELINE: platform/payments/checkout.ts + platform/payments/stripe.ts do NOT
// exist yet (land in Plan 03). The dynamic import below throws → this suite is RED now.
// That is the expected baseline; do NOT create the helpers to make this green here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture for the create-session call so assertions can read the exact args. Typed to
// accept the create params object so `.mock.calls[0][0]` is indexable under tsc.
const sessionsCreate = vi.fn(async (_params: Record<string, unknown>) => ({
  id: "cs_test_123",
  url: "https://checkout.stripe.com/c/pay/cs_test_123",
}));

// Mock the server-only Stripe client factory the checkout helper depends on. The real
// module imports "server-only" + reads STRIPE_SECRET_KEY; the mock returns a fake SDK
// exposing only checkout.sessions.create so the unit test never touches the network.
vi.mock("@/platform/payments/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
  createStripeClient: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
}));

describe("createCheckoutSession contract (SC5)", () => {
  beforeEach(() => {
    sessionsCreate.mockClear();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("creates an EUR payment Session with integer unit_amount and metadata.transfer_id", async () => {
    // Dynamic import via a runtime specifier so this test file type-checks BEFORE the
    // implementation exists (Nyquist baseline). The import still THROWS at runtime
    // until Plan 03 ships platform/payments/checkout.ts — the suite stays RED.
    const specifier = "@/platform/payments/checkout";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      createCheckoutSession: (input: {
        transferId: string;
        amountCents: number;
      }) => Promise<unknown>;
    };
    const create = mod.createCheckoutSession;

    await create({
      transferId: "11111111-1111-1111-1111-111111111111",
      amountCents: 4500,
    });

    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    const args = (sessionsCreate.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

    expect(args.mode).toBe("payment");

    // line_items carry EUR + integer minor units.
    const lineItems = args.line_items as Array<{
      price_data?: { currency?: string; unit_amount?: number };
    }>;
    const priceData = lineItems[0].price_data!;
    expect(priceData.currency).toBe("eur");
    expect(priceData.unit_amount).toBe(4500);
    expect(Number.isInteger(priceData.unit_amount)).toBe(true);

    // The Session is bound to the transfer row via metadata (resolved by the webhook).
    const metadata = args.metadata as { transfer_id?: string };
    expect(metadata.transfer_id).toBe("11111111-1111-1111-1111-111111111111");
  });
});
