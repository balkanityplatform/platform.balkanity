// app/driver/page.tsx — Driver pool RSC (CLAIM-01, D-01/D-03/D-06), server-guarded.
//
// RSC: re-verifies the DRIVER role server-side (getCurrentRole() — revalidates the JWT,
// never the cookie) BEFORE any read or render; a non-driver is redirected to /sign-in
// (threat: driver browser → RSC page). The pre-claim pool is read through the ANON
// cookie-bound caller-auth client (createClient from platform/supabase/server) by calling
// the masked `wp_pool()` RPC — NOT a base-table transfers select (CLAIM-01/CLAIM-03).
//
// wp_pool() is a SECURITY DEFINER function (migration 0005) that STRUCTURALLY omits all
// guest contact PII and the exact pickup location — none of those columns are ever selected
// (Pitfall 11). It returns exactly the 9 pre-claim columns rendered below.
// flight_no IS present (operational, non-PII for v1 — D-02). The base table stays 0-rows
// for a non-claiming driver, so this RPC is the only way the pool is read.
//
// Copy is resolved server-side (no-flash, PLAT-04) and handed to the client island as an
// explicit prop bag — mirrors the app/admin/drivers/{page,DriversView} pattern with the
// DRIVER warm-light chrome instead of the slate console.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { PoolView, type PoolRow } from "./PoolView";

// Tell Next this is always dynamic — the pool is live, never statically cached.
export const dynamic = "force-dynamic";

export default async function DriverPoolPage() {
  if ((await getCurrentRole()) !== "driver") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound caller-auth client — the SAME client the claim path uses. The masked
  // wp_pool() RPC is the data-layer PII gate; never the service-role client here.
  const supabase = await createClient();

  // Masked pre-claim read — the RPC returns ONLY the 9 non-PII pool columns (CLAIM-01).
  const { data } = await supabase.rpc("wp_pool");

  const pool: PoolRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    status: r.status as string,
    arrival_at: r.arrival_at as string,
    airport: (r.airport as string | null) ?? null,
    zone: (r.zone as string | null) ?? null,
    flight_no: (r.flight_no as string | null) ?? null,
    amount_cents: r.amount_cents as number,
    pax: (r.pax as number | null) ?? null,
    luggage_count: (r.luggage_count as number | null) ?? null,
  }));

  return (
    <PoolView
      pool={pool}
      lang={lang}
      copy={{
        claimTransferCta: t.claimTransferCta,
        poolEmptyHeading: t.poolEmptyHeading,
        poolEmptyBody: t.poolEmptyBody,
        claimLostToast: t.claimLostToast,
        claimFailedToast: t.claimFailedToast,
        airportLabel: t.airportLabel,
        zoneLabel: t.zoneLabel,
        unclaimedBadge: t.driverUnclaimedBadge,
        flightLabel: t.driverFlightLabel,
        fareLabel: t.driverFareLabel,
        passengersLabel: t.driverPassengersLabel,
        luggageLabel: t.driverLuggageLabel,
      }}
    />
  );
}
