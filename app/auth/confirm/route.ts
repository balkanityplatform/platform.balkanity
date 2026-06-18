// app/auth/confirm/route.ts — email-link verification (AUTH-04).
//
// The emailed link lands here and establishes a server-side session (auth cookies
// set via the @supabase/ssr server client), then redirects by link purpose:
//   - recovery / invite → /set-password (the user now has a session and must set
//     a password before continuing; /set-password role-routes on success).
//   - email / magiclink → /          (guest/legacy passwordless links; `/` role-routes).
//
// Two link shapes are supported:
//
//   (a) PKCE code flow — `?code=...`. This is what Supabase's DEFAULT email
//       template emits: `{{ .ConfirmationURL }}` hits Supabase's /auth/v1/verify,
//       which redirects back here with an auth code. Required on the free tier,
//       where the email template cannot be customised without custom SMTP.
//       Same-browser only (the PKCE code_verifier cookie is set at send time).
//       Redirects to `/` (the type is not carried on the code flow).
//   (b) token_hash flow — `?token_hash=...&type=<recovery|invite|email|magiclink>`.
//       Used once a custom email template is configured via custom SMTP / Resend
//       (Phase 7); also works cross-device.
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
  // attacker-supplied `type` verbatim (WR-03). AUTH-04 adds `recovery` (forgot
  // password) and `invite` (admin-driven account creation) alongside the legacy
  // passwordless `email`/`magiclink`. Anything else falls through to the error
  // redirect below.
  const rawType = searchParams.get("type");
  const type: EmailOtpType | null =
    rawType === "recovery" ||
    rawType === "invite" ||
    rawType === "email" ||
    rawType === "magiclink"
      ? rawType
      : null;

  // Allowlist the `next` param at this auth trust boundary — an attacker-controlled
  // `next` must NEVER be forwarded verbatim (open-redirect / WR-03, threat T-04-TMP4).
  // Only an internal status path (a UUID-shaped /status/<id>) is accepted; anything
  // else falls back to `/`. This is the booking-confirmation / re-access landing target
  // (AUTH-02 / BOOK-06 / D-07).
  const STATUS_NEXT_RE = /^\/status\/[0-9a-f-]{36}$/;
  const rawNext = searchParams.get("next");
  const validatedNext = rawNext && STATUS_NEXT_RE.test(rawNext) ? rawNext : "/";

  // recovery/invite sessions must land on the set-password screen; passwordless
  // links (email/magiclink) land on the validated `next` (the guest status page) or
  // `/` (role-routes) when no valid next was supplied.
  const verifiedDest =
    type === "recovery" || type === "invite" ? "/set-password" : validatedNext;

  const supabase = await createClient();

  // (a) Default-template PKCE flow.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Session cookies are set. magiclink guests honour the validated `next` (the
      // status page); other flows fall back to `/` which role-routes (D-03). recovery/
      // invite never reach the code branch with a status `next`, so `validatedNext`
      // is `/` for them unless explicitly a /status path — safe either way.
      return NextResponse.redirect(new URL(validatedNext, origin));
    }
  } else if (token_hash && type) {
    // (b) Custom-template token_hash flow.
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      // recovery/invite → /set-password; email/magiclink → validated `next` (or /).
      return NextResponse.redirect(new URL(verifiedDest, origin));
    }
  }

  // Verification failed or missing params → back to sign-in with an error flag.
  return NextResponse.redirect(new URL("/sign-in?error=verify", origin));
}
