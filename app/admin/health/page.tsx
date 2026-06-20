// app/admin/health/page.tsx — admin Platform-health console (HLTH-03 gauge + HLTH-02/04
// surfaces), server-guarded, read-only RSC.
//
// SECURITY (threat T-08-10): getCurrentRole() re-verifies the admin role server-side
// (revalidates the JWT, never the cookie) BEFORE any read or render; a non-admin is
// redirected to /sign-in. The gate runs first, before any query.
//
// READ PATH (threat T-08-11): every read goes through the ANON cookie-bound client
// (createClient from platform/supabase/server) so the admin-read RLS policies
// (email_log_admin_read / health_events_admin_read) are the data-layer gate — NEVER the
// service-role client (which would bypass RLS). Defence-in-depth alongside the role gate.
//
// DISPLAY-ONLY (D-01): this page renders the OPEN health_events rows Plan 02's sweep writes
// (kind='reconciliation_discrepancy' | 'stuck_unclaimed', resolved_at IS NULL). It is the
// DISPLAY surface for HLTH-02/HLTH-04 — Plan 02 is the definitive detector/bearer. There is
// NO detection logic here and NO write/destructive control (read-only RSC).
//
// PII (threat T-08-12): health_events.detail carries non-PII facts only (transfer id, amount,
// arrival). The lists show ids + status and link to the existing gated transfer detail for any
// PII (where the admin is already authorized).
//
// WCAG 1.4.1 (threat T-06-COLOR): every amber/coral state carries a worded TEXT label/badge.
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { EmailCapGauge, EMAIL_SOFT_CAP_DEFAULT } from "./EmailCapGauge";

// An open health_events row as displayed by the recon / stuck lists.
type HealthEventRow = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

function fmtWhen(iso: string, lang: "en" | "bg"): string {
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// A non-PII meta line built from the row's id + non-PII detail facts (never guest PII).
function metaLine(row: HealthEventRow): string {
  const ref = row.entity_id ?? row.id;
  const amount = row.detail && typeof row.detail.amount_cents === "number"
    ? ` · ${(row.detail.amount_cents / 100).toFixed(2)} €`
    : "";
  return `${ref}${amount}`;
}

export default async function HealthPage() {
  // Role gate FIRST — server-side, before any read (threat T-08-10).
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound client — the admin-read RLS policies are the data gate (NOT service-role).
  const supabase = await createClient();

  // 1. EMAIL-CAP GAUGE — today's (UTC) 'sent' rows, the same query SHAPE as the send guardrail
  //    (send-email.ts:63-71) but via the cookie-bound client + email_log_admin_read RLS.
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  let sent: number | null = null;
  try {
    const { count, error } = await supabase
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayUtc.toISOString())
      .eq("outcome", "sent");
    if (error) throw error;
    sent = count ?? 0;
  } catch {
    sent = null; // surfaces healthLoadFailed below
  }

  // 2. RECONCILIATION list — OPEN health_events rows Plan 02 writes on a money discrepancy.
  let recon: HealthEventRow[] | null = null;
  try {
    const { data, error } = await supabase
      .from("health_events")
      .select("id,entity_type,entity_id,detail,created_at")
      .eq("kind", "reconciliation_discrepancy")
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    recon = (data ?? []) as unknown as HealthEventRow[];
  } catch {
    recon = null;
  }

  // 3. STUCK list — OPEN health_events rows Plan 02 writes for paid-but-unclaimed-near-arrival.
  let stuck: HealthEventRow[] | null = null;
  try {
    const { data, error } = await supabase
      .from("health_events")
      .select("id,entity_type,entity_id,detail,created_at")
      .eq("kind", "stuck_unclaimed")
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    stuck = (data ?? []) as unknown as HealthEventRow[];
  } catch {
    stuck = null;
  }

  const cap = EMAIL_SOFT_CAP_DEFAULT;

  return (
    <main className="min-h-dvh bg-white">
      {/* Slate console chrome (identical to app/admin/page.tsx / TransfersView). */}
      <header className="flex items-center justify-between bg-slate px-[24px] py-[16px]">
        <span className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px]">
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </span>
        <LanguageToggle current={lang} label={t.langToggle} className="text-white" />
      </header>

      <section className="mx-auto flex max-w-2xl flex-col gap-[24px] px-[24px] py-[48px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">{t.healthTitle}</h1>

        {/* 1. Email-cap gauge — the focal anchor, first in the stack (UI-SPEC §Layout). */}
        <div className="rounded-md border border-grey/30 bg-white p-[24px]">
          {sent === null ? (
            <p className="text-[16px] leading-[1.5] text-grey">{t.healthLoadFailed}</p>
          ) : (
            <EmailCapGauge
              sent={sent}
              cap={cap}
              copy={{
                emailCapLabel: t.emailCapLabel,
                emailCapWarning: t.emailCapWarning,
                emailCapAtCap: t.emailCapAtCap,
                emailCapZero: t.emailCapZero,
              }}
            />
          )}
        </div>

        {/* 2. Stuck transfers (HLTH-04 surface). */}
        <div className="rounded-md border border-grey/30 bg-white p-[24px]">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">{t.stuckHeading}</h2>
          {stuck === null ? (
            <p className="mt-[16px] text-[16px] leading-[1.5] text-grey">{t.healthLoadFailed}</p>
          ) : stuck.length === 0 ? (
            <div className="mt-[16px] flex flex-col gap-[8px]">
              <h3 className="text-[16px] font-semibold leading-[1.4] text-slate">
                {t.stuckEmptyHeading}
              </h3>
              <p className="text-[16px] leading-[1.5] text-grey">{t.stuckEmptyBody}</p>
            </div>
          ) : (
            <ul className="mt-[16px] flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white">
              {stuck.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/transfers/${row.entity_id ?? row.id}`}
                    className="flex min-h-[56px] flex-col gap-[6px] border-l-4 border-l-coral px-[16px] py-[12px] hover:bg-slate/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    <span className="text-[16px] font-semibold leading-[1.4] text-slate">
                      {metaLine(row)}
                    </span>
                    <span className="text-[14px] leading-[1.4] text-grey">
                      {fmtWhen(row.created_at, lang)}
                    </span>
                    {/* WCAG 1.4.1: coral rows ALWAYS carry the text badge. */}
                    <span className="inline-flex w-fit items-center rounded-[4px] bg-coral px-[8px] py-[2px] text-[12px] font-semibold uppercase tracking-wide text-white">
                      {t.stuckBadge}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Payment reconciliation (HLTH-02 surface) — the most severe signal. */}
        <div className="rounded-md border border-grey/30 bg-white p-[24px]">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">{t.reconHeading}</h2>
          {recon === null ? (
            <p className="mt-[16px] text-[16px] leading-[1.5] text-grey">{t.healthLoadFailed}</p>
          ) : recon.length === 0 ? (
            <div className="mt-[16px] flex flex-col gap-[8px]">
              <h3 className="text-[16px] font-semibold leading-[1.4] text-slate">
                {t.reconEmptyHeading}
              </h3>
              <p className="text-[16px] leading-[1.5] text-grey">{t.reconEmptyBody}</p>
            </div>
          ) : (
            <ul className="mt-[16px] flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white">
              {recon.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/transfers/${row.entity_id ?? row.id}`}
                    className="flex min-h-[56px] flex-col gap-[6px] border-l-4 border-l-coral px-[16px] py-[12px] hover:bg-slate/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    <span className="text-[16px] font-semibold leading-[1.4] text-slate">
                      {metaLine(row)}
                    </span>
                    <span className="text-[14px] leading-[1.4] text-grey">
                      {fmtWhen(row.created_at, lang)}
                    </span>
                    {/* WCAG 1.4.1: coral rows ALWAYS carry the text badge. */}
                    <span className="inline-flex w-fit items-center rounded-[4px] bg-coral px-[8px] py-[2px] text-[12px] font-semibold uppercase tracking-wide text-white">
                      {t.reconBadge}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
