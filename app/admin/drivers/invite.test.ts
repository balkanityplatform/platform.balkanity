// app/admin/drivers/invite.test.ts — driver invite behaviors (ONBD-05 / AUTH-03 / NOTF-04).
//
// Proves the invite slice's load-bearing guarantees in the SERVER ACTION:
//   • a valid invite calls generateLink({type:'invite'}) (NEVER the email-sending
//     inviteUserByEmail — D-03), writes app_users with the literal role:'driver'
//     (mass-assignment defense, T-02-EOP5), stores name+phone in driver_profiles
//     (D-02), and returns { status:"ok", actionLink } so the form reveals it (D-04);
//   • a non-admin caller is rejected BEFORE any auth-user creation (re-gate,
//     T-02-EOP5) — generateLink is never called;
//   • a re-invite (generateLink reports the user already exists) returns the generic
//     driverAlreadyInvited copy (no enumeration branch, Pitfall 4 / T-02-ID5).
//
// Mocks createAdminClient + getCurrentRole the way companies/lifecycle.test.ts does:
// the from-chain and the auth.admin.generateLink stub are rewired per test.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- auth.admin.generateLink stub (the GoTrue admin API call) ---
const generateLink = vi.fn();
// inviteUserByEmail must NEVER be called (D-03) — present only to assert that.
const inviteUserByEmail = vi.fn();

// --- service-role writes: from("app_users").insert(...) / from("driver_profiles").insert(...) ---
const appUsersInsert = vi.fn(); // resolves to { error }
const driverProfilesInsert = vi.fn(); // resolves to { error }

const from = vi.fn((table: string) => {
  if (table === "app_users") return { insert: appUsersInsert };
  if (table === "driver_profiles") return { insert: driverProfilesInsert };
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { generateLink, inviteUserByEmail } },
    from,
  })),
}));

const getCurrentRole = vi.fn();
vi.mock("@/platform/auth/role", () => ({
  getCurrentRole: (...args: unknown[]) => getCurrentRole(...args),
}));

// Real-ish dictionary: only the keys the action touches need stable strings.
vi.mock("@/platform/i18n/dictionary", () => ({
  getDict: vi.fn(async () => ({
    saveFailed: "SAVE_FAILED",
    fieldRequired: "FIELD_REQUIRED",
    driverAlreadyInvited: "ALREADY_INVITED",
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { inviteDriver } from "./actions";

function formWith(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

describe("inviteDriver (ONBD-05 / AUTH-03 / NOTF-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentRole.mockResolvedValue("admin");
    // A trusted base must be present for the happy path (WR-04).
    process.env.NEXT_PUBLIC_SITE_URL = "https://balkanity.example";
    // Default happy stubs — generateLink creates the user + returns the link.
    generateLink.mockResolvedValue({
      data: {
        user: { id: "drv-1" },
        properties: { action_link: "https://balkanity.example/auth/confirm?token=abc&type=invite" },
      },
      error: null,
    });
    appUsersInsert.mockResolvedValue({ error: null });
    driverProfilesInsert.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    // Restore the env var so other suites aren't affected.
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
    }
  });

  it("creates the auth user via generateLink (no email), writes role=driver + profile, and returns the action_link", async () => {
    const result = await inviteDriver(
      { status: "idle" },
      formWith({ email: "Driver@Example.com", name: "Ivan", phone: "+359888123456" }),
    );

    // The set-password link is revealed to the admin (D-04).
    expect(result).toEqual({
      status: "ok",
      actionLink: "https://balkanity.example/auth/confirm?token=abc&type=invite",
    });

    // generateLink is the invite path — and it is type:'invite' with the trusted
    // base redirectTo (WR-04 / Pitfall 1).
    expect(generateLink).toHaveBeenCalledTimes(1);
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invite",
        email: "Driver@Example.com",
        options: expect.objectContaining({
          redirectTo: "https://balkanity.example/auth/confirm?type=invite",
          data: { name: "Ivan" },
        }),
      }),
    );

    // D-03: the email-SENDING API is NEVER used.
    expect(inviteUserByEmail).not.toHaveBeenCalled();

    // role is the literal 'driver', written server-side (mass-assignment defense).
    expect(appUsersInsert).toHaveBeenCalledWith({
      id: "drv-1",
      email: "Driver@Example.com",
      role: "driver",
    });

    // D-02: name + phone stored in driver_profiles, keyed to the new auth user.
    expect(driverProfilesInsert).toHaveBeenCalledWith({
      user_id: "drv-1",
      name: "Ivan",
      phone: "+359888123456",
    });
  });

  it("stores a null phone when none is provided (phone optional, D-02)", async () => {
    await inviteDriver(
      { status: "idle" },
      formWith({ email: "driver@example.com", name: "Maria" }),
    );

    expect(driverProfilesInsert).toHaveBeenCalledWith({
      user_id: "drv-1",
      name: "Maria",
      phone: null,
    });
  });

  it("rejects a non-admin caller before creating any auth user (re-gate, T-02-EOP5)", async () => {
    getCurrentRole.mockResolvedValue("driver");

    const result = await inviteDriver(
      { status: "idle" },
      formWith({ email: "driver@example.com", name: "Ivan" }),
    );

    expect(result).toEqual({ status: "error", message: "SAVE_FAILED" });
    // No account creation, no writes.
    expect(generateLink).not.toHaveBeenCalled();
    expect(appUsersInsert).not.toHaveBeenCalled();
  });

  it("returns the generic driverAlreadyInvited copy when generateLink reports an existing user (Pitfall 4 / T-02-ID5)", async () => {
    generateLink.mockResolvedValue({
      data: { user: null, properties: null },
      error: { message: "A user with this email address has already been registered" },
    });

    const result = await inviteDriver(
      { status: "idle" },
      formWith({ email: "dup@example.com", name: "Ivan" }),
    );

    expect(result).toEqual({ status: "error", message: "ALREADY_INVITED" });
    // No profile written when the account couldn't be (re)created.
    expect(appUsersInsert).not.toHaveBeenCalled();
    expect(driverProfilesInsert).not.toHaveBeenCalled();
  });

  it("returns the generic driverAlreadyInvited copy when the app_users insert hits the unique-email index (Pitfall 4)", async () => {
    appUsersInsert.mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const result = await inviteDriver(
      { status: "idle" },
      formWith({ email: "dup@example.com", name: "Ivan" }),
    );

    expect(result).toEqual({ status: "error", message: "ALREADY_INVITED" });
    expect(driverProfilesInsert).not.toHaveBeenCalled();
  });

  it("rejects a malformed email with the generic fieldRequired copy (no generateLink call)", async () => {
    const result = await inviteDriver(
      { status: "idle" },
      formWith({ email: "not-an-email", name: "Ivan" }),
    );

    expect(result).toEqual({ status: "error", message: "FIELD_REQUIRED" });
    expect(generateLink).not.toHaveBeenCalled();
  });
});
