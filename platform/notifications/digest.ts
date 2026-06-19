import "server-only";
// platform/notifications/digest.ts — driver daily-digest builder + invokable send (NOTF-05).
//
// `import "server-only"` (line 1, PLAT-05): this module reads the service-role pool
// projection and the Resend send path — it must NEVER be importable from a client
// component (the build-time guarantee the service-role / RESEND keys stay server-side).
//
// ── PHASE 8 SEAM (D-08, threat T-07-DG4) ────────────────────────────────────────────
// `sendDueDigests()` is an INVOKABLE function only. The TIME TRIGGER that fires it at
// each driver's chosen `digest_send_hour` is PHASE 8 (Supabase pg_cron + pg_net invoking
// this from the DB). Phase 7 ships the content builder, the opt-in preference + UI, and
// this invokable send — the cron schedule that calls it is explicitly out of scope here.
// ────────────────────────────────────────────────────────────────────────────────────
//
// PII GATE (threat T-07-DG1): sendDueDigests runs WITHOUT a caller JWT (cron context),
// so it cannot rely on the wp_pool() RPC's RLS masking for the OWN-RUNS read. The PII
// gate here is the EXPLICIT non-PII PROJECTION: buildDigest selects/maps ONLY the 9
// masked operational columns (arrival/airport/zone/flight_no/fare/pax/luggage) and NEVER
// the guest contact fields or exact pickup address — even though the owning driver
// legitimately has that PII post-claim, the DIGEST BODY summarises operational fields
// only. digest.test.ts asserts ZERO guest-PII keys reach the rendered HTML.
//
// RATE SAFETY (Pitfall 3, threat T-07-DG3): the multi-driver fan-out is SEQUENCED with a
// ~250ms delay between sends (NOT Promise.all) so it stays ≤5 req/s. Each send is
// independent (one failure never aborts the loop), routed through `sendEmail` at the
// `best_effort` tier (soft-capped by sendEmail, D-10) with a STABLE per-(driver, day)
// idempotencyKey so a re-invocation on the same UTC day never double-sends.
import { createAdminClient } from "@/platform/supabase/admin";
import { buildDigestEmail, type DigestItem } from "@/platform/notifications/templates";
import { sendEmail } from "@/platform/notifications/send-email";

// The 9 masked, non-PII operational columns the digest is allowed to read. This list IS
// the PII gate — guest contact fields and the exact address are deliberately absent.
const POOL_COLUMNS =
  "id,status,arrival_at,airport,zone,flight_no,amount_cents,pax,luggage_count";

// The driver's own claimed/active runs for the day count as "active" in these states.
const ACTIVE_RUN_STATES = ["claimed", "en_route", "arrived", "picked_up"];

// Map an arbitrary row to ONLY the non-PII DigestItem fields (the projection gate in code
// form — never copies a guest contact or address key onto the rendered item).
function toDigestItem(row: Record<string, unknown>): DigestItem {
  return {
    arrival_at: (row.arrival_at as string | null) ?? null,
    airport: (row.airport as string | null) ?? null,
    zone: (row.zone as string | null) ?? null,
    flight_no: (row.flight_no as string | null) ?? null,
    amount_cents: (row.amount_cents as number | null) ?? null,
    pax: (row.pax as number | null) ?? null,
    luggage_count: (row.luggage_count as number | null) ?? null,
  };
}

// buildDigest — assemble the morning snapshot for one driver and render it to {subject, html}.
// POOL: the currently-claimable masked pool (the SAME 9 columns wp_pool() exposes). OWN RUNS:
// the driver's own active claimed runs for the day. Returns the rendered email; the HTML never
// contains guest PII (templates.buildDigestEmail renders operational fields only).
export async function buildDigest(
  driverId: string,
): Promise<{ subject: string; html: string }> {
  const admin = createAdminClient();

  // POOL — the masked claimable snapshot. wp_pool() structurally omits PII; we additionally
  // map to the non-PII DigestItem shape so nothing beyond the 9 columns can render.
  const { data: poolData } = await admin.rpc("wp_pool");
  const poolItems: DigestItem[] = ((poolData ?? []) as Record<string, unknown>[]).map(
    toDigestItem,
  );

  // OWN RUNS — the driver's own rows. The EXPLICIT column projection is the PII gate (cron
  // has no caller JWT). Filter to active run states in JS (the row set is small per driver).
  const { data: runsData } = await admin
    .from("wp_transfers")
    .select(POOL_COLUMNS)
    .eq("driver_id", driverId);
  const ownRuns: DigestItem[] = ((runsData ?? []) as Record<string, unknown>[])
    .filter((r) => ACTIVE_RUN_STATES.includes(String(r.status)))
    .map(toDigestItem);

  const { subject, html } = buildDigestEmail({ poolItems, ownRuns });
  return { subject, html };
}

// sendDueDigests — the INVOKABLE fan-out (Phase 8 cron calls this). Sends the daily digest to
// every opted-in driver whose self-chosen send hour matches the current UTC hour. Each send is
// best_effort (soft-capped by sendEmail), sequenced ~250ms apart (≤5 req/s, Pitfall 3), keyed by
// a stable per-(driver, day) idempotencyKey, and independently isolated so one failure does not
// abort the loop. The TIME TRIGGER that invokes this is Phase 8 (Supabase pg_cron + pg_net).
export async function sendDueDigests(): Promise<void> {
  const admin = createAdminClient();

  const currentHour = new Date().getUTCHours();
  const todayUtcDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC) — per-day key.

  // Opted-in drivers due this hour. Join app_users for the recipient email (the address the
  // digest is sent to). digest_enabled is off by default (D-07) so an un-opted driver never matches.
  const { data: due } = await admin
    .from("driver_profiles")
    .select("user_id, digest_send_hour, app_users(email)")
    .eq("digest_enabled", true)
    .eq("digest_send_hour", currentHour);

  for (const row of (due ?? []) as Array<{
    user_id: string;
    digest_send_hour: number | null;
    app_users: { email: string | null } | { email: string | null }[] | null;
  }>) {
    // app_users may resolve to an object or a single-element array depending on the join shape.
    const joined = Array.isArray(row.app_users) ? row.app_users[0] : row.app_users;
    const email = joined?.email ?? null;
    if (!email) continue; // no deliverable address — skip (never throws past here).

    try {
      const { subject, html } = await buildDigest(row.user_id);
      await sendEmail({
        to: email,
        subject,
        html,
        tier: "best_effort",
        idempotencyKey: `digest:${row.user_id}:${todayUtcDate}`,
      });
    } catch (err) {
      // One driver's failure must never abort the fan-out — log the error (NOT recipient PII).
      console.error("[NOTF-05] digest send failed (continuing)", err);
    }

    // Sequence the sends to stay ≤5 req/s (Pitfall 3) — NOT Promise.all.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
