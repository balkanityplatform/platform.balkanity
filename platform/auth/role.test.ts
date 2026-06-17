// platform/auth/role.test.ts — server-side role resolution behaviors (SC-3 / AUTH-01).
//
// Mocks platform/supabase/server.ts so auth.getUser() and the
// from(...).select(...).eq(...).maybeSingle() chain return controlled values.
// Asserts: admin resolves to "admin"; no user resolves to null; exactly one
// value is returned (never an array, never a guessed default); a real query
// error resolves to null (logged, not silently swallowed) while a legitimate
// missing row also resolves to null (WR-05).
import { beforeEach, describe, expect, it, vi } from "vitest";

// The mocked server anon client. Each test rewires getUser / the from-chain.
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
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
    eq.mockReturnValue({ maybeSingle });
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });
  });

  it('returns "admin" when getUser() returns a user whose app_users row is admin', async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });

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
    maybeSingle.mockResolvedValue({ data: { role: "driver" }, error: null });

    const role = await getCurrentRole();

    expect(Array.isArray(role)).toBe(false);
    expect(role).toBe("driver");
  });

  it("returns null when the app_users row is missing (no guessed default)", async () => {
    // maybeSingle() returns data:null WITHOUT an error for zero rows — the
    // legitimate "no row" case (WR-05).
    getUser.mockResolvedValue({ data: { user: { id: "u-3" } } });
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const role = await getCurrentRole();

    expect(role).toBeNull();
  });

  it("returns null and logs when the role lookup hits a real query error (no phantom logout swallowing)", async () => {
    // A genuine DB/transport error must be surfaced (logged), not silently
    // treated as a legitimate "no row" (WR-05).
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: { id: "u-4" } } });
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "57P01", message: "db terminating connection" },
    });

    const role = await getCurrentRole();

    expect(role).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "role lookup failed",
      expect.objectContaining({ message: "db terminating connection" }),
    );

    consoleError.mockRestore();
  });
});
