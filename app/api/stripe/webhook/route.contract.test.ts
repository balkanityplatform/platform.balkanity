// app/api/stripe/webhook/route.contract.test.ts — source-level contract for the
// Stripe webhook route (SC1, BOOK-05, threats T-spoof / replay).
//
// The webhook is the ONLY money-authoritative path. Two source-level invariants must
// hold or signature verification silently breaks:
//   1. `export const runtime = "nodejs"` — the Edge runtime mangles raw-body/crypto
//      handling (CLAUDE.md "What NOT to Use": Edge runtime for the Stripe webhook).
//   2. The handler reads the RAW body via `req.text()` and NEVER `req.json()` —
//      `.json()` re-encodes the bytes and breaks `stripe.webhooks.constructEvent`
//      (CLAUDE.md Pitfall: parsing webhook body with `.json()`).
//
// NYQUIST BASELINE: app/api/stripe/webhook/route.ts does NOT exist yet (lands in
// Plan 04). readFileSync throws → this suite is RED now. That is the expected baseline;
// do NOT stub the route to make it green.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE = readFileSync(
  join(process.cwd(), "app/api/stripe/webhook/route.ts"),
  "utf8",
);

// Strip comments so a `// req.json()` mention in prose cannot trip the absent-check.
const CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, ""))
  .join("\n");

describe("Stripe webhook route contract (source-level, SC1)", () => {
  it("declares the nodejs runtime (never Edge)", () => {
    expect(CODE).toMatch(/export const runtime\s*=\s*["']nodejs["']/);
  });

  it("reads the raw request body via req.text()", () => {
    expect(CODE).toMatch(/\.text\(\s*\)/);
  });

  it("never parses the webhook body with req.json() (breaks signature verification)", () => {
    expect(CODE).not.toMatch(/\.json\(/);
  });

  it("verifies the signature via stripe.webhooks.constructEvent", () => {
    expect(CODE).toMatch(/constructEvent/);
  });
});
