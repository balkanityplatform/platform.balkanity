"use client";
// app/sign-in/SignInForm.tsx — client form for email + password sign-in (AUTH-04).
//
// Holds the useActionState interactivity; all copy is passed in from the server
// page (already resolved through the EN/BG dictionary) so there is no flash and
// the form stays a thin client island. On success the server action redirects to
// `/` (role-routes), so there is no "sent"/success branch to render here — only
// the generic error state.
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { type SignInState, signIn } from "./actions";

const initialState: SignInState = { status: "idle" };

export type SignInCopy = {
  emailLabel: string;
  passwordLabel: string;
  signInCta: string;
  forgotPasswordLink: string;
};

export function SignInForm({ copy }: { copy: SignInCopy }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

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

      <label
        htmlFor="password"
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {copy.passwordLabel}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
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

      <Link
        href="/forgot-password"
        className="text-[14px] font-semibold leading-[1.4] text-teal underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        {copy.forgotPasswordLink}
      </Link>
    </form>
  );
}
