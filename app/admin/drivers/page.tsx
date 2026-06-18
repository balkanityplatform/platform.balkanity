// app/admin/drivers/page.tsx — Drivers console (ONBD-05), server-guarded.
//
// RSC: re-verifies the admin role server-side (getCurrentRole() — revalidates the
// JWT, never the cookie) BEFORE any read or render; a non-admin is redirected to
// /sign-in (threat: admin browser → RSC page). Reads the invited drivers through
// the ANON cookie-bound client (createClient from platform/supabase/server) so the
// admin-read RLS policy on driver_profiles is actually exercised (defence-in-depth,
// threat T-02-EOP5) — NOT the service-role client (which would bypass RLS).
//
// driver_profiles and app_users both key off auth.users(id) but there is no direct
// FK between them, so we read each separately (both admin-read RLS) and merge by id
// to attach the driver's email to the roster — no implicit PostgREST embed assumed.
// Copy is resolved server-side (no-flash) and handed to the client view as a prop bag.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { DriversView, type DriverRow } from "./DriversView";

export default async function DriversPage() {
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound reads — the admin-read RLS policies are the data-layer gate.
  const supabase = await createClient();

  const [{ data: profiles }, { data: users }] = await Promise.all([
    supabase
      .from("driver_profiles")
      .select("user_id,name,phone,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("app_users").select("id,email,role").eq("role", "driver"),
  ]);

  const emailById = new Map<string, string>(
    (users ?? []).map((u) => [u.id as string, u.email as string]),
  );

  const drivers: DriverRow[] = (profiles ?? []).map((p) => ({
    user_id: p.user_id as string,
    name: p.name as string,
    phone: (p.phone as string | null) ?? null,
    email: emailById.get(p.user_id as string) ?? null,
  }));

  return (
    <DriversView
      drivers={drivers}
      lang={lang}
      copy={{
        langToggle: t.langToggle,
        driversTitle: t.driversTitle,
        inviteDriverTitle: t.inviteDriverTitle,
        driversEmptyHeading: t.driversEmptyHeading,
        driversEmptyBody: t.driversEmptyBody,
        emailLabel: t.emailLabel,
        driverNameLabel: t.driverNameLabel,
        driverPhoneLabel: t.driverPhoneLabel,
        generateInviteLinkCta: t.generateInviteLinkCta,
        inviteLinkDeliveryNote: t.inviteLinkDeliveryNote,
        inviteLinkCopyCta: t.inviteLinkCopyCta,
        fieldRequired: t.fieldRequired,
        saveFailed: t.saveFailed,
      }}
    />
  );
}
