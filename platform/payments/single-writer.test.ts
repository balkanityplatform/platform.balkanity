// platform/payments/single-writer.test.ts — source-level grep gate (SC1, BOOK-05).
//
// Money invariant: `status: 'paid'` may be written in EXACTLY ONE code path — the
// signature-verified Stripe webhook route (app/api/stripe/webhook/route.ts), via the
// service-role client. Any second writer (a success_url handler, an admin action, a
// client call) is a money-spoofing vector (threat T-SD / T-spoof). This test scans the
// whole source tree, strips comments, and asserts exactly one file sets status to paid.
//
// NYQUIST BASELINE: the webhook route does NOT exist yet (lands in Plan 04). With zero
// writers this gate is RED ("expected exactly one"); that is correct. When Plan 04 adds
// the single webhook writer it turns GREEN, and stays RED again the instant a second
// writer appears anywhere — which is the whole point.
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

describe("single status='paid' writer (source-level grep gate, SC1)", () => {
  const files: string[] = [];
  for (const root of ROOTS) collectSourceFiles(join(process.cwd(), root), files);

  const writers = files.filter((f) => PAID_WRITE.test(stripComments(readFileSync(f, "utf8"))));

  it("has exactly one production file that writes status: 'paid'", () => {
    expect(writers).toHaveLength(1);
  });

  it("the single paid writer is the Stripe webhook route", () => {
    expect(writers).toHaveLength(1);
    expect(writers[0].replace(/\\/g, "/")).toMatch(
      /app\/api\/stripe\/webhook\/route\.ts$/,
    );
  });
});
