// app/driver/advance.lifecycle.test.ts — Wave-0 RED spec for CLAIM-05 (legal-edge-only advance).
//
// CONTRACT (CLAIM-05, D-05): the driver advance-status action `advanceStatus` resolves the
// SINGLE next forward edge from the current status via the canonical lifecycle map
// (platform/transfers/lifecycle.ts ALLOWED_TRANSITIONS) — it never writes an arbitrary or
// skip-ahead target. The DB trigger (0004/0006) is the hard backstop, but the app action must
// itself only ever attempt a `canTransition`-legal forward move (the friendly mirror, D-05).
//
// Two halves:
//   (a) a PURE lifecycle assertion (GREEN now) that pins the driver-forward next-edge for each
//       active state — the contract the action must resolve against (claimed→en_route→arrived→
//       picked_up→completed; release/cancel are NOT driver-forward edges).
//   (b) a SOURCE-LEVEL assertion that the Plan-03 action resolves its target THROUGH the
//       lifecycle map (imports ALLOWED_TRANSITIONS / canTransition) rather than hard-coding a
//       status string — RED until Plan 03 ships advanceStatus.
//
// NYQUIST BASELINE: half (a) is green (it pins the contract); half (b) is RED-by-absence until
// Plan 03. Do NOT implement advanceStatus to satisfy (b) — it is the Plan 03 deliverable.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TransferState } from "@/platform/ui/StatusDot";
import { ALLOWED_TRANSITIONS, canTransition } from "@/platform/transfers/lifecycle";

// The driver-forward next edge for each active (driver-actionable) state. Release (→paid) and
// cancel (→cancelled) are admin/backward edges and are NOT the driver-forward advance target.
const DRIVER_FORWARD: ReadonlyArray<[TransferState, TransferState]> = [
  ["claimed", "en_route"],
  ["en_route", "arrived"],
  ["arrived", "picked_up"],
  ["picked_up", "completed"],
];

const CANDIDATES: readonly string[] = [
  "app/driver/actions.ts",
  "app/driver/run/actions.ts",
];

function readIfExists(rel: string): string | null {
  const full = join(process.cwd(), rel);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("driver advanceStatus only ever writes a legal forward edge (CLAIM-05, D-05)", () => {
  // (a) PURE contract — pins the driver-forward edge the action must resolve to.
  it("each active state's driver-forward next edge is canTransition-legal", () => {
    for (const [from, to] of DRIVER_FORWARD) {
      expect(canTransition(from, to), `${from} → ${to} must be legal`).toBe(true);
      expect(ALLOWED_TRANSITIONS[from]).toContain(to);
    }
  });

  it("an illegal skip-ahead (e.g. claimed → completed) is never legal", () => {
    expect(canTransition("claimed", "completed")).toBe(false);
    expect(canTransition("claimed", "arrived")).toBe(false);
    expect(canTransition("en_route", "completed")).toBe(false);
  });

  // (b) SOURCE-LEVEL — the action resolves through the lifecycle map (RED until Plan 03).
  const found = CANDIDATES.map((rel) => ({ rel, src: readIfExists(rel) }))
    .filter((c): c is { rel: string; src: string } => c.src !== null)
    .map((c) => ({ rel: c.rel, code: stripComments(c.src) }))
    .filter((c) => /\badvanceStatus\b/.test(c.code));

  it("advanceStatus exists and resolves its target via the lifecycle map (RED until Plan 03)", () => {
    expect(found.length).toBeGreaterThan(0);
    for (const { rel, code } of found) {
      const usesLifecycle =
        /ALLOWED_TRANSITIONS/.test(code) || /canTransition/.test(code);
      expect(
        usesLifecycle,
        `${rel} must resolve the advance target through ALLOWED_TRANSITIONS/canTransition, not a hard-coded status`,
      ).toBe(true);
    }
  });
});
