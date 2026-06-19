// app/driver/run/RunView.test.tsx — Wave-0 RED spec for CLAIM-06 (My run ordering + partition).
//
// CONTRACT (CLAIM-06, D-06): the driver "My run" view renders the active claimed transfers
// ordered by `arrival_at` ASCENDING (soonest first), and a transfer that reaches
// `status='completed'` DROPS OUT of the active run into the collapsed "Completed today"
// (`completedTodayTitle`) section — it never appears in the active list again (no un-claim).
//
// PREFERRED shape: a jsdom render of <RunView> with a fixture of out-of-order claimed rows +
// one completed row, asserting (i) the active-card order equals the arrival-sorted ids and
// (ii) the completed row is absent from the active list and present under "Completed today".
// FALLBACK (used while the island cannot render standalone): a SOURCE-LEVEL assertion that
// RunView orders by arrival_at and partitions completed into completedTodayTitle — RED-by-
// absence so it can never false-pass.
//
// NYQUIST BASELINE (RED by design): RunView.tsx does NOT exist yet — it lands in Plan 03 Task 2,
// which CONSUMES this spec as its CLAIM-06 gate. Do NOT create RunView to make this green here.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RUNVIEW_PATH = join(process.cwd(), "app/driver/run/RunView.tsx");

// Out-of-order arrival fixture + one completed row — documents the data the Plan-03 component
// must order/partition. (Consumed once RunView renders; the source-gate below uses the contract.)
const FIXTURE = [
  { id: "t-late", status: "claimed", arrival_at: "2026-07-01T18:00:00Z" },
  { id: "t-soon", status: "claimed", arrival_at: "2026-07-01T09:00:00Z" },
  { id: "t-mid", status: "claimed", arrival_at: "2026-07-01T13:00:00Z" },
  { id: "t-done", status: "completed", arrival_at: "2026-07-01T07:00:00Z" },
] as const;

// The expected active-card order: claimed rows by arrival_at ASC, completed excluded.
const EXPECTED_ACTIVE_ORDER = ["t-soon", "t-mid", "t-late"];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("My run: arrival-ASC active order + completed→Completed today (CLAIM-06, D-06)", () => {
  it("the fixture's arrival-sorted active order excludes the completed row (contract)", () => {
    const active = FIXTURE.filter((r) => r.status !== "completed")
      .slice()
      .sort((a, b) => a.arrival_at.localeCompare(b.arrival_at))
      .map((r) => r.id);
    expect(active).toEqual(EXPECTED_ACTIVE_ORDER);
    expect(active).not.toContain("t-done");
  });

  it("RunView.tsx exists (RED until Plan 03 Task 2 builds the CLAIM-06 view)", () => {
    // RED-by-absence: Plan 03 Task 2 creates app/driver/run/RunView.tsx.
    expect(existsSync(RUNVIEW_PATH)).toBe(true);
  });

  it("RunView orders the active run by arrival_at and partitions completed into Completed today", () => {
    // Source-level contract: once RunView exists it MUST sort the active list by arrival_at and
    // route completed rows into the completedTodayTitle section (never inline in the active run).
    if (!existsSync(RUNVIEW_PATH)) {
      // Force RED while the component is absent — never a silent pass.
      expect(existsSync(RUNVIEW_PATH), "RunView.tsx must exist (Plan 03 Task 2)").toBe(true);
      return;
    }
    const code = stripComments(readFileSync(RUNVIEW_PATH, "utf8"));
    expect(/arrival_at/.test(code), "RunView must order by arrival_at").toBe(true);
    expect(
      /completedTodayTitle/.test(code) || /Completed today/.test(code),
      "RunView must render a Completed today partition for completed rows",
    ).toBe(true);
    expect(
      /['"`]completed['"`]/.test(code),
      "RunView must partition rows on status==='completed'",
    ).toBe(true);
  });
});
