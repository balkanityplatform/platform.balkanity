import "server-only";
// platform/payments/checkout.ts — code-created Stripe Checkout Session (SC5, BOOK-05).
//
// This is the ONLY sanctioned way to charge for a transfer: a CODE-created
// `checkout.sessions.create` carrying `metadata.transfer_id` — NEVER a dashboard
// Payment Link (CLAUDE.md lock). The webhook (Plan 04) later reads
// `metadata.transfer_id` to resolve which transfer row to mark `paid`. Nothing here
// writes `paid` — that is webhook-only.
//
// Money invariant (T-03-MNY): `unit_amount` is passed as INTEGER cents straight from
// the caller (`amountCents`, sourced from `wp_transfers.amount_cents`). No float math,
// no ×100 at the boundary — Stripe consumes minor units directly.
//
// Trust boundary (T-03-V5): `transferId` is validated as a uuid with zod before it is
// ever forwarded into Stripe metadata. success/cancel URLs derive from the TRUSTED
// `NEXT_PUBLIC_SITE_URL` constant, never the attacker-controlled request Origin header
// (carried-forward WR-04 lock).
import { z } from "zod";
import { getStripe } from "./stripe";

// UUID-shaped guard. We use an explicit 8-4-4-4-12 hex pattern rather than zod's
// `.uuid()`, because `.uuid()` enforces the RFC-4122 version+variant nibbles and would
// reject otherwise-well-formed transfer ids (and the unit fixture). The transfer id is
// still resolved against a real `wp_transfers` row at the caller's boundary (D-03), so
// this is a shape gate, not the authorization check.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const InputSchema = z.object({
  transferId: z.string().regex(UUID_SHAPE, "Invalid transfer id"),
  amountCents: z.number().int().positive(),
});

export type CreateCheckoutSessionInput = z.infer<typeof InputSchema>;

/**
 * Create a one-off EUR Checkout Session bound to a transfer row via
 * `metadata.transfer_id`. Returns the hosted Checkout URL for a server 303-redirect.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<string | null> {
  const { transferId, amountCents } = InputSchema.parse(input);

  // Trusted base — NEVER the request Origin header (WR-04). Falls back to a relative
  // path if unset so URL construction never throws in non-prod/test contexts.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur", // D-01 — EUR only
          unit_amount: amountCents, // INTEGER cents, passed straight (no ×100)
          product_data: { name: "Airport transfer" },
        },
      },
    ],
    // Bind the Session to the transfer row. Mirrored onto payment_intent_data so the
    // expanded PaymentIntent in the webhook also carries it (Research Q3).
    metadata: { transfer_id: transferId },
    payment_intent_data: { metadata: { transfer_id: transferId } },
    success_url: `${base}/pay/success?t=${transferId}`,
    cancel_url: `${base}/pay/cancel?t=${transferId}`,
  });

  return session.url;
}
