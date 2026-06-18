"use server";
// app/admin/properties/actions.ts — Properties CRUD mutations (ONBD-02).
//
// Mirrors app/admin/companies/actions.ts. Every mutation crosses an untrusted
// FormData → server boundary, so each one:
//   1. RE-GATES the caller with getCurrentRole() !== "admin" (threat T-02-EOP3) —
//      the service-role client below BYPASSES RLS, so this in-action role check is
//      the only authorization gate on writes.
//   2. Validates input with a zod schema at the trust boundary (threat T-02-TMP3 /
//      T-02-V5b) — company_id must be a uuid (a forged/non-existent parent is also
//      rejected by the `references companies(id)` FK), name non-empty. Generic,
//      dictionary-keyed errors only; no provider-detail leak.
//   3. Writes via createAdminClient() (service-role) because the supply tables have
//      NO anon/authenticated write policy (migration 0002).
//
// deactivateProperty enforces D-12 (threat T-02-TMP4): a property with active
// destinations cannot be deactivated — checked in the action (not UI-only), with the
// FK `on delete restrict` as the DB integrity backstop. deleteProperty (hard delete)
// only proceeds for a childless property; the FK restrict is the backstop there too.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";

export type PropertyActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

// A property is id/name/active/company_id/created_at. Create/update validate the
// company_id (uuid — the parent FK) and a non-empty trimmed name.
const propertySchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().trim().min(1),
});

// Edit only changes the name (the parent company is fixed once created).
const propertyNameSchema = z.object({
  name: z.string().trim().min(1),
});

export async function createProperty(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = propertySchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    // copy id: fieldRequired (generic — never echo the raw zod issue)
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("properties").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    active: true,
  });

  if (error) {
    // copy id: saveFailed (generic — do not leak provider error detail)
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/properties");
  return { status: "success" };
}

export async function updateProperty(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = propertyNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("properties")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/properties");
  return { status: "success" };
}

export async function deactivateProperty(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // D-12: a property with ACTIVE destinations cannot be deactivated. Enforce in the
  // action (not UI-only) so a direct action call is also blocked (threat T-02-TMP4).
  const { count, error: countError } = await admin
    .from("destinations")
    .select("id", { count: "exact", head: true })
    .eq("property_id", id)
    .eq("active", true);

  if (countError) {
    return { status: "error", message: t.saveFailed };
  }

  if ((count ?? 0) > 0) {
    // copy id: deactivatePropertyBlocked (D-12 — deactivate destinations first)
    return { status: "error", message: t.deactivatePropertyBlocked };
  }

  const { error } = await admin
    .from("properties")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/properties");
  return { status: "success" };
}

export async function deleteProperty(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // Hard delete only for a childless property. The FK `on delete restrict` on
  // destinations.property_id is the DB integrity backstop; this app-layer check turns
  // the would-be FK error into a dictionary-keyed, generic response.
  const { count, error: countError } = await admin
    .from("destinations")
    .select("id", { count: "exact", head: true })
    .eq("property_id", id);

  if (countError) {
    return { status: "error", message: t.saveFailed };
  }

  if ((count ?? 0) > 0) {
    // Has destinations → cannot hard-delete. Same dictionary copy as the
    // deactivate-blocked path (deactivate/remove children first).
    return { status: "error", message: t.deactivatePropertyBlocked };
  }

  const { error } = await admin.from("properties").delete().eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/properties");
  return { status: "success" };
}
