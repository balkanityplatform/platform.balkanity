// app/api/cron/digest/route.ts — the authenticated hourly digest cron (D-10, HLTH-05 sibling).
//
// This is the TIME TRIGGER Phase 7 deferred to Phase 8 (see the PHASE 8 SEAM header in
// platform/notifications/digest.ts): pg_cron fires this route every hour, and the route invokes
// Phase 7's existing `sendDueDigests()` UNCHANGED — that function self-filters drivers by
// `digest_send_hour == current UTC hour`, so the route adds ZERO scheduling logic.
//
// It is a PUBLIC-INTERNET endpoint doing PRIVILEGED work (driver email fan-out), so it MUST
// authenticate EVERY caller before any work runs (threat T-08-13, Pitfall 5). It mirrors the
// health route's (Plan 02) hard posture EXACTLY:
//
//   1. `export const runtime = "nodejs"` — NEVER Edge (service-role + crypto are fragile on Edge).
//   2. AUTH GATE FIRST, zero work before it passes: the `x-cron-secret` header (pg_cron path) OR a
//      Vercel `Authorization: Bearer <CRON_SECRET>` header (the daily-backstop convention) is
//      compared TIMING-SAFE (crypto.timingSafeEqual over equal-length buffers — NEVER `===`,
//      which is timing-leaky, threat T-08-07) against process.env.CRON_SECRET. A missing/wrong
//      secret → 401 with ZERO work (sendDueDigests is never reached — route.test.ts asserts this).
//   3. Responses are built via `new NextResponse(JSON.stringify(...))` (no `.json(` token).
//
// MONEY LOCK (D-01): the route performs ZERO `wp_transfers` writes — it is a thin authenticated
// wrapper around the existing digest invokable.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDueDigests } from "@/platform/notifications/digest";

// CONTEXT D-02 lock — Node runtime ONLY (mirrors the webhook + health route).
export const runtime = "nodejs";

function jsonResponse(payload: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Timing-safe equality (V6, threat T-08-07). timingSafeEqual requires equal-length buffers, so we
// guard length first (a length mismatch is not the secret leaking); returns false on an empty
// expected secret or an absent provided secret.
function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Accept BOTH the pg_cron `x-cron-secret` header and Vercel's `Authorization: Bearer <secret>`
// (the daily-backstop convention). Returns the presented secret, or null if neither is present.
function presentedSecret(req: Request): string | null {
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret) return headerSecret;
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

export async function POST(req: Request) {
  // AUTH GATE FIRST — zero work before it passes (threat T-08-13). sendDueDigests is unreachable
  // on a bad/missing secret.
  if (!secretMatches(presentedSecret(req))) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  // Authenticated: fire the existing digest fan-out UNCHANGED — it self-filters by
  // digest_send_hour == current UTC hour. Wrap defensively so a fan-out throw still returns 200:
  // a transient send error must not wedge the cron (the next hourly cycle retries the due set).
  try {
    await sendDueDigests();
  } catch (err) {
    console.error("[NOTF-05] digest fan-out failed", err);
  }

  return jsonResponse({ ok: true }, 200);
}
