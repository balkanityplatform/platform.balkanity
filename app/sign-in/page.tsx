"use client";
// app/sign-in/page.tsx — admin magic-link sign-in form (AUTH-04 / D-01).
//
// Passwordless: an email field + "Send magic link" CTA wired to the sendMagicLink
// server action. On success shows the "Check your email…" confirmation. Copy is the
// EN canonical from the UI-SPEC Copywriting Contract, inline now and keyed to the
// same ids the typed EN/BG dictionary will adopt in 01-04. Plain markup — the styled
// 52px Button + tokens land in 01-04; this uses the same copy ids meanwhile.
import { useActionState } from "react";
import { type SignInState, sendMagicLink } from "./actions";

const initialState: SignInState = { status: "idle" };

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <main>
      <h1>Sign in</h1>

      {state.status === "sent" ? (
        // copy id: magicLinkSent
        <p role="status">{state.message}</p>
      ) : (
        <form action={formAction}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />

          {state.status === "error" ? (
            // copy id: signInError
            <p role="alert">{state.message}</p>
          ) : null}

          <button type="submit" disabled={pending}>
            Send magic link
          </button>
        </form>
      )}
    </main>
  );
}
