import "server-only";
// platform/payments/refund.ts — SERVER-ONLY manual Stripe refund hook (OPS-04, D-12).
//
// `import "server-only"` (the FIRST line) makes `next build` FAIL if any client
// component imports this module — the Stripe SECRET key (full-account credential,
// CLAUDE.md security lock, threat T-03-ID2 / T-06-REFUND) can never reach the browser.
// Mirrors platform/payments/stripe.ts + fee.ts.
//
// CONTRACT (OPS-04, D-12, Pitfall 3):
//   • Refund BY `payment_intent` (we store `stripe_payment_intent_id` on the transfer row) —
//     never a client-trusted amount path.
//   • Pass the supplied `idempotencyKey` as the Stripe REQUEST OPTION (second arg) so a
//     retried admin click / Server-Action retry never issues a SECOND refund (Pitfall 3).
//   • `amount` is passed ONLY when a partial `amountCents` is supplied; omitting it →
//     Stripe issues a FULL refund (Stripe default when `amount` is absent — passing
//     `undefined` is NOT coerced to 0).
//   • The Stripe `reason` enum (defaults to "requested_by_customer") is DISTINCT from the
//     D-10 free-text audit reason recorded by the calling action (RESEARCH A4). This hook
//     only knows the Stripe enum.
//   • This hook NEVER writes `status='paid'` (a refund is not a payment; the single-writer
//     money lock holds — refund.ts is NOT a paid writer, see single-writer.test.ts). It
//     performs NO DB write at all; the calling action records the audit reason.
//
// IMPORTANT (CLAUDE.md verified fact): a refund does NOT return the original Stripe
// processing fee — the always-shown fee disclosure (fee.ts / recordedFeeCents) surfaces
// that to the admin (D-12).
import { getStripe } from "@/platform/payments/stripe";

export interface RefundPaymentOptions {
  /** The captured PaymentIntent id (transfer.stripe_payment_intent_id) to refund. */
  paymentIntentId: string;
  /** Partial amount in integer minor units; OMIT for a full refund (D-12). */
  amountCents?: number;
  /** Stripe refund reason enum — admin-initiated refunds map to requested_by_customer (A4). */
  reason?: "requested_by_customer";
  /** Stable key so a retried/double-clicked refund never double-charges (Pitfall 3). */
  idempotencyKey: string;
}

/**
 * Issue a full (no `amountCents`) or partial (`amountCents`) Stripe refund against a
 * captured PaymentIntent, idempotency-keyed. Returns the Stripe Refund object. NEVER
 * writes `status='paid'` and performs NO DB write — the caller records the audit reason.
 */
export async function refundPayment(opts: RefundPaymentOptions) {
  const stripe = getStripe();
  return stripe.refunds.create(
    {
      payment_intent: opts.paymentIntentId,
      // Omitted (undefined) → full refund. Passed straight (no `?? 0` coercion).
      amount: opts.amountCents,
      reason: opts.reason ?? "requested_by_customer",
    },
    { idempotencyKey: opts.idempotencyKey },
  );
}
