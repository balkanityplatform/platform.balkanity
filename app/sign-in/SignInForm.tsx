"use client";
// app/sign-in/SignInForm.tsx — client form for the magic-link sign-in (D-01).
//
// Holds the useActionState interactivity; all copy is passed in from the server
// page (already resolved through the EN/BG dictionary) so there is no flash and
// the form stays a thin client island. Auth behaviour is unchanged from 01-03 —
// it still calls the sendMagicLink server action; only the chrome is re-skinned.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { type SignInState, sendMagicLink } from "./actions";

const initialState: SignInState = { status: "idle" };

export type SignInCopy = {
  emailLabel: string;
  signInCta: string;
};

export function SignInForm({ copy }: { copy: SignInCopy }) {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  if (state.status === "sent") {
    // copy id: magicLinkSent (server-action message, dictionary-keyed)
    return (
      <p role="status" className="text-[16px] leading-[1.5] text-slate">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      <label
        htmlFor="email"
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {copy.emailLabel}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      />

      {state.status === "error" ? (
        // copy id: signInError (server-action message, dictionary-keyed)
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {copy.signInCta}
      </Button>
    </form>
  );
}
