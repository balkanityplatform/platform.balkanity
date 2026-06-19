"use client";
// app/admin/drivers/InviteDriverForm.tsx — invite-driver island (ONBD-05 / D-01 / D-14).
//
// Thin useActionState form mirroring ForgotPasswordForm's success-replaces-form
// shape: three fields (email + name + phone, D-02) post to inviteDriver. On
// status:"ok" the form is REPLACED by a role="status" confirmation that the invite
// was EMAILED to the driver (D-14 — the set-password link is sent via Resend, never
// revealed/copied here; there is no actionLink in state). On status:"error" a coral,
// dictionary-keyed message renders inline.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { TextField } from "@/platform/ui/TextField";
import { type InviteDriverState, inviteDriver } from "./actions";

const initialState: InviteDriverState = { status: "idle" };

export type InviteDriverCopy = {
  emailLabel: string;
  driverNameLabel: string;
  driverPhoneLabel: string;
  generateInviteLinkCta: string;
  inviteEmailSentNote: string;
  fieldRequired: string;
  saveFailed: string;
};

export function InviteDriverForm({ copy }: { copy: InviteDriverCopy }) {
  const [state, formAction, pending] = useActionState(
    inviteDriver,
    initialState,
  );

  // Success: confirm the invite was emailed (D-14). The form is gone — the link was
  // sent to the driver's inbox; nothing to copy/reveal here.
  if (state.status === "ok") {
    return (
      <div
        role="status"
        className="flex flex-col gap-[12px] rounded-md border border-grey/30 bg-white p-[16px]"
      >
        <p className="text-[16px] leading-[1.5] text-slate">
          {copy.inviteEmailSentNote}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      <TextField
        label={copy.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <TextField
        label={copy.driverNameLabel}
        name="name"
        type="text"
        autoComplete="name"
        required
      />
      <TextField
        label={copy.driverPhoneLabel}
        name="phone"
        type="tel"
        autoComplete="tel"
      />

      <Button type="submit" disabled={pending}>
        {copy.generateInviteLinkCta}
      </Button>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
