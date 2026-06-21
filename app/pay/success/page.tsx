// app/pay/success/page.tsx — DISPLAY-ONLY post-Checkout page (BOOK-05, Pitfall 3, SC2).
//
// Stripe redirects the guest here (`/pay/success?t=<transfer-id>`) AFTER Checkout. That
// redirect is SPOOFABLE — anyone can open this URL directly without paying — so this
// page MUST be display-only: it READS the transfer status and NEVER writes `paid`. The
// ONLY writer of `paid` is the signature-verified webhook (single-writer gate). A guest
// who hits this URL before (or instead of) the webhook firing sees the NON-paid status.
//
// Enforced by:
//   - the source-level single-writer grep gate (this file adds no paid-status write),
//   - the success-spoof e2e (tests/e2e/success-spoof.spec.ts): a direct hit with no
//     webhook must NOT render the word "paid". Hence the literal "Paid" receipt line is
//     emitted ONLY inside the `status === "paid"` branch — never for an unpaid transfer.
import { LockIcon } from "@/app/(guest)/_pass/icons";
import { getDict } from "@/platform/i18n/dictionary";
import { fmtEur } from "@/platform/money/commission";
import { createAdminClient } from "@/platform/supabase/admin";
import { Card } from "@/platform/ui/Card";

// Server component (no "use client") — the service-role admin client is server-only.
export const runtime = "nodejs";

type SearchParams = Promise<{ t?: string }>;

// Minimal server-side token interpolation (mirrors the status page).
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t: transferId } = await searchParams;
  const t = await getDict();

  // Service-role READ (display only — no write of any kind on this path).
  let status: string | null = null;
  let amountCents: number | null = null;
  let paidAt: string | null = null;

  if (transferId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("wp_transfers")
      .select("status, amount_cents, paid_at")
      .eq("id", transferId)
      .maybeSingle();
    if (data) {
      status = data.status;
      amountCents = data.amount_cents;
      paidAt = data.paid_at;
    }
  }

  const isPaid = status === "paid";

  // Lighter design-system restyle (CONTEXT D-01) — Card + Display title + teal
  // track link + a single teal Stripe-trust touch. This is the confirmation
  // pass-lite treatment (no full pass skeuomorphism); zero behaviour change.
  const trackLink =
    "text-[16px] font-semibold leading-[1.5] text-teal underline";

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-[32px] px-[16px] py-[48px]">
      <h1 className="text-display font-semibold text-slate">
        {t.paySuccessTitle}
      </h1>
      <Card className="flex flex-col gap-[16px]">
        {!transferId ? (
          <p className="text-body text-slate">{t.paySuccessNoRef}</p>
        ) : status === null ? (
          <p className="text-body text-slate">{t.paySuccessNotFound}</p>
        ) : isPaid ? (
          // The ONLY place the word "Paid" is rendered — guarded by the real status.
          <>
            <p className="text-heading font-semibold text-slate">
              {fill(t.statusReceiptPaidLine, {
                amount: amountCents !== null ? fmtEur(amountCents) : "",
                paidDate: fmtDate(paidAt),
              })}
            </p>
            <p className="text-label text-grey">{t.statusReceiptSubNote}</p>
            <a href={`/status/${transferId}`} className={trackLink}>
              {t.paySuccessTrackCta}
            </a>
            <p className="flex items-center gap-[8px] text-label text-teal">
              <LockIcon />
              {t.payTrustFooter}
            </p>
          </>
        ) : (
          // Un-paid (e.g. "requested"): NEUTRAL confirming state per UI-SPEC — never an
          // authoritative "paid" affordance (SC2/SC5 spoof gate; the verified webhook is
          // the sole paid writer). Point the guest to their status page to track it.
          <>
            <p className="text-heading font-semibold text-slate">{t.paySuccessConfirming}</p>
            <a href={`/status/${transferId}`} className={trackLink}>
              {t.paySuccessTrackCta}
            </a>
            <a href="/track" className="text-label text-grey underline">
              {t.paySuccessTrackFallback}
            </a>
            <p className="flex items-center gap-[8px] text-label text-teal">
              <LockIcon />
              {t.payTrustFooter}
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
