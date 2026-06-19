"use client";
// app/admin/transfers/TransfersView.tsx — admin transfers list island (OPS-01, D-07/D-08/D-09).
//
// Slate console chrome (mirrors DriversView). Renders the admin transfers list with:
//   - a STATUS filter (one chip per lifecycle state) that narrows the rendered rows,
//   - a one-tap needs-attention quick filter (needsAttentionFilterCta),
//   - a free-text SEARCH box matching guest name / flight no. / destination,
// each of which updates the URL searchParams (router.replace) to re-query server-side — the
// RSC owns the read, the .in/.or filter, the in-RSC destination search, the needsAttention
// compute, and the coral-pinned-then-arrival sort. This island is presentational over the
// already-ordered rows it receives.
//
// WCAG 1.4.1 (threat T-06-COLOR): a needsAttention row carries the coral `needsAttentionBadge`
// TEXT marker — colour is NEVER the sole signal. Each row links to /admin/transfers/<id>.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { StatusDot, type TransferState } from "@/platform/ui/StatusDot";
import { fmtEur } from "@/platform/money/commission";

export type TransferRow = {
  id: string;
  status: TransferState;
  arrival_at: string | null;
  guest_name: string | null;
  flight_no: string | null;
  amount_cents: number;
  zone: string | null;
  airport: string | null;
  needsAttention: boolean;
};

export type TransfersViewCopy = {
  langToggle: string;
  transfersTitle: string;
  filterByStatusLabel: string;
  needsAttentionFilterCta: string;
  transferSearchPlaceholder: string;
  transfersEmptyHeading: string;
  transfersEmptyBody: string;
  transfersNoMatchBody: string;
  needsAttentionBadge: string;
};

function fmtArrival(iso: string | null, lang: "en" | "bg"): string {
  if (!iso) return "—";
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function TransfersView({
  rows,
  lang,
  statusOptions,
  activeStatus,
  attentionOnly,
  query,
  copy,
}: {
  rows: TransferRow[];
  lang: "en" | "bg";
  statusOptions: TransferState[];
  activeStatus: TransferState[];
  attentionOnly: boolean;
  query: string;
  copy: TransfersViewCopy;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(query);

  // Re-query server-side by writing the URL searchParams (the RSC owns the read).
  function applyParams(next: { status?: string[]; attention?: boolean; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.status !== undefined) {
      if (next.status.length > 0) params.set("status", next.status.join(","));
      else params.delete("status");
    }
    if (next.attention !== undefined) {
      if (next.attention) params.set("attention", "1");
      else params.delete("attention");
    }
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }

    const qs = params.toString();
    router.replace(qs ? `/admin/transfers?${qs}` : "/admin/transfers");
  }

  function toggleStatus(s: TransferState) {
    const set = new Set(activeStatus);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    applyParams({ status: Array.from(set) });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyParams({ q: searchInput.trim() });
  }

  const hasActiveFilters = activeStatus.length > 0 || attentionOnly || query.length > 0;

  return (
    <main className="min-h-dvh bg-white">
      {/* Slate console chrome (reused from the drivers/companies pages). */}
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
        <LanguageToggle current={lang} label={copy.langToggle} className="text-white" />
      </header>

      <section className="mx-auto flex max-w-2xl flex-col gap-[24px] px-[24px] py-[48px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {copy.transfersTitle}
        </h1>

        {/* Filter + search controls (D-08). */}
        <div className="flex flex-col gap-[16px]">
          {/* Free-text search across guest name / flight no. / destination. */}
          <form onSubmit={onSearchSubmit} role="search" className="flex gap-[8px]">
            <input
              type="search"
              name="q"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={copy.transferSearchPlaceholder}
              aria-label={copy.transferSearchPlaceholder}
              className="min-h-[44px] flex-1 rounded-md border border-grey/30 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            />
          </form>

          {/* Status filter chips + needs-attention quick filter. */}
          <div className="flex flex-col gap-[8px]">
            <span className="text-[14px] font-semibold leading-[1.4] text-grey">
              {copy.filterByStatusLabel}
            </span>
            <div className="flex flex-wrap gap-[8px]">
              <button
                type="button"
                aria-pressed={attentionOnly}
                onClick={() => applyParams({ attention: !attentionOnly })}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-[16px] text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                  attentionOnly
                    ? "border-coral bg-coral text-white"
                    : "border-coral text-coral hover:bg-coral/5"
                }`}
              >
                {copy.needsAttentionFilterCta}
              </button>
              {statusOptions.map((s) => {
                const active = activeStatus.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleStatus(s)}
                    className={`inline-flex min-h-[44px] items-center rounded-full border px-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                      active
                        ? "border-slate bg-slate text-white"
                        : "border-grey/30 text-slate hover:bg-slate/5"
                    }`}
                  >
                    <StatusDot state={s} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List / empty / no-match states. */}
        {rows.length === 0 ? (
          hasActiveFilters ? (
            <p className="text-[16px] leading-[1.5] text-grey">
              {copy.transfersNoMatchBody}
            </p>
          ) : (
            <div className="flex flex-col gap-[8px]">
              <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
                {copy.transfersEmptyHeading}
              </h2>
              <p className="text-[16px] leading-[1.5] text-grey">
                {copy.transfersEmptyBody}
              </p>
            </div>
          )
        ) : (
          <ul className="flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white">
            {rows.map((r) => (
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
                    {r.flight_no ? (
                      <>
                        <span>·</span>
                        <span>{r.flight_no}</span>
                      </>
                    ) : null}
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
      </section>
    </main>
  );
}
