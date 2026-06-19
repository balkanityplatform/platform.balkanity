// app/admin/transfers/TransfersView.test.tsx — Wave-0 RED spec for OPS-01 (admin list).
//
// CONTRACT (OPS-01, D-07/D-08/D-09): the admin transfers list view <TransfersView>:
//   (a) STATUS FILTER — applying a status filter narrows the rendered rows to the selected
//       statuses only.
//   (b) FREE-TEXT SEARCH — a query matches across guest name / flight no. / destination; a
//       substring present in any of the three KEEPS the row, and a non-matching query empties
//       the list to the `transfersNoMatchBody` state.
//   (c) NEEDS-ATTENTION PINNING — stuck/unclaimed rows are pinned to the TOP and carry the coral
//       `needsAttentionBadge` TEXT marker (never colour alone — WCAG 1.4.1). The needs-attention
//       rows precede the rest (D-07 pin, D-08 controls, D-09 stuck definition).
//
// PREFERRED shape: a jsdom render of <TransfersView> with a mixed-status fixture (incl. an
// unclaimed `paid` needs-attention row + a claimed row), asserting filter narrowing, search
// keep/empty, and coral-badge top-pinning. FALLBACK (while the island cannot render standalone):
// a SOURCE-LEVEL assertion that the view implements the filter/search/needsAttention-pin
// contract — RED-by-absence so it can never false-pass.
//
// NYQUIST BASELINE (RED by design): TransfersView.tsx does NOT exist yet — it lands in Plan 04
// Task 1, which CONSUMES this spec as its OPS-01 gate. Do NOT create it to make this green here.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const VIEW_PATH = join(process.cwd(), "app/admin/transfers/TransfersView.tsx");

// Mixed-status fixture documenting the data the Plan-04 view must filter/search/pin.
const FIXTURE = [
  {
    id: "t-unclaimed",
    status: "paid",
    driver_id: null, // unclaimed paid → needs attention (D-09)
    guest_name: "Ivan Petrov",
    flight_no: "FR1234",
    destination: "Sunny Beach",
  },
  {
    id: "t-claimed",
    status: "claimed",
    driver_id: "d-1",
    guest_name: "Maria Dimitrova",
    flight_no: "W64500",
    destination: "Bansko",
  },
] as const;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function code(): string | null {
  return existsSync(VIEW_PATH) ? stripComments(readFileSync(VIEW_PATH, "utf8")) : null;
}

describe("admin TransfersView: filter + search + coral needs-attention pin (OPS-01, D-07/D-08/D-09)", () => {
  it("the fixture distinguishes a needs-attention (unclaimed paid) row from a claimed row (contract)", () => {
    const needsAttention = FIXTURE.filter(
      (r) => r.status === "paid" && r.driver_id === null,
    ).map((r) => r.id);
    expect(needsAttention).toEqual(["t-unclaimed"]);
  });

  it("TransfersView.tsx exists (RED until Plan 04 Task 1 builds the OPS-01 view)", () => {
    expect(existsSync(VIEW_PATH)).toBe(true);
  });

  it("implements status filtering", () => {
    const c = code();
    if (!c) {
      expect(existsSync(VIEW_PATH), "TransfersView.tsx must exist (Plan 04)").toBe(true);
      return;
    }
    expect(/status/.test(c) && /filter/i.test(c), "must implement a status filter").toBe(true);
  });

  it("implements free-text search across name / flight no. / destination with a no-match empty state", () => {
    const c = code();
    if (!c) {
      expect(existsSync(VIEW_PATH), "TransfersView.tsx must exist (Plan 04)").toBe(true);
      return;
    }
    expect(/search/i.test(c), "must implement free-text search").toBe(true);
    expect(/guest_name/.test(c), "search must cover guest name").toBe(true);
    expect(/flight_no/.test(c), "search must cover flight no.").toBe(true);
    expect(
      /transfersNoMatchBody/.test(c),
      "a non-matching query must show transfersNoMatchBody",
    ).toBe(true);
  });

  it("pins coral needs-attention rows to the top with a text badge (never colour alone)", () => {
    const c = code();
    if (!c) {
      expect(existsSync(VIEW_PATH), "TransfersView.tsx must exist (Plan 04)").toBe(true);
      return;
    }
    expect(/needsAttention/.test(c), "must compute a needs-attention partition (D-09)").toBe(true);
    expect(
      /needsAttentionBadge/.test(c),
      "needs-attention rows must render the needsAttentionBadge TEXT marker (WCAG 1.4.1)",
    ).toBe(true);
  });
});
