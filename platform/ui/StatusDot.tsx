// platform/ui/StatusDot.tsx — lifecycle status indicator (PLAT-03 / T-04-02 / DS-02).
//
// Brand rule (WCAG 1.4.1): status is ALWAYS a coloured shape PLUS a text label —
// colour is never the sole signal. The lifecycle colour map is the platform-wide
// contract (UI-SPEC); only proven visually in Phase 1, consumed fully from Phase 4.
// The label uses the Label typography role (14px / 600).
//
// DS-02 (D-03): a `variant` prop exposes two renderers over ONE colour/label map —
// `"dot"` (default; the original inline dot+label, existing callers unchanged) and
// `"pill"` (a solid filled badge, e.g. coral "Unclaimed" on a driver claim card).
// DS-02 (D-04): the one status-rendering change this phase ships — `cancelled` is a
// hollow coral ring (`border-2 border-coral bg-transparent`, NOT a solid `bg-coral`
// dot) in BOTH variants, off the happy path, with the worded label still present.

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

// DS-02 (D-03): how a status renders — the inline dot (default) or a filled pill.
export type StatusVariant = "dot" | "pill";

// Per-state token colour class + human label. Colour class uses the brand
// utilities generated from the @theme tokens (bg-teal, bg-grey, …).
// SINGLE SOURCE OF TRUTH: both variants read this one map (T-04-02 Don't-Hand-Roll).
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

// Read-only label accessor over the single STATE_META source. Consumers that
// render their own shape (e.g. the DS-04 LifecycleStepper) derive the worded
// label from HERE rather than hand-rolling a parallel label array (T-04-02).
export function stateLabel(state: TransferState): string {
  return STATE_META[state].label;
}

// D-04: cancelled is off the happy path — a hollow coral ring in BOTH variants.
// 2px stroke, transparent fill; the worded label still renders (WCAG 1.4.1).
const CANCELLED_RING = "border-2 border-coral bg-transparent";

// Label typography role: 14px / 600 slate (kept verbatim across variants).
const LABEL_CLASS = "text-[14px] font-semibold leading-[1.4] text-slate";

export function StatusDot({
  state,
  variant = "dot",
}: {
  state: TransferState;
  variant?: StatusVariant;
}) {
  const { colorClass, label } = STATE_META[state];
  const isCancelled = state === "cancelled";

  // D-04: cancelled renders as the hollow-ring dot+label in BOTH variants —
  // it is the terminal off-happy-path state, never a filled pill.
  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-[4px]">
        <span
          data-testid="status-dot"
          aria-hidden="true"
          className={`inline-block h-[10px] w-[10px] rounded-full ${CANCELLED_RING}`}
        />
        <span className={LABEL_CLASS}>{label}</span>
      </span>
    );
  }

  // "pill": a solid filled badge — the per-state colour fills the badge and the
  // worded label sits on top in white (still WCAG 1.4.1, label present).
  if (variant === "pill") {
    return (
      <span
        data-testid="status-pill"
        className={`inline-flex items-center rounded-full px-[12px] py-[4px] ${colorClass}`}
      >
        <span className="text-[14px] font-semibold leading-[1.4] text-white">
          {label}
        </span>
      </span>
    );
  }

  // "dot" (default): the EXACT original markup — existing callers see no change.
  return (
    <span className="inline-flex items-center gap-[4px]">
      {/* Coloured dot — never the sole signal; the label below always renders. */}
      <span
        data-testid="status-dot"
        aria-hidden="true"
        className={`inline-block h-[10px] w-[10px] rounded-full ${colorClass}`}
      />
      {/* Label typography role: 14px / 600. */}
      <span className={LABEL_CLASS}>{label}</span>
    </span>
  );
}
