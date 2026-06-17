// platform/ui/StatusDot.test.tsx — PLAT-03 / T-04-02 (WCAG 1.4.1).
//
// Proves the brand rule that status is ALWAYS a coloured dot PLUS a non-empty
// text label — colour is never the sole signal — and that each lifecycle state
// maps to the correct token-derived colour class (UI-SPEC lifecycle map).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type TransferState, StatusDot } from "./StatusDot";

// Expected label text + token colour class per lifecycle state (UI-SPEC map).
const CASES: Array<{
  state: TransferState;
  label: string;
  colorClass: string;
}> = [
  { state: "requested", label: "Requested", colorClass: "bg-grey" },
  { state: "paid", label: "Paid", colorClass: "bg-teal2" },
  { state: "claimed", label: "Claimed", colorClass: "bg-teal" },
  { state: "en_route", label: "En route", colorClass: "bg-amber" },
  { state: "arrived", label: "Arrived", colorClass: "bg-amber" },
  { state: "picked_up", label: "Picked up", colorClass: "bg-teal" },
  { state: "completed", label: "Completed", colorClass: "bg-grey" },
  { state: "cancelled", label: "Cancelled", colorClass: "bg-coral" },
];

describe("StatusDot", () => {
  it.each(CASES)(
    "renders a non-empty text label for %s (colour never the sole signal)",
    ({ state, label }) => {
      render(<StatusDot state={state} />);
      const text = screen.getByText(label);
      expect(text).toBeInTheDocument();
      expect(text.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    },
  );

  it.each(CASES)(
    "maps %s to the correct token colour class",
    ({ state, colorClass }) => {
      const { container } = render(<StatusDot state={state} />);
      const dot = container.querySelector('[data-testid="status-dot"]');
      expect(dot).not.toBeNull();
      expect(dot).toHaveClass(colorClass);
    },
  );
});
