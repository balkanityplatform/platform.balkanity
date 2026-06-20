// app/api/cron/health/route.test.ts — x-cron-secret auth gate for the 15-min health cron.
//
// NYQUIST BASELINE — RED until Plan 02 lands the route handler (app/api/cron/health/route.ts).
// The dynamic runtime-string import below type-checks BEFORE the implementation exists, then
// THROWS at runtime → this suite is RED now. Do NOT create the route here.
//
// What this pins (GREEN in Plan 02): the route is a public-internet endpoint doing real work
// (reconciliation + stuck + keep-alive), so it MUST authenticate every caller by comparing the
// x-cron-secret header (timing-safe) against process.env.CRON_SECRET.
//   - unauthorized: a missing/wrong header → 401 AND ZERO work (the mocked worker is never run).
//   - authorized:   the correct header → the worker is invoked and the route returns 200.
//
// The worker (reconcile/stuck/keepalive) is MOCKED so no live Stripe/DB is touched.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CRON_SECRET = "test-cron-secret-0123456789";

// The health worker the route delegates to (the 15-min sweep). Mocked so we can assert it is
// invoked only when authorized. The real export name is pinned in Plan 02; the route imports it.
const runHealthSweep = vi.fn(async () => ({ ok: true }));
vi.mock("@/platform/health/sweep", () => ({ runHealthSweep }));

// Belt-and-braces: also mock the underlying workers in case the route wires them directly.
vi.mock("@/platform/health/reconcile", () => ({ reconcile: vi.fn(async () => []) }));
vi.mock("@/platform/health/stuck", () => ({ findStuck: vi.fn(async () => []) }));

type RoutePost = (req: Request) => Promise<Response>;
async function loadPost(): Promise<RoutePost> {
  const specifier = "@/app/api/cron/health/route";
  const mod = (await import(/* @vite-ignore */ specifier)) as { POST: RoutePost };
  return mod.POST;
}

function postReq(secret?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-cron-secret"] = secret;
  return new Request("http://localhost/api/cron/health", {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("health cron route auth gate (HLTH-02/HLTH-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("unauthorized — a missing/wrong x-cron-secret returns 401 and performs ZERO work", async () => {
    const POST = await loadPost();
    const res = await POST(postReq("wrong-secret"));
    expect(res.status).toBe(401);
    expect(runHealthSweep).not.toHaveBeenCalled();
  });

  it("authorized — the correct x-cron-secret reaches the worker and returns 200", async () => {
    const POST = await loadPost();
    const res = await POST(postReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(runHealthSweep).toHaveBeenCalledTimes(1);
  });
});
