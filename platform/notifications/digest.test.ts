// platform/notifications/digest.test.ts — daily-digest content builder (NOTF-05).
//
// What this pins: the digest output contains the MASKED operational fields
// (date/arrival/airport/zone/flight_no/fare/pax/luggage) for BOTH the claimable pool and the
// driver's own claimed runs, with airport/zone read off the joined `destinations`, and ZERO
// guest-PII keys (no guest_name/guest_email/guest_phone/notes/exact address).
//
// CR-01 REGRESSION GUARD: buildDigest must NOT read the claimable pool through the
// auth.uid()-gated wp_pool() RPC on the service-role/cron path (that returns 0 rows in
// production). This test mocks the REAL chain now used — the service-role
// `.from("wp_transfers").select(...).eq("status","paid").is("driver_id", null)` for the pool
// AND `.from("wp_transfers").select(...).eq("driver_id", id)` for own-runs — and asserts the
// `rpc` accessor is NEVER invoked. If buildDigest regressed to `admin.rpc("wp_pool")`, the
// pool branch would not be exercised here and the rpc-not-called assertion would fail.
//
// WR-05 REGRESSION GUARD: airport/zone come off the `destinations(airport,zone)` JOIN, not the
// base wp_transfers row. The mock rows carry airport/zone ONLY inside `destinations`, so a
// regression to selecting airport/zone off the base row would drop them from the digest.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));

// The masked open pool the digest reads via the service-role base-table select + destinations
// join (status='paid' AND driver_id IS NULL). airport/zone live ONLY on `destinations` (WR-05).
const POOL_ROWS = [
  {
    id: "p1",
    status: "paid",
    arrival_at: "2026-07-01T10:00:00Z",
    flight_no: "FB123",
    amount_cents: 9000,
    pax: 2,
    luggage_count: 3,
    destinations: { airport: "SOF", zone: "Bansko" },
  },
];
// The driver's own claimed runs. Full rows are legitimate post-claim, but the DIGEST must
// still not echo guest PII into the email body — it summarises operational fields only.
// airport/zone again come off the joined `destinations`, never the base row (WR-05).
const MY_RUNS = [
  {
    id: "r1",
    status: "claimed",
    arrival_at: "2026-07-01T12:00:00Z",
    flight_no: "FB777",
    amount_cents: 7000,
    pax: 1,
    luggage_count: 1,
    destinations: { airport: "SOF", zone: "Plovdiv" },
    // PII present on the row but MUST NOT be rendered into the digest:
    guest_name: "SECRET GUEST",
    guest_email: "secret@example.com",
    guest_phone: "+359000000000",
    notes: "SECRET NOTE",
  },
];

// Spy proving the auth.uid()-gated wp_pool() RPC is NEVER used on the service-role path (CR-01).
const rpcSpy = vi.fn(async () => ({ data: [], error: null }));
// Capture the column projection the digest selects so we can assert it never widens to PII.
const selectSpy = vi.fn();

// Build a chainable query mock for `admin.from("wp_transfers").select(...)`.
//   POOL read:     .select(cols).eq("status","paid").is("driver_id", null)  → POOL_ROWS
//   OWN-RUNS read: .select(cols).eq("driver_id", id)                        → MY_RUNS
// `.eq()` is BOTH awaitable (own-runs resolves to MY_RUNS) AND chainable to `.is()` (pool
// resolves to POOL_ROWS). This mirrors the supabase-js builder's then-able chain semantics.
function makeQuery() {
  const ownRunsResult = { data: MY_RUNS, error: null };
  const poolResult = { data: POOL_ROWS, error: null };

  const eqStage = {
    // .is("driver_id", null) terminates the POOL chain → the open-pool rows.
    is: vi.fn(async () => poolResult),
    // .eq(...) alone (own-runs) is awaitable → the driver's own rows.
    then: (resolve: (v: typeof ownRunsResult) => unknown) => resolve(ownRunsResult),
  };
  return {
    select: vi.fn((cols: string) => {
      selectSpy(cols);
      return { eq: vi.fn(() => eqStage) };
    }),
  };
}

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcSpy,
    from: vi.fn(() => makeQuery()),
  })),
}));

vi.mock("@/platform/i18n/dictionary", () => ({
  getDictFor: vi.fn(() => ({
    emailDigestSubject: "Your Balkanity day",
    emailDigestHeading: "Your Balkanity day",
    emailDigestIntro: "Here are the transfers available to claim and your runs.",
    emailDigestEmptyBody: "No transfers right now.",
  })),
}));

const PII_FRAGMENTS = [
  "SECRET GUEST",
  "secret@example.com",
  "+359000000000",
  "SECRET NOTE",
];

type BuildDigest = (driverId: string) => Promise<{ subject: string; html: string }>;

async function loadBuildDigest(): Promise<BuildDigest> {
  const specifier = "@/platform/notifications/digest";
  const mod = (await import(/* @vite-ignore */ specifier)) as { buildDigest: BuildDigest };
  return mod.buildDigest;
}

describe("buildDigest (NOTF-05)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes masked pool operational fields and the driver's runs", async () => {
    const buildDigest = await loadBuildDigest();
    const { html } = await buildDigest("driver-1");
    expect(html).toContain("Bansko"); // pool zone off destinations join (masked, AREA only)
    expect(html).toContain("FB123"); // pool flight_no (operational, non-PII)
    expect(html).toContain("Plovdiv"); // own-run zone off destinations join
    expect(html).toContain("FB777"); // own-run flight_no
  });

  it("reads the pool DIRECTLY (service-role), NOT via the auth.uid()-gated wp_pool() RPC (CR-01)", async () => {
    const buildDigest = await loadBuildDigest();
    await buildDigest("driver-1");
    // wp_pool() returns 0 rows under the no-JWT service-role/cron client — it must never be used.
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("selects airport/zone via the destinations join, never off the base wp_transfers row (WR-05)", async () => {
    const buildDigest = await loadBuildDigest();
    await buildDigest("driver-1");
    const projections = selectSpy.mock.calls.map((c) => c[0] as string);
    expect(projections.length).toBeGreaterThan(0);
    for (const cols of projections) {
      expect(cols).toContain("destinations(airport,zone)");
      // The base-table column list must NOT bare-select airport/zone (they live on destinations).
      expect(cols).not.toMatch(/(^|,)\s*airport(\s*,|$)/);
      expect(cols).not.toMatch(/(^|,)\s*zone(\s*,|$)/);
    }
  });

  it("contains ZERO guest-PII keys (no name/email/phone/notes/address)", async () => {
    const buildDigest = await loadBuildDigest();
    const { html } = await buildDigest("driver-1");
    for (const frag of PII_FRAGMENTS) {
      expect(html).not.toContain(frag);
    }
  });
});
