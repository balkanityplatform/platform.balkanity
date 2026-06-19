import "server-only";
// platform/notifications/notify.ts — in-app notification writes (NOTF-01).
//
// `import "server-only"` (line 1): the service-role key never reaches the browser
// (PLAT-05, threat T-07-SE1).
//
// insertNotification is a SERVICE-ROLE insert into the polymorphic `notifications`
// table — there is NO client write RLS policy (the no-write-policy lock from 0002–0006
// HOLDS, Open Q1). The table is polymorphic: entity_type/entity_id reference the
// subject (e.g. 'transfer' + transferId) — there is deliberately NO transfer_id column
// (SC#1, PLAT-01 platform-generic seam).
//
// markRead / markAllRead are GATED SERVICE-ROLE actions (NOT a client write policy):
// the caller identity is read on the caller-auth client (auth.getUser() — revalidates
// the JWT), then the service-role UPDATE is SCOPED to recipient_id = auth.uid() so a
// forged call for another user's row matches 0 rows (threat T-07-SE4). They mirror the
// app/driver/actions.ts two-part caller-identity → service-role gate. Kept as plain
// server-only functions; Plan 03 wraps them in a "use server" action file at the bell
// call-site (the simpler wiring — keeps this module free of the "use server" directive
// so send-email.ts can import insertNotification without pulling an action boundary).
//
// MONEY LOCK (threat T-07-SE5): ZERO `wp_transfers` writes here.
import { createAdminClient } from "@/platform/supabase/admin";
import { createClient } from "@/platform/supabase/server";
import { readOwnNotifications, type NotificationRow } from "./feed";

// Re-exported here so the bell's read seam lives next to its write seam (markRead/markAllRead),
// and so the own-rows-only contract is pinned by notifications-rls.test.ts on THIS module.
// It is a thin delegate to feed.ts's single caller-auth read — the poll cannot widen the
// surface because it reuses the exact RSC read (threat T-07-BELL1).
export async function refetchNotifications(): Promise<NotificationRow[]> {
  return readOwnNotifications();
}

// Service-role insert of a polymorphic notification row. Wrapped so a failed insert is
// non-fatal to the caller's lifecycle write (callers also log-and-continue, but this is
// defensive — a notification miss must never roll back a transfer transition).
export async function insertNotification(opts: {
  recipientId: string;
  type: string;
  title: string;
  entityType?: string;
  entityId?: string;
  body?: string;
}): Promise<void> {
  const { recipientId, type, title, entityType, entityId, body } = opts;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      recipient_id: recipientId,
      type,
      entity_type: entityType ?? null, // polymorphic — NEVER a transfer_id column (SC#1)
      entity_id: entityId ?? null,
      title,
      body: body ?? null,
    });
  } catch (err) {
    console.error("insertNotification failed (non-fatal)", err);
  }
}

// Mark ONE notification read — gated service-role UPDATE scoped to the caller.
export async function markRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // no identity → nothing to scope; write nothing.

  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id); // recipient scope is the gate — a forged id matches 0 rows.
}

// Mark ALL of the caller's unread notifications read — gated service-role UPDATE.
export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id) // recipient scope is the gate.
    .is("read_at", null);
}
