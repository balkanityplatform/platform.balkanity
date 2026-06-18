"use client";
// app/track/TrackForm.tsx — client island for the status re-access request (D-07).
//
// Thin useActionState form; copy is resolved server-side and passed in (no flash). On
// submit the action ALWAYS returns the same neutral success (no account enumeration),
// which replaces the form. A validation error surfaces the generic error copy inline.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { TextField } from "@/platform/ui/TextField";
import { requestStatusLink, type TrackState } from "./actions";

const initialState: TrackState = { status: "idle" };

export type TrackCopy = {
  emailLabel: string;
  sendCta: string;
};

export function TrackForm({ copy }: { copy: TrackCopy }) {
  const [state, formAction, pending] = useActionState(
    requestStatusLink,
    initialState,
  );

  if (state.status === "ok") {
    // Neutral success — never reveals whether the email had a booking.
    return (
      <p role="status" className="text-[16px] leading-[1.5] text-slate">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      <TextField
        name="email"
        type="email"
        label={copy.emailLabel}
        autoComplete="email"
        required
        error={state.status === "error" ? state.message : undefined}
      />
      <Button type="submit" disabled={pending}>
        {copy.sendCta}
      </Button>
    </form>
  );
}
