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

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    // copy id: signInError
    return { status: "error", message: t.signInError };
  }

  // copy id: magicLinkSent
  return { status: "sent", message: t.magicLinkSent };
}
