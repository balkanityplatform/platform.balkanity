"use client";
// app/driver/run/[id]/DetailView.tsx — driver trip-detail advance island (DUI-04).
//
// The single client interaction on the otherwise-RSC trip-detail page: a next-forward-edge advance
// CTA wired to the EXISTING advanceStatus(id) (the D-13 gated service-role write — reused VERBATIM,
// NOT re-implemented here). The label is chosen by the next forward edge resolved THROUGH the
// lifecycle map (claimed→"Start driving", en_route→"Confirm arrival" (DUI-04, the NEW edge label),
// arrived→"Mark picked up", picked_up→"Mark completed"). At a terminal/cancelled state there is no
// driver-forward edge, so nothing renders.
//
// The advance logic (next-edge resolution + the useTransition onAdvance with the coral
// advanceFailedToast) is copied VERBATIM from app/driver/run/RunView.tsx — the ONLY change is the
// en_route→arrived label, which keys `arrived: copy.driverConfirmArrivalCta` ("Confirm arrival").
//
// CLAIM-04: there is deliberately NO release / give-back control here — the only forward motion is
// this advance CTA. No new server action is defined; advanceStatus is imported and reused.
import { useState, useTransition } from "react";
import { Button } from "@/platform/ui/Button";
import { Toast } from "@/platform/ui/Toast";
import type { TransferState } from "@/platform/ui/StatusDot";
import { ALLOWED_TRANSITIONS } from "@/platform/transfers/lifecycle";
import { advanceStatus } from "../../actions";

export type DetailViewCopy = {
  advanceToEnRouteCta: string;
  advanceToArrivedCta: string;
  advanceToPickedUpCta: string;
  advanceToCompletedCta: string;
  driverConfirmArrivalCta: string;
  advanceFailedToast: string;
};

export function DetailView({
  id,
  status,
  copy,
}: {
  id: string;
  status: TransferState;
  copy: DetailViewCopy;
}) {
  const [pending, startTransition] = useTransition();
  const [advancing, setAdvancing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Next-forward-edge resolution via the lifecycle map (never cancelled/paid) — copied verbatim
  // from RunView; the ONLY change is the en_route→arrived label (driverConfirmArrivalCta).
  const next = ALLOWED_TRANSITIONS[status].find(
    (s) => s !== "cancelled" && s !== "paid",
  );
  if (!next) return null;
  const labelByNext: Partial<Record<TransferState, string>> = {
    en_route: copy.advanceToEnRouteCta,
    arrived: copy.driverConfirmArrivalCta, // NEW — "Confirm arrival" for the en_route→arrived edge (DUI-04).
    picked_up: copy.advanceToPickedUpCta,
    completed: copy.advanceToCompletedCta,
  };
  const label = labelByNext[next];
  if (!label) return null;

  function onAdvance() {
    if (advancing) return; // one advance in flight at a time
    setAdvancing(true);
    startTransition(async () => {
      try {
        const result = await advanceStatus(id);
        if (!result.ok) {
          setToast(copy.advanceFailedToast);
        }
        // On success the server revalidate refreshes the detail at the new status.
      } catch {
        setToast(copy.advanceFailedToast);
      } finally {
        setAdvancing(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        className="w-full"
        disabled={advancing || pending}
        onClick={onAdvance}
      >
        {label}
      </Button>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-50 flex justify-center px-[24px]">
          <Toast message={toast} tone="error" onDismiss={() => setToast(null)} />
        </div>
      )}
    </>
  );
}
