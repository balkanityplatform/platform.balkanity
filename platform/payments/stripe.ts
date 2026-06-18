import "server-only";
// platform/payments/stripe.ts — SERVER-ONLY Stripe client factory.
//
// `import "server-only"` (the FIRST line) makes `next build` FAIL if any client
// component imports this module — the build-time guarantee that the Stripe SECRET
// key can never be bundled into the browser (CLAUDE.md security lock, threat
// T-03-ID2). Mirrors the service-role boundary in platform/supabase/admin.ts.
//
// The key is read from the NON-public `STRIPE_SECRET_KEY` — never a `NEXT_PUBLIC_`
// name. The Stripe SECRET key is a full-account credential; exposing it client-side
// would let anyone create charges/refunds.
//
// API version is PINNED to "2026-05-27.dahlia" (D-02). The installed stripe@22.2.x
// typings expose `apiVersion?: string` (LatestApiVersion = "2026-05-27.dahlia"), so
// the literal type-checks with no cast — no `as any` needed.
//
// New-per-call (no module-global cache): matches the admin.ts posture and the
// repo's server.ts warning against module-global caching under Vercel Fluid-compute.
import Stripe from "stripe";

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-05-27.dahlia",
  });
}

// Alias kept in sync with the unit-test mock surface (checkout.test.ts mocks both
// getStripe and createStripeClient) so either import name resolves the same client.
export const createStripeClient = getStripe;
