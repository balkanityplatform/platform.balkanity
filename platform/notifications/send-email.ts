import "server-only";
// platform/notifications/send-email.ts — THE single Resend call-site (NOTF-06).
//
// `import "server-only"` (line 1) makes `next build` FAIL if any client component
// imports this module — the build-time guarantee that RESEND_API_KEY / the
// service-role key can never reach the browser (PLAT-05, threat T-07-SE1). The key
// is read from the NON-public `RESEND_API_KEY` (never a `NEXT_PUBLIC_` name).
//
// SINGLE CALL-SITE INVARIANT (threat T-07-SE2, single-sender.test.ts grep gate):
// this is the ONLY production file that constructs `new Resend(...)` or calls
// `resend.emails.send`. Every send routes through here so the cap/idempotency/rate
// guard cannot be bypassed.
//
// THREE-LAYER DEDUP (Pitfall 4, threat T-07-SE3):
//   1. email_log idempotency_key check-before-send (a prior terminal 'sent' → duplicate, no re-send).
//   2. UNIQUE index on email_log.idempotency_key (migration 0007) — the race-safe authority.
//   3. Resend native `idempotencyKey` (the SECOND arg to emails.send) — a 24h provider dedup window.
//
// SOFT CAP (D-10/D-12): best_effort sends are soft-blocked at >= EMAIL_SOFT_CAP daily
// 'sent' rows and recorded as `skipped_cap` (NOT retried — the in-app feed carries the
// info). `critical` always proceeds (the guest confirmation / driver invite must land).
//
// MONEY LOCK (threat T-07-SE5): this module performs ZERO `wp_transfers` writes — it
// never sets `status: 'paid'` (single-writer.test.ts stays green).
import { Resend } from "resend";
import { createAdminClient } from "@/platform/supabase/admin";
import { insertNotification } from "@/platform/notifications/notify";

// D-13 verified sender on the verified send.balkanity.com subdomain.
const SENDER = "noreply@send.balkanity.com";

// D-10 soft cap (default 90, ~10 head-room below the Resend 100/day hard cap). Read from
// the NON-public env name; parse defensively so a garbage value falls back to the default.
function softCap(): number {
  const raw = Number(process.env.EMAIL_SOFT_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
}

export type EmailTier = "critical" | "best_effort";
export type SendOutcome = "sent" | "skipped_cap" | "duplicate" | "failed";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  tier: EmailTier;
  idempotencyKey: string;
}): Promise<{ outcome: SendOutcome }> {
  const { to, subject, html, tier, idempotencyKey } = opts;
  const admin = createAdminClient();

  // ── 1. IDEMPOTENCY (Pitfall 4 layer 1): a prior terminal 'sent' for this key →
  //       duplicate, never re-send (webhook-retry safety, D-12).
  const { data: existing } = await admin
    .from("email_log")
    .select("id,outcome")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing && (existing as { outcome?: string }).outcome === "sent") {
    return { outcome: "duplicate" };
  }

  // ── 2. DAILY COUNT: today's (UTC) 'sent' rows — backs the soft cap + the near-cap alarm.
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayUtc.toISOString())
    .eq("outcome", "sent");
  const dailyCount = count ?? 0;
  const cap = softCap();

  // ── 3. SOFT CAP (D-10): best_effort at/over the cap is logged skipped_cap and NOT sent
  //       (NOT retried, D-12). critical always proceeds.
  if (tier === "best_effort" && dailyCount >= cap) {
    await admin.from("email_log").insert({
      idempotency_key: idempotencyKey,
      recipient: to,
      tier,
      outcome: "skipped_cap",
    });
    return { outcome: "skipped_cap" };
  }

  // ── 4. SEND: the ONLY resend.emails.send call-site. idempotencyKey is the SECOND arg
  //       (Resend's native 24h dedup — Pitfall 4 layer 3). Wrap so a provider failure is
  //       recorded as 'failed' and surfaced to the caller (never throws past here).
  const resend = new Resend(process.env.RESEND_API_KEY!);
  let outcome: SendOutcome;
  try {
    const { error } = await resend.emails.send(
      { from: SENDER, to, subject, html },
      { idempotencyKey },
    );
    outcome = error ? "failed" : "sent";
  } catch {
    outcome = "failed";
  }

  // ── 5. RECORD the outcome (sent | failed). The UNIQUE idempotency_key is the race-safe
  //       authority; a concurrent duplicate insert losing the race is non-fatal here.
  await admin.from("email_log").insert({
    idempotency_key: idempotencyKey,
    recipient: to,
    tier,
    outcome,
  });

  // ── 6. CAP-NEAR ALARM (D-11): once the daily count crosses the near-threshold and no
  //       email_cap_near alarm has been logged today, raise an admin in-app notification
  //       (free against the cap — NO email). Its own try/catch so it never affects the send.
  if (outcome === "sent" && dailyCount + 1 >= cap - 10) {
    try {
      await raiseCapNearAlarm(admin, todayUtc.toISOString());
    } catch {
      // alarm best-effort only — never affects the send outcome.
    }
  }

  return { outcome };
}

// Raise ONE admin email_cap_near alarm per UTC day (in-app only — free against the cap).
// Forward-compatible admin resolution: query app_users where role='admin' (Open Q2).
async function raiseCapNearAlarm(
  admin: ReturnType<typeof createAdminClient>,
  todayUtcIso: string,
): Promise<void> {
  // De-dupe: skip if an email_cap_near alarm already exists today.
  const { count: alreadyAlarmed } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "email_cap_near")
    .gte("created_at", todayUtcIso);
  if ((alreadyAlarmed ?? 0) > 0) return;

  const { data: admins } = await admin
    .from("app_users")
    .select("id")
    .eq("role", "admin");
  for (const a of (admins ?? []) as { id: string }[]) {
    await insertNotification({
      recipientId: a.id,
      type: "email_cap_near",
      title: "Email cap nearing — best-effort emails paused",
    });
  }
}
