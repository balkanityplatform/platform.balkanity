"use server";
// app/forgot-password/actions.ts — self-service password reset request (AUTH-04).
//
// Calls resetPasswordForEmail with a trusted, server-configured redirect base —
// NOT the client-supplied `Origin` header (header-controlled redirect target in the
// reset email, WR-04); `Origin` is only the local-dev fallback when
// NEXT_PUBLIC_SITE_URL is unset. The reset link lands on /auth/confirm?type=recovery,
// which verifies the OTP and forwards to /set-password.
//
// ALWAYS returns the same generic "if an account exists…" message regardless of
// whether the email exists — no account enumeration (do not branch on the Supabase
// result). Copy is dictionary-keyed.
import { headers } from "next/headers";
import { getDict } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";

export type ForgotPasswordState = {
  status: "idle" | "sent";
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  const t = await getDict();

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");

  // Only fire the reset for a well-formed email AND a usable base. Either way the
  // response is the SAME generic confirmation (no enumeration, no error leak).
  if (email && EMAIL_RE.test(email) && base) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}/auth/confirm?type=recovery`,
    });
  }

  // copy id: resetEmailSent (always generic — never reveal whether the account exists)
  return { status: "sent", message: t.resetEmailSent };
}
