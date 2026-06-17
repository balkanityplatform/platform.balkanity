// platform/auth/role.ts — server-side role resolution (AUTH-01, SC-3).
//
// THE authorization primitive. Resolves the current request's app role by
// REVALIDATING the JWT server-side via `auth.getUser()` (never the unverified
// cookie-trusting session read, which CLAUDE.md "What NOT to Use" forbids for
// authz — see 01-RESEARCH Anti-Patterns / Pitfall 5). Returns exactly one role or
// null — never an array, never a guessed default (AUTH-01 "exactly one role").
import { createClient } from "@/platform/supabase/server";

export type AppRole = "admin" | "driver" | "guest";

export async function getCurrentRole(): Promise<AppRole | null> {
  const supabase = await createClient();

  // Revalidates the JWT against Supabase Auth — the only trustworthy authz read.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return (data.role as AppRole) ?? null;
}
