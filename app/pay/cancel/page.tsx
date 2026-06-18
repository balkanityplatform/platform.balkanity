// app/pay/cancel/page.tsx — DISPLAY-ONLY "payment cancelled" page (Pitfall 3).
//
// Stripe redirects here (`/pay/cancel?t=<transfer-id>`) when the guest abandons
// Checkout. Like the success page, it is display-only: it READS the transfer status and
// NEVER writes anything (it certainly never writes `paid` — the webhook is the sole paid
// writer). Cancelling Checkout leaves the transfer in its pre-payment (unpaid) state.
import { createAdminClient } from "@/platform/supabase/admin";

// Server component — the service-role admin client is server-only.
export const runtime = "nodejs";

type SearchParams = Promise<{ t?: string }>;

export default async function PayCancelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t: transferId } = await searchParams;

  // Service-role READ (display only — no write of any kind on this path).
  let status: string | null = null;
  if (transferId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("wp_transfers")
      .select("status")
      .eq("id", transferId)
      .maybeSingle();
    status = data?.status ?? null;
  }

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Payment cancelled</h1>
      <p>Your payment was not completed.</p>
      {status ? <p>Current status: {status}.</p> : null}
    </main>
  );
}
