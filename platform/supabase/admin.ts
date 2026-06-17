import "server-only";
// platform/supabase/admin.ts — SERVICE-ROLE Supabase client (SERVER-ONLY).
//
// `import "server-only"` (the FIRST line) makes `next build` FAIL if any client
// component imports this module — the build-time guarantee that the service-role key
// can never be bundled into the browser (PLAT-05, SC-4, threat T-02-01). The key is
// read from the NON-public `SUPABASE_SERVICE_ROLE_KEY` — never a `NEXT_PUBLIC_` name
// (threat T-02-02).
//
// Phase 1 has no service-role write yet; this establishes the pattern + the build guard
// for later phases (e.g. the Stripe webhook's `paid` write). Source: 01-RESEARCH Pattern 3.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
