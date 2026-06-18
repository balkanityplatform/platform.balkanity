// app/admin/destinations/page.tsx — Destinations console (ONBD-03/04), server-guarded.
//
// Mirrors the properties slice (app/admin/properties/page.tsx): re-verifies the admin
// role server-side (getCurrentRole() — revalidates the JWT, never the cookie) BEFORE
// any read or render; a non-admin is redirected to /sign-in. Reads through the ANON
// cookie-bound client (createClient from platform/supabase/server) so the admin-read
// RLS policies on `destinations` + `properties` are actually exercised (defence-in-depth,
// threat T-02-EOP4) — NOT the service-role client (which would bypass RLS).
//
// Destinations read the active properties list so DestinationForm can offer a parent-
// property Select (a destination is always created under a property), and embed the
// parent property + company name for the list rows. Copy is resolved server-side
// (no-flash) and handed to the client view as a prop bag.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { DestinationsView } from "./DestinationsView";

export default async function DestinationsPage() {
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound reads — the admin-read RLS policies are the data-layer gate.
  const supabase = await createClient();

  const [destinationsResult, propertiesResult] = await Promise.all([
    // Destinations + their parent property name + grandparent company name (embedded
    // via the FK chain). Ordered by label for a stable list.
    supabase
      .from("destinations")
      .select(
        "id,slug,label,active,price_cents,commission_pct,property_id,properties(name,companies(name))",
      )
      .order("label"),
    // Active properties only — the eligible parents for the picker.
    supabase
      .from("properties")
      .select("id,name")
      .eq("active", true)
      .order("name"),
  ]);

  // Supabase types an embedded one-to-one relation as an object | array depending on
  // the FK shape; normalise the property + company names (or "" when absent).
  const destinations = (destinationsResult.data ?? []).map((d) => {
    const property = (
      d as {
        properties?:
          | { name: string; companies?: { name: string } | { name: string }[] | null }
          | { name: string; companies?: { name: string } | { name: string }[] | null }[]
          | null;
      }
    ).properties;
    const propertyObj = Array.isArray(property) ? property[0] : property;
    const propertyName = propertyObj?.name ?? "";
    const company = propertyObj?.companies;
    const companyName = Array.isArray(company)
      ? (company[0]?.name ?? "")
      : (company?.name ?? "");
    return {
      id: d.id as string,
      slug: d.slug as string,
      label: d.label as string,
      active: d.active as boolean,
      priceCents: d.price_cents as number,
      commissionPct: d.commission_pct as number,
      propertyId: d.property_id as string,
      propertyName,
      companyName,
    };
  });

  const properties = (propertiesResult.data ?? []) as {
    id: string;
    name: string;
  }[];

  return (
    <DestinationsView
      destinations={destinations}
      properties={properties}
      lang={lang}
      copy={{
        langToggle: t.langToggle,
        destinationsTitle: t.destinationsTitle,
        destinationsEmptyHeading: t.destinationsEmptyHeading,
        destinationsEmptyBody: t.destinationsEmptyBody,
        destinationLabelLabel: t.destinationLabelLabel,
        slugLabel: t.slugLabel,
        addressLabel: t.addressLabel,
        zoneLabel: t.zoneLabel,
        airportLabel: t.airportLabel,
        priceLabel: t.priceLabel,
        commissionPctLabel: t.commissionPctLabel,
        propertyNameLabel: t.propertyNameLabel,
        saveDestinationCta: t.saveDestinationCta,
        saveChangesCta: t.saveChangesCta,
        cancelCta: t.cancelCta,
        editCta: t.saveChangesCta,
        deactivateConfirmCta: t.deactivateConfirmCta,
        activeLabel: t.activeLabel,
        inactiveLabel: t.inactiveLabel,
        fieldRequired: t.fieldRequired,
        saveFailed: t.saveFailed,
        slugInvalid: t.slugInvalid,
        slugTaken: t.slugTaken,
        commissionRange: t.commissionRange,
        slugEditWarning: t.slugEditWarning,
        youKeepCommissionLine: t.youKeepCommissionLine,
        youKeepNetLine: t.youKeepNetLine,
        youKeepFeeNote: t.youKeepFeeNote,
      }}
    />
  );
}
