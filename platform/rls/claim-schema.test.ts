// platform/rls/claim-schema.test.ts — source-level contract for migration 0005.
//
// This is a SOURCE-LEVEL contract test (the established precedent, payments-schema.test.ts
// / supply-rls.test.ts): it reads supabase/migrations/0005_claim_correctness.sql and asserts
// that the migration TEXT encodes the claim-correctness security contract (CLAIM-02 / CLAIM-03,
// D-01..D-04). It does NOT touch a live DB — the live-DB concurrency/PII proof is the BLOCKING
// push-verification checkpoint (Plan 03, 05-GATES-EVIDENCE.md) + the live gates in tests/claim/.
// The point is to fail fast in CI if anyone weakens the migration shape at the source: drops
// the masked-read mechanism, adds PII columns to the view, drops `search_path=''`, drops the
// `status='paid' AND driver_id IS NULL` race predicate, drops `RETURNING *`, or grants execute
// to anon/public.
//
// NYQUIST BASELINE: migration 0005 does NOT exist yet — it is authored in Plan 02 and applied
// live in Plan 03. These assertions are EXPECTED to be RED now (the file read throws ENOENT);
// that is the contract the migration must satisfy. Do NOT create 0005 to make this green — the
// migration is the Plan 02 deliverable and the live apply is the Plan 03 BLOCKING signed-off task.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/0005_claim_correctness.sql"),
  "utf8",
);

// Strip SQL line comments so keyword/clause assertions can't be satisfied (or broken) by a
// commented-out line. This is load-bearing: a commented `-- for update` write policy must not
// satisfy the no-write-policy contract, and a commented `-- guest_name` reference must not
// trip the PII-omission assertion. The Balkanity guardrail (below) is the one exception — it
// is asserted against the RAW header text, which is intentionally a comment block.
const CODE = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("0005 claim-correctness schema contract (source-level)", () => {
  it("provides a masked pre-claim read — security_invoker view OR a SECURITY DEFINER pool read", () => {
    // Open Q1 resolves in Plan 02 to either a security_invoker view or a SECURITY DEFINER
    // read function — EITHER is accepted here, both preserve the D-01 column omission.
    const securityInvoker = /security_invoker\s*=\s*on/i.test(CODE);
    const definerPoolRead =
      /create\s+(or replace\s+)?function\s+public\.wp_pool/i.test(CODE) ||
      /create\s+(or replace\s+)?view\s+public\.wp_pool/i.test(CODE);
    expect(securityInvoker || definerPoolRead).toBe(true);
  });

  it("physically omits guest PII columns from the masked pool (D-01)", () => {
    // The view/read must never SELECT guest_name / guest_email / guest_phone — structural
    // masking, not select-then-hide. (flight_no IS permitted — operational, D-02.)
    expect(CODE).not.toMatch(/\bguest_(name|email|phone)\b/);
  });

  it("hardens the SECURITY DEFINER claim RPC with an empty search_path (Pitfall 4)", () => {
    expect(CODE).toMatch(/set search_path\s*=\s*''/);
  });

  it("decides the race with the atomic conditional predicate, not RLS (D-04)", () => {
    expect(CODE).toMatch(/status\s*=\s*'paid'\s+and\s+driver_id is null/i);
  });

  it("hands the winner the full row atomically via RETURNING * (D-03)", () => {
    expect(CODE).toMatch(/returning \*/i);
  });

  it("grants claim_transfer execute to authenticated and revokes it from anon/public (D-06, Pitfall 5)", () => {
    expect(CODE).toMatch(
      /grant\s+execute on function public\.claim_transfer.*authenticated/i,
    );
    expect(CODE).toMatch(
      /revoke\s+execute on function public\.claim_transfer.*(public|anon)/i,
    );
  });

  it("adds NO write policy on wp_transfers (the no-write-policy lock from 0002/0003/0004 holds)", () => {
    // The claim write goes through the SECURITY DEFINER RPC only; no permissive
    // INSERT/UPDATE/DELETE policy is granted on wp_transfers.
    expect(CODE).not.toMatch(/for update/);
    expect(CODE).not.toMatch(/for insert/);
    expect(CODE).not.toMatch(/for delete/);
  });

  it("carries the Balkanity-only infra guardrail in the header (Pitfall 6)", () => {
    // Asserted against the RAW migration text (NOT comment-stripped) — the guardrail lives
    // in the FLAGGED header comment block. NEVER apply 0005 to Kalvia.
    expect(MIGRATION).toContain("Kalvia (utyatpadtibqqswsfvtr)");
    expect(MIGRATION).toContain("qyhdogajtmnvxphrslwm");
  });
});
