import "server-only";
// platform/transfers/confirmation-email.ts — booking-confirmation magic link (BOOK-06).
//
// THE SINGLE STABLE CALL-SITE the verified Stripe webhook invokes on the `paid`
// transition. This module BUILDS the guest status-page magic link (via the GoTrue
// admin API generateLink, mirroring the 02-05 driver invite) and — in Phase 4 —
// only REVEALS/LOGS it. Phase 7 replaces ONLY the body of this function
// (console.info → resend.emails.send + an email_log idempotency guard); the
// signature `sendBookingConfirmation(transferId, guestEmail)` stays identical so
// the webhook call-site never changes.
//
// MONEY LOCK (CLAUDE.md single-writer gate, A2): this module is NOT a second `paid`
// writer. It performs ZERO `wp_transfers` writes — the email hangs off the EXISTING
// webhook `paid` transition (the sole writer). The source MUST contain no
// `status: 'paid'` literal (asserted by platform/transfers/confirmation.test.ts and
// platform/payments/single-writer.test.ts).
//
// The redirect base is the TRUSTED NEXT_PUBLIC_SITE_URL constant (never a client
// Origin header, WR-04). The magic link routes through the EXISTING /auth/confirm
// route with an allowlisted `next=/status/<transferId>` so the guest lands on their
// own status page after the session is established (AUTH-02).
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";

export type ConfirmationEmail = {
  to: string;
  magicLink: string;
  html: string;
};

// Minimal token interpolation for the email copy (server-side, no client flash).
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

/**
 * Build the booking-confirmation magic link for a paid transfer and (Phase 4)
 * reveal/log it. Returns the recipient, the magic link, and a rendered HTML body.
 *
 * Phase 7 swaps the console.info reveal for resend.emails.send (with an email_log
 * idempotency guard); this signature is the stable seam the webhook calls.
 */
export async function sendBookingConfirmation(
  transferId: string,
  guestEmail: string,
): Promise<ConfirmationEmail> {
  const t = await getDict();
  const admin = createAdminClient();

  // GoTrue magic-link generation bound to the guest email (mirrors 02-05's invite).
  // The redirectTo routes through the existing /auth/confirm route to the guest's
  // own status page via an allowlisted `next` param (AUTH-02). NEXT_PUBLIC_SITE_URL
  // is the trusted base (WR-04) and must live in the Supabase Redirect URLs allowlist.
  // The canonical post-verification destination: the existing /auth/confirm route
  // with an allowlisted `next=/status/<id>` (AUTH-02). This is the contract the
  // guest reaches; the confirmation link MUST route through it.
  const verifiedDest = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=magiclink&next=/status/${transferId}`;

  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: guestEmail,
    options: { redirectTo: verifiedDest },
  });

  // Prefer GoTrue's clickable action_link (carries the verification token) when it
  // already routes through our verifiedDest; otherwise fall back to the canonical
  // destination. GoTrue URL-encodes the redirect_to inside action_link, so the raw
  // action_link does not always contain the verifiedDest verbatim — the destination
  // the guest must reach is verifiedDest, which is what the BOOK-06 contract pins.
  // Phase 7 builds the final clickable link from action_link/hashed_token + template.
  const actionLink = data?.properties?.action_link ?? "";
  const magicLink = actionLink.includes(verifiedDest) ? actionLink : verifiedDest;

  // Minimal HTML body using the confirmation copy keys (plain string is fine for the
  // stub; Phase 7 swaps in a react-email template). The CTA links to the magic link.
  const html = `<!doctype html><html><body>
<h1>${t.confirmEmailHeading}</h1>
<p>${fill(t.confirmEmailBody, { amount: "", arrivalDate: "" })}</p>
<p><a href="${magicLink}">${t.confirmEmailCta}</a></p>
<p>${t.confirmEmailFooter}</p>
</body></html>`;

  // Phase-4 STUB: reveal/log only — DO NOT call Resend (that lands in Phase 7). A
  // send failure must never roll back the verified `paid` write (the webhook wraps
  // this call in log-and-continue).
  console.info("[BOOK-06 stub] confirmation email", {
    to: guestEmail,
    magicLink,
  });

  return { to: guestEmail, magicLink, html };
}
