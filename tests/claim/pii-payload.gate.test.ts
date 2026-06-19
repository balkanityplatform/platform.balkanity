// tests/claim/pii-payload.gate.test.ts — LIVE adversarial gate (CLAIM-03 / SC3, SC4, T-05-02).
//
// PII gating MUST live at the data layer, not the UI — UI masking leaks via the auto-generated
// PostgREST / supabase-js API, which is exactly the attack this gate proves closed. A driver who
// has NOT claimed a transfer must see ZERO guest PII keys in the masked pool payload, and an
// adversarial raw read of the BASE table under the same JWT must return ZERO rows (the RLS
// boundary holds against a devtools/anon-key attacker — SC4). Flight no. is EXPECTED present in
// the pool — operational, reclassified non-PII for v1 (D-02), and is NOT a gate failure.
//
// NYQUIST BASELINE: migration 0005 (the wp_pool view + the claiming-driver/admin RLS policy)
// does NOT exist yet — authored in Plan 02, applied live (Balkanity ONLY) in Plan 03. This gate
// is RED now; do NOT stub the view to make it green. The live apply is the Plan 03 BLOCKING task.
//
// PREREQUISITES (live TEST-DB seeding via the Task-2 fixtures, gated behind the Plan 03 apply):
//   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
//   - When the live env is absent the gate SKIPS (never false-passes) via hasLiveEnv().
import { afterEach, describe, expect, it } from "vitest";

import {
  hasLiveEnv,
  makeCallerClient,
  seedDrivers,
  seedPaidTransfer,
  teardown,
  type SeedIds,
} from "./fixtures";

// The PII keys that must NEVER appear in a non-claiming driver's payload (D-01 / D-02).
// flight_no is deliberately ABSENT here — it is operational and expected present (D-02).
const PII_KEYS = ["guest_name", "guest_email", "guest_phone", "address", "notes"];

const describeLive = hasLiveEnv() ? describe : describe.skip;

describeLive("CLAIM-03 / SC3, SC4 — non-claiming-driver zero-PII gate (live)", () => {
  let pending: SeedIds | null = null;

  afterEach(async () => {
    if (pending) {
      await teardown(pending);
      pending = null;
    }
  });

  it("leaks zero PII keys to a non-claiming driver via the masked pool, flight_no present", async () => {
    const transfer = await seedPaidTransfer();
    const [driver] = await seedDrivers(1); // a NON-claiming driver
    pending = { transfer, driverUserIds: [driver.userId] };

    const client = makeCallerClient(driver.accessToken);

    // (a) The masked pool — structurally cannot carry PII (the SECURITY DEFINER read
    //     function physically omits it). Per the resolved Open-Q1 (option b), wp_pool is a
    //     definer FUNCTION, so it is invoked via PostgREST as an RPC, not a queryable relation.
    const { data: pool } = await client.rpc("wp_pool");
    expect(pool).not.toBeNull();
    for (const row of pool ?? []) {
      for (const key of PII_KEYS) {
        expect(Object.keys(row)).not.toContain(key);
      }
      // flight_no is operational, EXPECTED present — NOT a gate failure (D-02).
      expect(Object.keys(row)).toContain("flight_no");
    }
  });

  it("returns zero base-table rows to a non-claiming driver (raw PostgREST attack — SC4)", async () => {
    const transfer = await seedPaidTransfer();
    const [driver] = await seedDrivers(1); // a NON-claiming driver
    pending = { transfer, driverUserIds: [driver.userId] };

    const client = makeCallerClient(driver.accessToken);

    // (b) Adversarial: hit the BASE table directly with the same JWT — the anon-key API path
    //     an attacker would use in devtools. RLS must return ZERO rows (not a masked row) for a
    //     non-claiming driver, so no PII leaks even via raw PostgREST (SC4 / T-05-02).
    const { data: base } = await client
      .from("wp_transfers")
      .select("*")
      .eq("id", transfer.transferId);
    expect(base).toHaveLength(0);
  });
});
