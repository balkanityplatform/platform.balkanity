// tests/claim/concurrency.gate.test.ts — LIVE adversarial gate (CLAIM-02 / SC2, T-05-01).
//
// The atomic claim is the ONLY correctness path that guarantees zero double-claims. N drivers
// firing claim_transfer() at the SAME paid/unclaimed transfer at the SAME instant must yield
// EXACTLY ONE ok=true winner and N-1 ok=false reason='already_claimed' losers — proven by a
// single Promise.all over N INDEPENDENT caller-auth clients (no await-in-loop, which would
// serialize and false-green — Pitfall 3 / T-05-01). The losers carry transfer=null (zero PII,
// D-03); the winner gets the full row atomically via the RPC's RETURNING * and driver_id equals
// that caller's auth.uid (the JWT, never a client-supplied id — D-04 / T-05-04).
//
// NYQUIST BASELINE: migration 0005 (the wp_pool view + claim_transfer RPC) does NOT exist yet —
// it is authored in Plan 02 and applied live (Balkanity ONLY) in Plan 03. This gate is RED now;
// do NOT stub the RPC to make it green. The live apply is the Plan 03 BLOCKING signed-off task.
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

const N_DRIVERS = 20; // N simultaneous claimers contending for one transfer
const K_ROUNDS = 5; // loop the whole gate K times on freshly re-seeded rows (Pitfall 3)

// Skip cleanly (not false-pass) when run without the live TEST DB.
const describeLive = hasLiveEnv() ? describe : describe.skip;

describeLive("CLAIM-02 / SC2 — concurrency one-winner gate (live)", () => {
  let pending: SeedIds | null = null;

  afterEach(async () => {
    if (pending) {
      await teardown(pending);
      pending = null;
    }
  });

  it(`yields exactly one winner across ${K_ROUNDS} rounds of ${N_DRIVERS} parallel claims`, async () => {
    for (let round = 0; round < K_ROUNDS; round++) {
      // Fresh paid/unclaimed transfer + N driver JWTs each round.
      const transfer = await seedPaidTransfer();
      const drivers = await seedDrivers(N_DRIVERS);
      pending = { transfer, driverUserIds: drivers.map((d) => d.userId) };

      // N INDEPENDENT caller-auth clients (anon key + per-driver JWT) — never service-role.
      const clients = drivers.map((d) => ({
        uid: d.userId,
        client: makeCallerClient(d.accessToken),
      }));

      // THE BARRIER: a single Promise.all fires all N RPCs concurrently. NO await between
      // fires — they contend on the one row lock (READ COMMITTED serialization). A for-await
      // loop here would serialize and false-green (Pitfall 3 / T-05-01).
      const results = await Promise.all(
        clients.map(({ client }) =>
          client.rpc("claim_transfer", { p_transfer_id: transfer.transferId }),
        ),
      );

      const winners = results.filter((r) => r.data?.ok === true);
      const losers = results.filter(
        (r) => r.data?.ok === false && r.data?.reason === "already_claimed",
      );

      // EXACTLY one winner — zero double-claims (CLAIM-02 / SC2).
      expect(winners).toHaveLength(1);
      // Every other caller is a graceful, typed loser.
      expect(losers).toHaveLength(N_DRIVERS - 1);
      // Losers carry zero PII — transfer is null (D-03 / T-05-02).
      expect(losers.every((l) => l.data?.transfer == null)).toBe(true);

      // The winner gets the full row atomically (RETURNING *), and its driver_id is the
      // winner's OWN auth.uid — never a client-supplied id (D-04 / T-05-04).
      const winnerIndex = results.findIndex((r) => r.data?.ok === true);
      expect(winners[0].data?.transfer).not.toBeNull();
      expect(winners[0].data?.transfer?.driver_id).toBe(clients[winnerIndex].uid);

      await teardown(pending);
      pending = null;
    }
  });
});
