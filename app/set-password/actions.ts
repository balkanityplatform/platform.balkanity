"use server";
// app/set-password/actions.ts — set/change password (shared invite + recovery, AUTH-04).
//
// Requires an active session (established by /auth/confirm verifying the invite or
// recovery OTP). Re-checks auth.getUser() server-side (revalidates the JWT — never
// trust the cookie alone) before mutating: a logged-out caller is bounced to
// /sign-in rather than silently no-op'ing. Validates the two fields match and meet
// a minimum length, then updateUser({ password }). On success redirect("/") (called
// OUTSIDE try/catch so NEXT_REDIRECT control flow isn't swallowed). Errors are
// generic and dictionary-keyed.
import { redirect } from "next/navigation";
import { getDict } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";

export type SetPasswordState = {
  status: "idle" | "error";
  message?: string;
};

const MIN_PASSWORD_LENGTH = 8;

export async function setPassword(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const t = await getDict();

  if (password.length < MIN_PASSWORD_LENGTH) {
    // copy id: passwordTooShort
    return { status: "error", message: t.passwordTooShort };
  }

  if (password !== confirm) {
    // copy id: passwordMismatch
    return { status: "error", message: t.passwordMismatch };
  }

  const supabase = await createClient();

  // Re-validate the session server-side (auth.getUser, not getSession) — the
  // password write must belong to a genuinely authenticated invite/recovery
  // session, never an unauthenticated caller hitting the action directly.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // copy id: signInError (generic — session expired / not signed in)
    return { status: "error", message: t.signInError };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // copy id: signInError (generic — do not leak provider error detail)
    return { status: "error", message: t.signInError };
  }

  // Success: session already established; `/` resolves the role and routes (D-03).
  redirect("/");
}
