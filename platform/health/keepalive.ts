import "server-only";
// platform/health/keepalive.ts — DB keep-alive heartbeat (HLTH-05).
//
// `import "server-only"` (line 1, PLAT-05): this module writes via the service-role client — it
// must NEVER be importable from a client component.
//
// SINGLE MANDATED STRATEGY — NO SCHEMA CHANGE: the heartbeat is a benign INSERT into the EXISTING
// `health_events` table (authored in Plan 01's 0008). Setting `resolved_at = now()` means the row
// is never "open", so it NEVER appears in the admin reconciliation/stuck lists (the partial
// open-index excludes it) and never triggers an alert — it exists purely as recurring DB write
// activity that defeats the 7-day Supabase inactivity pause (Pitfall 3) which would otherwise
// silently stop pg_cron and the reconciliation sweep with it.
//
// There is NO separate heartbeat table and this plan makes ZERO edits to any migration file —
// `health_events.kind` is free-form text with NO CHECK constraint (0008), so 'keepalive' is
// allowed by construction. The insert is wrapped non-fatal: a heartbeat miss NEVER fails the cron.
//
// MONEY LOCK (D-01): ZERO `wp_transfers` writes — writes ONLY to health_events.
import { createAdminClient } from "@/platform/supabase/admin";

// touchHeartbeat — a benign service-role write each cycle so the project stays warm (HLTH-05).
// Auto-resolved (resolved_at=now()) so it never appears as an open alert. Non-fatal by design.
export async function touchHeartbeat(): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("health_events").insert({
      kind: "keepalive",
      entity_type: "system",
      entity_id: "heartbeat",
      resolved_at: new Date().toISOString(),
    });
  } catch (err) {
    // A missed heartbeat must never fail the cron — log and continue.
    console.error("[HLTH-05] keepalive write failed (non-fatal)", err);
  }
}
