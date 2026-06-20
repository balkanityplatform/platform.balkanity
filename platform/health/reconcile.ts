import "server-only";
// platform/health/reconcile.ts — payment reconciliation detection + alert fan-out (HLTH-02).
//
// `import "server-only"` (line 1, PLAT-05): this module reads the server-only Stripe key
// (getStripe) and the service-role client (createAdminClient) — it must NEVER be importable
// from a client component (the build-time guarantee those credentials stay server-side).
//
// D-03 RESOLVED — the STRIPE API is the source of truth (NOT a DB-only anti-join, which is
// blind to a never-delivered webhook). reconcile() lists recent PAID Checkout Sessions
// (server-only Stripe key), reads each session's metadata.transfer_id (the link key the
// webhook set at app/api/stripe/webhook/route.ts:117), and left-anti-joins them against the
// paid `wp_transfers` set: a paid session whose transfer is missing-or-not-paid is a
// discrepancy — exactly the never-delivered webhook the DoD reconciliation test must catch.
//
// Two safety rails:
//   - LOOKBACK (Pitfall 1): a session inside the ~10-min in-flight window is NOT flagged (the
//     webhook may simply not have landed yet — no false positive).
//   - DEDUP (Pitfall 2): an already-OPEN health_events row for (kind, entity_id) suppresses a
//     second alert — exactly one alert per discrepancy. The 0008 partial open-index backs this.
//
// CRITICAL (D-01, single-writer money lock): this file performs ZERO `wp_transfers` writes of
// `status: 'paid'` — it DETECTS and ALERTS only. Remediation is human-driven webhook replay
// (idempotent via webhook_events.event_id). The source contains NO `status:'paid'` write.
//
// PII GATE (threat T-08-08): the alert body carries transfer id / session id / amount ONLY —
// reconcile.ts reads NO guest contact columns (guest_email/guest_phone/guest_name/address).
//
// WEBHOOK_EVENTS SECONDARY CROSS-CHECK — DELIBERATELY DEFERRED for the pilot. The Stripe-API
// anti-join below is the SOLE detection source this plan; the webhook_events effect-failure
// cross-check is a future hardening item (the Stripe-API path already catches a never-delivered
// webhook, which the DB-only webhook_events path is blind to).
import { createAdminClient } from "@/platform/supabase/admin";
import { getStripe } from "@/platform/payments/stripe";
import { insertNotification } from "@/platform/notifications/notify";
import { sendEmail } from "@/platform/notifications/send-email";

const KIND = "reconciliation_discrepancy";

// In-flight lookback: a session younger than this is mid-processing, not a discrepancy.
const LOOKBACK_MS = 10 * 60 * 1000; // ~10 minutes (Pitfall 1)

// Window of recent PAID sessions to scan — kept small for the pilot (page stays tiny).
const SCAN_WINDOW_MS = 24 * 60 * 60 * 1000; // last 24h

type Discrepancy = { entityId: string; kind: string };

// reconcile — detect paid Stripe sessions whose transfer is not paid in the ledger, dedup
// against open health_events, and fan out an in-app + critical email alert per NEW discrepancy.
// Returns the discrepancies it acted on (the route ignores the value; the array is the test seam).
export async function reconcile(opts?: { now?: number }): Promise<Discrepancy[]> {
  const now = opts?.now ?? Date.now();
  const admin = createAdminClient();

  // 1) PAID Checkout Sessions in the recent window (server-only Stripe key, D-03 source of truth).
  const { data: sessions } = await getStripe().checkout.sessions.list({
    created: { gte: Math.floor((now - SCAN_WINDOW_MS) / 1000) },
    limit: 100,
  });

  // 2) The paid transfer set (service-role read, explicit projection — CR-01: NEVER wp_pool()).
  const { data: paidRows } = await admin
    .from("wp_transfers")
    .select("id,status")
    .eq("status", "paid");
  const paidIds = new Set(
    ((paidRows ?? []) as Array<{ id: string; status: string }>).map((r) => r.id),
  );

  const discrepancies: Discrepancy[] = [];

  for (const session of (sessions ?? []) as Array<{
    id: string;
    payment_status?: string | null;
    status?: string | null;
    created: number;
    metadata?: { transfer_id?: string | null } | null;
  }>) {
    // Only consider genuinely-paid sessions.
    const isPaid =
      session.payment_status === "paid" || session.status === "complete";
    if (!isPaid) continue;

    // LOOKBACK (Pitfall 1): skip an in-flight session — the webhook may not have landed yet.
    const createdMs = session.created * 1000;
    if (now - createdMs < LOOKBACK_MS) continue;

    const transferId = session.metadata?.transfer_id ?? null;
    if (!transferId) continue; // no link key → nothing to reconcile against here.

    // ANTI-JOIN: a session whose transfer is NOT in the paid set is a discrepancy.
    if (paidIds.has(transferId)) continue;

    // DEDUP (Pitfall 2): an OPEN health_events row for (kind, entity_id=transferId) suppresses
    // re-alert. The event is keyed by the transfer id (the discrepancy subject) — one open alert
    // per discrepant transfer. Filter on entity_id at the query layer + kind in JS (the open
    // partial index backs this); a single .eq before .is keeps the chain to one equality predicate.
    const { data: open } = await admin
      .from("health_events")
      .select("id,kind,entity_id")
      .eq("entity_id", transferId)
      .is("resolved_at", null);
    const alreadyOpen = ((open ?? []) as Array<{ kind: string; entity_id: string }>).some(
      (e) => e.kind === KIND && e.entity_id === transferId,
    );
    if (alreadyOpen) continue;

    discrepancies.push({ entityId: transferId, kind: KIND });

    // ALERT (D-09). Each step is independently log-and-continue (one failure never aborts the
    // sweep). The detail carries NON-PII facts only (transfer id, session id) — never guest PII.
    try {
      await admin.from("health_events").insert({
        kind: KIND,
        entity_type: "transfer",
        entity_id: transferId,
        detail: { transfer_id: transferId, session_id: session.id },
      });
    } catch (err) {
      console.error("[HLTH-02] health_events insert failed (continuing)", err);
    }

    // Resolve admin recipients (forward-compatible app_users query, mirrors the webhook).
    let admins: { id: string; email: string | null }[] = [];
    try {
      const { data } = await admin
        .from("app_users")
        .select("id,email")
        .eq("role", "admin");
      admins = (data ?? []) as { id: string; email: string | null }[];
    } catch (err) {
      console.error("[HLTH-02] admin recipient resolution failed (continuing)", err);
    }

    const title = "Payment reconciliation discrepancy — needs review";
    const factLine = `Transfer ${transferId} • Stripe session ${session.id}`;

    for (const a of admins) {
      // In-app notification (free against the email cap).
      try {
        await insertNotification({
          recipientId: a.id,
          type: KIND,
          entityType: "transfer",
          entityId: transferId,
          title,
          body: factLine,
        });
      } catch (err) {
        console.error("[HLTH-02] admin notification failed (continuing)", err);
      }

      // Critical-tier email (D-09) — discrepancy FACT only, no guest contact PII.
      if (!a.email) continue;
      try {
        await sendEmail({
          to: a.email,
          subject: title,
          html: `<p>A paid Stripe Checkout session has no matching paid transfer.</p><p>${factLine}</p><p>Investigate and replay the webhook if appropriate.</p>`,
          tier: "critical",
          idempotencyKey: `recon:${session.id}`,
        });
      } catch (err) {
        console.error("[HLTH-02] discrepancy email failed (continuing)", err);
      }
    }
  }

  return discrepancies;
}
