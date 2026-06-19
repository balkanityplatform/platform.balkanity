"use server";
// app/notifications/actions.ts — the bell's client-callable server-action seam (NOTF-01).
//
// `"use server"` makes these callable from the NotificationBell client island. They are thin
// wrappers over the server-only platform/notifications modules — NO logic added on top:
//
//   - refetchNotifications: the live-poll read. It reuses the SAME caller-auth own-rows-only
//     read as the RSC seed (platform/notifications/feed.ts via notify.refetchNotifications), so
//     the poll can NEVER widen the surface beyond what the page already showed (threat T-07-BELL1).
//   - markRead / markAllRead: the Plan-02 GATED service-role read-state actions (caller identity
//     via auth.getUser() then UPDATE scoped to recipient_id = auth.uid()). A forged call for
//     another user's row matches 0 rows (threat T-07-BELL3). There is NO client write RLS policy
//     — the no-write-policy lock HOLDS; this action file is the only write surface for read-state.
//
// MONEY LOCK: ZERO wp_transfers writes here (read-state only).
import {
  refetchNotifications as readNotifications,
  markRead as markReadGated,
  markAllRead as markAllReadGated,
} from "@/platform/notifications/notify";
import type { NotificationRow } from "@/platform/notifications/feed";

// Live-poll read for the bell — own-rows-only (RLS-scoped), newest-first.
export async function refetchNotifications(): Promise<NotificationRow[]> {
  return readNotifications();
}

// Mark ONE notification read — gated service-role UPDATE scoped to the caller.
export async function markRead(notificationId: string): Promise<void> {
  return markReadGated(notificationId);
}

// Mark ALL of the caller's unread notifications read — gated service-role UPDATE.
export async function markAllRead(): Promise<void> {
  return markAllReadGated();
}
