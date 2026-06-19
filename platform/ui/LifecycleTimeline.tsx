// platform/ui/LifecycleTimeline.tsx — vertical 8-state lifecycle timeline (BOOK-07, SC4).
//
// Renders the transfer lifecycle as a vertical ordered list, one row per state, each
// row = a <StatusDot/> (the platform-wide dot+label contract, WCAG 1.4.1 — colour is
// NEVER the sole signal) + a slot for a timestamp. The current state is emphasised;
// past rows are full-opacity; future rows are muted. The LABEL TEXT IS ALWAYS PRESENT
// (StatusDot always renders the label), so opacity is a secondary cue only.
//
// SINGLE SOURCE OF TRUTH: the state union (TransferState) and the colour map live in
// StatusDot; the lifecycle order (LIFECYCLE_ORDER, the 7 happy-path states) lives in
// platform/transfers/lifecycle.ts. This file declares NO local state→colour map and NO
// local state enum — it consumes both verbatim (Don't-Hand-Roll lock, T-04-02).
//
// `cancelled` is EXCLUDED from LIFECYCLE_ORDER (it is not a happy-path step). When the
// transfer is cancelled it is rendered as a DISTINCT terminal coral row, not inline.
import { LIFECYCLE_ORDER } from "@/platform/transfers/lifecycle";
import { StatusDot, type TransferState } from "@/platform/ui/StatusDot";

// Index of the current state within the happy-path order (−1 if not on it, e.g.
// `cancelled`). Used to classify each row as past / current / future for emphasis.
function orderIndex(state: TransferState): number {
  return LIFECYCLE_ORDER.indexOf(state);
}

export function LifecycleTimeline({ current }: { current: TransferState }) {
  const currentIdx = orderIndex(current);
  const isCancelled = current === "cancelled";

  return (
    <ol className="flex flex-col gap-[16px]">
      {LIFECYCLE_ORDER.map((state, idx) => {
        const isCurrent = !isCancelled && state === current;
        const isFuture = isCancelled || (currentIdx >= 0 && idx > currentIdx);

        // Emphasis cues. The label text is ALWAYS rendered by StatusDot, so opacity
        // is a secondary signal layered on top (WCAG 1.4.1 holds regardless).
        const rowClass = isCurrent
          ? "font-semibold text-slate"
          : isFuture
            ? "opacity-50"
            : "opacity-100";

        return (
          <li
            key={state}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex items-center justify-between ${rowClass}`}
          >
            <StatusDot state={state} />
            {/* Timestamp slot — empty for now; Phase 5/6 may surface per-state times. */}
            <span className="text-[14px] leading-[1.4] text-grey" />
          </li>
        );
      })}

      {/* Terminal cancelled row — distinct, coral, only when reached (never inline). */}
      {isCancelled ? (
        <li
          aria-current="step"
          className="flex items-center justify-between font-semibold text-slate"
        >
          <StatusDot state="cancelled" />
          <span className="text-[14px] leading-[1.4] text-grey" />
        </li>
      ) : null}
    </ol>
  );
}
