// app/driver/advance.ownership.test.ts — Wave-0 RED spec for CLAIM-04 (advance ownership gate).
//
// CONTRACT (CLAIM-04, D-04/D-06): the driver advance-status server action `advanceStatus`
// only ever mutates a transfer the CALLER owns — i.e. one whose `driver_id` equals the
// caller's auth.uid(). An advance attempt on a transfer owned by ANOTHER driver returns an
// error and writes NOTHING. The ownership is derived from auth.uid() server-side, never from
// a client-supplied driver id (mirrors the Phase-5 claim-RPC self-derivation, T-05-SPOOF).
//
// This is a SOURCE-LEVEL gate (claim-schema.test.ts precedent): it asserts the action module
// EXISTS and encodes the ownership predicate (`driver_id = auth.uid()` / `.eq("driver_id", …)`
// against the caller uid) so it is impossible to advance a transfer you do not own.
//
// NYQUIST BASELINE (RED by design): `advanceStatus` does NOT exist yet — it lands in Plan 03
// (driver run slice). Until then the file read finds no action and this gate is RED. Do NOT
// implement advanceStatus to make this green — it is the Plan 03 deliverable.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Candidate locations for the Plan-03 driver advance action.
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

describe("driver advanceStatus enforces caller ownership (CLAIM-04, D-04/D-06)", () => {
  const found = CANDIDATES.map((rel) => ({ rel, src: readIfExists(rel) }))
    .filter((c): c is { rel: string; src: string } => c.src !== null)
    .map((c) => ({ rel: c.rel, code: stripComments(c.src) }))
    .filter((c) => /\badvanceStatus\b/.test(c.code));

  it("the advanceStatus action exists (RED until Plan 03)", () => {
    // RED-by-absence: the driver run slice (Plan 03) introduces advanceStatus.
    expect(found.length).toBeGreaterThan(0);
  });

  it("advanceStatus scopes the write to the caller-owned transfer (driver_id = auth.uid())", () => {
    for (const { rel, code } of found) {
      // The mutation must be filtered by the caller's own driver_id — derived from auth.uid()
      // server-side, never a client-supplied id. Accept either the supabase-js .eq filter or
      // an auth.uid()-derived predicate; require BOTH the driver_id scope AND a uid derivation.
      const scopesByDriverId = /\.eq\(\s*['"`]driver_id['"`]/.test(code);
      const derivesUid =
        /getUser\(/.test(code) || /auth\.uid\(\)/.test(code) || /\buser\.id\b/.test(code);
      expect(
        scopesByDriverId,
        `${rel} must scope advanceStatus to .eq("driver_id", …) so a non-owner write affects 0 rows`,
      ).toBe(true);
      expect(
        derivesUid,
        `${rel} must derive the owner from the authenticated caller (getUser/auth.uid), never a client id`,
      ).toBe(true);
    }
  });
});
