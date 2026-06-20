// platform/ui/LifecycleStepper.test.tsx — DS-04 (D-05/06/07/08), WCAG 1.4.1.
//
// Proves the new HORIZONTAL step-styled lifecycle stepper:
//  - it consumes STEPPER_ORDER (6 steps paid→completed) and STATE_META labels —
//    no hand-rolled order/label arrays (Don't-Hand-Roll lock, T-04-02/D-06);
//  - each step encodes its state beyond colour (D-07): completed = teal circle +
//    a white check, active = amber solid circle, pending = grey outline ring;
//  - the active step carries aria-current="step";
//  - all 6 worded labels render (shape is never the sole signal, WCAG 1.4.1);
//  - current="cancelled" (D-08) renders the DISTINCT terminal treatment
//    (StatusDot hollow coral ring + "Cancelled") and NOT the 6-step track.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { STEPPER_ORDER } from "@/platform/transfers/lifecycle";
import { LifecycleStepper } from "./LifecycleStepper";

// The exact worded labels the stepper must surface (derived from STATE_META,
// UI-SPEC casing): Paid → Claimed → En route → Arrived → Picked up → Completed.
const STEP_LABELS = [
  "Paid",
  "Claimed",
  "En route",
  "Arrived",
  "Picked up",
  "Completed",
];

describe("LifecycleStepper", () => {
  it("iterates exactly the 6 STEPPER_ORDER steps", () => {
    const { container } = render(<LifecycleStepper current="claimed" />);
    const steps = container.querySelectorAll('[data-testid="stepper-step"]');
    expect(steps.length).toBe(STEPPER_ORDER.length);
    expect(steps.length).toBe(6);
  });

  it("renders all 6 worded labels (colour is never the sole signal)", () => {
    render(<LifecycleStepper current="claimed" />);
    for (const label of STEP_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("classifies completed / active / pending shapes relative to current", () => {
    const { container } = render(<LifecycleStepper current="claimed" />);

    // paid (index 0 < 1) is COMPLETED: teal circle + a white check inside.
    const paid = container.querySelector(
      '[data-testid="stepper-step"][data-state="paid"]',
    );
    const paidShape = paid?.querySelector('[data-testid="stepper-shape"]');
    expect(paidShape).toHaveClass("bg-teal");
    expect(
      paid?.querySelector('[data-testid="stepper-check"]'),
    ).not.toBeNull();

    // claimed (index 1 === current) is ACTIVE: amber solid circle, aria-current.
    const claimed = container.querySelector(
      '[data-testid="stepper-step"][data-state="claimed"]',
    );
    const claimedShape = claimed?.querySelector('[data-testid="stepper-shape"]');
    expect(claimedShape).toHaveClass("bg-amber");
    expect(claimed?.getAttribute("aria-current")).toBe("step");

    // en_route (index 2 > 1) is PENDING: grey outline ring, no fill, no check.
    const enRoute = container.querySelector(
      '[data-testid="stepper-step"][data-state="en_route"]',
    );
    const enRouteShape = enRoute?.querySelector('[data-testid="stepper-shape"]');
    expect(enRouteShape).toHaveClass("border-grey");
    expect(enRouteShape).not.toHaveClass("bg-teal");
    expect(enRouteShape).not.toHaveClass("bg-amber");
    expect(enRoute?.getAttribute("aria-current")).toBeNull();
    expect(
      enRoute?.querySelector('[data-testid="stepper-check"]'),
    ).toBeNull();
  });

  it("marks every step completed when current is the terminal completed state", () => {
    const { container } = render(<LifecycleStepper current="completed" />);
    const checks = container.querySelectorAll('[data-testid="stepper-check"]');
    // All 6 steps show the completed check (the last is the active/terminal step).
    expect(checks.length).toBe(6);
    const completed = container.querySelector(
      '[data-testid="stepper-step"][data-state="completed"]',
    );
    expect(completed?.getAttribute("aria-current")).toBe("step");
  });

  it("renders the DISTINCT cancelled terminal treatment, not the 6-step track (D-08)", () => {
    const { container } = render(<LifecycleStepper current="cancelled" />);

    // The cancelled terminal banner: StatusDot hollow coral ring + "Cancelled".
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("border-2", "border-coral", "bg-transparent");
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    // The 6-step track is NOT rendered (no stepper steps, none of the 6 labels).
    expect(
      container.querySelectorAll('[data-testid="stepper-step"]').length,
    ).toBe(0);
    for (const label of STEP_LABELS) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});
