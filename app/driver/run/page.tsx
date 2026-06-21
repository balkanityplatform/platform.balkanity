// app/driver/run/page.tsx — driver "My run" RSC (CLAIM-06, D-06), server-guarded.
//
// Re-verifies the driver role server-side (getCurrentRole() — revalidates the JWT, never the
// cookie) BEFORE any read; a non-driver is redirected to /sign-in. Reads the caller's OWN claimed
// rows on the ANON cookie-bound client (createClient) so the claiming-driver RLS
// (wp_transfers_claimed_driver_read, migration 0005) is the data gate — NOT the service-role
// client. Full PII is legitimately visible here because every row returned is one this driver
// owns (driver_id = auth.uid()).
//
// Rows are read in arrival_at ASC order (soonest first, CLAIM-06) across the active + completed
// states, then partitioned in the RSC into ACTIVE (claimed/en_route/arrived/picked_up) and
// completed (for the "Completed today" section, D-06). Copy is resolved server-side (no-flash)
// and handed to the island as an explicit prop bag.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { RunView, type RunRow } from "./RunView";

const ACTIVE_STATES = ["claimed", "en_route", "arrived", "picked_up"] as const;

export default async function MyRunPage() {
  if ((await getCurrentRole()) !== "driver") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound read — the claiming-driver RLS scopes rows to this driver's own claims.
  const supabase = await createClient();
  const { data } = await supabase
    .from("wp_transfers")
    .select(
      "id,status,arrival_at,guest_name,guest_phone,flight_no,notes,amount_cents,pax,luggage_count, destinations(address,zone,airport)",
    )
    .in("status", ["claimed", "en_route", "arrived", "picked_up", "completed"])
    .order("arrival_at", { ascending: true });

  const rows = (data ?? []) as unknown as RunRow[];
  const active = rows.filter((r) =>
    (ACTIVE_STATES as readonly string[]).includes(r.status),
  );
  const completed = rows.filter((r) => r.status === "completed");

  return (
    <RunView
      active={active}
      completed={completed}
      lang={lang}
      copy={{
        myRunTitle: t.myRunTitle,
        runEmptyHeading: t.runEmptyHeading,
        runEmptyBody: t.runEmptyBody,
        completedTodayTitle: t.completedTodayTitle,
        airportLabel: t.airportLabel,
        zoneLabel: t.zoneLabel,
        passengersLabel: t.driverPassengersLabel,
        luggageLabel: t.driverLuggageLabel,
        advanceToEnRouteCta: t.advanceToEnRouteCta,
        advanceToArrivedCta: t.advanceToArrivedCta,
        advanceToPickedUpCta: t.advanceToPickedUpCta,
        advanceToCompletedCta: t.advanceToCompletedCta,
        advanceFailedToast: t.advanceFailedToast,
      }}
    />
  );
}
