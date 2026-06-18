// app/auth/confirm/route.ts — magic-link verification (AUTH-04 / D-01).
//
// The emailed link lands here and establishes a server-side session (auth cookies
// set via the @supabase/ssr server client), then redirects to `/`, which
// role-redirects (Task 3). Two link shapes are supported:
//
//   (a) PKCE code flow — `?code=...`. This is what Supabase's DEFAULT email
//       template emits: `{{ .ConfirmationURL }}` hits Supabase's /auth/v1/verify,
//       which redirects back here with an auth code. Required on the free tier,
//       where the email template cannot be customised without custom SMTP.
//       Same-browser only (the PKCE code_verifier cookie is set at send time).
//   (b) token_hash flow — `?token_hash=...&type=email`. Used once a custom email
//       template (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`)
//       is configured via custom SMTP / Resend (Phase 7); also works cross-device.
//
// On failure or missing params, bounce back to /sign-in with an error flag.
// Node runtime — Supabase auth cookie handling.
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/platform/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");

  // Allowlist the OTP type at this auth trust boundary — never forward an
  // attacker-supplied `type` verbatim. This admin-only magic-link flow only
  // ever uses passwordless email links, so accept only `email`/`magiclink`
  // (WR-03). Anything else falls through to the error redirect below.
  const rawType = searchParams.get("type");
  const type: EmailOtpType | null =
    rawType === "email" || rawType === "magiclink" ? rawType : null;

  const supabase = await createClient();

  // (a) Default-template PKCE flow.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Session cookies are set; let `/` resolve the role and redirect (D-03).
      return NextResponse.redirect(new URL("/", origin));
    }
  } else if (token_hash && type) {
    // (b) Custom-template token_hash flow.
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  // Verification failed or missing params → back to sign-in with an error flag.
  return NextResponse.redirect(new URL("/sign-in?error=verify", origin));
}
