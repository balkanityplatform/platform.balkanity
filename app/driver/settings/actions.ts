"use server";
// app/driver/settings/actions.ts — driver digest-preference mutation (NOTF-05, D-07/D-08).
//
// ONE gated Server Action over driver_profiles' digest columns, following the
// admin/transfers/actions.ts skeleton but gated on the DRIVER role + self-scope:
//   1. RE-GATE the caller: getCurrentRole() !== "driver" → reject. The createAdminClient()
//      service-role write BYPASSES RLS, so this in-action check + the auth.uid() row-scope
//      are THE authorization gate (threat T-07-DG2). A non-driver / cross-driver call fails here.
//   2. Validate input with zod at the trust boundary (generic, dictionary-keyed errors only).
//   3. Write via createAdminClient() because driver_profiles has NO client write RLS policy
//      (the no-write-policy lock; migrations 0002/0007) — the digest preference is written
//      ONLY through this gated action.
//
// SELF-SCOPE (threat T-07-DG2): the UPDATE is scoped to user_id = the caller's verified
// auth.uid() (read server-side from the revalidated JWT) — NEVER a client-supplied id. A
// forged call therefore matches 0 rows; one driver can never set another's preference.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";
import { createClient } from "@/platform/supabase/server";

export type DigestPreferenceState = {
  status: "idle" | "error" | "success";
  message?: string;
};

// enabled is a boolean (the toggle). hour is required ONLY when enabled (D-08): a 0–23 whole
// hour. When disabled, hour is ignored (coerced to null on the write so a stale hour is cleared).
const schema = z
  .object({
    enabled: z.boolean(),
    hour: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
      .refine(
        (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 23),
        { message: "invalid" },
      ),
  })
  .refine((d) => !d.enabled || d.hour !== undefined, {
    message: "hour required when enabled",
    path: ["hour"],
  });

export async function saveDigestPreference(
  _prev: DigestPreferenceState,
  formData: FormData,
): Promise<DigestPreferenceState> {
  const t = await getDict();

  // 1. RE-GATE: only a driver may set a digest preference.
  if ((await getCurrentRole()) !== "driver") {
    return { status: "error", message: t.digestSaveFailed };
  }

  // 2. VALIDATE at the boundary. The checkbox posts "on" when checked / absent when unchecked.
  const parsed = schema.safeParse({
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    hour: formData.get("hour") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: t.digestSaveFailed };
  }

  // The caller's verified uid (revalidated JWT, never a client arg) — the row-scope gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: t.digestSaveFailed };
  }

  // 3. WRITE via service-role, scoped to user_id = auth.uid(). When disabled, hour → null.
  const admin = createAdminClient();
  const { error } = await admin
    .from("driver_profiles")
    .update({
      digest_enabled: parsed.data.enabled,
      digest_send_hour: parsed.data.enabled ? parsed.data.hour : null,
    })
    .eq("user_id", user.id);

  if (error) {
    return { status: "error", message: t.digestSaveFailed };
  }

  revalidatePath("/driver/settings");
  return { status: "success" };
}
