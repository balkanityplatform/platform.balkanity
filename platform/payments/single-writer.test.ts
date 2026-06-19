// platform/payments/single-writer.test.ts — source-level grep gate (SC1, BOOK-05).
//
// Money invariant: `status: 'paid'` may be written in EXACTLY the KNOWN code paths — and
// no others. Any additional writer (a success_url handler, a stray admin action, a client
// call) is a money-spoofing vector (threat T-SD / T-spoof / T-06-02). This test scans the
// whole source tree, strips comments, and asserts the set of `status:'paid'` writers is a
// SUBSET of the two sanctioned writers.
//
// THE TWO SANCTIONED WRITERS (D-15 — the ONE deliberate widening from "exactly one"):
//   1) app/api/stripe/webhook/route.ts   — the signature-verified Stripe webhook (the money
//                                           authority; requested/claimed -> paid on capture).
//   2) app/admin/transfers/actions.ts     — the NARROW gated RELEASE action (D-14): an admin
//                                           releases a `claimed` transfer back to the open pool
//                                           (claimed -> paid, driver_id cleared). This is a
//                                           service-role action behind getCurrentRole()==='admin'
//                                           — NEVER a client, NEVER the success_url path. The
//                                           0006 trigger restricts the edge to `claimed` only.
// Every OTHER file writing status:'paid' fails this contract.
//
// NYQUIST BASELINE: today only the webhook writer exists (the release action lands in Plan 05).
// The contract is encoded as "writers ⊆ {webhook, admin actions}", NOT "writers === both", so
// it is GREEN with just the present webhook writer and does NOT falsely demand the not-yet-built
// release action. It turns RED the instant a THIRD, unsanctioned writer appears anywhere.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "platform", "modules"] as const;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

function isSourceFile(name: string): boolean {
  if (!/\.(ts|tsx)$/.test(name)) return false;
  // Exclude test files so the gate counts production writers only.
  if (/\.(test|spec)\.(ts|tsx)$/.test(name)) return false;
  return true;
}

function collectSourceFiles(dir: string, acc: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // root may not exist yet (modules/ etc.)
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (isSourceFile(entry)) {
      acc.push(full);
    }
  }
}

// Strip JS/TS comments so header prose ("// only the webhook sets paid") cannot
// self-satisfy or break the gate. Handles // line comments and /* */ block comments.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// Matches an object literal writing the paid status, e.g.
//   status: 'paid'   |   status: "paid"   |   { status: `paid` }
const PAID_WRITE = /status\s*:\s*['"`]paid['"`]/;

// The two sanctioned `status:'paid'` writers (path suffixes, OS-normalised). The set of
// real writers must be a SUBSET of these — a subset (not equality) so the gate stays GREEN
// before Plan 05 wires the release action while still failing the instant a third appears.
const ALLOWED_WRITERS: readonly RegExp[] = [
  /app\/api\/stripe\/webhook\/route\.ts$/,
  /app\/admin\/transfers\/actions\.ts$/,
] as const;

function isAllowedWriter(file: string): boolean {
  const norm = file.replace(/\\/g, "/");
  return ALLOWED_WRITERS.some((re) => re.test(norm));
}

describe("sanctioned status='paid' writers (source-level grep gate, SC1, D-15)", () => {
  const files: string[] = [];
  for (const root of ROOTS) collectSourceFiles(join(process.cwd(), root), files);

  const writers = files.filter((f) => PAID_WRITE.test(stripComments(readFileSync(f, "utf8"))));

  it("every production file writing status: 'paid' is one of the two sanctioned writers", () => {
    const unsanctioned = writers
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !isAllowedWriter(f));
    // writers ⊆ {webhook route, admin transfers actions} — a third writer fails here.
    expect(unsanctioned).toEqual([]);
  });

  it("the webhook route is permitted as the money-authority writer", () => {
    // The webhook is the present writer today (Plan 04); it must always be allowed.
    expect(
      ALLOWED_WRITERS.some((re) =>
        re.test("app/api/stripe/webhook/route.ts"),
      ),
    ).toBe(true);
  });

  it("the narrow gated admin release action is the only widening (D-15)", () => {
    // The release action (claimed -> paid) is the single deliberate exception; it lands in
    // Plan 05 and is allowed here in advance so adding it does not require touching this gate.
    expect(
      ALLOWED_WRITERS.some((re) =>
        re.test("app/admin/transfers/actions.ts"),
      ),
    ).toBe(true);
  });
});
