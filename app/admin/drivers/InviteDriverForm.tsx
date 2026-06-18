"use client";
// app/admin/drivers/InviteDriverForm.tsx — invite-driver island (ONBD-05 / D-01 / D-04).
//
// Thin useActionState form mirroring ForgotPasswordForm's success-replaces-form
// shape: three fields (email + name + phone, D-02) post to inviteDriver. On
// status:"ok" the form is REPLACED by a role="status" block that reveals the
// returned set-password actionLink in a read-only field with a copy button and the
// delivery note — NO email is sent in Phase 2 (D-03 stub / D-04 manual delivery).
// On status:"error" a coral, dictionary-keyed message renders inline.
import { useActionState, useRef, useState } from "react";
import { Button } from "@/platform/ui/Button";
import { TextField } from "@/platform/ui/TextField";
import { type InviteDriverState, inviteDriver } from "./actions";

const initialState: InviteDriverState = { status: "idle" };

export type InviteDriverCopy = {
  emailLabel: string;
  driverNameLabel: string;
  driverPhoneLabel: string;
  generateInviteLinkCta: string;
  inviteLinkDeliveryNote: string;
  inviteLinkCopyCta: string;
  fieldRequired: string;
  saveFailed: string;
};

export function InviteDriverForm({ copy }: { copy: InviteDriverCopy }) {
  const [state, formAction, pending] = useActionState(
    inviteDriver,
    initialState,
  );
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  // Success: reveal the copy-paste set-password link + delivery note (D-04). The
  // form is gone — the admin's next action is to copy the link and hand it off.
  if (state.status === "ok" && state.actionLink) {
    const link = state.actionLink;

    async function copyLink() {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        // Clipboard API unavailable (e.g. insecure context) — fall back to
        // selecting the field so the admin can copy manually.
        linkRef.current?.select();
      }
    }

    return (
      <div
        role="status"
        className="flex flex-col gap-[12px] rounded-md border border-grey/30 bg-white p-[16px]"
      >
        <p className="text-[16px] leading-[1.5] text-slate">
          {copy.inviteLinkDeliveryNote}
        </p>
        <div className="flex flex-col gap-[8px] sm:flex-row sm:items-center">
          <input
            ref={linkRef}
            readOnly
            value={link}
            aria-label={copy.inviteLinkDeliveryNote}
            onFocus={(e) => e.currentTarget.select()}
            className="h-[52px] flex-1 rounded-md border border-grey/40 px-[16px] text-[14px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          />
          <Button type="button" variant="ghost" onClick={copyLink}>
            {copy.inviteLinkCopyCta}
          </Button>
        </div>
        {copied ? (
          <p className="text-[14px] leading-[1.4] text-teal">
            {/* terse, non-dictionary confirmation that the copy succeeded */}
            ✓
          </p>
        ) : null}
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
