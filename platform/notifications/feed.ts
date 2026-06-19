import "server-only";
// platform/notifications/feed.ts — the bell's own-notifications read (NOTF-01).
//
// `import "server-only"` (line 1): this read runs only on the server (the caller-auth
// client binds the request cookies — it can never execute in the browser).
//
// readOwnNotifications is the SINGLE read shape behind both the RSC seed and the client
// poll (mirrors the wp_pool discipline from Phase 6): one read => the poll can NEVER widen
// the surface beyond what the RSC already showed.
//
// PII / widening lock (threat T-07-BELL1): the read uses the CALLER-AUTH client
// (createClient from platform/supabase/server) — NEVER the service-role admin client.
// RLS `notifications_own_read` (migration 0007) scopes the rows to recipient_id = auth.uid(),
// so we add NO manual recipient filter beyond what RLS enforces; the service-role client
// would bypass RLS and hand back every user's notifications.
import { createClient } from "@/platform/supabase/server";

// The bell-shaped notification row. Polymorphic (entity_type/entity_id) — there is NO
// transfer_id column (PLAT-01). `title` is pre-rendered by the Plan-04 fan-out, so the
// panel renders it directly; `read_at === null` means unread.
export type NotificationRow = {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

// Caller-auth, own-rows-only read ordered newest-first. RLS is the recipient gate.
export async function readOwnNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,entity_type,entity_id,title,body,read_at,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    // A transient read failure is non-fatal for the seed/poll — return an empty list so
    // the bell keeps the last-good state (the caller decides; the poll swallows + retries).
    return [];
  }

  return (data ?? []) as NotificationRow[];
}
