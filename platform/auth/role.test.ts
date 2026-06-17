// platform/auth/role.test.ts — server-side role resolution behaviors (SC-3 / AUTH-01).
//
// Mocks platform/supabase/server.ts so auth.getUser() and the
// from(...).select(...).eq(...).single() chain return controlled values.
// Asserts: admin resolves to "admin"; no user resolves to null; exactly one
// value is returned (never an array, never a guessed default).
import { beforeEach, describe, expect, it, vi } from "vitest";

// The mocked server anon client. Each test rewires getUser / the from-chain.
const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

import { getCurrentRole } from "@/platform/auth/role";

describe("getCurrentRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eq.mockReturnValue({ single });
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });
  });

  it('returns "admin" when getUser() returns a user whose app_users row is admin', async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    single.mockResolvedValue({ data: { role: "admin" }, error: null });

    const role = await getCurrentRole();

    expect(role).toBe("admin");
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("app_users");
    expect(eq).toHaveBeenCalledWith("id", "u-1");
  });

  it("returns null when getUser() returns no user (unauthenticated)", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const role = await getCurrentRole();

    expect(role).toBeNull();
    // Must NOT query app_users when there is no authenticated user.
    expect(from).not.toHaveBeenCalled();
  });

  it("returns exactly one scalar role value, never an array", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    single.mockResolvedValue({ data: { role: "driver" }, error: null });

    const role = await getCurrentRole();

    expect(Array.isArray(role)).toBe(false);
    expect(role).toBe("driver");
  });

  it("returns null when the app_users row is missing (no guessed default)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-3" } } });
    single.mockResolvedValue({ data: null, error: { message: "no rows" } });

    const role = await getCurrentRole();

    expect(role).toBeNull();
  });
});
