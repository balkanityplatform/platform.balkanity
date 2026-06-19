"use client";
// app/pickup/[slug]/BookingForm.tsx — guest booking form island (BOOK-02 / BOOK-04).
//
// The canonical useActionState island (mirrors DestinationForm): copy is passed in from
// the server page (already dictionary-resolved → no flash); fields collect D-01..D-04;
// the server zod errors surface inline via state.message; a pending/disabled state on
// submit prevents double-submit.
//
// BOOK-04 — the prepaid & non-refundable disclosure is rendered ABOVE the CTA (not behind
// a link); the "Continue to payment" CTA is DISABLED until the acknowledgement checkbox
// is checked, and an unchecked submit attempt shows the blocked-submit error inline.
//
// Server-trusted amount (Pitfall 5): this form submits NO amount/price input — only the
// slug (hidden) + the guest fields. The server re-reads price_cents.
import { useActionState, useState } from "react";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import { PaxStepper } from "@/platform/ui/PaxStepper";
import { TextField } from "@/platform/ui/TextField";
import { type BookingState, createBooking } from "./actions";

const initialState: BookingState = { status: "idle" };

export type BookingFormCopy = {
  fullNameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  flightLabel: string;
  arrivalDateLabel: string;
  arrivalTimeLabel: string;
  passengersLabel: string;
  passengersHelp: string;
  luggageLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  continueCta: string;
  continuePending: string;
  backCta: string;
  yourDetails: string;
  disclosureHeading: string;
  disclosureBody: string;
  disclosureCheckboxLabel: string;
  disclosureBlockedError: string;
  fieldRequired: string;
  invalidEmail: string;
  invalidPhone: string;
  arrivalPast: string;
  passengersRange: string;
  bookingFailed: string;
};

export function BookingForm({
  slug,
  copy,
}: {
  slug: string;
  copy: BookingFormCopy;
}) {
  const [state, formAction, pending] = useActionState(
    createBooking,
    initialState,
  );

  // BOOK-04 — the non-refundable acknowledgement gates the CTA.
  const [acked, setAcked] = useState(false);
  // `touched` flips once the guest interacts with the acknowledgement; the blocked
  // error is shown only after interaction (never pre-emptively on page load).
  const [touched, setTouched] = useState(false);

  // Map the dictionary-keyed server error into an inline field/generic slot, exactly as
  // DestinationForm does. The email/phone/passengers/arrival errors point at their field;
  // everything else is the generic form error.
  const err = state.status === "error" ? state.message : undefined;
  const emailError = err === copy.invalidEmail ? err : undefined;
  const phoneError = err === copy.invalidPhone ? err : undefined;
  const paxError = err === copy.passengersRange ? err : undefined;
  const requiredError = err === copy.fieldRequired ? err : undefined;
  const formError =
    err &&
    err !== copy.invalidEmail &&
    err !== copy.invalidPhone &&
    err !== copy.passengersRange &&
    err !== copy.fieldRequired
      ? err
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      {/* The slug carries the booking to the right destination; the amount does NOT. */}
      <input type="hidden" name="slug" value={slug} />

      <h2 className="text-[20px] font-semibold leading-[1.2] text-slate">
        {copy.yourDetails}
      </h2>

      <TextField
        name="name"
        label={copy.fullNameLabel}
        required
        error={requiredError}
      />
      <TextField
        name="email"
        type="email"
        label={copy.emailLabel}
        required
        error={emailError}
      />
      <TextField
        name="phone"
        type="tel"
        label={copy.phoneLabel}
        required
        error={phoneError}
      />
      <TextField name="flight_no" label={copy.flightLabel} required />
      <TextField
        name="arrival_date"
        type="date"
        label={copy.arrivalDateLabel}
        required
      />
      <TextField
        name="arrival_time"
        type="time"
        label={copy.arrivalTimeLabel}
        required
      />

      <PaxStepper
        name="pax"
        label={copy.passengersLabel}
        helpText={copy.passengersHelp}
        min={1}
        max={8}
        defaultValue={1}
      />
      {paxError ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {paxError}
        </p>
      ) : null}

      <PaxStepper
        name="luggage_count"
        label={copy.luggageLabel}
        min={0}
        defaultValue={0}
      />

      <TextField name="notes" label={copy.notesLabel} placeholder={copy.notesPlaceholder} />

      {/* BOOK-04 — prepaid & non-refundable disclosure, ABOVE the CTA. */}
      <Card className="flex flex-col gap-[16px]">
        <h3 className="text-[20px] font-semibold leading-[1.2] text-slate">
          {copy.disclosureHeading}
        </h3>
        <p className="text-[16px] leading-[1.5] text-grey">
          {copy.disclosureBody}
        </p>
        <label className="flex min-h-[44px] items-center gap-[8px] text-[14px] leading-[1.4] text-slate">
          <input
            type="checkbox"
            name="ack"
            checked={acked}
            onChange={(e) => {
              setAcked(e.target.checked);
              setTouched(true);
            }}
            className="h-[20px] w-[20px] accent-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          />
          {copy.disclosureCheckboxLabel}
        </label>
        {touched && !acked ? (
          <p role="alert" className="text-[14px] leading-[1.4] text-coral">
            {copy.disclosureBlockedError}
          </p>
        ) : null}
      </Card>

      {formError ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {formError}
        </p>
      ) : null}

      {/* CTA disabled until acknowledged (BOOK-04) and while pending (no double-submit).
          aria-busy + a label swap give a visible in-progress affordance during the
          2–4 s Supabase-insert + Stripe-Checkout round-trip. */}
      <Button
        type="submit"
        disabled={!acked || pending}
        aria-busy={pending}
      >
        {pending ? copy.continuePending : copy.continueCta}
      </Button>

      {/* Secondary escape affordance (spec: ghost "Back") — a mobile-PWA guest may have
          no reliable browser-back from a deep link / in-app browser. */}
      <Button type="button" variant="ghost" onClick={() => history.back()}>
        {copy.backCta}
      </Button>
    </form>
  );
}
