// platform/transfers/lifecycle.test.ts — exhaustive lifecycle-map gate (XFER-01).
//
// This pins the TS allowed-transition map (platform/transfers/lifecycle.ts) to the
// SAME table the migration-0004 `wp_enforce_transfer_transition` DB trigger encodes
// (RESEARCH Pattern 2; D-09 full 8-state machine; D-10 admin-cancel from pre-pickup).
// It iterates ALL 8×8 ordered state pairs and asserts each against an EXPECTED map
// authored independently below — so any future drift from the DB trigger fails here
// (T-04-01). This is a GREEN suite: the map + this test land together in this task.
import { describe, expect, it } from "vitest";
import type { TransferState } from "@/platform/ui/StatusDot";
import { ALLOWED_TRANSITIONS, LIFECYCLE_ORDER, canTransition } from "./lifecycle";

// The 8 states, authored here independently of lifecycle.ts (do NOT import its order)
// so a divergence in the source map cannot self-satisfy the cross-product assertion.
const ALL_STATES: readonly TransferState[] = [
  "requested",
  "paid",
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
];

// EXPECTED allowed-transition map — a verbatim re-statement of the DB trigger's
// allowed set (RESEARCH Pattern 2). If lifecycle.ts drifts from this, the 8×8 loop
// below fails. Self-edges are intentionally absent (the trigger no-op-early-returns).
const EXPECTED: Record<TransferState, ReadonlySet<TransferState>> = {
  requested: new Set(["paid", "cancelled"]),
  paid: new Set(["claimed", "cancelled"]),
  // claimed → paid is the D-14 RELEASE backward edge (Phase 6); restricted to claimed only.
  claimed: new Set(["en_route", "cancelled", "paid"]),
  en_route: new Set(["arrived", "cancelled"]),
  arrived: new Set(["picked_up", "cancelled"]),
  picked_up: new Set(["completed"]),
  completed: new Set([]),
  cancelled: new Set([]),
};

describe("transfer lifecycle transition map (XFER-01, mirror of the 0004 DB trigger)", () => {
  it("matches the DB-trigger allowed map for every one of the 64 ordered state pairs", () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const expected = EXPECTED[from].has(to);
        expect(
          canTransition(from, to),
          `canTransition('${from}','${to}') should be ${expected}`,
        ).toBe(expected);
      }
    }
  });

  // --- Spot assertions on the load-bearing edges (Pitfall 4, D-10 terminal rules) ---

  it("allows requested → paid (the webhook's first real transition — Pitfall 4)", () => {
    expect(canTransition("requested", "paid")).toBe(true);
  });

  it("allows claimed → paid (the D-14 release backward edge), restricted to claimed only", () => {
    expect(canTransition("claimed", "paid")).toBe(true);
    // Release is claimed-ONLY — no other state may rewind to paid.
    expect(canTransition("en_route", "paid")).toBe(false);
    expect(canTransition("arrived", "paid")).toBe(false);
    expect(canTransition("picked_up", "paid")).toBe(false);
  });

  it("allows admin pre-pickup cancel from all five pre-pickup states (D-10)", () => {
    expect(canTransition("requested", "cancelled")).toBe(true);
    expect(canTransition("paid", "cancelled")).toBe(true);
    expect(canTransition("claimed", "cancelled")).toBe(true);
    expect(canTransition("en_route", "cancelled")).toBe(true);
    expect(canTransition("arrived", "cancelled")).toBe(true);
  });

  it("forbids cancel from the terminal-ish picked_up / completed states (D-10)", () => {
    expect(canTransition("picked_up", "cancelled")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("forbids any outbound transition from the terminal states (completed, cancelled)", () => {
    for (const to of ALL_STATES) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("forbids the requested → completed skip and allows the happy-path forward edges", () => {
    expect(canTransition("requested", "completed")).toBe(false);
    expect(canTransition("paid", "claimed")).toBe(true);
    expect(canTransition("claimed", "en_route")).toBe(true);
    expect(canTransition("en_route", "arrived")).toBe(true);
    expect(canTransition("arrived", "picked_up")).toBe(true);
    expect(canTransition("picked_up", "completed")).toBe(true);
  });

  it("treats a same-state pair as NOT a legal forward transition (trigger no-op early-return)", () => {
    for (const s of ALL_STATES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  // --- Structural invariants the UI + downstream plans rely on ---

  it("ALLOWED_TRANSITIONS.requested contains both 'paid' and 'cancelled'", () => {
    expect(ALLOWED_TRANSITIONS.requested).toContain("paid");
    expect(ALLOWED_TRANSITIONS.requested).toContain("cancelled");
  });

  it("ALLOWED_TRANSITIONS.picked_up does not contain 'cancelled'; terminals are empty", () => {
    expect(ALLOWED_TRANSITIONS.picked_up).not.toContain("cancelled");
    expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  it("LIFECYCLE_ORDER lists exactly the 7 happy-path states in order, excluding cancelled", () => {
    expect(LIFECYCLE_ORDER).toEqual([
      "requested",
      "paid",
      "claimed",
      "en_route",
      "arrived",
      "picked_up",
      "completed",
    ]);
    expect(LIFECYCLE_ORDER).toHaveLength(7);
    expect(LIFECYCLE_ORDER).not.toContain("cancelled");
  });
});
