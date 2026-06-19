// platform/notifications/digest.test.ts — daily-digest content builder (NOTF-05).
//
// NYQUIST BASELINE — RED until Plan 05 lands the digest builder
// (platform/notifications/digest.ts → buildDigest). The runtime-string import type-checks
// before the impl exists, then THROWS → RED now. Resend mocked for safety (D-15).
//
// What this pins (GREEN in Plan 05): the digest output contains the MASKED wp_pool fields
// (date/arrival/airport/zone/flight_no/fare/pax/luggage) + the driver's own claimed runs,
// and ZERO guest-PII keys (no guest_name/guest_email/guest_phone/notes/exact address).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));

// The masked pool the digest reads (wp_pool() shape — 8 D-01 columns, no PII).
const POOL_ROWS = [
  {
    id: "p1",
    status: "paid",
    arrival_at: "2026-07-01T10:00:00Z",
    airport: "SOF",
    zone: "Bansko",
    flight_no: "FB123",
    amount_cents: 9000,
    pax: 2,
    luggage_count: 3,
  },
];
// The driver's own claimed runs (full rows are legitimate post-claim, but the DIGEST must
// still not echo guest PII into the email body — it summarises operational fields only).
const MY_RUNS = [
  {
    id: "r1",
    status: "claimed",
    arrival_at: "2026-07-01T12:00:00Z",
    airport: "SOF",
    zone: "Plovdiv",
    flight_no: "FB777",
    amount_cents: 7000,
    pax: 1,
    luggage_count: 1,
    // PII present on the row but MUST NOT be rendered into the digest:
    guest_name: "SECRET GUEST",
    guest_email: "secret@example.com",
    guest_phone: "+359000000000",
    notes: "SECRET NOTE",
  },
];

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: POOL_ROWS, error: null })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: MY_RUNS, error: null })),
      })),
    })),
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
    expect(html).toContain("Bansko"); // zone (masked, AREA only)
    expect(html).toContain("FB123"); // flight_no (operational, non-PII)
    expect(html).toContain("Plovdiv"); // the driver's own claimed run
  });

  it("contains ZERO guest-PII keys (no name/email/phone/notes/address)", async () => {
    const buildDigest = await loadBuildDigest();
    const { html } = await buildDigest("driver-1");
    for (const frag of PII_FRAGMENTS) {
      expect(html).not.toContain(frag);
    }
  });
});
