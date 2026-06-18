"use client";
// app/set-password/SetPasswordForm.tsx — client island for setting a new password.
//
// Thin useActionState form; copy is passed in from the server page (resolved through
// the EN/BG dictionary → no flash). On success the action redirects to `/`
// (role-routes), so there is no success branch here — only the generic error state.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { type SetPasswordState, setPassword } from "./actions";

const initialState: SetPasswordState = { status: "idle" };

export type SetPasswordCopy = {
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  setPasswordCta: string;
};

export function SetPasswordForm({ copy }: { copy: SetPasswordCopy }) {
  const [state, formAction, pending] = useActionState(
    setPassword,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      <label
        htmlFor="password"
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {copy.newPasswordLabel}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      />

      <label
        htmlFor="confirm"
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {copy.confirmPasswordLabel}
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      />

      {state.status === "error" ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {copy.setPasswordCta}
      </Button>
    </form>
  );
}
