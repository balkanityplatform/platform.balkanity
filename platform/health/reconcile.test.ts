// platform/health/reconcile.test.ts — payment reconciliation detection (HLTH-02).
//
// NYQUIST BASELINE — RED until Plan 02 lands the reconcile worker
// (platform/health/reconcile.ts). The dynamic runtime-string import below type-checks
// BEFORE the implementation exists, then THROWS at runtime → this suite is RED now.
// Do NOT create the module here.
//
// D-03 RESOLVED: the Stripe API is the source of truth. reconcile() lists recent PAID
// Checkout Sessions (server-only Stripe key, mocked here) and left-anti-joins them against
// `wp_transfers` (service-role read, mocked here): a paid session whose transfer is NOT paid
// is a discrepancy (a never-delivered webhook). Two safety rails:
//   - lookback (Pitfall 1): a session inside the ~10-min in-flight window is NOT flagged
//     (the webhook may simply not have landed yet — no false positive).
//   - dedup (Pitfall 2): an already-OPEN health_events row for (kind, entity_id) suppresses a
//     second alert — exactly one alert per discrepancy.
//
// Stripe + the service-role client are ALWAYS MOCKED (no live network/DB).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// --- knobs the per-test fixtures tune ---
const NOW = new Date("2026-07-01T12:00:00Z").getTime();
// Stripe paid sessions the mocked list returns. created is a UNIX-seconds timestamp.
let STRIPE_SESSIONS: Array<{
  id: string;
  payment_status: string;
  created: number;
  metadata: { transfer_id: string };
}> = [];
// wp_transfers rows the mocked service-role read returns (the "paid" set).
let PAID_TRANSFER_IDS: string[] = [];
// existing OPEN health_events rows for the dedup branch: (kind, entity_id) pairs.
let OPEN_EVENTS: Array<{ kind: string; entity_id: string }> = [];
// captured inserts so we can assert how many discrepancy alerts fired.
const insertSpy = vi.fn(async () => ({ data: null, error: null }));

// --- Stripe mock: checkout.sessions.list yields STRIPE_SESSIONS ---
const sessionsList = vi.fn(async () => ({ data: STRIPE_SESSIONS }));
vi.mock("@/platform/payments/stripe", () => ({
  getStripe: vi.fn(() => ({ checkout: { sessions: { list: sessionsList } } })),
  createStripeClient: vi.fn(() => ({ checkout: { sessions: { list: sessionsList } } })),
}));

// --- service-role admin client mock: reads wp_transfers (paid set) + health_events (open),
//     and inserts a health_events discrepancy row. A small chainable stub per from(table). ---
vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "wp_transfers") {
        // .select(...).eq('status','paid') → the paid transfer ids
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: PAID_TRANSFER_IDS.map((id) => ({ id, status: "paid" })),
              error: null,
            })),
          })),
        };
      }
      // health_events: open-rows read + discrepancy insert
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(async () => ({ data: OPEN_EVENTS, error: null })),
          })),
        })),
        insert: insertSpy,
      };
    }),
  })),
}));

type Discrepancy = { entityId: string; kind: string };
type Reconcile = (opts?: { now?: number }) => Promise<Discrepancy[]>;

async function loadReconcile(): Promise<Reconcile> {
  const specifier = "@/platform/health/reconcile";
  const mod = (await import(/* @vite-ignore */ specifier)) as { reconcile: Reconcile };
  return mod.reconcile;
}

describe("payment reconciliation detection (HLTH-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    STRIPE_SESSIONS = [];
    PAID_TRANSFER_IDS = [];
    OPEN_EVENTS = [];
  });

  it("detection — a paid Stripe session with NO matching paid transfer yields one discrepancy", async () => {
    STRIPE_SESSIONS = [
      {
        id: "cs_1",
        payment_status: "paid",
        created: Math.floor((NOW - 60 * 60 * 1000) / 1000), // 1h ago — well outside lookback
        metadata: { transfer_id: "t1" },
      },
    ];
    PAID_TRANSFER_IDS = []; // t1 is NOT paid in the DB → discrepancy
    const reconcile = await loadReconcile();
    const out = await reconcile({ now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0]?.entityId).toBe("t1");
  });

  it("lookback — a paid session inside the ~10-min in-flight window is NOT flagged", async () => {
    STRIPE_SESSIONS = [
      {
        id: "cs_recent",
        payment_status: "paid",
        created: Math.floor((NOW - 3 * 60 * 1000) / 1000), // 3 min ago — inside the window
        metadata: { transfer_id: "t_recent" },
      },
    ];
    PAID_TRANSFER_IDS = []; // not yet paid, but too recent to flag
    const reconcile = await loadReconcile();
    const out = await reconcile({ now: NOW });
    expect(out).toHaveLength(0);
  });

  it("dedup — an OPEN health_events row for the discrepancy suppresses a second alert", async () => {
    STRIPE_SESSIONS = [
      {
        id: "cs_dupe",
        payment_status: "paid",
        created: Math.floor((NOW - 60 * 60 * 1000) / 1000),
        metadata: { transfer_id: "t_dupe" },
      },
    ];
    PAID_TRANSFER_IDS = [];
    OPEN_EVENTS = [{ kind: "reconciliation_discrepancy", entity_id: "t_dupe" }];
    const reconcile = await loadReconcile();
    await reconcile({ now: NOW });
    // already-open → NO new insert fires (single alert per discrepancy, Pitfall 2)
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("never-writes-paid — reconcile.ts contains no status:'paid' write (belt; single-writer gate is authority)", () => {
    const src = stripComments(
      readFileSync(join(process.cwd(), "platform/health/reconcile.ts"), "utf8"),
    );
    expect(/status\s*:\s*['"]paid['"]/.test(src)).toBe(false);
  });
});

// Strip block + line comments so a commented-out example never trips the source-grep.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
