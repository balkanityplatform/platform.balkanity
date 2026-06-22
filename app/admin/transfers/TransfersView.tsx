"use client";
// app/admin/transfers/TransfersView.tsx — admin transfers list island (OPS-01, AUI-03/AUI-05, D-01/D-02/D-04).
//
// Renders the admin transfers list inside the Plan-01 slate console shell as the
// "pending-transmissions" table on desktop and the existing stacked cards on mobile:
//
//   - DESKTOP <table>: Time/ID · Passenger · Route · Lifecycle · Status · Driver · Actions.
//   - MOBILE <ul>:    the SAME stacked rows that were the list before (D-04 — reused verbatim
//                     as the card fallback, no new mobile layout invented).
//
// Filtering / sorting authority split (D-01 / D-02):
//   - STATUS filter chips + the needs-attention quick filter STAY a server URL-param re-query
//     (applyParams/toggleStatus → router.replace) — the RSC owns the read + .in(status) filter
//     + the needsAttention compute. The chips NARROW the loaded set server-side.
//   - The top-bar SEARCH (Plan-01 shell) filters the ALREADY-LOADED rows CLIENT-SIDE (no URL `q`,
//     no server round-trip): a substring match over guest_name / flight_no / destination
//     (zone/airport) / truncated id. A non-matching query renders `transfersNoMatchBody`.
//     The term is sourced from the shell top bar via the `admin:search` window CustomEvent.
//   - A client SORT control (Needs attention default / Soonest arrival / Status) is the SOLE
//     ordering authority over the loaded rows (D-02) — no hidden server pin underneath.
//
// WCAG 1.4.1 (threat T-06-COLOR): a needsAttention row carries the coral `needsAttentionBadge`
// TEXT marker — colour is NEVER the sole signal. Each row links to /admin/transfers/<id>.
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StatusDot, stateLabel, type TransferState } from "@/platform/ui/StatusDot";
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
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
  driver_id: string | null;
  needsAttention: boolean;
};

export type TransfersViewCopy = {
  filterByStatusLabel: string;
  needsAttentionFilterCta: string;
  transfersEmptyHeading: string;
  transfersEmptyBody: string;
  transfersNoMatchBody: string;
  needsAttentionBadge: string;
  // Table column headers (Plan-01 keys).
  colTimeId: string;
  colPassenger: string;
  colRoute: string;
  colLifecycle: string;
  colStatus: string;
  colDriver: string;
  colActions: string;
  // Row action + worded Unassigned driver cell (never empty).
  rowActionView: string;
  driverUnassigned: string;
  // Client sort control.
  adminSortLabel: string;
  sortAttention: string;
  sortArrival: string;
  sortStatus: string;
};

// Client sort union — the SOLE ordering authority over the loaded rows (D-02).
type SortKey = "needs-attention" | "arrival" | "status";

// Lifecycle order used by the "Status" sort (mirrors the StatusDot/lifecycle order).
const STATUS_SORT_ORDER: TransferState[] = [
  "requested",
  "paid",
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
];

// The window event the Plan-01 top-bar search dispatches (client-side seam, no URL `q`).
const SEARCH_EVENT = "admin:search";

function fmtArrival(iso: string | null, lang: "en" | "bg"): string {
  if (!iso) return "—";
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Truncated, human-scannable id (also the substring search matches against).
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function TransfersView({
  rows,
  lang,
  statusOptions,
  activeStatus,
  attentionOnly,
  copy,
}: {
  rows: TransferRow[];
  lang: "en" | "bg";
  statusOptions: TransferState[];
  activeStatus: TransferState[];
  attentionOnly: boolean;
  copy: TransfersViewCopy;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // CLIENT-SIDE search term over the LOADED rows (D-01) — sourced from the shell top bar
  // via the `admin:search` window event. No URL `q` param, no server round-trip.
  const [search, setSearch] = useState("");
  // CLIENT-SIDE sort — the sole ordering authority over the loaded rows (D-02).
  const [sortKey, setSortKey] = useState<SortKey>("needs-attention");

  useEffect(() => {
    function onSearch(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setSearch(typeof detail === "string" ? detail : "");
    }
    window.addEventListener(SEARCH_EVENT, onSearch as EventListener);
    return () => window.removeEventListener(SEARCH_EVENT, onSearch as EventListener);
  }, []);

  // Re-query server-side by writing the URL searchParams (the RSC owns the read).
  // STATUS + attention chips ONLY — search is now client-side (D-01), no `q` here.
  function applyParams(next: { status?: string[]; attention?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.status !== undefined) {
      if (next.status.length > 0) params.set("status", next.status.join(","));
      else params.delete("status");
    }
    if (next.attention !== undefined) {
      if (next.attention) params.set("attention", "1");
      else params.delete("attention");
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

  // CLIENT-SIDE search over the loaded rows: substring match across guest name / flight no. /
  // destination (zone/airport) / truncated id. Keeps the test tokens guest_name + flight_no.
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const inGuest = (r.guest_name ?? "").toLowerCase().includes(needle);
      const inFlight = (r.flight_no ?? "").toLowerCase().includes(needle);
      const inDest = [r.zone, r.airport]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle));
      const inId = r.id.toLowerCase().includes(needle);
      return inGuest || inFlight || inDest || inId;
    });
  }, [rows, search]);

  // CLIENT-SIDE sort — the SOLE ordering authority over the loaded rows (D-02). No hidden
  // server pin underneath: "Needs attention" reproduces the coral-pin-then-arrival order here.
  const visibleRows = useMemo(() => {
    const arr = [...searched];
    const arrivalAsc = (a: TransferRow, b: TransferRow) => {
      const av = a.arrival_at ? new Date(a.arrival_at).getTime() : Number.POSITIVE_INFINITY;
      const bv = b.arrival_at ? new Date(b.arrival_at).getTime() : Number.POSITIVE_INFINITY;
      return av - bv;
    };
    if (sortKey === "arrival") {
      arr.sort(arrivalAsc);
    } else if (sortKey === "status") {
      arr.sort((a, b) => {
        const ai = STATUS_SORT_ORDER.indexOf(a.status);
        const bi = STATUS_SORT_ORDER.indexOf(b.status);
        if (ai !== bi) return ai - bi;
        return arrivalAsc(a, b);
      });
    } else {
      // "needs-attention" (default): coral-pinned to the top, then soonest arrival.
      arr.sort((a, b) => {
        if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
        return arrivalAsc(a, b);
      });
    }
    return arr;
  }, [searched, sortKey]);

  const hasActiveFilters =
    activeStatus.length > 0 || attentionOnly || search.trim().length > 0;
  const route = (r: TransferRow) =>
    [r.airport, r.zone].filter(Boolean).join(" → ") || "—";
  const driverCell = (r: TransferRow) =>
    r.driver_id === null ? copy.driverUnassigned : stateLabel(r.status);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-[24px] px-[24px] py-[32px]">
      {/* Controls: status filter chips + needs-attention quick filter (server re-query, D-08)
          and the client sort control (sole ordering authority, D-02). */}
      <div className="flex flex-col gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <span className="text-[14px] font-semibold leading-[1.4] text-grey">
            {copy.filterByStatusLabel}
          </span>
          <div className="flex flex-wrap items-center gap-[8px]">
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

        {/* Client sort control — sole ordering authority over the loaded rows (D-02). */}
        <div className="flex items-center gap-[8px]">
          <label
            htmlFor="admin-transfers-sort"
            className="text-[14px] font-semibold leading-[1.4] text-grey"
          >
            {copy.adminSortLabel}
          </label>
          <select
            id="admin-transfers-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="min-h-[44px] rounded-md border border-grey/30 bg-white px-[12px] text-[14px] font-semibold text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <option value="needs-attention">{copy.sortAttention}</option>
            <option value="arrival">{copy.sortArrival}</option>
            <option value="status">{copy.sortStatus}</option>
          </select>
        </div>
      </div>

      {/* List / empty / no-match states. */}
      {visibleRows.length === 0 ? (
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
        <>
          {/* DESKTOP: pending-transmissions <table> (md+). */}
          <div className="hidden overflow-x-auto rounded-md border border-grey/30 md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-grey/30 bg-slate/5 text-[12px] font-semibold uppercase tracking-wide text-grey">
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colTimeId}</th>
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colPassenger}</th>
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colRoute}</th>
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colLifecycle}</th>
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colStatus}</th>
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colDriver}</th>
                  <th scope="col" className="px-[16px] py-[12px]">{copy.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey/20">
                {visibleRows.map((r) => (
                  <tr
                    key={r.id}
                    className={`min-h-[56px] align-middle text-[14px] text-slate hover:bg-slate/5 ${
                      r.needsAttention ? "border-l-4 border-l-coral" : ""
                    }`}
                  >
                    <td className="px-[16px] py-[12px]">
                      <div className="flex flex-col gap-[2px]">
                        <span className="font-semibold">{fmtArrival(r.arrival_at, lang)}</span>
                        <span className="text-[12px] text-grey">{shortId(r.id)}</span>
                        {/* WCAG 1.4.1: coral rows ALWAYS carry the text badge — never colour alone. */}
                        {r.needsAttention ? (
                          <span className="mt-[2px] inline-flex w-fit items-center rounded-[4px] bg-coral px-[6px] py-[1px] text-[11px] font-semibold uppercase tracking-wide text-white">
                            {copy.needsAttentionBadge}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-[16px] py-[12px]">
                      {r.guest_name ?? "—"}
                      {r.flight_no ? (
                        <span className="ml-[6px] text-[12px] text-grey">{r.flight_no}</span>
                      ) : null}
                    </td>
                    <td className="px-[16px] py-[12px] text-slate">{route(r)}</td>
                    <td className="px-[16px] py-[12px]">
                      <div className="min-w-[220px]">
                        <LifecycleStepper current={r.status} />
                      </div>
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <StatusDot state={r.status} />
                    </td>
                    <td className="px-[16px] py-[12px] text-slate">{driverCell(r)}</td>
                    <td className="px-[16px] py-[12px]">
                      <Link
                        href={`/admin/transfers/${r.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-md border border-grey/30 px-[12px] text-[14px] font-semibold text-teal hover:bg-teal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                      >
                        {copy.rowActionView}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE: the existing stacked rows reused verbatim as the card fallback (D-04). */}
          <ul className="flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white md:hidden">
            {visibleRows.map((r) => (
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
                    <span className="text-slate">{route(r)}</span>
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
                    <span>·</span>
                    <span>{driverCell(r)}</span>
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
        </>
      )}
    </section>
  );
}
