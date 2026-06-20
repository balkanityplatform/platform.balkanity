// platform/ui/LifecycleStepper.tsx — horizontal step-styled lifecycle (DS-04).
//
// The NEW separate horizontal stepper every surface uses to show transfer
// progress (Guest status pass, Driver trip detail, Admin row/detail). It is a
// distinct component (D-05): the existing vertical `LifecycleTimeline` is left
// UNTOUCHED — no orientation-prop refactor.
//
// Don't-Hand-Roll lock (T-04-02 / D-06): it consumes the centralised
// `STEPPER_ORDER` (the 6 steps paid→completed, lifecycle.ts) and the StatusDot
// `STATE_META` worded labels (via `stateLabel`). It declares NO local order or
// label array.
//
// Shape encodes state beyond colour (D-07, WCAG 1.4.1 — colour is never the sole
// signal): Completed = teal circle + a white check; Active = amber solid circle;
// Pending = grey (#66676F) outline ring (`border border-grey`). Each step ALSO
// renders its worded label.
//
// `cancelled` (D-08) is off the happy path: it short-circuits to a DISTINCT
// terminal treatment — the StatusDot hollow coral ring + "Cancelled" — instead of
// the 6-step track, mirroring `LifecycleTimeline`'s terminal cancelled row. It is
// never wedged into the horizontal row.
import { STEPPER_ORDER } from "@/platform/transfers/lifecycle";
import { StatusDot, stateLabel, type TransferState } from "@/platform/ui/StatusDot";

// A small inline check mark for the completed step (white on the teal circle).
// shape is the signal; the worded label below remains the primary cue (WCAG 1.4.1).
function CheckMark() {
  return (
    <svg
      data-testid="stepper-check"
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-[14px] w-[14px] text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function LifecycleStepper({ current }: { current: TransferState }) {
  // D-08: cancelled short-circuits to the distinct terminal treatment — render
  // the StatusDot hollow coral ring + "Cancelled" banner, NOT the 6-step track.
  if (current === "cancelled") {
    return (
      <div
        data-testid="stepper-cancelled"
        aria-current="step"
        className="inline-flex items-center font-semibold text-slate"
      >
        <StatusDot state="cancelled" />
      </div>
    );
  }

  // Classify each step relative to `current`'s index in STEPPER_ORDER. A `current`
  // not on the track (e.g. `requested`, which the stepper omits) yields -1 → every
  // step renders pending, which is the correct pre-`paid` resting state.
  const currentIdx = STEPPER_ORDER.indexOf(current);

  return (
    <ol className="flex items-center gap-[8px]">
      {STEPPER_ORDER.map((state, idx) => {
        // `completed` is the terminal happy-path state: when reached, the LAST
        // step is both the active/terminal step AND shows the completed (teal +
        // check) treatment — the track is fully done. For every other `current`
        // the active step is the amber in-progress circle.
        const isTerminalCompleted = current === "completed";
        const isActive = idx === currentIdx;
        const isCompleted =
          (currentIdx >= 0 && idx < currentIdx) ||
          (isActive && isTerminalCompleted);
        // (pending is the remaining case: idx > currentIdx or off-track)

        // Shape per state (D-07) — distinct beyond colour:
        //  completed = teal solid circle (+ white check inside)
        //  active    = amber solid circle
        //  pending   = grey outline ring (transparent fill, no check)
        const shapeClass = isCompleted
          ? "bg-teal"
          : isActive
            ? "bg-amber"
            : "border border-grey bg-transparent";

        return (
          <li
            key={state}
            data-testid="stepper-step"
            data-state={state}
            aria-current={isActive ? "step" : undefined}
            className="flex flex-1 flex-col items-center gap-[4px] text-center"
          >
            <div className="flex w-full items-center">
              {/* Leading connector segment (omitted before the first step). */}
              {idx > 0 ? (
                <span
                  aria-hidden="true"
                  className={`h-[2px] flex-1 ${
                    isCompleted || isActive ? "bg-teal" : "bg-grey/40"
                  }`}
                />
              ) : (
                <span aria-hidden="true" className="flex-1" />
              )}

              {/* The step shape — the secondary signal; the label is primary. */}
              <span
                data-testid="stepper-shape"
                aria-hidden="true"
                className={`inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${shapeClass}`}
              >
                {isCompleted ? <CheckMark /> : null}
              </span>

              {/* Trailing connector segment (omitted after the last step). */}
              {idx < STEPPER_ORDER.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-[2px] flex-1 ${
                    isCompleted ? "bg-teal" : "bg-grey/40"
                  }`}
                />
              ) : (
                <span aria-hidden="true" className="flex-1" />
              )}
            </div>

            {/* Worded label (WCAG 1.4.1) — derived from the single STATE_META
                source via stateLabel(), never a hand-rolled array (D-06). */}
            <span className="text-[14px] font-semibold leading-[1.4] text-slate">
              {stateLabel(state)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
