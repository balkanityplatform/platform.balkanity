"use server";
// app/sign-in/actions.ts — admin magic-link send (AUTH-04 / D-01).
//
// D-01: Supabase magic-link passwordless — the SINGLE auth pattern. No password
// flow anywhere. `shouldCreateUser: false` → no open signup; the admin is seeded
// via SQL (D-02, 01-02). Light V5 input validation (plain email check; zod arrives
// Phase 3/4 at the booking/webhook trust boundary). Strings keyed to the UI-SPEC
// Copywriting Contract; resolved through the typed EN/BG dictionary (01-04) so the
// confirmation/error messages honour the current language.
import { headers } from "next/headers";
import { getDict } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";

export type SignInState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

// Conservative server-side email shape check (V5, threat T-03-05).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const t = await getDict();

  if (!email || !EMAIL_RE.test(email)) {
    // copy id: signInError
    return { status: "error", message: t.signInError };
  }

  // Derive the magic-link redirect base from a trusted, server-configured URL —
  // NOT the client-supplied `Origin` header (header-controlled redirect target in
  // the auth email, WR-04). Fall back to `Origin` only when NEXT_PUBLIC_SITE_URL is
  // unset (local dev). An empty base would yield a relative URL Supabase rejects,
  // so bail out with the sign-in error instead. (Supabase's dashboard "Redirect
  // URLs" allowlist is the server-side defense; this is defense-in-depth.)
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
  if (!base) {
    // copy id: signInError
    return { status: "error", message: t.signInError };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${base}/auth/confirm`,
    },
  });

  if (error) {
    // copy id: signInError
    return { status: "error", message: t.signInError };
  }

  // copy id: magicLinkSent
  return { status: "sent", message: t.magicLinkSent };
}
