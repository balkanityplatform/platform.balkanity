import "server-only";
// platform/payments/fee.ts — RECORDED Stripe fee, in integer cents (SC5 / D-05, BOOK-05).
//
// `import "server-only"` keeps this on the server (it reaches Stripe via the secret
// client) — a client import fails `next build` (threat T-03-ID2).
//
// The RECORDED fee is the ACTUAL fee Stripe charged, read VERBATIM from the expanded
// `latest_charge.balance_transaction.fee`. This is the persisted truth (D-05) — it is
// NOT the pre-payment display estimate `estStripeFeeCents` in commission.ts, and it is
// NEVER recomputed or rounded here.
//
// IMPORTANT (CLAUDE.md verified fact): a refund does NOT return this original
// processing fee, so it is recorded at capture time as the real cost of the transfer.
//
// Pitfall 5 guard: if `latest_charge` or `balance_transaction` is absent or left as a
// string id (not expanded), return `null` rather than throw — Phase 8 reconciliation
// backfills nulls.
import type Stripe from "stripe";

// Structural narrowing helpers — the input is an expanded PaymentIntent (or a
// structurally compatible fixture in tests). We only read what D-05 needs.
function isExpandedCharge(value: unknown): value is Stripe.Charge {
  return typeof value === "object" && value !== null && "balance_transaction" in value;
}

function isExpandedBalanceTransaction(
  value: unknown,
): value is Stripe.BalanceTransaction {
  return (
    typeof value === "object" &&
    value !== null &&
    "fee" in value &&
    typeof (value as { fee: unknown }).fee === "number"
  );
}

/**
 * Return the actual Stripe fee in integer cents from an expanded PaymentIntent's
 * `latest_charge.balance_transaction.fee`, or `null` when it is absent/unexpanded.
 *
 * The value is returned VERBATIM (no rounding, no transform) — it is the recorded
 * truth (D-05).
 */
export function recordedFeeCents(pi: unknown): number | null {
  if (typeof pi !== "object" || pi === null) return null;

  const latestCharge = (pi as { latest_charge?: unknown }).latest_charge;
  if (!isExpandedCharge(latestCharge)) return null;

  const balanceTransaction = (latestCharge as { balance_transaction?: unknown })
    .balance_transaction;
  if (!isExpandedBalanceTransaction(balanceTransaction)) return null;

  return balanceTransaction.fee;
}
