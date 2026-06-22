"use client";
// app/admin/transfers/[id]/RefundForm.tsx — manual refund form island (OPS-04, D-12).
//
// A thin useActionState form (mirrors InviteDriverForm's shape) posting to the `refund`
// Server Action. Three controls:
//   • amount — pre-filled to the FULL paid amount in euros, editable DOWN for a partial refund
//     (D-12 full/partial). Omitting/clearing it is a full refund (the action treats undefined as full).
//   • reason — required free-text audit note (D-10), recorded as last_action_reason on the row.
//   • the ALWAYS-shown refundFeeDisclosure — the ~€{fee} Stripe processing fee is NOT recovered
//     by a refund (CLAUDE.md verified fact, D-12). It renders unconditionally so an admin never
//     refunds assuming the fee returns.
//
// The submit button is DISABLED while pending (Pitfall 3 — double-submit guard; the action's
// stable idempotencyKey is the server-side backstop). On error a coral, dictionary-keyed
// role="alert" message renders inline; on success a role="status" confirmation replaces it.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { TextField } from "@/platform/ui/TextField";
import { type TransferActionState, refund } from "../actions";

const initialState: TransferActionState = { status: "idle" };

export type RefundFormCopy = {
  refundAmountLabel: string;
  actionReasonLabel: string;
  // {fee} token is substituted here with the recorded Stripe fee (in euros).
  refundFeeDisclosure: string;
  refundTransferCta: string;
  saveFailed: string;
};

export function RefundForm({
  transferId,
  fullAmountEur,
  recordedFeeEur,
  copy,
}: {
  transferId: string;
  /** The full paid amount in euros (pre-fills the amount field, editable down). */
  fullAmountEur: string;
  /** The recorded Stripe fee in euros, substituted into the disclosure {fee} token. */
  recordedFeeEur: string;
  copy: RefundFormCopy;
}) {
  const [state, formAction, pending] = useActionState(refund, initialState);

  const disclosure = copy.refundFeeDisclosure.replace("{fee}", recordedFeeEur);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-[16px] rounded-md border border-grey/30 bg-white p-[24px]"
    >
      <input type="hidden" name="id" value={transferId} />

      <TextField
        label={copy.refundAmountLabel}
        name="amount"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        defaultValue={fullAmountEur}
      />

      <TextField label={copy.actionReasonLabel} name="reason" type="text" required />

      {/* ALWAYS shown — the fee is never recovered by a refund (D-12). */}
      <p className="rounded-md bg-slate/5 px-[16px] py-[12px] text-[14px] leading-[1.4] text-grey">
        {disclosure}
      </p>

      <Button type="submit" variant="ghost" disabled={pending}>
        {copy.refundTransferCta}
      </Button>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-[14px] font-semibold leading-[1.4] text-teal">
          ✓
        </p>
      ) : null}
    </form>
  );
}
