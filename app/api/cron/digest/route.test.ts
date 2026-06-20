// app/api/cron/digest/route.test.ts — x-cron-secret auth gate for the hourly digest cron.
//
// NYQUIST BASELINE — RED until Plan 02 lands the route handler (app/api/cron/digest/route.ts).
// The dynamic runtime-string import below type-checks BEFORE the implementation exists, then
// THROWS at runtime → this suite is RED now. Do NOT create the route here.
//
// What this pins (GREEN in Plan 02): the digest route fires Phase-7's existing sendDueDigests()
// (which honours each driver's digest_send_hour). It is a public endpoint, so it MUST
// authenticate every caller via the x-cron-secret header against process.env.CRON_SECRET.
//   - unauthorized: a missing/wrong header → 401 AND ZERO work (sendDueDigests never awaited).
//   - authorized:   the correct header → sendDueDigests is awaited and the route returns 200.
//
// sendDueDigests is MOCKED so no live Resend/DB is touched (D-15 caveat: never a live send).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CRON_SECRET = "test-cron-secret-0123456789";

// Phase-7's existing digest invokable; the route delegates to it. Mocked here.
const sendDueDigests = vi.fn(async () => ({ sent: 0 }));
vi.mock("@/platform/notifications/digest", () => ({ sendDueDigests }));

type RoutePost = (req: Request) => Promise<Response>;
async function loadPost(): Promise<RoutePost> {
  const specifier = "@/app/api/cron/digest/route";
  const mod = (await import(/* @vite-ignore */ specifier)) as { POST: RoutePost };
  return mod.POST;
}

function postReq(secret?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-cron-secret"] = secret;
  return new Request("http://localhost/api/cron/digest", {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("digest cron route auth gate (D-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("unauthorized — a missing/wrong x-cron-secret returns 401 and performs ZERO work", async () => {
    const POST = await loadPost();
    const res = await POST(postReq()); // no header at all
    expect(res.status).toBe(401);
    expect(sendDueDigests).not.toHaveBeenCalled();
  });

  it("authorized — the correct x-cron-secret awaits sendDueDigests and returns 200", async () => {
    const POST = await loadPost();
    const res = await POST(postReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(sendDueDigests).toHaveBeenCalledTimes(1);
  });
});
