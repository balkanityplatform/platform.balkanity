// app/pickup/[slug]/page.tsx — public guest booking page (BOOK-01).
//
// Resolves a /pickup/<slug> link to its destination + fare and mounts the booking form
// island. This is a PUBLIC surface (no auth) — the read is the active-destination read
// the 0004 `destinations_public_active_read` anon policy supports; here we use the
// service-role client for a non-PII read of label/zone/airport/price_cents/active.
//
// Two states:
//   - active destination → label (Display) + fare summary card + <BookingForm/>
//   - missing / active=false → the neutral "not available" state, NO form (T-04-ID4).
//
// Server-trusted amount (Pitfall 5 / UI-SPEC interaction contract): the fare is rendered
// READ-ONLY from price_cents; it is NEVER a form input — the action re-reads the price.
// All copy is resolved server-side from getDict() (no client flash).
import { getDict } from "@/platform/i18n/dictionary";
import { fmtEur } from "@/platform/money/commission";
import { createAdminClient } from "@/platform/supabase/admin";
import { Card } from "@/platform/ui/Card";
import { BookingForm } from "./BookingForm";

// Node runtime — the service-role admin client is server-only (mirrors /pay/success).
export const runtime = "nodejs";

type Params = Promise<{ slug: string }>;

// Interpolate {airport}/{zone} tokens in the fare caption copy (server-side).
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

export default async function PickupPage({ params }: { params: Params }) {
  const { slug } = await params;
  const t = await getDict();

  const admin = createAdminClient();
  const { data: dest } = await admin
    .from("destinations")
    .select("label, zone, airport, price_cents, active")
    .eq("slug", slug)
    .maybeSingle();

  // Inactive / unknown slug → neutral unavailable state (no form, no fare leak).
  if (!dest || !dest.active) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-[16px] px-[16px] py-[48px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {t.slugUnavailableHeading}
        </h1>
        <p className="text-[16px] leading-[1.5] text-grey">
          {t.slugUnavailableBody}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-[24px] px-[16px] py-[48px]">
      {/* Destination label — Display role (28px). */}
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {dest.label}
      </h1>

      {/* Fare summary — read-only; the amount is NEVER a form input (Pitfall 5). */}
      <Card className="flex flex-col gap-[8px]">
        <p className="text-[14px] leading-[1.4] text-grey">
          {fill(t.bookingFareCaption, {
            airport: dest.airport ?? "",
            zone: dest.zone ?? "",
          })}
        </p>
        <p className="text-[16px] font-semibold text-slate">
          {t.bookingTotalToPay} €{fmtEur(dest.price_cents)}
        </p>
      </Card>

      <BookingForm
        slug={slug}
        copy={{
          fullNameLabel: t.bookingFullNameLabel,
          emailLabel: t.bookingEmailLabel,
          phoneLabel: t.bookingPhoneLabel,
          flightLabel: t.bookingFlightLabel,
          arrivalDateLabel: t.bookingArrivalDateLabel,
          arrivalTimeLabel: t.bookingArrivalTimeLabel,
          passengersLabel: t.bookingPassengersLabel,
          passengersHelp: t.bookingPassengersHelp,
          luggageLabel: t.bookingLuggageLabel,
          notesLabel: t.bookingNotesLabel,
          notesPlaceholder: t.bookingNotesPlaceholder,
          continueCta: t.bookingContinueCta,
          backCta: t.bookingBackCta,
          yourDetails: t.bookingYourDetails,
          disclosureHeading: t.disclosureHeading,
          disclosureBody: t.disclosureBody,
          disclosureCheckboxLabel: t.disclosureCheckboxLabel,
          disclosureBlockedError: t.disclosureBlockedError,
          fieldRequired: t.bookingFieldRequired,
          invalidEmail: t.bookingInvalidEmail,
          invalidPhone: t.bookingInvalidPhone,
          arrivalPast: t.bookingArrivalPast,
          passengersRange: t.bookingPassengersRange,
          bookingFailed: t.bookingFailed,
        }}
      />
    </main>
  );
}
