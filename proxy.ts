// proxy.ts — Next 16 request-boundary session refresh (renamed from middleware.ts).
//
// INTENTIONAL DEVIATION from CLAUDE.md's "middleware.ts at repo root": Next 16
// deprecated `middleware.ts` → `proxy.ts` (function export `proxy`). Functionally
// identical; this is the current convention (01-RESEARCH A1 / SOTA).
//
// Refreshes the Supabase auth session on EVERY request so magic-link sessions stay
// valid and SSR sees the signed-in user. Uses `getClaims()` (fast local JWT verify)
// for the refresh path; the authz decision still uses `auth.getUser()` in
// platform/auth/role.ts. Place NO logic between createServerClient and getClaims —
// the official Supabase warning: anything in between causes random logouts.
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: no code between createServerClient (above) and getClaims (here).
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Run on all paths except static assets, image optimizer, favicon and the
  // service worker — these never carry an auth session to refresh.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
