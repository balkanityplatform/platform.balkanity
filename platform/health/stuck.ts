import "server-only";
// platform/health/stuck.ts — stuck-transfer detection + in-app-only alert (HLTH-04).
//
// `import "server-only"` (line 1, PLAT-05): this module reads the service-role client — it must
// NEVER be importable from a client component (the build-time guarantee the key stays server-side).
//
// D-04 predicate: a transfer is STUCK when status='paid' AND driver_id IS NULL AND
// arrival_at <= now()+12h — a paid, unclaimed transfer whose arrival is near. A CLAIMED transfer
// (has a driver_id) is NOT stuck; a paid+unclaimed transfer whose arrival is >12h away is NOT yet
// stuck. The status/driver predicate is applied at the query layer; the 12h arrival bound is
// applied in JS over the (small) candidate set.
//
// D-05: stuck alerting is IN-APP ONLY (insertNotification) — it NEVER sends transactional email.
// The Resend 100/day cap is for guest/driver mail, not internal ops alerts. There is NO email
// import or call anywhere in this file (stuck.test.ts pins this with a comment-stripped grep).
//
// DEDUP (Pitfall 2): an already-OPEN health_events row for (kind='stuck_unclaimed', entity_id=
// transferId) suppresses a second alert — no re-alert storm every 15 min.
//
// MONEY LOCK (D-01): ZERO `wp_transfers` writes here — detect-and-alert only.
import { createAdminClient } from "@/platform/supabase/admin";
import { insertNotification } from "@/platform/notifications/notify";

const KIND = "stuck_unclaimed";

// Arrival horizon: a paid+unclaimed transfer arriving within this window is stuck (D-04).
const ARRIVAL_HORIZON_MS = 12 * 60 * 60 * 1000; // 12 hours

type StuckRow = { id: string };

// findStuck — detect paid+unclaimed transfers whose arrival is within 12h, dedup against open
// health_events, and raise an IN-APP-ONLY admin alert per NEW stuck transfer. Returns the stuck
// rows it acted on (the route ignores the value; the array is the test seam).
export async function findStuck(opts?: { now?: number }): Promise<StuckRow[]> {
  const now = opts?.now ?? Date.now();
  const horizon = now + ARRIVAL_HORIZON_MS;
  const admin = createAdminClient();

  // Candidate set: paid + unclaimed (the query-layer predicate). Explicit projection — CR-01:
  // read the base table directly with named columns, NEVER wp_pool() (no caller JWT here).
  const { data: candidates } = await admin
    .from("wp_transfers")
    .select("id, arrival_at, status, driver_id")
    .eq("status", "paid")
    .is("driver_id", null);

  const stuck: StuckRow[] = [];

  for (const row of (candidates ?? []) as Array<{
    id: string;
    arrival_at: string | null;
    status: string;
    driver_id: string | null;
  }>) {
    // 12h arrival bound (D-04): a NULL arrival or an arrival beyond the horizon is not yet stuck.
    if (!row.arrival_at) continue;
    if (new Date(row.arrival_at).getTime() > horizon) continue;

    // DEDUP (Pitfall 2): an OPEN health_events row for this transfer suppresses re-alert.
    const { data: open } = await admin
      .from("health_events")
      .select("id,kind,entity_id")
      .eq("entity_id", row.id)
      .is("resolved_at", null);
    const alreadyOpen = ((open ?? []) as Array<{ kind: string; entity_id: string }>).some(
      (e) => e.kind === KIND && e.entity_id === row.id,
    );
    if (alreadyOpen) continue;

    stuck.push({ id: row.id });

    // ALERT (D-05, IN-APP ONLY). The detail carries the non-PII arrival fact only — never guest
    // contact PII. Each step is independently log-and-continue.
    try {
      await admin.from("health_events").insert({
        kind: KIND,
        entity_type: "transfer",
        entity_id: row.id,
        detail: { arrival_at: row.arrival_at },
      });
    } catch (err) {
      console.error("[HLTH-04] health_events insert failed (continuing)", err);
    }

    // Resolve admin recipients (forward-compatible app_users query, mirrors the webhook).
    let admins: { id: string }[] = [];
    try {
      const { data } = await admin.from("app_users").select("id").eq("role", "admin");
      admins = (data ?? []) as { id: string }[];
    } catch (err) {
      console.error("[HLTH-04] admin recipient resolution failed (continuing)", err);
    }

    const title = "Stuck transfer — paid but unclaimed near arrival";
    for (const a of admins) {
      try {
        await insertNotification({
          recipientId: a.id,
          type: KIND,
          entityType: "transfer",
          entityId: row.id,
          title,
        });
      } catch (err) {
        console.error("[HLTH-04] admin notification failed (continuing)", err);
      }
    }
  }

  return stuck;
}
