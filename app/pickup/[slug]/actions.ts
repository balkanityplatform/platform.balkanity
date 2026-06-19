"use server";
// app/pickup/[slug]/actions.ts — guest booking server action (BOOK-02 / BOOK-03).
//
// PUBLIC SURFACE — there is NO getCurrentRole() admin gate here (unlike the admin
// destinations actions): anyone with a /pickup/<slug> link can book (PATTERNS line 69).
// The trust boundary is therefore (a) the zod `bookingSchema` that re-validates every
// FormData field, and (b) the SERVER-RE-READ amount — the charge is ALWAYS the
// destination's `price_cents` read here by slug, NEVER a client-submitted value
// (Pitfall 5 / CLAUDE.md money lock / T-04-TMP3). The form submits no amount input.
//
// This action writes ONLY `status:'requested'` — it is NOT a `paid` writer. The
// signature-verified Stripe webhook remains the sole writer of `paid` (single-writer
// gate; platform/payments/single-writer.test.ts must stay green).
//
// On a valid submit it inserts the `requested` row with the server-trusted amount,
// reuses createCheckoutSession verbatim (code-created Checkout Session carrying
// metadata.transfer_id — never a dashboard Payment Link), and 303-redirects to the
// hosted Checkout URL. redirect()'s NEXT_REDIRECT is intentionally NOT caught — it must
// propagate so the redirect actually happens (never catch-and-swallow it).
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createCheckoutSession } from "@/platform/payments/checkout";
import { createAdminClient } from "@/platform/supabase/admin";

export type BookingState = {
  status: "idle" | "error" | "success";
  message?: string;
};

// Trust boundary (BOOK-02): every guest-submitted field is re-validated here. NOTE the
// absence of any `amount`/`price` field — the amount is server-sourced, not parsed from
// FormData (T-04-TMP3). `pax` is coerced+bounded 1–8 (mirrors the 0004 `pax` CHECK).
const bookingSchema = z.object({
  slug: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  name: z.string().trim().min(1),
  pax: z.coerce.number().int().min(1).max(8),
  flight_no: z.string().trim().min(1),
  arrival_date: z.string().trim().min(1),
  arrival_time: z.string().trim().min(1),
  luggage_count: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().optional(),
});

export async function createBooking(
  _prev: BookingState,
  fd: FormData,
): Promise<BookingState> {
  const t = await getDict();
  // D-17: capture the booking language (same cookie source as getDict) so the
  // webhook-fired confirmation (Plan 03) can resolve guest copy via getDictFor(locale ?? 'en').
  const lang = await getLang();

  const parsed = bookingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    // Differentiate the most actionable boundary errors; everything else is generic.
    const issues = parsed.error.issues;
    if (issues.some((i) => i.path[0] === "email")) {
      return { status: "error", message: t.bookingInvalidEmail };
    }
    if (issues.some((i) => i.path[0] === "pax")) {
      return { status: "error", message: t.bookingPassengersRange };
    }
    return { status: "error", message: t.bookingFieldRequired };
  }

  const {
    slug,
    email,
    phone,
    name,
    pax,
    flight_no,
    arrival_date,
    arrival_time,
    luggage_count,
    notes,
  } = parsed.data;

  // Build the arrival timestamp from the date+time fields and reject a past arrival.
  const arrivalAt = new Date(`${arrival_date}T${arrival_time}`);
  if (Number.isNaN(arrivalAt.getTime()) || arrivalAt.getTime() < Date.now()) {
    return { status: "error", message: t.bookingArrivalPast };
  }

  const admin = createAdminClient();

  // SERVER-TRUSTED AMOUNT (Pitfall 5): re-read the destination's price_cents by slug.
  // An inactive/unknown slug yields no row → no insert, no charge (T-04-ID4).
  const { data: dest } = await admin
    .from("destinations")
    .select("id, price_cents, active")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!dest || !dest.active) {
    return { status: "error", message: t.bookingFailed };
  }

  // Insert the requested transfer carrying the SERVER-sourced amount (never FormData).
  const { data: row, error: insertError } = await admin
    .from("wp_transfers")
    .insert({
      destination_id: dest.id,
      status: "requested",
      amount_cents: dest.price_cents,
      locale: lang, // D-17 — persisted booking language (EN fallback when NULL)
      guest_email: email,
      guest_name: name,
      guest_phone: phone,
      pax,
      flight_no,
      arrival_at: arrivalAt.toISOString(),
      luggage_count: luggage_count ?? null,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { status: "error", message: t.bookingFailed };
  }

  // Reuse the code-created Checkout Session helper verbatim with the SERVER amount.
  const checkoutUrl = await createCheckoutSession({
    transferId: row.id,
    amountCents: dest.price_cents,
  });

  if (!checkoutUrl) {
    return { status: "error", message: t.bookingFailed };
  }

  // 303-redirect to hosted Checkout. NEXT_REDIRECT must propagate — never swallowed.
  redirect(checkoutUrl);
}
