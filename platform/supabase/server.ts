// platform/supabase/server.ts — SERVER Supabase client (anon, cookie-bound).
//
// Uses the anon/publishable key — same trust tier as the browser client — but reads
// and writes the auth-session cookies so SSR sees the signed-in user. Authorization
// decisions MUST call `auth.getUser()` (revalidates the JWT server-side); never the
// cookie-trusting session read (which is unverified). See 01-RESEARCH Pattern 2 / Pitfall 5.
//
// Create a NEW client per call — do NOT cache in a module global (Vercel Fluid-compute
// caveat). Source: vercel/next.js examples/with-supabase/lib/supabase/server.ts.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when proxy.ts
            // refreshes sessions (01-03). The set would otherwise throw because
            // a Server Component cannot mutate cookies after the response starts.
          }
        },
      },
    },
  );
}
