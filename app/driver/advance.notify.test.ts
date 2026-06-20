// app/driver/advance.notify.test.ts — arrived fan-out fires the guest email (NOTF-02).
//
// NYQUIST BASELINE — RED until Plan 04/05 wires the lifecycle fan-out into
// app/driver/actions.ts advanceStatus. This is a source-level gate (mirrors
// platform/payments/single-writer.test.ts): it greps the comment-stripped advanceStatus
// source for the `arrived`-branch sendEmail wiring. RED today because the wiring is absent.
//
// What this pins (GREEN in Plan 04/05), per UI-SPEC Interaction Contracts + Pattern 4:
//   - advancing to `arrived` fires the guest "driver arrived" email exactly once
//     (a single sendEmail / buildArrivedEmail wiring keyed `arrived:<id>`);
//   - advancing to `en_route` fires NO email (the en_route branch has no send wiring).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

const TARGET = join(process.cwd(), "app/driver/actions.ts");

describe("advanceStatus arrived fan-out (NOTF-02, source gate)", () => {
  const src = stripComments(readFileSync(TARGET, "utf8"));

  it("advanceStatus wires a sendEmail for the arrived transition", () => {
    // RED today: advanceStatus has no sendEmail wiring. Plan 04/05 adds the arrived-only
    // guest "driver arrived" send (idempotency key `arrived:<id>`).
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/arrived:/);
  });

  it("the en_route branch carries NO email send (heads-up only on arrived)", () => {
    // No `en_route:` idempotency-key send wiring should ever appear — en_route is silent.
    expect(src).not.toMatch(/en_route:/);
  });

  it("the self-claim assigned email keys per (transfer, driver), not per transfer (CR-02)", () => {
    // The idempotency key MUST include the driverId so a later reassignment to a different
    // driver re-sends (new key) while a true retry of the same claim still dedups.
    expect(src).toMatch(/assigned:\$\{transferId\}:\$\{driverId\}/);
    // Guard against a regression to the colliding per-transfer-only key.
    expect(src).not.toMatch(/idempotencyKey:\s*`assigned:\$\{transferId\}`/);
  });
});
