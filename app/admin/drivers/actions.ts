"use server";
// app/admin/drivers/actions.ts — driver invite mutation (ONBD-05 / AUTH-03 / NOTF-04).
//
// THE new primitive of Phase 2: an admin invites a driver. This crosses the
// untrusted FormData → server boundary AND creates an auth account, so it:
//   1. RE-GATES the caller with getCurrentRole() !== "admin" (threat T-02-EOP5) —
//      generateLink + the service-role writes below BYPASS RLS, so this in-action
//      role check is the only authorization gate. A direct (non-UI) call by a
//      non-admin is rejected here before any auth-user creation.
//   2. zod-validates email/name/phone at the trust boundary — generic,
//      dictionary-keyed errors only; no provider-detail leak.
//   3. Creates the auth user via the GoTrue admin API generateLink({type:'invite'})
//      — this CREATES the auth.users + auth.identities record AND returns the
//      set-password link, sending NO email (D-03; threat T-02-TMP8: never a raw
//      auth.users INSERT). The redirect base is the TRUSTED NEXT_PUBLIC_SITE_URL
//      constant, never the client Origin header (WR-04; threat T-02-TMP7) — it must
//      also live in the Supabase Redirect URLs allowlist (Task 3 checkpoint).
//   4. Writes role='driver' EXPLICITLY server-side as the literal — never derived
//      from client input (mass-assignment / self-promotion defense, threat
//      T-02-EOP5). No open driver signup exists; this invite is the only path to a
//      driver account (AUTH-03).
//   5. Stores the display profile (name + phone) in driver_profiles (D-02).
//   6. Returns the action_link to the admin UI for manual copy (D-04); it is NOT
//      logged broadly (threat T-02-ID6). NOTF-04: the Resend send wires in Phase 7.
//
// Re-invite (Pitfall 4): a duplicate email surfaces the generic, admin-facing
// driverAlreadyInvited message — never branch error copy on provider detail
// (account-enumeration defense, threat T-02-ID5; mirrors the forgot-password
// no-enumeration pattern).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";
import { sendEmail } from "@/platform/notifications/send-email";
import { buildInviteEmailFromLink } from "./invite-email";

export type InviteDriverState = {
  status: "idle" | "error" | "ok";
  message?: string;
  // D-14: the invite is now EMAIL-ONLY — the set-password link is sent to the driver
  // via sendEmail, never revealed/copied in the admin UI. No actionLink in state.
};

// email must be a valid address; name is required (the driver display name, D-02);
// phone is optional. Trimmed; empty/whitespace name → generic fieldRequired.
// phone is optional: FormData.get("phone") yields null when the field is absent
// and "" when present-but-empty — both normalise to undefined (no phone) so the
// optional string validates rather than tripping the required-string guard.
const inviteSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  phone: z.preprocess(
    (v) => (v == null || v === "" ? undefined : v),
    z.string().trim().optional(),
  ),
});

export async function inviteDriver(
  _prev: InviteDriverState,
  formData: FormData,
): Promise<InviteDriverState> {
  const t = await getDict();

  // Re-gate: the service-role client below bypasses RLS — this is the only authz
  // gate on the invite. Generic message (no role disclosure).
  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    // copy id: fieldRequired (generic — never echo the raw zod issue)
    return { status: "error", message: t.fieldRequired };
  }

  // Trusted redirect base — the server-configured constant, NOT the client Origin
  // header (WR-04, threat T-02-TMP7). Must be set in Vercel production env and the
  // target URL must be in the Supabase Redirect URLs allowlist (Task 3 checkpoint).
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // generateLink(type:'invite') CREATES the auth user AND returns the set-password
  // link — it sends NO email (D-03). We deliberately do NOT use the email-sending
  // admin invite API here; the link is handed off manually for copy (D-04).
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: {
      // Must be in the project's Redirect URLs allowlist (Pitfall 1). The existing
      // /auth/confirm route already allowlists type=invite → /set-password.
      redirectTo: `${base}/auth/confirm?type=invite`,
      data: { name: parsed.data.name }, // optional user_metadata
    },
  });

  // Re-invite of an existing email (Pitfall 4) surfaces here as a GoTrue error —
  // return the generic admin-facing "already invited" copy (no enumeration branch).
  if (error || !data?.user) {
    return { status: "error", message: t.driverAlreadyInvited };
  }

  const userId = data.user.id;

  // Assign the driver role EXPLICITLY as the literal 'driver' (mass-assignment /
  // self-promotion defense, threat T-02-EOP5) — never read from formData.
  const { error: roleError } = await admin.from("app_users").insert({
    id: userId,
    email: parsed.data.email,
    role: "driver",
  });
  if (roleError) {
    // A duplicate app_users row (unique lower(email) index) also lands here — same
    // generic "already invited" copy (no enumeration branch on provider detail).
    return { status: "error", message: t.driverAlreadyInvited };
  }

  // Store the display profile (name + phone) keyed to the new auth user (D-02).
  const { error: profileError } = await admin.from("driver_profiles").insert({
    user_id: userId,
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
  });
  if (profileError) {
    return { status: "error", message: t.saveFailed };
  }

  // D-14 (NOTF-04): EMAIL the set-password link via the single sendEmail call-site —
  // CRITICAL tier (the invite must land even past the soft cap), invite copy is EN
  // (D-17, getDictFor('en') inside buildInviteEmail). Stable idempotency key per user
  // so a re-submit never double-sends. Log-and-continue: a send failure must NOT roll
  // back the account/profile writes above (the driver exists; the admin can re-invite).
  // The link is NEVER returned to the UI (D-14 — no inline reveal / copy-paste). The
  // template build (which carries the link) lives in ./invite-email so this action
  // source never contains the reveal token (invite.notify.test.ts source gate).
  try {
    const { subject, html } = buildInviteEmailFromLink({
      to: parsed.data.email,
      link: data.properties.action_link,
    });
    await sendEmail({
      to: parsed.data.email,
      subject,
      html,
      tier: "critical",
      idempotencyKey: `invite:${userId}`,
    });
  } catch (err) {
    // Non-fatal: the account is created; the invite email can be re-sent. Log the error
    // object only — never the recipient address / action_link (threat T-07-FO5).
    console.error("[NOTF-04] invite email send failed (continuing)", err);
  }

  revalidatePath("/admin/drivers");

  // D-14: email-only — no actionLink returned (the link was emailed, not revealed).
  return { status: "ok" };
}
