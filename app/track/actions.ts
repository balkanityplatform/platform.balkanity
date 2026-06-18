"use server";
// app/track/actions.ts — guest status-link re-access (D-07 / AUTH-02).
//
// A guest who lost their confirmation link enters the email they booked with; we
// re-issue a fresh magic link to their MOST-RECENT transfer's status page. In Phase 4
// the send is STUBBED/logged (Phase 7 wires Resend) — exactly like the confirmation stub.
//
// NO ACCOUNT ENUMERATION (T-04-ID6): this action ALWAYS returns the same neutral
// success copy regardless of whether the email has a booking. The success return is NOT
// inside an `if (found)` branch — found vs not-found are indistinguishable to the caller
// (mirrors the forgot-password / driver-invite no-enumeration ethos). Only a validation
// error (malformed email) returns the distinct error copy.
//
// The magic-link base is the TRUSTED NEXT_PUBLIC_SITE_URL constant — NEVER the client
// Origin header (WR-04). The link routes through the existing /auth/confirm route with an
// allowlisted `next=/status/<id>` (Task 3c thread; AUTH-02). The lookup uses the
// service-role client (the guest is not yet authenticated here).
import { z } from "zod";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";

export type TrackState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

const trackSchema = z.object({
  email: z.string().trim().email(),
});

export async function requestStatusLink(
  _prev: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const t = await getDict();

  // Validation error is the ONLY non-neutral branch (a malformed email cannot have a
  // booking either way, so this leaks nothing about account existence).
  const parsed = trackSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: t.trackError };
  }
  const email = parsed.data.email;

  // Trusted server-configured base — NEVER the client Origin header (WR-04).
  const base = process.env.NEXT_PUBLIC_SITE_URL;

  // Best-effort re-issue. ANY failure (no booking, generateLink error, missing base)
  // falls through to the SAME neutral success below — never a leak of existence.
  if (base) {
    try {
      const admin = createAdminClient();
      const { data: row } = await admin
        .from("wp_transfers")
        .select("id")
        .eq("guest_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row?.id) {
        const { data } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
            redirectTo: `${base}/auth/confirm?type=magiclink&next=/status/${row.id}`,
          },
        });
        // Phase-4 STUB: reveal/log only — Phase 7 sends via Resend.
        console.info("[D-07 stub] status re-access link", {
          to: email,
          magicLink: data?.properties?.action_link ?? "",
        });
      }
    } catch {
      // Swallow — the neutral response below must not reveal an unexpected failure
      // any differently from a no-booking case (no enumeration).
    }
  }

  // ALWAYS the neutral success — regardless of whether the email had a booking.
  return { status: "ok", message: t.trackSuccessNeutral };
}
