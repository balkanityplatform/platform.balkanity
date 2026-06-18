// app/admin/companies/page.tsx — Companies console (ONBD-01), server-guarded.
//
// RSC: re-verifies the admin role server-side (getCurrentRole() — revalidates the
// JWT, never the cookie) BEFORE any read or render; a non-admin is redirected to
// /sign-in (threat: admin browser → RSC page). Reads companies through the ANON
// cookie-bound client (createClient from platform/supabase/server) so the
// admin-read RLS policy on `companies` is actually exercised (defence-in-depth,
// threat T-02-EOP2) — NOT the service-role client (which would bypass RLS). Copy
// is resolved server-side (no-flash) and handed to the client view as a prop bag.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { CompaniesView } from "./CompaniesView";

export default async function CompaniesPage() {
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound read — the admin-read RLS policy is the data-layer gate.
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id,name,active")
    .order("name");

  const companies = (data ?? []) as {
    id: string;
    name: string;
    active: boolean;
  }[];

  return (
    <CompaniesView
      companies={companies}
      lang={lang}
      copy={{
        langToggle: t.langToggle,
        companiesTitle: t.companiesTitle,
        companiesEmptyHeading: t.companiesEmptyHeading,
        companiesEmptyBody: t.companiesEmptyBody,
        companyNameLabel: t.companyNameLabel,
        createCompanyCta: t.createCompanyCta,
        saveChangesCta: t.saveChangesCta,
        cancelCta: t.cancelCta,
        editCta: t.saveChangesCta,
        deactivateConfirmCta: t.deactivateConfirmCta,
        activeLabel: t.activeLabel,
        inactiveLabel: t.inactiveLabel,
        fieldRequired: t.fieldRequired,
        saveFailed: t.saveFailed,
      }}
    />
  );
}
