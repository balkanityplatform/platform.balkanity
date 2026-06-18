// app/pay/start/route.ts — MINIMAL test-only checkout trigger (Plan 04).
//
// Phase 4 replaces this with the real guest booking form (whose own validation gates
// the charge). For now it is the smallest surface that lets the replay/forged/spoof
// gates in Plan 05 actually drive a Checkout Session against a seeded transfer.
//
// GATING (T-03-START, Task 2 acceptance — "neither gate" is NOT acceptable):
// this endpoint is guarded by a `NODE_ENV !== "production"` check. It is therefore
// NEVER reachable in production — it cannot become a public, unauthenticated charge
// surface. The chosen gate is NON-PROD-ONLY (not admin-only): the Plan 05 live gates
// run in TEST mode without an admin session, so a non-prod guard keeps the trigger
// usable there while making it inert in prod.
//
// It NEVER writes `paid` (the webhook is the sole paid writer). It only reads the
// transfer's amount and 303-redirects to Stripe's hosted Checkout URL — the
// server-redirect lock (no @stripe/stripe-js client dependency, CLAUDE.md).
import { type NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/platform/payments/checkout";
import { createAdminClient } from "@/platform/supabase/admin";

// Node runtime — mirrors the webhook + the checkout helper's server-only Stripe client.
export const runtime = "nodejs";

async function handle(req: NextRequest): Promise<NextResponse> {
  // GATE (T-03-START): inert in production. Never a public charge surface live.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const transferId = new URL(req.url).searchParams.get("t");
  if (!transferId) {
    return new NextResponse("missing transfer id", { status: 400 });
  }

  // Service-role READ of the transfer's amount (the tables have admin-read SELECT only
  // and NO write policy — this read is via the service-role client, and it writes
  // nothing). The amount is the integer-cents source of truth for the Session.
  const admin = createAdminClient();
  const { data: transfer } = await admin
    .from("wp_transfers")
    .select("id, amount_cents")
    .eq("id", transferId)
    .maybeSingle();

  if (!transfer) {
    return new NextResponse("transfer not found", { status: 404 });
  }

  const sessionUrl = await createCheckoutSession({
    transferId: transfer.id,
    amountCents: transfer.amount_cents,
  });

  if (!sessionUrl) {
    return new NextResponse("could not create checkout session", { status: 502 });
  }

  // Server 303-redirect to the hosted Checkout URL (CLAUDE.md lock — no client Stripe.js).
  return NextResponse.redirect(sessionUrl, 303);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
