"use server";
// app/admin/companies/actions.ts — Companies CRUD mutations (ONBD-01).
//
// Every mutation crosses an untrusted FormData → server boundary, so each one:
//   1. RE-GATES the caller with getCurrentRole() !== "admin" (threat T-02-EOP1) —
//      the service-role client below BYPASSES RLS, so this in-action role check is
//      the only authorization gate on writes. A direct (non-UI) call by a
//      non-admin is rejected here, not just hidden in the UI.
//   2. Validates input with a zod schema at the trust boundary (threat T-02-V5) —
//      generic, dictionary-keyed errors only; no provider-detail leak.
//   3. Writes via createAdminClient() (service-role) because the supply tables have
//      NO anon/authenticated write policy (migration 0002).
//
// deactivateCompany enforces D-12 (threat T-02-TMP1): a company with active
// properties cannot be deactivated — checked in the action (not UI-only), with the
// FK `on delete restrict` as the DB integrity backstop. deleteCompany (hard delete)
// only proceeds for a childless company; the FK restrict is the backstop there too.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";

export type CompanyActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

// Name is the only company field (companies = id/name/active/created_at). Trim and
// require non-empty — an all-whitespace name is rejected as "required".
const companyNameSchema = z.object({
  name: z.string().trim().min(1),
});

export async function createCompany(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = companyNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    // copy id: fieldRequired (generic — never echo the raw zod issue)
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .insert({ name: parsed.data.name });

  if (error) {
    // copy id: saveFailed (generic — do not leak provider error detail)
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/companies");
  return { status: "success" };
}

export async function updateCompany(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = companyNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/companies");
  return { status: "success" };
}

export async function deactivateCompany(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // D-12: a company with ACTIVE properties cannot be deactivated. Enforce in the
  // action (not UI-only) so a direct action call is also blocked (threat T-02-TMP1).
  const { count, error: countError } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id)
    .eq("active", true);

  if (countError) {
    return { status: "error", message: t.saveFailed };
  }

  if ((count ?? 0) > 0) {
    // copy id: deactivateCompanyBlocked (D-12 — deactivate properties first)
    return { status: "error", message: t.deactivateCompanyBlocked };
  }

  const { error } = await admin
    .from("companies")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/companies");
  return { status: "success" };
}

export async function deleteCompany(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // Hard delete only for a childless company. The FK `on delete restrict` on
  // properties.company_id is the DB integrity backstop; this app-layer check turns
  // the would-be FK error into a dictionary-keyed, generic response.
  const { count, error: countError } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id);

  if (countError) {
    return { status: "error", message: t.saveFailed };
  }

  if ((count ?? 0) > 0) {
    // Has properties → cannot hard-delete. Same dictionary copy as the
    // deactivate-blocked path (deactivate/remove children first).
    return { status: "error", message: t.deactivateCompanyBlocked };
  }

  const { error } = await admin.from("companies").delete().eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/companies");
  return { status: "success" };
}
