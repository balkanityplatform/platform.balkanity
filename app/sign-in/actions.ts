"use server";
// app/sign-in/actions.ts — admin/driver email + password sign-in (AUTH-04).
//
// AUTH-04 (decision reversal): classic email + password LOGIN replaces the prior
// passwordless magic-link flow for admin & driver users. Account creation is
// admin-driven via Supabase invite (set-password landing); self-service reset
// lives at /forgot-password. Guests are unaffected (no login).
//
// Light V5 input validation (plain email shape + non-empty password; zod arrives
// Phase 3/4 at the booking/webhook trust boundary). Error copy is generic and
// dictionary-keyed — never leak WHICH field was wrong (account-enumeration /
// credential-probing defense). Authorization is unchanged: `/` role-redirects via
// getCurrentRole() → auth.getUser() after the session is established here.
import { redirect } from "next/navigation";
import { getDict } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";

export type SignInState = {
  status: "idle" | "error";
  message?: string;
};

// Conservative server-side email shape check (V5, threat T-03-05).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const t = await getDict();

  // Generic validation: a malformed email or empty password both surface the
  // SAME message so the form never reveals which credential was rejected.
  if (!email || !EMAIL_RE.test(email) || !password) {
    // copy id: signInError
    return { status: "error", message: t.signInError };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // copy id: signInError (generic — do NOT leak which credential was wrong).
    return { status: "error", message: t.signInError };
  }

  // Success: the session cookies are set; `/` resolves the role and routes (D-03).
  // redirect() throws NEXT_REDIRECT as control flow, so it MUST run OUTSIDE the
  // try/catch-free path above (it is — no try/catch here) and after the await.
  redirect("/");
}
