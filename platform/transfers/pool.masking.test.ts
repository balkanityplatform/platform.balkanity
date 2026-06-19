// platform/transfers/pool.masking.test.ts — Wave-0 RED spec for CLAIM-01 (pool no-PII).
//
// CONTRACT (CLAIM-01, D-01/D-02): the driver pool surface consumes ONLY the masked
// `wp_pool()` read (migration 0005, a SECURITY DEFINER function returning the 8 pre-claim
// columns). The pool payload therefore structurally CANNOT carry guest PII — guest_name /
// guest_email / guest_phone / the exact address / free-text notes are never selected. The
// operational `flight_no` IS present (non-PII for v1, D-02).
//
// This is a SOURCE-LEVEL gate (the established precedent: claim-schema.test.ts /
// single-writer.test.ts). It asserts the pool-read consumer wires the masked `wp_pool` RPC
// and references NONE of the PII columns — masking by construction, never select-then-hide.
//
// NYQUIST BASELINE (RED by design): the pool-read consumer does NOT exist yet — it lands in
// Plan 02 (driver pool slice). Until then the candidate-file scan finds no consumer and this
// gate is RED ("expected a pool consumer that calls wp_pool"). Do NOT create the consumer to
// make this green — it is the Plan 02 deliverable. When Plan 02 wires the `.rpc('wp_pool')`
// read into the driver pool, this turns GREEN and stays RED the instant any PII column is
// pulled onto the pool path.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The PII keys that must NEVER appear on the pool read path (mirrors the Phase-5 PII set).
// flight_no is deliberately EXCLUDED — it is operational, non-PII, and EXPECTED in the pool.
const PII_KEYS = [
  "guest_name",
  "guest_email",
  "guest_phone",
] as const;

// Candidate files the Plan-02 pool slice may land in. The masked-read consumer is whichever
// of these calls `.rpc("wp_pool")`. The scan is tolerant of the exact filename Plan 02 picks.
const CANDIDATES: readonly string[] = [
  "app/driver/page.tsx",
  "app/driver/PoolView.tsx",
  "app/driver/pool/page.tsx",
  "app/driver/pool/PoolView.tsx",
  "platform/transfers/pool.ts",
];

function readIfExists(rel: string): string | null {
  const full = join(process.cwd(), rel);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

// Strip comments so header prose ("// never select guest_name") cannot self-satisfy/break.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("driver pool is masked: no guest PII on the pool path (CLAIM-01, D-01)", () => {
  const consumers = CANDIDATES.map((rel) => ({ rel, src: readIfExists(rel) }))
    .filter((c): c is { rel: string; src: string } => c.src !== null)
    .map((c) => ({ rel: c.rel, code: stripComments(c.src) }))
    .filter((c) => /\.rpc\(\s*['"`]wp_pool['"`]/.test(c.code));

  it("a pool consumer wires the masked wp_pool() read (RED until Plan 02)", () => {
    // RED-by-absence: no consumer of wp_pool exists yet. Plan 02 turns this green.
    expect(consumers.length).toBeGreaterThan(0);
  });

  it("the pool consumer references ZERO guest-PII columns (structural masking)", () => {
    for (const { rel, code } of consumers) {
      for (const key of PII_KEYS) {
        expect(
          new RegExp(`\\b${key}\\b`).test(code),
          `${rel} must not reference PII column ${key} on the pool path`,
        ).toBe(false);
      }
    }
  });

  it("the operational flight_no IS available on the pool path (non-PII, D-02)", () => {
    for (const { rel, code } of consumers) {
      expect(
        /\bflight_no\b/.test(code),
        `${rel} should surface the operational flight_no on the pool path`,
      ).toBe(true);
    }
  });
});
