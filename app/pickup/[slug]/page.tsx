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
import { DetailsGrid } from "@/app/(guest)/_pass/DetailsGrid";
import {
  CalendarIcon,
  ClockIcon,
  PeopleIcon,
  PlaneIcon,
} from "@/app/(guest)/_pass/icons";
import { PassHeader } from "@/app/(guest)/_pass/PassHeader";
import { TransferPass } from "@/app/(guest)/_pass/TransferPass";
import { getDict } from "@/platform/i18n/dictionary";
import { fmtEur } from "@/platform/money/commission";
import { createAdminClient } from "@/platform/supabase/admin";
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
      {/* The booking screen IS the Transfer Pass (UI-SPEC Decision 2): a teal route
          header on top, the real-fields overview grid, the payment-status + total
          row, then the restyled BookingForm framed inside the same shell. */}
      <TransferPass
        header={
          <PassHeader
            eyebrow={t.passEyebrow}
            // On /pickup (pre-insert) the ref line is OMITTED — no faked id ever
            // shows (Decision 1 / UI-SPEC line 121 / T-10-03).
            startLabel={dest.airport ?? ""}
            endLabel={dest.label}
          />
        }
      >
        {/* Real-fields overview (Decision 3) — captions + line icons. The values
            are the guest's to enter in the form below; the grid is the labelled
            overview, so they render the graceful em-dash placeholder pre-input. */}
        <DetailsGrid
          items={[
            { caption: t.passDate, value: "", icon: <CalendarIcon /> },
            { caption: t.passFlightNo, value: "", icon: <PlaneIcon /> },
            { caption: t.passGuests, value: "", icon: <PeopleIcon /> },
            { caption: t.passTime, value: "", icon: <ClockIcon /> },
          ]}
        />

        {/* Payment-status row — pre-pay shows an amber dot + the worded
            `passPaymentPending` label (StatusDot semantics; never colour alone,
            WCAG 1.4.1). The transfer becomes `paid` only via the verified webhook. */}
        <div className="flex items-center justify-between gap-[8px]">
          <span className="inline-flex items-center gap-[4px]">
            <span
              aria-hidden="true"
              className="inline-block h-[10px] w-[10px] rounded-full bg-amber"
            />
            <span className="text-[14px] font-semibold leading-[1.4] text-slate">
              {t.passPaymentPending}
            </span>
          </span>
        </div>

        {/* Total prepaid — read-only; the amount is NEVER a form input (Pitfall 5).
            Heading role (24px); the fare caption sits at the Label role beneath. */}
        <div className="flex flex-col gap-[4px]">
          <p className="text-[14px] leading-[1.4] text-grey">
            {fill(t.bookingFareCaption, {
              airport: dest.airport ?? "",
              zone: dest.zone ?? "",
            })}
          </p>
          <p className="text-[24px] font-semibold leading-[1.2] text-slate">
            {t.bookingTotalToPay} €{fmtEur(dest.price_cents)}
          </p>
        </div>

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
            // The pay-CTA amount is interpolated SERVER-SIDE here via fill()
            // (Pitfall 5 — never a form input); the form just renders the string.
            continueCta: fill(t.bookingContinueCta, {
              amount: fmtEur(dest.price_cents),
            }),
            continuePending: t.bookingContinuePending,
            trustFooter: t.payTrustFooter,
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
      </TransferPass>
    </main>
  );
}
