// app/admin/transfers/[id]/page.tsx — admin transfer detail (OPS-02), server-guarded.
//
// RSC: re-verifies the admin role server-side (getCurrentRole() — revalidates the JWT,
// never the cookie) BEFORE any read or render; a non-admin is redirected to /sign-in
// (threat T-06-AC1). Reads the SINGLE UNMASKED row by id through the ANON cookie-bound
// client (createClient) so the wp_transfers_admin_read RLS policy is the data gate — NOT
// the service-role client. The admin sees the full row (guest contact PII + exact address +
// notes), distinct from the driver's masked pool view. Joined destination supplies the
// exact address / zone / airport. Action wiring (assign/reassign/release/cancel/refund)
// arrives in Plan 05 — this slice is read-only detail.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import type { TransferState } from "@/platform/ui/StatusDot";
import { TransferDetailView, type TransferDetail } from "./TransferDetailView";

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang, { id }] = await Promise.all([getDict(), getLang(), params]);

  // Anon cookie-bound read — the wp_transfers_admin_read RLS policy is the data gate.
  const supabase = await createClient();

  const { data } = await supabase
    .from("wp_transfers")
    .select("*, destinations(zone,airport,address)")
    .eq("id", id)
    .single();

  const copy = {
    langToggle: t.langToggle,
    transfersTitle: t.transfersTitle,
    transfersEmptyHeading: t.transfersEmptyHeading,
    transfersEmptyBody: t.transfersEmptyBody,
    addressLabel: t.addressLabel,
    zoneLabel: t.zoneLabel,
    airportLabel: t.airportLabel,
    emailLabel: t.emailLabel,
    assignDriverCta: t.assignDriverCta,
    reassignDriverCta: t.reassignDriverCta,
    releaseTransferCta: t.releaseTransferCta,
    cancelTransferCta: t.cancelTransferCta,
    refundTransferCta: t.refundTransferCta,
  };

  if (!data) {
    return <TransferDetailView row={null} lang={lang} copy={copy} />;
  }

  const raw = data as unknown as {
    id: string;
    status: string;
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
    destinations: { zone: string | null; airport: string | null; address: string | null } | null;
  };

  const row: TransferDetail = {
    id: raw.id,
    status: raw.status as TransferState,
    arrival_at: raw.arrival_at,
    guest_name: raw.guest_name,
    guest_email: raw.guest_email,
    guest_phone: raw.guest_phone,
    flight_no: raw.flight_no,
    pax: raw.pax,
    luggage_count: raw.luggage_count,
    notes: raw.notes,
    amount_cents: raw.amount_cents,
    fee_cents: raw.fee_cents,
    paid_at: raw.paid_at,
    stripe_payment_intent_id: raw.stripe_payment_intent_id,
    zone: raw.destinations?.zone ?? null,
    airport: raw.destinations?.airport ?? null,
    address: raw.destinations?.address ?? null,
  };

  return <TransferDetailView row={row} lang={lang} copy={copy} />;
}
