// app/admin/DashboardView.tsx — admin "Transfer Pool" dashboard view (AUI-02 / D-05).
//
// Presentational: receives four KPI counts + the top-~5 recent rows + copy as props (no
// read, no auth call — the RSC app/admin/page.tsx owns the role gate + the anon-RLS read).
// Renders inside the slate console shell (app/admin/layout.tsx, Plan 01) — NO <header> of
// its own.
//
// Four KPI cards (Unclaimed=coral / Claimed=teal / En route=amber / Total today=slate):
// each pairs a big Display figure with the worded Label — colour is NEVER the sole cue
// (WCAG 1.4.1). No invented progress %, no direction arrows, no revenue (Decision 1 — truthful UI).
//
// Below the grid, a "Recent transfers" section reuses TransfersView's row grammar (guest
// name or arrival, StatusDot, airport→zone, arrival, fare, coral needs-attention left-border
// + text badge) over the loaded top-5 rows, then a "View all" link to /admin/transfers.
import Link from "next/link";
import { Card } from "@/platform/ui/Card";
import { StatusDot, type TransferState } from "@/platform/ui/StatusDot";
import { fmtEur } from "@/platform/money/commission";

export type RecentRow = {
  id: string;
  status: TransferState;
  arrival_at: string | null;
  guest_name: string | null;
  zone: string | null;
  airport: string | null;
  amount_cents: number;
  needsAttention: boolean;
};

export type DashboardCounts = {
  unclaimed: number;
  claimed: number;
  enRoute: number;
  totalToday: number;
};

export type DashboardViewCopy = {
  adminDashboardTitle: string;
  kpiUnclaimed: string;
  kpiClaimed: string;
  kpiEnRoute: string;
  kpiTotalToday: string;
  adminRecentTransfersHeading: string;
  adminViewAllCta: string;
  transfersEmptyHeading: string;
  transfersEmptyBody: string;
  needsAttentionBadge: string;
};

// KPI accent roles — the status colour is a left accent bar; the worded label below is
// ALWAYS present so colour is never the sole cue (WCAG 1.4.1).
type KpiAccent = "coral" | "teal" | "amber" | "slate";
const ACCENT_BAR: Record<KpiAccent, string> = {
  coral: "bg-coral",
  teal: "bg-teal",
  amber: "bg-amber",
  slate: "bg-slate",
};

function fmtArrival(iso: string | null, lang: "en" | "bg"): string {
  if (!iso) return "—";
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function KpiCard({
  figure,
  label,
  accent,
}: {
  figure: number;
  label: string;
  accent: KpiAccent;
}) {
  return (
    <Card className="flex items-stretch gap-[16px]">
      {/* Status-coloured accent bar — redundant with the worded label (never the sole cue). */}
      <span aria-hidden className={`w-[4px] shrink-0 rounded-full ${ACCENT_BAR[accent]}`} />
      <div className="flex flex-col gap-[4px]">
        {/* Display figure (28px / 600). */}
        <span className="text-[28px] font-semibold leading-[1.1] text-slate">{figure}</span>
        {/* Label caption — the worded cue, ALWAYS present (WCAG 1.4.1). */}
        <span className="text-[14px] font-semibold leading-[1.4] text-grey">{label}</span>
      </div>
    </Card>
  );
}

export function DashboardView({
  counts,
  recent,
  lang,
  copy,
}: {
  counts: DashboardCounts;
  recent: RecentRow[];
  lang: "en" | "bg";
  copy: DashboardViewCopy;
}) {
  const kpis: { figure: number; label: string; accent: KpiAccent }[] = [
    { figure: counts.unclaimed, label: copy.kpiUnclaimed, accent: "coral" },
    { figure: counts.claimed, label: copy.kpiClaimed, accent: "teal" },
    { figure: counts.enRoute, label: copy.kpiEnRoute, accent: "amber" },
    { figure: counts.totalToday, label: copy.kpiTotalToday, accent: "slate" },
  ];

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-[24px] px-[24px] py-[48px]">
      {/* Page title — Display (28px / 600). */}
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {copy.adminDashboardTitle}
      </h1>

      {/* KPI grid: 4 columns → 2 → 1. No invented progress %, no direction arrows, no revenue (Decision 1). */}
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} figure={k.figure} label={k.label} accent={k.accent} />
        ))}
      </div>

      {/* Recent transfers — top-5 reusing the transfers-list row grammar + a View-all link. */}
      <div className="flex flex-col gap-[16px]">
        <div className="flex items-center justify-between gap-[16px]">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
            {copy.adminRecentTransfersHeading}
          </h2>
          <Link
            href="/admin/transfers"
            className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-teal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            {copy.adminViewAllCta}
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col gap-[8px]">
            <h3 className="text-[18px] font-semibold leading-[1.3] text-slate">
              {copy.transfersEmptyHeading}
            </h3>
            <p className="text-[16px] leading-[1.5] text-grey">{copy.transfersEmptyBody}</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/transfers/${r.id}`}
                  className={`flex min-h-[56px] flex-col gap-[6px] px-[16px] py-[12px] hover:bg-slate/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                    r.needsAttention ? "border-l-4 border-l-coral" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-[8px]">
                    <span className="text-[16px] font-semibold leading-[1.4] text-slate">
                      {r.guest_name ?? fmtArrival(r.arrival_at, lang)}
                    </span>
                    <StatusDot state={r.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-[14px] leading-[1.4] text-grey">
                    <span className="text-slate">
                      {[r.airport, r.zone].filter(Boolean).join(" → ") || "—"}
                    </span>
                    <span>·</span>
                    <span>{fmtArrival(r.arrival_at, lang)}</span>
                    <span>·</span>
                    <span>{`${fmtEur(r.amount_cents)} €`}</span>
                  </div>
                  {/* WCAG 1.4.1: coral rows ALWAYS carry the text badge — never colour alone. */}
                  {r.needsAttention ? (
                    <span className="inline-flex w-fit items-center rounded-[4px] bg-coral px-[8px] py-[2px] text-[12px] font-semibold uppercase tracking-wide text-white">
                      {copy.needsAttentionBadge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
