// platform/supabase/client.ts — BROWSER Supabase client (anon / publishable key).
//
// The browser bundle may ONLY ever hold the publishable/anon-tier key; RLS is the
// row boundary. The service-role key lives in admin.ts behind `import "server-only"`
// and never reaches this module (PLAT-05).
//
// Source: vercel/next.js examples/with-supabase/lib/supabase/client.ts (01-RESEARCH Pattern 2).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
