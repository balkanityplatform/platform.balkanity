"use client";
// app/admin/transfers/[id]/TransferDetailView.tsx — admin transfer detail + ops island (OPS-02/03/04).
//
// Slate console chrome. Renders the transfer's lifecycle (LifecycleTimeline) + trip/payment facts,
// then the FIVE wired ops controls (Plan 05):
//   • assign  — one-tap: a small inline form (driver id) posting to `assign`; NO reason (D-10).
//   • reassign/release/cancel — each behind a CONFIRM DIALOG that requires the D-10 reason note
//     (the *Confirm copy is the dialog prompt). The destructive three use the coral token.
//   • cancel additionally offers the cancelOfferRefundCta shortcut that OPENS the RefundForm — it
//     never auto-refunds (D-11).
//   • refund — opens the RefundForm (amount pre-filled full, editable down; always-shown fee
//     disclosure — D-12).
//
// Each reason action is a useActionState form inside its dialog; the submit is disabled while
// pending. Server-side, every action re-gates getCurrentRole()==='admin' (the real authz gate —
// service-role bypasses RLS). The migration-0004/0006 trigger is the state-legality backstop.
//
// T-06-STALE: this /admin navigation is NetworkFirst at the SW layer so status/detail data is
// never stale-served from cache (Pitfall 4).
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { LifecycleTimeline } from "@/platform/ui/LifecycleTimeline";
import { fmtEur } from "@/platform/money/commission";
import type { TransferState } from "@/platform/ui/StatusDot";
import {
  type TransferActionState,
  assign,
  cancel,
  reassign,
  release,
} from "../actions";
import { RefundForm } from "./RefundForm";

export type TransferDetail = {
  id: string;
  status: TransferState;
  arrival_at: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  flight_no: string | null;
  pax: number | null;
  luggage_count: number | null;
  notes: string | null;
  amount_cents: number;
  fee_cents: number | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  zone: string | null;
  airport: string | null;
  address: string | null;
};

export type TransferDetailCopy = {
  langToggle: string;
  transfersTitle: string;
  transfersEmptyHeading: string;
  transfersEmptyBody: string;
  addressLabel: string;
  zoneLabel: string;
  airportLabel: string;
  emailLabel: string;
  assignDriverCta: string;
  reassignDriverCta: string;
  releaseTransferCta: string;
  cancelTransferCta: string;
  refundTransferCta: string;
  // Ops dialog copy (D-10/D-11/D-12).
  actionReasonLabel: string;
  refundAmountLabel: string;
  refundFeeDisclosure: string;
  cancelOfferRefundCta: string;
  cancelTransferConfirm: string;
  refundConfirm: string;
  reassignConfirm: string;
  releaseConfirm: string;
  transferDriverIdLabel: string;
  confirmActionCta: string;
  cancelCta: string;
  fieldRequired: string;
  saveFailed: string;
};

function fmtDateTime(iso: string | null, lang: "en" | "bg"): string {
  if (!iso) return "—";
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <dt className="text-[14px] font-semibold leading-[1.4] text-grey">{label}</dt>
      <dd className="text-[16px] leading-[1.5] text-slate">{value ?? "—"}</dd>
    </div>
  );
}

const initialState: TransferActionState = { status: "idle" };

// A confirm dialog that REQUIRES the D-10 reason note before submitting a reason-action
// (reassign/release/cancel). `extraField` lets reassign add the driver-id input. The submit is
// disabled while pending (no double-submit). On success the dialog closes.
function ReasonDialog({
  action,
  transferId,
  prompt,
  reasonLabel,
  confirmCta,
  dismissCta,
  destructive,
  extraField,
  onDone,
}: {
  action: (
    prev: TransferActionState,
    formData: FormData,
  ) => Promise<TransferActionState>;
  transferId: string;
  prompt: string;
  reasonLabel: string;
  confirmCta: string;
  dismissCta: string;
  destructive: boolean;
  extraField?: React.ReactNode;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  // Close on success (the revalidatePath in the action refreshes the row). Run in an effect so
  // we never call the parent's setState during this component's render.
  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state.status, onDone]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="flex flex-col gap-[12px] rounded-md border border-grey/30 bg-white p-[16px]"
    >
      <p className="text-[16px] leading-[1.5] text-slate">{prompt}</p>
      <form action={formAction} className="flex flex-col gap-[12px]">
        <input type="hidden" name="id" value={transferId} />
        {extraField}
        <label className="flex flex-col gap-[8px]">
          <span className="text-[14px] font-semibold leading-[1.4] text-slate">
            {reasonLabel}
          </span>
          <input
            name="reason"
            type="text"
            required
            className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          />
        </label>
        <div className="flex flex-wrap gap-[8px]">
          <button
            type="submit"
            disabled={pending}
            className={`inline-flex min-h-[52px] items-center rounded-md px-[16px] text-[16px] font-semibold text-white disabled:opacity-50 ${
              destructive ? "bg-coral" : "bg-teal"
            }`}
          >
            {confirmCta}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-[52px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate"
          >
            {dismissCta}
          </button>
        </div>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-[14px] leading-[1.4] text-coral">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

// One-tap assign: a small inline form (driver id) posting to `assign`. No reason (D-10).
function AssignForm({
  transferId,
  driverIdLabel,
  confirmCta,
  copy,
}: {
  transferId: string;
  driverIdLabel: string;
  confirmCta: string;
  copy: TransferDetailCopy;
}) {
  const [state, formAction, pending] = useActionState(assign, initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-[8px]">
      <input type="hidden" name="id" value={transferId} />
      <label className="flex flex-col gap-[8px]">
        <span className="text-[14px] font-semibold leading-[1.4] text-slate">
          {driverIdLabel}
        </span>
        <input
          name="driverId"
          type="text"
          required
          className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-[52px] items-center rounded-md bg-teal px-[16px] text-[16px] font-semibold text-white disabled:opacity-50"
      >
        {confirmCta}
      </button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="w-full text-[14px] leading-[1.4] text-coral">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

type OpenPanel =
  | "none"
  | "assign"
  | "reassign"
  | "release"
  | "cancel"
  | "refund";

export function TransferDetailView({
  row,
  lang,
  copy,
}: {
  row: TransferDetail | null;
  lang: "en" | "bg";
  copy: TransferDetailCopy;
}) {
  const [panel, setPanel] = useState<OpenPanel>("none");
  const close = () => setPanel("none");

  const recordedFeeEur = row?.fee_cents != null ? fmtEur(row.fee_cents) : "0.00";
  const fullAmountEur = row ? fmtEur(row.amount_cents) : "0.00";

  return (
    <main className="min-h-dvh bg-white">
      {/* Slate console chrome. */}
      <header className="flex items-center justify-between bg-slate px-[24px] py-[16px]">
        <Link
          href="/admin/transfers"
          className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </Link>
        <LanguageToggle current={lang} label={copy.langToggle} className="text-white" />
      </header>

      {row === null ? (
        <section className="mx-auto flex max-w-2xl flex-col gap-[8px] px-[24px] py-[48px]">
          <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
            {copy.transfersEmptyHeading}
          </h1>
          <p className="text-[16px] leading-[1.5] text-grey">{copy.transfersEmptyBody}</p>
          <Link
            href="/admin/transfers"
            className="mt-[16px] inline-flex min-h-[44px] w-fit items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate hover:bg-slate/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            {copy.transfersTitle}
          </Link>
        </section>
      ) : (
        <section className="mx-auto flex max-w-2xl flex-col gap-[32px] px-[24px] py-[48px]">
          <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
            {row.guest_name ?? copy.transfersTitle}
          </h1>

          {/* Lifecycle timeline (D-02). */}
          <div className="flex flex-col gap-[16px]">
            <LifecycleTimeline current={row.status} />
          </div>

          {/* Trip facts. */}
          <dl className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
            <Fact label={copy.emailLabel} value={row.guest_email} />
            <Fact label="Phone" value={row.guest_phone} />
            <Fact label="Arrival" value={fmtDateTime(row.arrival_at, lang)} />
            <Fact label="Flight" value={row.flight_no} />
            <Fact label={copy.airportLabel} value={row.airport} />
            <Fact label={copy.zoneLabel} value={row.zone} />
            <Fact label={copy.addressLabel} value={row.address} />
            <Fact
              label="Passengers"
              value={row.pax != null ? String(row.pax) : null}
            />
            <Fact
              label="Luggage"
              value={row.luggage_count != null ? String(row.luggage_count) : null}
            />
            <Fact label="Notes" value={row.notes} />
          </dl>

          {/* Payment facts. */}
          <dl className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
            <Fact label="Fare" value={`${fmtEur(row.amount_cents)} €`} />
            <Fact
              label="Stripe fee"
              value={row.fee_cents != null ? `${fmtEur(row.fee_cents)} €` : null}
            />
            <Fact label="Paid at" value={fmtDateTime(row.paid_at, lang)} />
            <Fact label="Payment intent" value={row.stripe_payment_intent_id} />
          </dl>

          {/* Ops actions (Plan 05 wiring). Destructive controls use the coral token; the
              reason-gated three open a confirm dialog requiring the D-10 reason note. */}
          <div className="flex flex-wrap gap-[8px]" aria-label="Transfer actions">
            <button
              type="button"
              onClick={() => setPanel(panel === "assign" ? "none" : "assign")}
              className="inline-flex min-h-[52px] items-center rounded-md bg-teal px-[16px] text-[16px] font-semibold text-white"
            >
              {copy.assignDriverCta}
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "reassign" ? "none" : "reassign")}
              className="inline-flex min-h-[52px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate"
            >
              {copy.reassignDriverCta}
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "release" ? "none" : "release")}
              className="inline-flex min-h-[52px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate"
            >
              {copy.releaseTransferCta}
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}
              className="inline-flex min-h-[52px] items-center rounded-md border border-coral px-[16px] text-[16px] font-semibold text-coral"
            >
              {copy.cancelTransferCta}
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "refund" ? "none" : "refund")}
              className="inline-flex min-h-[52px] items-center rounded-md border border-coral px-[16px] text-[16px] font-semibold text-coral"
            >
              {copy.refundTransferCta}
            </button>
          </div>

          {/* Open panel (one at a time). */}
          {panel === "assign" ? (
            <AssignForm
              transferId={row.id}
              driverIdLabel={copy.transferDriverIdLabel}
              confirmCta={copy.assignDriverCta}
              copy={copy}
            />
          ) : null}

          {panel === "reassign" ? (
            <ReasonDialog
              action={reassign}
              transferId={row.id}
              prompt={copy.reassignConfirm}
              reasonLabel={copy.actionReasonLabel}
              confirmCta={copy.confirmActionCta}
              dismissCta={copy.cancelCta}
              destructive={false}
              extraField={
                <label className="flex flex-col gap-[8px]">
                  <span className="text-[14px] font-semibold leading-[1.4] text-slate">
                    {copy.transferDriverIdLabel}
                  </span>
                  <input
                    name="driverId"
                    type="text"
                    required
                    className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  />
                </label>
              }
              onDone={close}
            />
          ) : null}

          {panel === "release" ? (
            <ReasonDialog
              action={release}
              transferId={row.id}
              prompt={copy.releaseConfirm}
              reasonLabel={copy.actionReasonLabel}
              confirmCta={copy.confirmActionCta}
              dismissCta={copy.cancelCta}
              destructive={false}
              onDone={close}
            />
          ) : null}

          {panel === "cancel" ? (
            <div className="flex flex-col gap-[12px]">
              <ReasonDialog
                action={cancel}
                transferId={row.id}
                prompt={copy.cancelTransferConfirm}
                reasonLabel={copy.actionReasonLabel}
                confirmCta={copy.confirmActionCta}
                dismissCta={copy.cancelCta}
                destructive
                onDone={close}
              />
              {/* D-11: cancel NEVER auto-refunds — it only OFFERS the refund shortcut. */}
              <button
                type="button"
                onClick={() => setPanel("refund")}
                className="inline-flex min-h-[44px] w-fit items-center rounded-md border border-coral px-[16px] text-[16px] font-semibold text-coral"
              >
                {copy.cancelOfferRefundCta}
              </button>
            </div>
          ) : null}

          {panel === "refund" ? (
            <RefundForm
              transferId={row.id}
              fullAmountEur={fullAmountEur}
              recordedFeeEur={recordedFeeEur}
              copy={{
                refundAmountLabel: copy.refundAmountLabel,
                actionReasonLabel: copy.actionReasonLabel,
                refundFeeDisclosure: copy.refundFeeDisclosure,
                refundTransferCta: copy.refundTransferCta,
                saveFailed: copy.saveFailed,
              }}
            />
          ) : null}
        </section>
      )}
    </main>
  );
}
