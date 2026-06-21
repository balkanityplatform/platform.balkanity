"use client";
// app/driver/PoolView.tsx — driver pool client island (CLAIM-01/CLAIM-04, D-01/D-03).
//
// Renders the masked pre-claim pool as warm-light cards (white surface, teal accents) — each
// card shows ONLY the 9 non-PII pool columns from wp_pool(): arrival date/time, airport, zone
// (area only), flight_no (operational, D-02), fare, pax, luggage. There is deliberately NO
// guest contact / address / notes here — masking is structural at the RPC, this island merely
// renders what the RPC returns (Pitfall 11).
//
// Live refresh (D-01): refetchPool on window focus + a ~25s interval poll while the tab is
// visible (cleared on unmount / when hidden). The pool data path is NetworkFirst (app/sw.ts) —
// a stale pool must never be served from the SW cache (Pitfall 4); the graceful already_claimed
// branch is the second line of defence.
//
// Claim (D-03): tap Claim → claimAction(id). A WIN (result.ok) navigates to /driver/run/<id>;
// the full PII renders THERE from the claimed row the RPC already returned — NO follow-up PII
// fetch from this island. A LOSS (reason === 'already_claimed') shows the NEUTRAL toast and
// silently removes the card — never an error state. Any other reason → coral error toast.
//
// CLAIM-04: a driver can never give a claimed transfer back — no such control exists here.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/platform/ui/Button";
import { RouteMotif } from "@/platform/ui/RouteMotif";
import { Toast, type ToastTone } from "@/platform/ui/Toast";
import { fmtEur } from "@/platform/money/commission";
import { PlaneIcon, BuildingIcon } from "@/app/(guest)/_pass/icons";
import { LuggageIcon } from "./_ui/icons";
import { claimAction, refetchPool } from "./actions";

// The 9 masked pool columns — mirrors wp_pool()'s return shape. NO PII keys by construction.
export type PoolRow = {
  id: string;
  status: string;
  arrival_at: string;
  airport: string | null;
  zone: string | null;
  flight_no: string | null;
  amount_cents: number;
  pax: number | null;
  luggage_count: number | null;
};

export type PoolViewCopy = {
  claimTransferCta: string;
  poolEmptyHeading: string;
  poolEmptyBody: string;
  claimLostToast: string;
  claimFailedToast: string;
  airportLabel: string;
  zoneLabel: string;
  unclaimedBadge: string;
  flightLabel: string;
  fareLabel: string;
  passengersLabel: string;
  luggageLabel: string;
};

const POLL_INTERVAL_MS = 25_000; // ~20-30s live refresh (D-01 / UI-SPEC interaction contract).

function fmtArrival(iso: string, lang: "en" | "bg"): string {
  const locale = lang === "bg" ? "bg-BG" : "en-GB";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
  const time = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

export function PoolView({
  pool,
  lang,
  copy,
}: {
  pool: PoolRow[];
  lang: "en" | "bg";
  copy: PoolViewCopy;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PoolRow[]>(pool);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(
    null,
  );

  // Live refresh: re-read the masked pool on focus + a light interval while visible.
  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const fresh = await refetchPool();
      setRows(fresh);
    } catch {
      // Transient poll failure is non-fatal — keep the last good pool; the next tick retries.
    }
  }, []);

  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    const onFocus = () => pollRef.current();
    const onVisible = () => pollRef.current();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => pollRef.current(), POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  async function onClaim(id: string) {
    if (claimingId) return; // one in-flight claim at a time (prevent double-submit).
    setClaimingId(id);
    try {
      const result = await claimAction(id);
      if (result.ok) {
        // WIN: land on the run detail; full PII renders there from the returned row.
        router.push(`/driver/run/${id}`);
        return;
      }
      if (result.reason === "already_claimed") {
        // LOSS: neutral toast (NOT an error, D-03) + silently drop the card.
        setToast({ message: copy.claimLostToast, tone: "neutral" });
        setRows((prev) => prev.filter((r) => r.id !== id));
        return;
      }
      // Genuine transport/claim failure — coral error toast; card stays.
      setToast({ message: copy.claimFailedToast, tone: "error" });
    } catch {
      setToast({ message: copy.claimFailedToast, tone: "error" });
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <>
      <section className="mx-auto flex max-w-2xl flex-col gap-[16px] px-[24px] py-[24px]">
        {rows.length === 0 ? (
          <div className="flex flex-col gap-[8px] py-[32px] text-center">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
              {copy.poolEmptyHeading}
            </h2>
            <p className="text-[16px] leading-[1.5] text-grey">
              {copy.poolEmptyBody}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-[16px]">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-[16px] rounded-md border border-grey/30 bg-white p-[16px] shadow-sm"
              >
                {/* Top row: arrival date · pickup time + the coral Unclaimed pill (DS-02
                    presentation copy over a status='paid' row — NOT a new TransferState). */}
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-[16px] font-semibold leading-[1.4] text-slate">
                    {fmtArrival(r.arrival_at, lang)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-coral px-[12px] py-[4px] text-[14px] font-semibold leading-[1.4] text-white">
                    {copy.unclaimedBadge}
                  </span>
                </div>

                {/* Route motif: airport → zone (area only — never the exact address). */}
                <RouteMotif
                  start={{
                    icon: <PlaneIcon />,
                    label: r.airport ?? copy.airportLabel,
                  }}
                  end={{
                    icon: <BuildingIcon />,
                    label: r.zone ?? copy.zoneLabel,
                  }}
                />

                {/* Meta row: flight · fare · pax · luggage — the masked non-PII columns. */}
                <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[14px] leading-[1.4] text-grey">
                  {r.flight_no && (
                    <span>
                      <span className="text-grey">{copy.flightLabel}: </span>
                      <span className="font-semibold text-slate">{r.flight_no}</span>
                    </span>
                  )}
                  <span>
                    <span className="text-grey">{copy.fareLabel}: </span>
                    <span className="font-semibold text-slate">
                      {fmtEur(r.amount_cents)} €
                    </span>
                  </span>
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

                <Button
                  type="button"
                  className="w-full"
                  disabled={claimingId === r.id}
                  onClick={() => onClaim(r.id)}
                >
                  {copy.claimTransferCta}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-50 flex justify-center px-[24px]">
          <Toast
            message={toast.message}
            tone={toast.tone}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}
    </>
  );
}
