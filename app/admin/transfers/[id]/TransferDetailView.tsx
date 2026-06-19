"use client";
// app/admin/transfers/[id]/TransferDetailView.tsx — admin transfer detail island (OPS-02, D-02).
//
// Slate console chrome. Renders the transfer's lifecycle (LifecycleTimeline, the platform-wide
// dot+label timeline — colour is NEVER the sole signal, WCAG 1.4.1) plus the trip facts (guest
// name/phone/email, arrival, airport, zone, EXACT address from the join, flight no., pax,
// luggage, notes) and the payment facts (fare from amount_cents, paid_at, the recorded Stripe
// fee, the payment-intent reference). The FIVE ops action controls (assign/reassign/release/
// cancel/refund) are laid out as LABEL-only placeholders here — their onClick/server-action
// wiring is Plan 05 (this slice is read-only). Destructive labels use the coral token.
//
// T-06-STALE: this /admin navigation is NetworkFirst at the SW layer (app/sw.ts authNetworkFirst
// matches /admin/*), so status/detail data is never stale-served from cache (Pitfall 4).
import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { LifecycleTimeline } from "@/platform/ui/LifecycleTimeline";
import { fmtEur } from "@/platform/money/commission";
import type { TransferState } from "@/platform/ui/StatusDot";

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

export function TransferDetailView({
  row,
  lang,
  copy,
}: {
  row: TransferDetail | null;
  lang: "en" | "bg";
  copy: TransferDetailCopy;
}) {
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

          {/* Ops action placeholders (LABELS only — onClick/server-action wiring is Plan 05).
              Buttons are disabled here so the read-only slice cannot mutate state. Destructive
              labels (cancel/refund/release) use the coral token. */}
          <div
            className="flex flex-wrap gap-[8px]"
            aria-label="Transfer actions (wiring arrives in a later step)"
          >
            <button
              type="button"
              disabled
              className="inline-flex min-h-[52px] items-center rounded-md bg-teal px-[16px] text-[16px] font-semibold text-white opacity-50"
            >
              {copy.assignDriverCta}
            </button>
            <button
              type="button"
              disabled
              className="inline-flex min-h-[52px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate opacity-50"
            >
              {copy.reassignDriverCta}
            </button>
            <button
              type="button"
              disabled
              className="inline-flex min-h-[52px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate opacity-50"
            >
              {copy.releaseTransferCta}
            </button>
            <button
              type="button"
              disabled
              className="inline-flex min-h-[52px] items-center rounded-md border border-coral px-[16px] text-[16px] font-semibold text-coral opacity-50"
            >
              {copy.cancelTransferCta}
            </button>
            <button
              type="button"
              disabled
              className="inline-flex min-h-[52px] items-center rounded-md border border-coral px-[16px] text-[16px] font-semibold text-coral opacity-50"
            >
              {copy.refundTransferCta}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
