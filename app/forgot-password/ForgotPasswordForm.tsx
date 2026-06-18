"use client";
// app/forgot-password/ForgotPasswordForm.tsx — client island for the reset request.
//
// Thin useActionState form; copy is passed in from the server page (resolved through
// the EN/BG dictionary → no flash). On submit the action always returns the same
// generic "sent" confirmation (no account enumeration), which replaces the form.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { type ForgotPasswordState, requestPasswordReset } from "./actions";

const initialState: ForgotPasswordState = { status: "idle" };

export type ForgotPasswordCopy = {
  emailLabel: string;
  sendResetCta: string;
};

export function ForgotPasswordForm({ copy }: { copy: ForgotPasswordCopy }) {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.status === "sent") {
    // copy id: resetEmailSent (generic confirmation — no enumeration)
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

      <Button type="submit" disabled={pending}>
        {copy.sendResetCta}
      </Button>
    </form>
  );
}
