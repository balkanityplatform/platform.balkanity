// app/status/[id]/page.tsx — magic-link-gated guest status page (BOOK-07 / AUTH-02 / SC4).
//
// THE GUEST PII BOUNDARY. The guest's own transfer is read with the COOKIE-BOUND ANON
// client (createClient from platform/supabase/server) — NEVER the service-role client —
// so the migration-0004 `wp_transfers_guest_self_read` RLS policy is the authorization
// gate: a JWT email ≠ guest_email matches no policy → zero rows → the session-expired
// state. Authorization uses auth.getUser() (revalidates the JWT server-side), NEVER
// getSession() (which trusts the cookie unverified — Pitfall 6 / CLAUDE.md lock).
//
// DRIVER REVEAL (D-06, post-claim). driver_profiles carries ONLY an admin-read RLS
// policy (migration 0002), so a guest cookie-session read returns ZERO rows. Therefore,
// ONLY after the owning transfer row is RLS-authorized AND status ∈ {claimed…completed}
// AND driver_id is non-null, we read EXACTLY {name, phone} for that single driver via the
// SERVICE-ROLE client. The read is gated on the already-RLS-authorized owning transfer
// row, so it never widens the guest's reach beyond their own claimed transfer's driver
// display fields. We do NOT add a broad guest SELECT policy on driver_profiles (PII stays
// minimal). NOTE: driver_profiles' primary key is `user_id` (migration 0002), and the
// transfer's driver_id FKs auth.users(id) — so the join is driver_profiles.user_id =
// wp_transfers.driver_id.
//
// The route/airport/zone trip metadata is non-PII destination data; it is read with the
// service-role client (mirrors /pickup and /pay/success) so a deactivated destination
// still resolves the guest's own route. NetworkFirst is enforced by app/sw.ts (Task 3).
import { getDict } from "@/platform/i18n/dictionary";
import { fmtEur } from "@/platform/money/commission";
import { createAdminClient } from "@/platform/supabase/admin";
import { createClient } from "@/platform/supabase/server";
import { Card } from "@/platform/ui/Card";
import { LifecycleTimeline } from "@/platform/ui/LifecycleTimeline";
import type { TransferState } from "@/platform/ui/StatusDot";

// Service-role + Supabase auth cookie handling → Node runtime (mirrors /pay/success).
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

// The statuses at/after which the driver is revealed to the guest (D-06).
const CLAIMED_OR_LATER: ReadonlySet<TransferState> = new Set([
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
]);

// Minimal token interpolation for the copy contract (server-side, no client flash).
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

// Format an ISO timestamp into a date + time pair for the trip summary / receipt.
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The session-expired / no-access state (no row, no session) — never leaks whether the
// id exists; offers the /track re-access CTA.
function ExpiredState({
  message,
  cta,
}: {
  message: string;
  cta: string;
}) {
  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-[16px] px-[16px] py-[48px]">
      <p className="text-[16px] leading-[1.5] text-slate">{message}</p>
      <a
        href="/track"
        className="text-[16px] font-semibold leading-[1.5] text-teal underline"
      >
        {cta}
      </a>
    </main>
  );
}

export default async function StatusPage({ params }: { params: Params }) {
  const { id } = await params;
  const t = await getDict();

  // Cookie-bound anon client — RLS is the authorization gate for the guest read.
  const supabase = await createClient();

  // getUser revalidates the JWT server-side (NEVER getSession — Pitfall 6).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ExpiredState message={t.statusExpired} cta={t.statusExpiredCta} />;
  }

  // RLS guest-self-read authorizes: only the guest whose JWT email = guest_email
  // gets a row. No service-role read of the guest transfer row itself.
  const { data: row } = await supabase
    .from("wp_transfers")
    .select(
      "id, status, amount_cents, paid_at, arrival_at, flight_no, pax, driver_id, destination_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    // No row → not theirs, or no row at all. Same neutral session-expired state.
    return <ExpiredState message={t.statusExpired} cta={t.statusExpiredCta} />;
  }

  const status = row.status as TransferState;
  const admin = createAdminClient();

  // Non-PII route metadata for the trip summary (airport → zone). Service-role read
  // mirrors /pickup; resolves the route even for a deactivated destination.
  let airport = "";
  let zone = "";
  if (row.destination_id) {
    const { data: dest } = await admin
      .from("destinations")
      .select("airport, zone")
      .eq("id", row.destination_id)
      .maybeSingle();
    if (dest) {
      airport = dest.airport ?? "";
      zone = dest.zone ?? "";
    }
  }

  // Driver reveal (D-06) — ONLY at/after claimed, with a non-null driver_id, via a
  // narrow service-role read of EXACTLY {name, phone} for the single driver_id. Gated
  // on the already-RLS-authorized owning transfer row above.
  let driverFirstName = "";
  let driverPhone = "";
  const revealDriver = CLAIMED_OR_LATER.has(status) && row.driver_id != null;
  if (revealDriver) {
    const { data: driver } = await admin
      .from("driver_profiles")
      .select("name, phone")
      .eq("user_id", row.driver_id)
      .maybeSingle();
    if (driver) {
      // Derive the first name from the display name (first whitespace-split token).
      driverFirstName = (driver.name ?? "").trim().split(/\s+/)[0] ?? "";
      driverPhone = driver.phone ?? "";
    }
  }

  const isPaid = status === "paid" || row.paid_at != null;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-[48px] px-[16px] py-[48px]">
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {t.statusTitle}
      </h1>

      {/* Trip summary — Card-grouped per UI-SPEC. */}
      <Card className="flex flex-col gap-[8px]">
        <h2 className="text-[20px] font-semibold leading-[1.2] text-slate">
          {t.statusYourTrip}
        </h2>
        <p className="text-[16px] leading-[1.5] text-slate">
          {fill(t.statusRouteLine, { airport, zone })}
        </p>
        <p className="text-[14px] leading-[1.4] text-grey">
          {fill(t.statusArrivalLine, {
            arrivalDate: fmtDate(row.arrival_at),
            arrivalTime: fmtTime(row.arrival_at),
          })}
        </p>
        {row.flight_no ? (
          <p className="text-[14px] leading-[1.4] text-grey">
            {fill(t.statusFlightLine, { flightNo: row.flight_no })}
          </p>
        ) : null}
        {row.pax != null ? (
          <p className="text-[14px] leading-[1.4] text-grey">
            {fill(t.statusPaxLine, { pax: String(row.pax) })}
          </p>
        ) : null}
      </Card>

      {/* Lifecycle timeline (SC4) */}
      <section className="flex flex-col gap-[16px]">
        <h2 className="text-[20px] font-semibold leading-[1.2] text-slate">
          {t.statusTimelineHeading}
        </h2>
        <LifecycleTimeline current={status} />
      </section>

      {/* Payment receipt — meaningful once paid (SC4). Card-grouped per UI-SPEC. */}
      <Card className="flex flex-col gap-[8px]">
        <h2 className="text-[20px] font-semibold leading-[1.2] text-slate">
          {t.statusReceiptHeading}
        </h2>
        {isPaid ? (
          <>
            <p className="text-[16px] leading-[1.5] text-slate">
              {fill(t.statusReceiptPaidLine, {
                amount:
                  row.amount_cents != null ? fmtEur(row.amount_cents) : "",
                paidDate: fmtDate(row.paid_at),
              })}
            </p>
            <p className="text-[14px] leading-[1.4] text-grey">
              {t.statusReceiptSubNote}
            </p>
          </>
        ) : (
          <p className="text-[14px] leading-[1.4] text-grey">
            {t.statusReceiptSubNote}
          </p>
        )}
      </Card>

      {/* Driver block — ONLY at/after claimed (D-06). Card-grouped per UI-SPEC. */}
      <Card className="flex flex-col gap-[8px]">
        <h2 className="text-[20px] font-semibold leading-[1.2] text-slate">
          {t.statusDriverHeading}
        </h2>
        {revealDriver ? (
          <p className="text-[16px] leading-[1.5] text-slate">
            {fill(t.statusDriverLine, {
              driverFirstName,
              driverPhone,
            })}
          </p>
        ) : (
          <p className="text-[14px] leading-[1.4] text-grey">
            {t.statusDriverPreClaimNote}
          </p>
        )}
      </Card>
    </main>
  );
}
