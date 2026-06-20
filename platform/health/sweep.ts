import "server-only";
// platform/health/sweep.ts — the 15-min health sweep orchestrator (HLTH-02/04/05).
//
// `import "server-only"` (line 1, PLAT-05): pulls the reconcile/stuck/keepalive workers, all of
// which touch the service-role client / server-only Stripe key — never client-importable.
//
// runHealthSweep runs the three detection/keep-alive workers in sequence. Each worker is
// independently log-and-continue internally; here we ALSO wrap each call so one worker throwing
// never skips the others — the keep-alive especially must run even if reconcile/stuck fail (a
// missed heartbeat is what causes the 7-day pause). The route delegates to this single seam so
// the cron entry point stays a thin auth gate (route.test.ts mocks runHealthSweep).
//
// MONEY LOCK (D-01): this orchestrator performs ZERO `wp_transfers` writes — it only invokes the
// detect-and-alert workers.
import { reconcile } from "@/platform/health/reconcile";
import { findStuck } from "@/platform/health/stuck";
import { touchHeartbeat } from "@/platform/health/keepalive";

export async function runHealthSweep(): Promise<{ ok: true }> {
  try {
    await reconcile();
  } catch (err) {
    console.error("[HLTH] reconcile worker failed (continuing)", err);
  }
  try {
    await findStuck();
  } catch (err) {
    console.error("[HLTH] stuck worker failed (continuing)", err);
  }
  // Keep-alive last and isolated — it must run even if the detectors above threw.
  try {
    await touchHeartbeat();
  } catch (err) {
    console.error("[HLTH] keepalive worker failed (continuing)", err);
  }
  return { ok: true };
}
