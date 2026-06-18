// app/admin/companies/lifecycle.test.ts — company deactivation lifecycle (D-12).
//
// Proves the D-12 gate lives in the SERVER ACTION, not the UI (threat T-02-TMP1):
//   • deactivateCompany with ACTIVE children → { status:"error", message:
//     deactivateCompanyBlocked }, and NO companies.update is attempted.
//   • deactivateCompany with ZERO active children → companies.update sets
//     active:false and returns { status:"success" }.
//   • a non-admin caller is rejected before any DB access (re-gate, T-02-EOP1).
//
// Mocks createAdminClient + getCurrentRole the way platform/auth/role.test.ts mocks
// the server client: the from-chain is rewired per test to return a controlled
// { count } for the properties pre-check and { error } for the companies update.
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- properties count pre-check chain: from("properties").select(...).eq().eq() ---
const propertiesEqActive = vi.fn(); // resolves to { count, error }
const propertiesEqCompany = vi.fn(() => ({ eq: propertiesEqActive }));
const propertiesSelect = vi.fn(() => ({ eq: propertiesEqCompany }));

// --- companies update chain: from("companies").update(...).eq() ---
const companiesUpdateEq = vi.fn(); // resolves to { error }
const companiesUpdate = vi.fn(() => ({ eq: companiesUpdateEq }));

const from = vi.fn((table: string) => {
  if (table === "properties") return { select: propertiesSelect };
  if (table === "companies") return { update: companiesUpdate };
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
    deactivateCompanyBlocked: "DEACTIVATE_BLOCKED",
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deactivateCompany } from "./actions";

function formWith(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("deactivateCompany (D-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentRole.mockResolvedValue("admin");
    propertiesSelect.mockReturnValue({ eq: propertiesEqCompany });
    propertiesEqCompany.mockReturnValue({ eq: propertiesEqActive });
    companiesUpdate.mockReturnValue({ eq: companiesUpdateEq });
  });

  it("blocks deactivation when the company has active properties (D-12)", async () => {
    propertiesEqActive.mockResolvedValue({ count: 2, error: null });

    const result = await deactivateCompany(
      { status: "idle" },
      formWith({ id: "co-1" }),
    );

    expect(result).toEqual({ status: "error", message: "DEACTIVATE_BLOCKED" });
    // The block is enforced BEFORE any companies write.
    expect(companiesUpdate).not.toHaveBeenCalled();
  });

  it("deactivates (active=false) when the company has zero active children", async () => {
    propertiesEqActive.mockResolvedValue({ count: 0, error: null });
    companiesUpdateEq.mockResolvedValue({ error: null });

    const result = await deactivateCompany(
      { status: "idle" },
      formWith({ id: "co-2" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(companiesUpdate).toHaveBeenCalledWith({ active: false });
    expect(companiesUpdateEq).toHaveBeenCalledWith("id", "co-2");
  });

  it("rejects a non-admin caller before touching the database (re-gate)", async () => {
    getCurrentRole.mockResolvedValue("driver");

    const result = await deactivateCompany(
      { status: "idle" },
      formWith({ id: "co-3" }),
    );

    expect(result).toEqual({ status: "error", message: "SAVE_FAILED" });
    expect(from).not.toHaveBeenCalled();
  });
});
