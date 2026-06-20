// platform/ui/StatusDot.test.tsx — PLAT-03 / T-04-02 / DS-02 (WCAG 1.4.1).
//
// Proves the brand rule that status is ALWAYS a coloured shape PLUS a non-empty
// text label — colour is never the sole signal — and that each lifecycle state
// maps to the correct token-derived colour class (UI-SPEC lifecycle map).
//
// DS-02 (D-03/D-04): also covers the new `variant` prop — `"dot"` (default,
// unchanged) and `"pill"` (solid filled badge) — and the one status-rendering
// change this phase ships: `cancelled` is a hollow coral ring (`border-coral`
// + `bg-transparent`, NOT `bg-coral`) in BOTH variants, label still present.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type StatusVariant,
  type TransferState,
  StatusDot,
} from "./StatusDot";

// Expected label text + the class the shape carries per lifecycle state
// (UI-SPEC map). `cancelled` is the hollow coral ring (D-04): the shape carries
// `border-coral` (+ transparent fill), every other state keeps its solid fill.
const CASES: Array<{
  state: TransferState;
  label: string;
  shapeClass: string;
}> = [
  { state: "requested", label: "Requested", shapeClass: "bg-grey" },
  { state: "paid", label: "Paid", shapeClass: "bg-teal2" },
  { state: "claimed", label: "Claimed", shapeClass: "bg-teal" },
  { state: "en_route", label: "En route", shapeClass: "bg-amber" },
  { state: "arrived", label: "Arrived", shapeClass: "bg-amber" },
  { state: "picked_up", label: "Picked up", shapeClass: "bg-teal" },
  { state: "completed", label: "Completed", shapeClass: "bg-grey" },
  // D-04: hollow coral ring — border-coral (+ bg-transparent), never bg-coral.
  { state: "cancelled", label: "Cancelled", shapeClass: "border-coral" },
];

const VARIANTS: StatusVariant[] = ["dot", "pill"];

describe("StatusDot", () => {
  // WCAG 1.4.1: the worded label always renders, in BOTH variants.
  describe.each(VARIANTS)("variant=%s", (variant) => {
    it.each(CASES)(
      "renders a non-empty text label for %s (colour never the sole signal)",
      ({ state, label }) => {
        render(<StatusDot state={state} variant={variant} />);
        const text = screen.getByText(label);
        expect(text).toBeInTheDocument();
        expect(text.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      },
    );

    it.each(CASES)(
      "maps %s to the correct token shape class",
      ({ state, shapeClass }) => {
        const { container } = render(
          <StatusDot state={state} variant={variant} />,
        );
        // The colour carrier differs by variant: the dot variant (and cancelled
        // in BOTH variants) carries it on the round `status-dot`; the pill
        // variant carries the fill on the `status-pill` badge container.
        const carrier =
          variant === "pill" && state !== "cancelled"
            ? container.querySelector('[data-testid="status-pill"]')
            : container.querySelector('[data-testid="status-dot"]');
        expect(carrier).not.toBeNull();
        expect(carrier).toHaveClass(shapeClass);
      },
    );
  });

  it("defaults to the dot variant (existing callers unchanged)", () => {
    const { container } = render(<StatusDot state="claimed" />);
    // The default dot is the 10px round shape carrying the solid colour class.
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("rounded-full", "bg-teal");
    expect(screen.getByText("Claimed")).toBeInTheDocument();
  });

  it("renders a solid filled badge for variant=pill with the worded label", () => {
    const { container } = render(<StatusDot state="claimed" variant="pill" />);
    // The pill is a filled badge: the colour is the fill on the badge container.
    const pill = container.querySelector('[data-testid="status-pill"]');
    expect(pill).not.toBeNull();
    expect(pill).toHaveClass("bg-teal");
    expect(screen.getByText("Claimed")).toBeInTheDocument();
  });

  it.each(VARIANTS)(
    "renders cancelled as a hollow coral ring (border-coral, bg-transparent) in variant=%s",
    (variant) => {
      const { container } = render(
        <StatusDot state="cancelled" variant={variant} />,
      );
      const dot = container.querySelector('[data-testid="status-dot"]');
      expect(dot).not.toBeNull();
      // The one behavioural change (D-04): ring, not a solid coral fill.
      expect(dot).toHaveClass("border-2", "border-coral", "bg-transparent");
      expect(dot).not.toHaveClass("bg-coral");
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    },
  );
});
