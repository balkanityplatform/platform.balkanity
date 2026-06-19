// app/admin/drivers/invite.notify.test.ts — invite un-stub fan-out (NOTF-04, D-14).
//
// NYQUIST BASELINE — RED until Plan 02 un-stubs app/admin/drivers/actions.ts inviteDriver
// (replace the action_link reveal with a critical-tier sendEmail, drop actionLink from the
// returned state). Source-level gate (mirrors platform/payments/single-writer.test.ts):
// greps the comment-stripped inviteDriver source. RED today — the reveal still returns
// actionLink and there is no sendEmail wiring.
//
// What this pins (GREEN in Plan 02), per Pattern 5 / D-14:
//   - the invite path calls sendEmail (critical tier, idempotency key `invite:<userId>`);
//   - the returned state no longer carries `actionLink` (the link is emailed, not revealed).
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

const TARGET = join(process.cwd(), "app/admin/drivers/actions.ts");

describe("inviteDriver email un-stub (NOTF-04 / D-14, source gate)", () => {
  const src = stripComments(readFileSync(TARGET, "utf8"));

  it("the invite path calls sendEmail (critical tier, invite:<userId> key)", () => {
    // RED today: no sendEmail wiring yet (the action still reveals the link).
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/invite:/);
    expect(src).toMatch(/critical/);
  });

  it("the returned state no longer carries actionLink (link is emailed, D-14)", () => {
    // RED today: the success return is `{ status: "ok", actionLink: ... }`.
    expect(src).not.toMatch(/actionLink/);
  });
});
