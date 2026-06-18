// platform/rls/supply-rls.test.ts — source-level RLS contract for migration 0002.
//
// This is a SOURCE-LEVEL contract test: it reads supabase/migrations/0002_supply_tables.sql
// and asserts that the migration TEXT encodes the security contract for the supply
// tables (ONBD-05 / threat T-02-EOP1, T-02-EOP2). It does NOT touch a live DB — a
// live-DB RLS test is deferred to the Plan 02 push verification (BLOCKING checkpoint)
// and the e2e suite. The point is to fail fast in CI if anyone weakens the policy
// shape (e.g. adds a write policy, or drops the admin gate) at the source.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/0002_supply_tables.sql"),
  "utf8",
);

const TABLES = [
  "companies",
  "properties",
  "destinations",
  "driver_profiles",
] as const;

// Strip SQL line comments so policy/keyword assertions can't be satisfied by a
// commented-out line (the "no write policy" rule is load-bearing).
const CODE = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("0002 supply-tables RLS contract (source-level)", () => {
  it("enables row level security on all four supply tables", () => {
    const enables = CODE.match(/enable row level security/g) ?? [];
    expect(enables).toHaveLength(4);

    for (const table of TABLES) {
      // Whitespace-tolerant: `alter table public.<table> ... enable row level security`.
      expect(CODE).toMatch(
        new RegExp(
          `alter table public\\.${table}\\s+enable row level security`,
        ),
      );
    }
  });

  it("grants exactly one admin-gated SELECT policy per table (and no more)", () => {
    const selectPolicies = CODE.match(/for select to authenticated/g) ?? [];
    expect(selectPolicies).toHaveLength(4);

    for (const table of TABLES) {
      expect(CODE).toMatch(
        new RegExp(`create policy "${table}_admin_read" on public\\.${table}`),
      );
    }
  });

  it("gates the admin-read policies on the admin role (defence-in-depth)", () => {
    // The policy is gated either via the is_admin() helper or an inline
    // role = 'admin' check; both must reference the admin role somewhere.
    expect(CODE).toMatch(/role = 'admin'/);
    // The four policies use the shared admin predicate.
    const adminGate = CODE.match(/using \(public\.is_admin\(\)\)/g) ?? [];
    expect(adminGate).toHaveLength(4);
  });

  it("grants NO insert/update/delete policy (writes go through service-role only)", () => {
    expect(CODE).not.toMatch(/for insert/);
    expect(CODE).not.toMatch(/for update/);
    expect(CODE).not.toMatch(/for delete/);
  });

  it("creates the globally-unique destinations slug index (D-09)", () => {
    expect(CODE).toMatch(
      /create unique index destinations_slug_key on public\.destinations \(slug\)/,
    );
  });

  it("encodes the money + commission integrity checks", () => {
    expect(CODE).toMatch(/price_cents\s+integer not null check \(price_cents >= 0\)/);
    expect(CODE).toMatch(
      /commission_pct integer not null check \(commission_pct between 0 and 100\)/,
    );
  });

  it("carries the Balkanity-only infra guardrail in the header", () => {
    expect(MIGRATION).toContain("Kalvia (utyatpadtibqqswsfvtr)");
    expect(MIGRATION).toContain("qyhdogajtmnvxphrslwm");
  });
});
