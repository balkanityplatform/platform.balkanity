import "server-only";
// platform/supabase/admin.ts — SERVICE-ROLE Supabase client (SERVER-ONLY).
//
// `import "server-only"` (the FIRST line) makes `next build` FAIL if any client
// component imports this module — the build-time guarantee that the service-role key
// can never be bundled into the browser (PLAT-05, SC-4, threat T-02-01). The key is
// read from the NON-public `SUPABASE_SERVICE_ROLE_KEY` — never a `NEXT_PUBLIC_` name
// (threat T-02-02).
//
// The project URL is NOT a secret (it already ships to the browser as
// `NEXT_PUBLIC_SUPABASE_URL`), so we read that single source of truth here rather
// than a duplicate `SUPABASE_URL` var. The ONLY server-only secret in this module is
// the service-role KEY. A duplicated URL var is a drift foot-gun against the
// "never target Kalvia" rule and a latent runtime failure on the `paid` write path
// if left unset (CR-01).
//
// Phase 1 has no service-role write yet; this establishes the pattern + the build guard
// for later phases (e.g. the Stripe webhook's `paid` write). Source: 01-RESEARCH Pattern 3.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // URL is not secret — single source of truth
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // the ONLY server-only secret here
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
