// app/admin/destinations/you-keep.test.tsx — live "you keep" recompute (D-06, ONBD-04).
//
// Proves the DestinationForm "you keep" panel recomputes LIVE (client-side, display-only)
// from price + commission %, using the pure platform/money/commission math:
//   • price €100.00 + 15% → commission €15.00, you-keep (net before fees) €85.00, and the
//     fee note containing "~1.5% + €0.25";
//   • changing the inputs (→ €200.00 + 10%) recomputes to €20.00 / €180.00 live.
//
// This is the AUTOMATED half of the Task-3 D-06 proof (the tests/e2e/you-keep.spec.ts
// full signed-in walkthrough stays manual — it needs a live admin session). Rendering
// the client island directly with @testing-library/react is the robust, session-free
// way to exercise the live recompute the UI-SPEC "you keep" contract requires.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The form imports the server actions module (which pulls in server-only deps); mock it
// so the client island renders in jsdom without the action runtime.
vi.mock("./actions", () => ({
  createDestination: vi.fn(),
  updateDestination: vi.fn(),
  deactivateDestination: vi.fn(),
}));

import { DestinationForm, type DestinationFormCopy } from "./DestinationForm";

// Real copy (en.ts) for the three "you keep" lines so the {pct}/{amount} interpolation
// is exercised exactly as the page passes it.
const copy: DestinationFormCopy = {
  destinationLabelLabel: "Destination label",
  slugLabel: "Link slug",
  addressLabel: "Address",
  zoneLabel: "Zone / area",
  airportLabel: "Airport",
  priceLabel: "Price",
  commissionPctLabel: "Commission %",
  propertyNameLabel: "Property name",
  saveDestinationCta: "Save destination",
  saveChangesCta: "Save changes",
  cancelCta: "Cancel",
  fieldRequired: "This field is required.",
  saveFailed: "Couldn't save.",
  slugInvalid: "Use lowercase letters, numbers, and hyphens only.",
  slugTaken: "That link is already in use. Choose a different one.",
  commissionRange: "Commission must be between 0 and 100%.",
  slugEditWarning: "Changing this link will break any /pickup links you've already shared.",
  youKeepCommissionLine: "Company commission ({pct}%): €{amount}",
  youKeepNetLine: "You keep (before fees): €{amount}",
  youKeepFeeNote:
    "Estimated Stripe fee ~1.5% + €0.25 per booking (applied at payment, Phase 3).",
};

const properties = [{ id: "11111111-1111-1111-1111-111111111111", name: "Seaside Villa" }];

describe('destination "you keep" panel (D-06)', () => {
  it("recomputes live from price + commission and updates on change", () => {
    render(<DestinationForm properties={properties} copy={copy} />);

    const price = screen.getByLabelText("Price");
    const pct = screen.getByLabelText("Commission %");

    // No panel until a positive price is entered.
    expect(screen.queryByTestId("you-keep-panel")).toBeNull();

    fireEvent.change(price, { target: { value: "100.00" } });
    fireEvent.change(pct, { target: { value: "15" } });

    // price €100.00 + 15% → commission €15.00, you keep €85.00, fee note present.
    expect(screen.getByTestId("you-keep-commission")).toHaveTextContent(
      "Company commission (15%): €15.00",
    );
    expect(screen.getByTestId("you-keep-net")).toHaveTextContent(
      "You keep (before fees): €85.00",
    );
    expect(screen.getByTestId("you-keep-fee-note")).toHaveTextContent(
      "~1.5% + €0.25",
    );

    // Change the inputs → live recompute (€200.00 + 10% → €20.00 / €180.00).
    fireEvent.change(price, { target: { value: "200.00" } });
    fireEvent.change(pct, { target: { value: "10" } });

    expect(screen.getByTestId("you-keep-commission")).toHaveTextContent(
      "Company commission (10%): €20.00",
    );
    expect(screen.getByTestId("you-keep-net")).toHaveTextContent(
      "You keep (before fees): €180.00",
    );
  });
});
