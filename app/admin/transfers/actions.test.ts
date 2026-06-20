// app/admin/transfers/actions.test.ts — Wave-0 RED spec for OPS-03 (admin ops actions + re-gate).
//
// CONTRACT (OPS-02/OPS-03, D-10/D-14): the admin transfers ops actions each re-gate
// `getCurrentRole() === 'admin'` server-side (a non-admin caller is rejected — never trust the
// page guard alone). The four actions:
//   • assign / reassign — set driver_id (one-tap assign; reassign swaps the claiming driver).
//   • release           — the D-14 backward edge: claimed → paid AND clears driver_id, returning
//                         the transfer to the open pool. This is one of the TWO sanctioned
//                         status='paid' writers (single-writer.test.ts, D-15) — service-role,
//                         behind the admin re-gate, NEVER a client.
//   • cancel            — a trigger-legal pre-pickup cancel (→ cancelled); NEVER auto-refunds
//                         (D-11; refund is a separate action).
//
// SOURCE-LEVEL gate (claim-schema.test.ts precedent): asserts the action module exists, each of
// the four actions is present, each re-gates getCurrentRole()/admin, release encodes
// claimed→paid + driver_id clear, and cancel targets the trigger-legal cancelled edge.
//
// NYQUIST BASELINE (RED by design): app/admin/transfers/actions.ts does NOT exist yet — it lands
// in Plan 05 (admin ops). Do NOT implement it to make this green — it is the Plan 05 deliverable.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ACTIONS_PATH = join(process.cwd(), "app/admin/transfers/actions.ts");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function code(): string | null {
  return existsSync(ACTIONS_PATH) ? stripComments(readFileSync(ACTIONS_PATH, "utf8")) : null;
}

describe("admin transfers ops actions: re-gate + assign/reassign/release/cancel (OPS-03, D-10/D-14)", () => {
  it("the admin transfers actions module exists (RED until Plan 05)", () => {
    expect(existsSync(ACTIONS_PATH)).toBe(true);
  });

  it("exposes all four ops actions (assign, reassign, release, cancel)", () => {
    const c = code();
    expect(c, "actions.ts must exist (Plan 05)").not.toBeNull();
    if (!c) return;
    for (const name of ["assign", "reassign", "release", "cancel"]) {
      expect(new RegExp(`\\b${name}`, "i").test(c), `actions.ts must expose a ${name} action`).toBe(
        true,
      );
    }
  });

  it("every ops action re-gates getCurrentRole() === 'admin' server-side", () => {
    const c = code();
    expect(c, "actions.ts must exist (Plan 05)").not.toBeNull();
    if (!c) return;
    expect(/getCurrentRole\(/.test(c), "must re-gate via getCurrentRole()").toBe(true);
    expect(/['"`]admin['"`]/.test(c), "must compare role to 'admin'").toBe(true);
  });

  it("release encodes claimed → paid AND clears driver_id (D-14 backward edge)", () => {
    const c = code();
    expect(c, "actions.ts must exist (Plan 05)").not.toBeNull();
    if (!c) return;
    expect(/status\s*:\s*['"`]paid['"`]/.test(c), "release must set status='paid'").toBe(true);
    expect(
      /driver_id\s*:\s*null/.test(c),
      "release must clear driver_id (return to the open pool)",
    ).toBe(true);
  });

  it("cancel targets the trigger-legal cancelled edge", () => {
    const c = code();
    expect(c, "actions.ts must exist (Plan 05)").not.toBeNull();
    if (!c) return;
    expect(/status\s*:\s*['"`]cancelled['"`]/.test(c), "cancel must set status='cancelled'").toBe(
      true,
    );
  });

  it("the guest assigned email keys per (transfer, driver), not per transfer (CR-02)", () => {
    const c = code();
    expect(c, "actions.ts must exist (Plan 05)").not.toBeNull();
    if (!c) return;
    // Per-(transfer, driver) key so a reassignment to a different driver re-sends, while a
    // true retry of the same assignment still dedups.
    expect(/assigned:\$\{transferId\}:\$\{driverId\}/.test(c)).toBe(true);
    // Guard against a regression to the colliding per-transfer-only key.
    expect(/idempotencyKey:\s*`assigned:\$\{transferId\}`/.test(c)).toBe(false);
  });

  it("reassign re-emails the guest the NEW driver via sendAssignedEmail (CR-02)", () => {
    const c = code();
    expect(c, "actions.ts must exist (Plan 05)").not.toBeNull();
    if (!c) return;
    // Isolate the reassign function body and assert it fires the guest assigned email for the
    // newly-assigned driver — previously reassign only fired the in-app driver notifications,
    // so the guest kept the OLD driver's name + phone.
    const start = c.indexOf("export async function reassign");
    expect(start, "reassign action must exist").toBeGreaterThan(-1);
    const next = c.indexOf("export async function release", start);
    const body = c.slice(start, next === -1 ? undefined : next);
    expect(
      /sendAssignedEmail\(\s*admin\s*,\s*parsed\.data\.id\s*,\s*parsed\.data\.driverId\s*\)/.test(
        body,
      ),
      "reassign must call sendAssignedEmail(admin, id, newDriverId)",
    ).toBe(true);
  });
});
