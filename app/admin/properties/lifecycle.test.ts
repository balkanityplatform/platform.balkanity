// app/admin/properties/lifecycle.test.ts — property deactivation lifecycle (D-12).
//
// Proves the D-12 gate lives in the SERVER ACTION, not the UI (threat T-02-TMP4):
//   • deactivateProperty with ACTIVE destinations → { status:"error", message:
//     deactivatePropertyBlocked }, and NO properties.update is attempted.
//   • deactivateProperty with ZERO active destinations → properties.update sets
//     active:false and returns { status:"success" }.
//   • a non-admin caller is rejected before any DB access (re-gate, T-02-EOP3).
//
// Mocks createAdminClient + getCurrentRole the way app/admin/companies/lifecycle.test.ts
// does: the from-chain is rewired per test to return a controlled { count } for the
// destinations pre-check and { error } for the properties update.
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- destinations count pre-check chain: from("destinations").select(...).eq().eq() ---
const destinationsEqActive = vi.fn(); // resolves to { count, error }
const destinationsEqProperty = vi.fn(() => ({ eq: destinationsEqActive }));
const destinationsSelect = vi.fn(() => ({ eq: destinationsEqProperty }));

// --- properties update chain: from("properties").update(...).eq() ---
const propertiesUpdateEq = vi.fn(); // resolves to { error }
const propertiesUpdate = vi.fn(() => ({ eq: propertiesUpdateEq }));

const from = vi.fn((table: string) => {
  if (table === "destinations") return { select: destinationsSelect };
  if (table === "properties") return { update: propertiesUpdate };
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from })),
}));

const getCurrentRole = vi.fn();
vi.mock("@/platform/auth/role", () => ({
  getCurrentRole: (...args: unknown[]) => getCurrentRole(...args),
}));

// Real-ish dictionary: only the keys the action touches need to be stable strings.
vi.mock("@/platform/i18n/dictionary", () => ({
  getDict: vi.fn(async () => ({
    saveFailed: "SAVE_FAILED",
    fieldRequired: "FIELD_REQUIRED",
    deactivatePropertyBlocked: "DEACTIVATE_BLOCKED",
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deactivateProperty } from "./actions";

function formWith(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("deactivateProperty (D-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentRole.mockResolvedValue("admin");
    destinationsSelect.mockReturnValue({ eq: destinationsEqProperty });
    destinationsEqProperty.mockReturnValue({ eq: destinationsEqActive });
    propertiesUpdate.mockReturnValue({ eq: propertiesUpdateEq });
  });

  it("blocks deactivation when the property has active destinations (D-12)", async () => {
    destinationsEqActive.mockResolvedValue({ count: 2, error: null });

    const result = await deactivateProperty(
      { status: "idle" },
      formWith({ id: "pr-1" }),
    );

    expect(result).toEqual({ status: "error", message: "DEACTIVATE_BLOCKED" });
    // The block is enforced BEFORE any properties write.
    expect(propertiesUpdate).not.toHaveBeenCalled();
  });

  it("deactivates (active=false) when the property has zero active children", async () => {
    destinationsEqActive.mockResolvedValue({ count: 0, error: null });
    propertiesUpdateEq.mockResolvedValue({ error: null });

    const result = await deactivateProperty(
      { status: "idle" },
      formWith({ id: "pr-2" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(propertiesUpdate).toHaveBeenCalledWith({ active: false });
    expect(propertiesUpdateEq).toHaveBeenCalledWith("id", "pr-2");
  });

  it("rejects a non-admin caller before touching the database (re-gate)", async () => {
    getCurrentRole.mockResolvedValue("driver");

    const result = await deactivateProperty(
      { status: "idle" },
      formWith({ id: "pr-3" }),
    );

    expect(result).toEqual({ status: "error", message: "SAVE_FAILED" });
    expect(from).not.toHaveBeenCalled();
  });
});
