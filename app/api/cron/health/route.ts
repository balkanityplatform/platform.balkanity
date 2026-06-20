// app/api/cron/health/route.ts — the authenticated 15-min health cron (HLTH-02/04/05).
//
// This is a PUBLIC-INTERNET endpoint doing PRIVILEGED work (reconciliation alerts, critical
// emails, service-role writes), so it MUST authenticate EVERY caller before any work runs
// (threat T-08-04, Pitfall 5). Mirrors the Stripe webhook's hard posture:
//
//   1. `export const runtime = "nodejs"` — NEVER Edge. Service-role + crypto are fragile on Edge.
//   2. AUTH GATE FIRST, zero work before it passes: the x-cron-secret header (pg_cron path) OR a
//      Vercel `Authorization: Bearer <CRON_SECRET>` header (the daily backstop, Plan 04) is
//      compared TIMING-SAFE (crypto.timingSafeEqual over equal-length buffers — NEVER `===`,
//      which is timing-leaky, threat T-08-07) against process.env.CRON_SECRET. A missing/wrong
//      secret → 401 with ZERO work (no DB read, no worker call).
//   3. Responses are built via `new NextResponse(JSON.stringify(...))` (no `.json(` token),
//      mirroring the webhook.
//
// MONEY LOCK (D-01): the route performs ZERO `wp_transfers` writes — it delegates to the
// detect-and-alert sweep only.
import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runHealthSweep } from "@/platform/health/sweep";

// CONTEXT D-02 lock — Node runtime ONLY (mirrors the webhook).
export const runtime = "nodejs";

function jsonResponse(payload: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Timing-safe equality (V6, threat T-08-07). Returns false on a length mismatch or empty secret
// WITHOUT a length-leaking early-return on the compare itself: timingSafeEqual requires
// equal-length buffers, so we guard length first (a length mismatch is not the secret leaking).
function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Accept BOTH the pg_cron `x-cron-secret` header and Vercel's `Authorization: Bearer <secret>`
// (the daily backstop, Plan 04). Returns the presented secret, or null if neither is present.
function presentedSecret(req: NextRequest): string | null {
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret) return headerSecret;
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

export async function POST(req: NextRequest) {
  // AUTH GATE FIRST — zero work before it passes (threat T-08-04).
  if (!secretMatches(presentedSecret(req))) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  // Authenticated: run the sweep (reconcile + stuck + keep-alive). The sweep isolates each
  // worker internally, but wrap defensively so a sweep-level throw still returns a 200 — a
  // transient detector failure must not wedge the cron (the next */15 cycle retries).
  try {
    await runHealthSweep();
  } catch (err) {
    console.error("[HLTH] health sweep failed", err);
  }

  return jsonResponse({ ok: true }, 200);
}
