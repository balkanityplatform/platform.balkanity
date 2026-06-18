// platform/rls/payments-schema.test.ts — source-level contract for migration 0003.
//
// This is a SOURCE-LEVEL contract test (the Phase 2 precedent, supply-rls.test.ts):
// it reads supabase/migrations/0003_payments_spine.sql and asserts that the migration
// TEXT encodes the payments trust-spine security contract (HLTH-01 / SC3 / SC4 and
// threats T-SD, T-spoof). It does NOT touch a live DB — the live-DB UNIQUE/RLS check
// is the BLOCKING push-verification checkpoint + e2e (03-VALIDATION §"Manual-Only
// Verifications"). The point is to fail fast in CI if anyone weakens the policy shape
// (adds a write policy, drops the admin gate, drops the UNIQUE event_id) at the source.
//
// NYQUIST BASELINE: migration 0003 does NOT exist yet — it lands in a later plan
// (02-04). These assertions are EXPECTED to be RED now; that is the contract the
// migration must satisfy. Do NOT create the migration to make this green.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/0003_payments_spine.sql"),
  "utf8",
);

// Strip SQL line comments so policy/keyword assertions can't be satisfied by a
// commented-out line (the "no write policy" rule is load-bearing — a commented
// `-- for insert` must not satisfy the contract, and a commented-out RLS enable
// must not break it).
const CODE = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const RLS_TABLES = ["wp_transfers", "webhook_events"] as const;

describe("0003 payments-spine schema contract (source-level)", () => {
  it("enables row level security on both wp_transfers and webhook_events", () => {
    const enables = CODE.match(/enable row level security/g) ?? [];
    expect(enables.length).toBeGreaterThanOrEqual(2);

    for (const table of RLS_TABLES) {
      expect(CODE).toMatch(
        new RegExp(`alter table public\\.${table}\\s+enable row level security`),
      );
    }
  });

  it("grants exactly one admin-gated SELECT policy per table (and no more)", () => {
    const selectPolicies = CODE.match(/for select to authenticated/g) ?? [];
    expect(selectPolicies).toHaveLength(2);

    // Each admin-read policy uses the shared is_admin() predicate (Phase 2 pattern).
    const adminGate = CODE.match(/using \(public\.is_admin\(\)\)/g) ?? [];
    expect(adminGate).toHaveLength(2);
  });

  it("grants NO insert/update/delete policy (paid writes go through service-role only)", () => {
    expect(CODE).not.toMatch(/for insert/);
    expect(CODE).not.toMatch(/for update/);
    expect(CODE).not.toMatch(/for delete/);
  });

  it("creates the UNIQUE index on webhook_events (event_id) (SC3 — replay idempotency)", () => {
    // Whitespace-tolerant: a unique index or a UNIQUE column constraint on event_id.
    expect(CODE).toMatch(
      /create unique index\s+\w+\s+on public\.webhook_events\s*\(\s*event_id\s*\)/,
    );
  });

  it("records the required webhook_events audit columns (SC4)", () => {
    for (const col of ["event_id", "type", "signature_result", "outcome"]) {
      expect(CODE).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it("encodes the wp_transfers money + linkage columns", () => {
    expect(CODE).toMatch(/\bstatus\b/);
    expect(CODE).toMatch(
      /amount_cents\s+integer not null check \(amount_cents >= 0\)/,
    );
    expect(CODE).toMatch(/\bcurrency\b/);
    expect(CODE).toMatch(/\bfee_cents\b/);
    expect(CODE).toMatch(/\bpaid_at\b/);
    expect(CODE).toMatch(/\bstripe_checkout_session_id\b/);
    expect(CODE).toMatch(/\bstripe_payment_intent_id\b/);
    // FK to the supply-side destinations table.
    expect(CODE).toMatch(/references public\.destinations/);
  });

  it("carries the Balkanity-only infra guardrail in the header", () => {
    expect(MIGRATION).toContain("Kalvia (utyatpadtibqqswsfvtr)");
    expect(MIGRATION).toContain("qyhdogajtmnvxphrslwm");
  });
});
