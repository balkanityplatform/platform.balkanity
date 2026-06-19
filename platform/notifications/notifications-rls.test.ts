// platform/notifications/notifications-rls.test.ts — own-rows-only bell read (NOTF-01).
//
// NYQUIST BASELINE — RED until Plan 03 lands the notifications refetch action
// (platform/notifications/notify.ts → refetchNotifications, or its action seam). The
// dynamic runtime-string import type-checks before the impl exists, then THROWS → RED now.
//
// What this pins (GREEN in Plan 03): a caller-auth read of `notifications` returns ONLY
// rows where recipient_id = auth.uid() (own-rows-only). We mock the caller-auth client so
// the read is scoped by the caller's uid the way the RLS policy notifications_own_read
// scopes it live — the action must NEVER hand back another recipient's notifications.
import { beforeEach, describe, expect, it, vi } from "vitest";

const CALLER_UID = "11111111-1111-1111-1111-111111111111";
const OTHER_UID = "22222222-2222-2222-2222-222222222222";

// The full table the DB holds; the mocked client returns only the caller's rows (RLS).
const ALL_ROWS = [
  { id: "n1", recipient_id: CALLER_UID, type: "new_paid_pool", read_at: null },
  { id: "n2", recipient_id: OTHER_UID, type: "new_paid_pool", read_at: null },
  { id: "n3", recipient_id: CALLER_UID, type: "run_assigned", read_at: null },
];

// caller-auth client: getUser returns the caller; the notifications select is RLS-scoped.
const eqSpy = vi.fn();
vi.mock("@/platform/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: CALLER_UID } } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => ({
          // RLS scopes the result to the caller's own rows.
          data: ALL_ROWS.filter((r) => r.recipient_id === CALLER_UID),
          error: null,
        })),
      })),
    })),
  })),
}));

type RefetchNotifications = () => Promise<
  Array<{ id: string; recipient_id: string; type: string; read_at: string | null }>
>;

async function loadRefetch(): Promise<RefetchNotifications> {
  const specifier = "@/platform/notifications/notify";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    refetchNotifications: RefetchNotifications;
  };
  return mod.refetchNotifications;
}

describe("notifications own-rows-only read (NOTF-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqSpy.mockReset();
  });

  it("returns ONLY the caller's own notifications (recipient_id = auth.uid())", async () => {
    const refetchNotifications = await loadRefetch();
    const rows = await refetchNotifications();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.recipient_id === CALLER_UID)).toBe(true);
    expect(rows.some((r) => r.recipient_id === OTHER_UID)).toBe(false);
  });
});
