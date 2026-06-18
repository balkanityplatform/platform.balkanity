// app/admin/properties/page.tsx — Properties console (ONBD-02), server-guarded.
//
// Mirrors the companies slice (app/admin/companies/page.tsx): re-verifies the admin
// role server-side (getCurrentRole() — revalidates the JWT, never the cookie) BEFORE
// any read or render; a non-admin is redirected to /sign-in. Reads through the ANON
// cookie-bound client (createClient from platform/supabase/server) so the admin-read
// RLS policies on `properties` + `companies` are actually exercised (defence-in-depth,
// threat T-02-EOP3) — NOT the service-role client (which would bypass RLS).
//
// Properties additionally read the active companies list so PropertyForm can offer a
// parent-company Select (ONBD-02 — a property is always created under a company). Copy
// is resolved server-side (no-flash) and handed to the client view as a prop bag.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { PropertiesView } from "./PropertiesView";

export default async function PropertiesPage() {
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound reads — the admin-read RLS policies are the data-layer gate.
  const supabase = await createClient();

  const [propertiesResult, companiesResult] = await Promise.all([
    // Properties + their parent company name (embedded select via the FK).
    supabase
      .from("properties")
      .select("id,name,active,company_id,companies(name)")
      .order("name"),
    // Active companies only — the eligible parents for the picker.
    supabase
      .from("companies")
      .select("id,name")
      .eq("active", true)
      .order("name"),
  ]);

  // Supabase types an embedded one-to-one relation as an object | array depending on
  // the FK shape; normalise to the parent company's name (or "" when absent).
  const properties = (propertiesResult.data ?? []).map((p) => {
    const company = (p as { companies?: { name: string } | { name: string }[] | null })
      .companies;
    const companyName = Array.isArray(company)
      ? (company[0]?.name ?? "")
      : (company?.name ?? "");
    return {
      id: p.id as string,
      name: p.name as string,
      active: p.active as boolean,
      companyId: p.company_id as string,
      companyName,
    };
  });

  const companies = (companiesResult.data ?? []) as {
    id: string;
    name: string;
  }[];

  return (
    <PropertiesView
      properties={properties}
      companies={companies}
      lang={lang}
      copy={{
        langToggle: t.langToggle,
        propertiesTitle: t.propertiesTitle,
        propertiesEmptyHeading: t.propertiesEmptyHeading,
        propertiesEmptyBody: t.propertiesEmptyBody,
        propertyNameLabel: t.propertyNameLabel,
        companyNameLabel: t.companyNameLabel,
        addPropertyCta: t.addPropertyCta,
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
