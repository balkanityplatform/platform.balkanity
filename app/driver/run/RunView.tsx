"use client";
// app/driver/run/RunView.tsx — driver "My Trips" client island (CLAIM-05/CLAIM-06, D-05/D-06, DUI-03).
//
// Renders the driver's OWN active claimed transfers as warm-light TRIP CARDS ordered by arrival_at
// ASCENDING (soonest first, CLAIM-06). Each card carries: the arrival date · pickup time, a per-row
// <StatusDot> badge with the row's REAL lifecycle state (Claimed=teal / En route=amber / Completed=
// grey / Cancelled=hollow coral ring — NOT a coral "Unclaimed" override; that presentation belongs
// only to the pool's Available surface), a RouteMotif (airport → zone), a pax · luggage meta row, a
// teal "details" link to /driver/run/[id], and a single next-step 52px primary CTA whose label is
// chosen by the next forward edge resolved through the lifecycle map (claimed→"Start driving",
// en_route→"Mark arrived", arrived→"Mark picked up", picked_up→"Mark completed").
//
// The CTA invokes advanceStatus(id) (the D-13 gated service-role write). On success the server
// revalidates /driver/run, so the card re-renders at the new status; a row that reaches
// `completed` DROPS OUT of the active run into the collapsed "Completed today" section (D-06) —
// it never re-appears in the active list. On failure a coral advanceFailedToast is shown.
//
// CLAIM-04: there is deliberately NO release/give-back control here — a driver cannot return a
// claim once made; the only forward motion is the advance CTA.
//
// NO earnings, NO ratings anywhere (Decision 1). The slim top header (logo · Alerts bell · language
// toggle) + the bottom nav live in app/driver/layout.tsx (Plan 01) — NOT in this island.
import { useState, useTransition } from "react";
import { Button } from "@/platform/ui/Button";
import { RouteMotif } from "@/platform/ui/RouteMotif";
import { StatusDot } from "@/platform/ui/StatusDot";
import { Toast } from "@/platform/ui/Toast";
import type { TransferState } from "@/platform/ui/StatusDot";
import { ALLOWED_TRANSITIONS } from "@/platform/transfers/lifecycle";
import { PlaneIcon, BuildingIcon } from "@/app/(guest)/_pass/icons";
import { LuggageIcon } from "../_ui/icons";
import { advanceStatus } from "../actions";

// The full post-claim row the driver legitimately sees (claiming-driver RLS).
export type RunRow = {
  id: string;
  status: string;
  arrival_at: string;
  guest_name: string | null;
  guest_phone: string | null;
  flight_no: string | null;
  notes: string | null;
  amount_cents: number;
  pax: number | null;
  luggage_count: number | null;
  destinations: {
    address: string | null;
    zone: string | null;
    airport: string | null;
  } | null;
};

export type RunViewCopy = {
  myRunTitle: string;
  runEmptyHeading: string;
  runEmptyBody: string;
  completedTodayTitle: string;
  airportLabel: string;
  zoneLabel: string;
  passengersLabel: string;
  luggageLabel: string;
  advanceToEnRouteCta: string;
  advanceToArrivedCta: string;
  advanceToPickedUpCta: string;
  advanceToCompletedCta: string;
  advanceFailedToast: string;
};

// Map the next forward edge → the matching advance CTA label. Returns null when there is no
// driver-forward edge (terminal), in which case no CTA renders.
function nextEdgeCta(
  status: TransferState,
  copy: RunViewCopy,
): { next: TransferState; label: string } | null {
  const next = ALLOWED_TRANSITIONS[status].find(
    (s) => s !== "cancelled" && s !== "paid",
  );
  if (!next) return null;
  const labelByNext: Partial<Record<TransferState, string>> = {
    en_route: copy.advanceToEnRouteCta,
    arrived: copy.advanceToArrivedCta,
    picked_up: copy.advanceToPickedUpCta,
    completed: copy.advanceToCompletedCta,
  };
  const label = labelByNext[next];
  return label ? { next, label } : null;
}

function fmtArrival(iso: string, lang: "en" | "bg"): string {
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Active states (driver-actionable) vs the terminal completed bucket. A `completed` row is
// partitioned into the "Completed today" section; everything else active is in the run list.
const ACTIVE_STATES: ReadonlyArray<string> = [
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
];

export function RunView({
  active,
  completed,
  lang,
  copy,
}: {
  active: RunRow[];
  completed: RunRow[];
  lang: "en" | "bg";
  copy: RunViewCopy;
}) {
  const [pending, startTransition] = useTransition();
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Defensive client-side ordering: arrival_at ASC (the RSC already orders, this keeps the
  // contract local to the island for CLAIM-06). Completed rows live in their own bucket.
  const activeSorted = active
    .filter((r) => ACTIVE_STATES.includes(r.status))
    .slice()
    .sort((a, b) => a.arrival_at.localeCompare(b.arrival_at));
  const completedToday = completed.filter((r) => r.status === "completed");

  function onAdvance(id: string) {
    if (advancingId) return; // one advance in flight at a time
    setAdvancingId(id);
    startTransition(async () => {
      try {
        const result = await advanceStatus(id);
        if (!result.ok) {
          setToast(copy.advanceFailedToast);
        }
        // On success the server revalidate refreshes the run; a completed row drops into the
        // Completed today section on the next render.
      } catch {
        setToast(copy.advanceFailedToast);
      } finally {
        setAdvancingId(null);
      }
    });
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-[24px] px-[24px] py-[24px]">
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {copy.myRunTitle}
      </h1>

      {activeSorted.length === 0 ? (
        <div className="flex flex-col gap-[8px] py-[32px] text-center">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
            {copy.runEmptyHeading}
          </h2>
          <p className="text-[16px] leading-[1.5] text-grey">
            {copy.runEmptyBody}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[16px]">
          {activeSorted.map((r) => {
            const cta = nextEdgeCta(r.status as TransferState, copy);
            return (
              <li
                key={r.id}
                className="flex flex-col gap-[16px] rounded-md border border-grey/30 bg-white p-[16px] shadow-sm"
              >
                {/* Top row: arrival date · pickup time + the per-row REAL status badge (DS-02
                    dot+label — NOT a coral Unclaimed override; that's the pool's presentation). */}
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-[16px] font-semibold leading-[1.4] text-slate">
                    {fmtArrival(r.arrival_at, lang)}
                  </span>
                  <StatusDot state={r.status as TransferState} />
                </div>

                {/* Route motif: airport → zone (area only). */}
                <RouteMotif
                  start={{
                    icon: <PlaneIcon />,
                    label: r.destinations?.airport ?? copy.airportLabel,
                  }}
                  end={{
                    icon: <BuildingIcon />,
                    label: r.destinations?.zone ?? copy.zoneLabel,
                  }}
                />

                {/* Meta row: pax · luggage — no earnings, no ratings (Decision 1). */}
                <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[14px] leading-[1.4] text-grey">
                  {r.pax != null && (
                    <span>
                      <span className="text-grey">{copy.passengersLabel}: </span>
                      <span className="font-semibold text-slate">{r.pax}</span>
                    </span>
                  )}
                  {r.luggage_count != null && (
                    <span className="inline-flex items-center gap-[4px]">
                      <LuggageIcon className="text-grey" aria-label={copy.luggageLabel} />
                      <span className="font-semibold text-slate">
                        {r.luggage_count}
                      </span>
                    </span>
                  )}
                </div>

                {/* Teal details link → the trip detail (My Trips tab stays lit there, D-02).
                    Labelled with the route summary (airport → zone). */}
                <a
                  href={`/driver/run/${r.id}`}
                  className="text-[14px] font-semibold text-teal underline"
                >
                  {[r.destinations?.airport, r.destinations?.zone]
                    .filter(Boolean)
                    .join(" → ")}
                </a>

                {cta ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={advancingId === r.id || pending}
                    onClick={() => onAdvance(r.id)}
                  >
                    {cta.label}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Completed today: rows that reached completed drop out of the active run here (D-06). */}
      {completedToday.length > 0 ? (
        <details className="rounded-md border border-grey/30 bg-white p-[16px]">
          <summary className="cursor-pointer text-[16px] font-semibold leading-[1.4] text-slate">
            {copy.completedTodayTitle} ({completedToday.length})
          </summary>
          <ul className="mt-[12px] flex flex-col gap-[8px]">
            {completedToday.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-[8px] text-[14px] leading-[1.4] text-grey"
              >
                <span className="text-slate">{fmtArrival(r.arrival_at, lang)}</span>
                <StatusDot state={r.status as TransferState} />
                <a
                  href={`/driver/run/${r.id}`}
                  className="font-semibold text-teal underline"
                >
                  {[r.destinations?.airport, r.destinations?.zone]
                    .filter(Boolean)
                    .join(" → ")}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-50 flex justify-center px-[24px]">
          <Toast message={toast} tone="error" onDismiss={() => setToast(null)} />
        </div>
      )}
    </section>
  );
}
