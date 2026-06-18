// app/pay/success/page.tsx — DISPLAY-ONLY post-Checkout page (BOOK-05, Pitfall 3, SC2).
//
// Stripe redirects the guest here (`/pay/success?t=<transfer-id>`) AFTER Checkout. That
// redirect is SPOOFABLE — anyone can open this URL directly without paying — so this
// page MUST be display-only: it READS the transfer status and NEVER writes `paid`. The
// ONLY writer of `paid` is the signature-verified webhook (single-writer gate). A guest
// who hits this URL before (or instead of) the webhook firing sees the NON-paid status.
//
// Enforced by:
//   - the source-level single-writer grep gate (this file adds no paid-status write),
//   - the success-spoof e2e (tests/e2e/success-spoof.spec.ts): a direct hit with no
//     webhook must NOT render the word "paid". Hence the literal "Paid" receipt line is
//     emitted ONLY inside the `status === "paid"` branch — never for an unpaid transfer.
import { fmtEur } from "@/platform/money/commission";
import { createAdminClient } from "@/platform/supabase/admin";

// Server component (no "use client") — the service-role admin client is server-only.
export const runtime = "nodejs";

type SearchParams = Promise<{ t?: string }>;

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t: transferId } = await searchParams;

  // Service-role READ (display only — no write of any kind on this path).
  let status: string | null = null;
  let amountCents: number | null = null;
  let paidAt: string | null = null;

  if (transferId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("wp_transfers")
      .select("status, amount_cents, paid_at")
      .eq("id", transferId)
      .maybeSingle();
    if (data) {
      status = data.status;
      amountCents = data.amount_cents;
      paidAt = data.paid_at;
    }
  }

  const isPaid = status === "paid";

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Transfer payment</h1>
      {!transferId ? (
        <p>No transfer reference provided.</p>
      ) : status === null ? (
        <p>We could not find that transfer.</p>
      ) : isPaid ? (
        // The ONLY place the word "Paid" is rendered — guarded by the real status.
        <p>
          Paid EUR {amountCents !== null ? fmtEur(amountCents) : ""}
          {paidAt ? ` on ${paidAt}` : ""}.
        </p>
      ) : (
        // Un-paid (e.g. "requested"): show the pending status. No "paid" affordance —
        // the webhook has not (yet) confirmed this payment (SC2 spoof gate).
        <p>Payment status: {status}. We are confirming your payment.</p>
      )}
    </main>
  );
}
