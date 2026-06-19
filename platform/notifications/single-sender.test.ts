// platform/notifications/single-sender.test.ts — single Resend call-site grep gate (NOTF-06).
//
// NYQUIST BASELINE — RED today: the sole sanctioned Resend call-site
// (platform/notifications/send-email.ts) does not exist yet, so the "exactly one
// call-site" invariant cannot hold. It turns GREEN in Plan 02 when send-email.ts
// becomes the only file invoking `resend.emails.send` / `new Resend(`.
//
// Invariant (mirrors platform/payments/single-writer.test.ts): the Resend client may be
// constructed and `emails.send` invoked in EXACTLY ONE production file —
// platform/notifications/send-email.ts. Any other call-site bypasses the cap/idempotency
// guard and is a Resend-cap / spoofing vector. We scan the source tree, strip comments,
// and assert the set of Resend call-sites === { send-email.ts }.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "platform", "modules"] as const;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

function isSourceFile(name: string): boolean {
  if (!/\.(ts|tsx)$/.test(name)) return false;
  if (/\.(test|spec)\.(ts|tsx)$/.test(name)) return false; // production only
  return true;
}

function collectSourceFiles(dir: string, acc: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // root may not exist yet
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectSourceFiles(full, acc);
    else if (isSourceFile(entry)) acc.push(full);
  }
}

// Strip comments so header prose ("// resend.emails.send only here") cannot self-satisfy.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// A Resend call-site = constructs the client OR invokes emails.send.
const RESEND_CALLSITE = /new\s+Resend\s*\(|resend\.emails\.send|\.emails\.send\s*\(/;

const ALLOWED = /platform\/notifications\/send-email\.ts$/;

describe("single Resend call-site (source grep gate, NOTF-06)", () => {
  const files: string[] = [];
  for (const root of ROOTS) collectSourceFiles(join(process.cwd(), root), files);

  const callSites = files.filter((f) =>
    RESEND_CALLSITE.test(stripComments(readFileSync(f, "utf8"))),
  );

  it("the only Resend call-site is platform/notifications/send-email.ts", () => {
    const norm = callSites.map((f) => f.replace(/\\/g, "/"));
    const unsanctioned = norm.filter((f) => !ALLOWED.test(f));
    expect(unsanctioned).toEqual([]);
    // RED today: send-email.ts is absent → zero sanctioned call-sites → the gate is unmet.
    expect(norm.some((f) => ALLOWED.test(f))).toBe(true);
  });
});
