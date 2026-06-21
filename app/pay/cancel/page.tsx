// app/pay/cancel/page.tsx — DISPLAY-ONLY post-cancel page (Pitfall 3).
//
// Stripe redirects here (`/pay/cancel?t=<transfer-id>`) when the guest abandons
// Checkout. Like the success page, it is display-only: it READS the transfer
// status and NEVER writes anything (it certainly never writes `paid` — the
// webhook is the sole paid writer). Cancelling Checkout leaves the transfer in
// its pre-payment (unpaid) state.
//
// Phase 10 restyle: moved off raw inline styles + hardcoded English onto the
// design-system shell (Card + Display title + teal /track link), all copy
// resolved server-side via getDict() (T-10-01: still ZERO write of any kind).
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";
import { Card } from "@/platform/ui/Card";

// Server component — the service-role admin client is server-only.
export const runtime = "nodejs";

type SearchParams = Promise<{ t?: string }>;

export default async function PayCancelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t: transferId } = await searchParams;
  const t = await getDict();

  // Service-role READ (display only — no write of any kind on this path).
  let status: string | null = null;
  if (transferId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("wp_transfers")
      .select("status")
      .eq("id", transferId)
      .maybeSingle();
    status = data?.status ?? null;
  }

  const trackLink =
    "text-[16px] font-semibold leading-[1.5] text-teal underline";

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-[32px] px-[16px] py-[48px]">
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {t.payCancelTitle}
      </h1>
      <Card className="flex flex-col gap-[16px]">
        <p className="text-[16px] leading-[1.5] text-grey">{t.payCancelBody}</p>
        {/* Neutral display-only status line (no PII, no fare); display-only —
            this page never writes, never sets `paid` (T-10-01). */}
        {status ? (
          <p className="text-[14px] leading-[1.4] text-grey">{status}</p>
        ) : null}
        <a href="/track" className={trackLink}>
          {t.payCancelTrackCta}
        </a>
      </Card>
    </main>
  );
}
