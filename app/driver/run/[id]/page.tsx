// app/driver/run/[id]/page.tsx — driver transfer detail RSC (CLAIM-04, post-claim PII).
//
// This is the WIN-LANDING target from the Plan-02 pool claim: once a driver claims a transfer the
// island navigates here, and the full post-claim detail renders. Server-guarded
// (getCurrentRole()==='driver' → /sign-in). The single own row is read on the ANON cookie-bound
// client so the claiming-driver RLS (wp_transfers_claimed_driver_read, migration 0005) is the
// data gate — NOT the service-role client. The row is therefore returned ONLY if this driver owns
// the claim (driver_id = auth.uid()); full guest PII (name, phone, exact address, notes) is
// legitimately visible because the driver owns the claim and needs it to fulfil the run.
//
// CLAIM-04: there is deliberately no give-back / release control on this page — once a driver
// owns a claim it stays theirs.
import { notFound, redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
import { RouteMotif } from "@/platform/ui/RouteMotif";
import { PlaneIcon, BuildingIcon } from "@/app/(guest)/_pass/icons";
import type { TransferState } from "@/platform/ui/StatusDot";
import { fmtEur } from "@/platform/money/commission";
import { DetailView } from "./DetailView";

type DetailRow = {
  id: string;
  status: string;
  arrival_at: string;
  guest_name: string | null;
  guest_phone: string | null;
  flight_no: string | null;
  notes: string | null;
  amount_cents: number;
  pax: number | null;
  luggage_count: number | null;
  destinations: {
    address: string | null;
    zone: string | null;
    airport: string | null;
  } | null;
};

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-grey">
        {label}
      </span>
      <span className="text-[16px] leading-[1.4] text-slate">{value}</span>
    </div>
  );
}

export default async function DriverTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if ((await getCurrentRole()) !== "driver") {
    redirect("/sign-in");
  }

  const { id } = await params;
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound read — the claiming-driver RLS returns the row ONLY if this driver owns it.
  const supabase = await createClient();
  const { data } = await supabase
    .from("wp_transfers")
    .select(
      "id,status,arrival_at,guest_name,guest_phone,flight_no,notes,amount_cents,pax,luggage_count, destinations(address,zone,airport)",
    )
    .eq("id", id)
    .single();

  const row = data as unknown as DetailRow | null;
  if (!row) {
    notFound();
  }

  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const arrival = new Date(row.arrival_at).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-[24px] px-[24px] py-[24px]">
      {/* Horizontal lifecycle stepper (DS-04, Decision 4) — replaces the vertical timeline. */}
      <LifecycleStepper current={row.status as TransferState} />

      {/* Hero route card: airport → zone/address (Decision 1 — NO live map). */}
      <RouteMotif
        start={{
          icon: <PlaneIcon />,
          label: row.destinations?.airport ?? t.airportLabel,
        }}
        end={{
          icon: <BuildingIcon />,
          label:
            row.destinations?.zone ?? row.destinations?.address ?? t.zoneLabel,
        }}
      />

      {/* Trip facts — legitimately visible post-claim. */}
      <div className="grid grid-cols-2 gap-[16px] rounded-md border border-grey/30 bg-white p-[16px] shadow-sm">
        <Fact label={t.airportLabel} value={row.destinations?.airport ?? null} />
        <Fact label={t.zoneLabel} value={row.destinations?.zone ?? null} />
        <Fact label={t.addressLabel} value={row.destinations?.address ?? null} />
        <Fact label={t.driverArrivalLabel} value={arrival} />
        <Fact label={t.driverFlightLabel} value={row.flight_no} />
        <Fact label={t.driverFareLabel} value={`${fmtEur(row.amount_cents)} €`} />
        <Fact
          label={t.driverPassengersLabel}
          value={row.pax != null ? String(row.pax) : null}
        />
        <Fact
          label={t.driverLuggageLabel}
          value={row.luggage_count != null ? String(row.luggage_count) : null}
        />
      </div>

      {/* Guest contact — full PII, visible only because the driver owns this claim. */}
      <div className="flex flex-col gap-[16px] rounded-md border border-grey/30 bg-white p-[16px] shadow-sm">
        <Fact label={t.driverGuestNameLabel} value={row.guest_name} />
        <Fact label={t.driverGuestPhoneLabel} value={row.guest_phone} />
        <Fact label={t.driverNotesLabel} value={row.notes} />
      </div>

      {/* Next-forward-edge advance CTA (Confirm arrival on en_route→arrived) — the server action
          cannot be invoked from this RSC, so the interaction lives in the DetailView island. */}
      <DetailView
        id={row.id}
        status={row.status as TransferState}
        copy={{
          advanceToEnRouteCta: t.advanceToEnRouteCta,
          advanceToArrivedCta: t.advanceToArrivedCta,
          advanceToPickedUpCta: t.advanceToPickedUpCta,
          advanceToCompletedCta: t.advanceToCompletedCta,
          driverConfirmArrivalCta: t.driverConfirmArrivalCta,
          advanceFailedToast: t.advanceFailedToast,
        }}
      />
    </section>
  );
}
