// platform/payments/refund.test.ts — Wave-0 RED spec for OPS-04 (manual refund hook).
//
// CONTRACT (OPS-04, D-12, Pitfall 3): the server-only refund hook `refundPayment` calls
// `stripe.refunds.create` with:
//   • `payment_intent` — the captured intent to refund (never a client-trusted amount path),
//   • an `idempotencyKey` (the second Stripe.refunds.create arg) so a retried admin click never
//     double-refunds,
//   • `amount` ONLY when a partial `amountCents` is supplied — OMITTING it yields a FULL refund.
// It NEVER sets `status='paid'` (a refund is not a payment; the single-writer money lock holds —
// the refund hook is NOT a paid writer). It is `import "server-only"` (never client-side, D-12).
//
// SOURCE-LEVEL gate (fee.ts / single-writer.test.ts precedent): asserts the hook module exists,
// is server-only, calls stripe.refunds.create with payment_intent + idempotencyKey, conditionally
// passes amount, and contains NO status:'paid' write.
//
// NYQUIST BASELINE (RED by design): platform/payments/refund.ts does NOT exist yet — it lands in
// Plan 05 (admin refund). Do NOT implement it to make this green — it is the Plan 05 deliverable.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REFUND_PATH = join(process.cwd(), "platform/payments/refund.ts");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function code(): string | null {
  return existsSync(REFUND_PATH) ? stripComments(readFileSync(REFUND_PATH, "utf8")) : null;
}

describe("manual refund hook: stripe.refunds.create + idempotency, never paid (OPS-04, D-12)", () => {
  it("the refund hook module exists (RED until Plan 05)", () => {
    expect(existsSync(REFUND_PATH)).toBe(true);
  });

  it("is server-only (never client-side, D-12)", () => {
    const c = code();
    if (!c) {
      expect(existsSync(REFUND_PATH), "refund.ts must exist (Plan 05)").toBe(true);
      return;
    }
    expect(/server-only/.test(c), "refund.ts must import 'server-only'").toBe(true);
  });

  it("exports refundPayment that calls stripe.refunds.create with payment_intent + idempotencyKey", () => {
    const c = code();
    if (!c) {
      expect(existsSync(REFUND_PATH), "refund.ts must exist (Plan 05)").toBe(true);
      return;
    }
    expect(/\brefundPayment\b/.test(c), "must export refundPayment").toBe(true);
    expect(/refunds\.create/.test(c), "must call stripe.refunds.create").toBe(true);
    expect(/payment_intent/.test(c), "must refund by payment_intent").toBe(true);
    expect(
      /idempotencyKey/.test(c),
      "must pass an idempotencyKey so a retried refund never double-charges (Pitfall 3)",
    ).toBe(true);
  });

  it("supports a partial amount (amountCents) and full refund when omitted", () => {
    const c = code();
    if (!c) {
      expect(existsSync(REFUND_PATH), "refund.ts must exist (Plan 05)").toBe(true);
      return;
    }
    // The hook must reference an amount/amountCents parameter (partial path); omitting it →
    // a full refund (Stripe default when `amount` is not set).
    expect(/amountCents|amount/i.test(c), "must support a partial amountCents (full when omitted)").toBe(
      true,
    );
  });

  it("NEVER writes status='paid' (a refund is not a payment — single-writer lock holds)", () => {
    const c = code();
    if (!c) {
      expect(existsSync(REFUND_PATH), "refund.ts must exist (Plan 05)").toBe(true);
      return;
    }
    expect(/status\s*:\s*['"`]paid['"`]/.test(c), "refund hook must never set status='paid'").toBe(
      false,
    );
  });
});
