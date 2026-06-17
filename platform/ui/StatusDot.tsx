// platform/ui/StatusDot.tsx — lifecycle status indicator (PLAT-03 / T-04-02).
//
// Brand rule (WCAG 1.4.1): status is ALWAYS a coloured dot PLUS a text label —
// colour is never the sole signal. The lifecycle colour map is the platform-wide
// contract (UI-SPEC); only proven visually in Phase 1, consumed fully from Phase 4.
// The label uses the Label typography role (14px / 600).

// The transfer lifecycle union — the system-of-record state machine (platform-wide).
export type TransferState =
  | "requested"
  | "paid"
  | "claimed"
  | "en_route"
  | "arrived"
  | "picked_up"
  | "completed"
  | "cancelled";

// Per-state token colour class + human label. Colour class uses the brand
// utilities generated from the @theme tokens (bg-teal, bg-grey, …).
const STATE_META: Record<
  TransferState,
  { colorClass: string; label: string }
> = {
  requested: { colorClass: "bg-grey", label: "Requested" },
  paid: { colorClass: "bg-teal2", label: "Paid" },
  claimed: { colorClass: "bg-teal", label: "Claimed" },
  en_route: { colorClass: "bg-amber", label: "En route" },
  arrived: { colorClass: "bg-amber", label: "Arrived" },
  picked_up: { colorClass: "bg-teal", label: "Picked up" },
  completed: { colorClass: "bg-grey", label: "Completed" },
  cancelled: { colorClass: "bg-coral", label: "Cancelled" },
};

export function StatusDot({ state }: { state: TransferState }) {
  const { colorClass, label } = STATE_META[state];

  return (
    <span className="inline-flex items-center gap-[4px]">
      {/* Coloured dot — never the sole signal; the label below always renders. */}
      <span
        data-testid="status-dot"
        aria-hidden="true"
        className={`inline-block h-[10px] w-[10px] rounded-full ${colorClass}`}
      />
      {/* Label typography role: 14px / 600. */}
      <span className="text-[14px] font-semibold leading-[1.4] text-slate">
        {label}
      </span>
    </span>
  );
}
