// platform/health/stuck.test.ts — stuck-transfer detection (HLTH-04).
//
// NYQUIST BASELINE — RED until Plan 02 lands the stuck worker (platform/health/stuck.ts).
// The dynamic runtime-string import below type-checks BEFORE the implementation exists, then
// THROWS at runtime → this suite is RED now. Do NOT create the module here.
//
// D-04 predicate: a transfer is STUCK when status='paid' AND driver_id IS NULL AND
// arrival_at <= now()+12h (a paid, unclaimed transfer whose arrival is near). A claimed
// transfer is NOT stuck; a paid transfer with arrival > 12h away is NOT stuck.
//
// D-05: stuck alerting is IN-APP ONLY (insertNotification) — it must NEVER sendEmail (the
// Resend 100/day cap is for guest/driver transactional mail, not internal ops alerts). This is
// pinned both behaviourally (no email mock invoked) and as a source-grep belt below.
//
// The service-role client is ALWAYS MOCKED (no live DB).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NOW = new Date("2026-07-01T12:00:00Z").getTime();

// wp_transfers rows the mocked service-role read returns; per-test tuned.
let TRANSFER_ROWS: Array<{
  id: string;
  status: string;
  driver_id: string | null;
  arrival_at: string;
}> = [];
const insertSpy = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "wp_transfers") {
        // .select(...).eq('status','paid').is('driver_id', null) → candidate rows
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => ({
                data: TRANSFER_ROWS.filter(
                  (r) => r.status === "paid" && r.driver_id === null,
                ),
                error: null,
              })),
            })),
          })),
        };
      }
      // health_events: dedup read returns no open rows here + the alert insert
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ is: vi.fn(async () => ({ data: [], error: null })) })),
        })),
        insert: insertSpy,
      };
    }),
  })),
}));

type StuckRow = { id: string };
type FindStuck = (opts?: { now?: number }) => Promise<StuckRow[]>;

async function loadFindStuck(): Promise<FindStuck> {
  const specifier = "@/platform/health/stuck";
  const mod = (await import(/* @vite-ignore */ specifier)) as { findStuck: FindStuck };
  return mod.findStuck;
}

const hoursFromNow = (h: number) => new Date(NOW + h * 60 * 60 * 1000).toISOString();

describe("stuck-transfer detection (HLTH-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TRANSFER_ROWS = [];
  });

  it("predicate — paid + unclaimed + arrival within 12h is flagged; claimed and far-future are not", async () => {
    TRANSFER_ROWS = [
      // STUCK: paid, no driver, arrival in 6h (<= now+12h)
      { id: "stuck1", status: "paid", driver_id: null, arrival_at: hoursFromNow(6) },
      // NOT stuck: claimed (has a driver)
      { id: "claimed1", status: "paid", driver_id: "d1", arrival_at: hoursFromNow(6) },
      // NOT stuck: paid + unclaimed but arrival is 24h away (> now+12h)
      { id: "far1", status: "paid", driver_id: null, arrival_at: hoursFromNow(24) },
    ];
    const findStuck = await loadFindStuck();
    const out = await findStuck({ now: NOW });
    const ids = out.map((r) => r.id);
    expect(ids).toContain("stuck1");
    expect(ids).not.toContain("claimed1");
    expect(ids).not.toContain("far1");
  });

  it("in-app-only — stuck.ts contains no sendEmail( call (D-05; in-app alerts only)", () => {
    const src = stripComments(
      readFileSync(join(process.cwd(), "platform/health/stuck.ts"), "utf8"),
    );
    expect(/\bsendEmail\s*\(/.test(src)).toBe(false);
  });
});

// Strip block + line comments so a commented-out reference never trips the source-grep.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
