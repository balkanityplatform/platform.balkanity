// app/auth/confirm/route.ts — magic-link verification (AUTH-04 / D-01).
//
// The emailed link points here (Supabase Auth email template must be set to
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` — dashboard
// config, NOT code). Exchanges the token_hash for a server-side session via
// verifyOtp (sets the auth cookies through the @supabase/ssr server client), then
// redirects to `/`, which role-redirects (Task 3). On failure, bounce back to
// /sign-in with an error flag. Node runtime — Supabase auth cookie handling.
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/platform/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");

  // Allowlist the OTP type at this auth trust boundary — never forward an
  // attacker-supplied `type` verbatim. This admin-only magic-link flow only
  // ever uses passwordless email links, so accept only `email`/`magiclink`
  // (WR-03). Anything else falls through to the error redirect below.
  const rawType = searchParams.get("type");
  const type: EmailOtpType | null =
    rawType === "email" || rawType === "magiclink" ? rawType : null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      // Session cookies are set; let `/` resolve the role and redirect (D-03).
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  // Verification failed or missing params → back to sign-in with an error flag.
  return NextResponse.redirect(new URL("/sign-in?error=verify", origin));
}
