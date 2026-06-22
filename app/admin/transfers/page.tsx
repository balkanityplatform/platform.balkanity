// app/admin/transfers/page.tsx — admin transfers list (OPS-01), server-guarded.
//
// RSC: re-verifies the admin role server-side (getCurrentRole() — revalidates the JWT,
// never the cookie) BEFORE any read or render; a non-admin is redirected to /sign-in
// (threat T-06-AC1). Reads ALL transfers through the ANON cookie-bound client
// (createClient from platform/supabase/server) so the wp_transfers_admin_read RLS policy
// is the data-layer gate (defence-in-depth) — NOT the service-role client (which would
// bypass RLS). This is the UNMASKED admin read (distinct from the driver's masked wp_pool()).
//
// searchParams are UNTRUSTED input (threat T-06-INJ): the status filter is applied via the
// parameterized PostgREST `.in("status", …)` — never string-built SQL. The free-text SEARCH
// is now CLIENT-SIDE over the loaded rows (D-01) — the server `q` ilike/destination
// search machinery is RETIRED; the shell top-bar search is the single search affordance and
// filters the already-loaded set in TransfersView (no URL `q`, no new endpoint, T-12-10).
// needsAttention is computed per row in the RSC with simple pilot constants (D-09); the
// client SORT control in TransfersView is now the sole ordering authority over loaded rows.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import type { TransferState } from "@/platform/ui/StatusDot";
import { TransfersView, type TransferRow } from "./TransfersView";

// D-09 pilot constants (simple, UI-highlight only — no alerts).
const NEAR_ARRIVAL_UNCLAIMED_HOURS = 6; // unclaimed AND arriving within N hours → attention
const ARRIVED_STALL_HOURS = 2; // status='arrived' and not advanced past this window → attention

// The 8 lifecycle statuses the status filter can select (D-08).
const STATUS_OPTIONS: TransferState[] = [
  "requested",
  "paid",
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
];

// The unmasked admin read shape (joined destination zone/airport/exact address).
type RawRow = {
  id: string;
  status: string;
  arrival_at: string | null;
  guest_name: string | null;
  flight_no: string | null;
  driver_id: string | null;
  amount_cents: number;
  destinations: { zone: string | null; airport: string | null; address: string | null } | null;
};

// needsAttention (D-09): unclaimed paid is ALWAYS true; additionally true for a
// near-arrival unclaimed row, or an `arrived` row stalled past the window.
function computeNeedsAttention(row: RawRow, now: number): boolean {
  const unclaimed = row.status === "paid" && row.driver_id === null;
  if (unclaimed) return true; // unclaimed always coral (D-09)

  const arrivalMs = row.arrival_at ? new Date(row.arrival_at).getTime() : null;

  // (a) near-arrival unclaimed (already covered by the always-true branch, kept explicit
  //     so the constant documents the pilot rule for a future non-paid unclaimed state).
  if (
    unclaimed &&
    arrivalMs != null &&
    arrivalMs - now <= NEAR_ARRIVAL_UNCLAIMED_HOURS * 3_600_000
  ) {
    return true;
  }

  // (b) arrived-stalled: status='arrived' and arrival_at is older than the stall window.
  if (
    row.status === "arrived" &&
    arrivalMs != null &&
    now - arrivalMs >= ARRIVED_STALL_HOURS * 3_600_000
  ) {
    return true;
  }

  return false;
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; attention?: string }>;
}) {
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang, params] = await Promise.all([getDict(), getLang(), searchParams]);

  const statusFilter = (params.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TransferState => STATUS_OPTIONS.includes(s as TransferState));
  const attentionOnly = params.attention === "1";

  // Anon cookie-bound read — the wp_transfers_admin_read RLS policy is the data gate.
  const supabase = await createClient();

  let query = supabase
    .from("wp_transfers")
    .select(
      "id,status,arrival_at,guest_name,flight_no,driver_id,amount_cents, destinations(zone,airport,address)",
    )
    .order("arrival_at", { ascending: true });

  // Status filter — parameterized PostgREST `.in` (never string-built SQL).
  if (statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  // Free-text search is now CLIENT-SIDE over the loaded rows (D-01) — the server ilike
  // branch + in-RSC destination search machinery is retired; the shell top-bar search filters
  // the already-loaded set in TransfersView (no URL `q`, no new endpoint).

  const { data } = await query;
  const raw = (data ?? []) as unknown as RawRow[];

  // This is an async RSC that renders ONCE per request (not a re-rendering client hook), so a
  // single wall-clock read for the needsAttention windows is deterministic for the render.
  // eslint-disable-next-line react-hooks/purity -- RSC renders once; no unstable re-render.
  const now = Date.now();

  const withFlag = raw.map((r) => ({
    ...r,
    needsAttention: computeNeedsAttention(r, now),
  }));

  // The attention quick-filter stays a server narrow (D-08). The needsAttention coral PIN is
  // NOT applied here anymore (D-02): the client sort control in TransfersView is the sole
  // ordering authority over the loaded rows, so the server hands them in the natural
  // arrival_at ASC load order and TransfersView reorders (default = needs-attention pin).
  const filtered = attentionOnly ? withFlag.filter((r) => r.needsAttention) : withFlag;

  const rows: TransferRow[] = filtered.map((r) => ({
    id: r.id,
    status: r.status as TransferState,
    arrival_at: r.arrival_at,
    guest_name: r.guest_name,
    flight_no: r.flight_no,
    amount_cents: r.amount_cents,
    zone: r.destinations?.zone ?? null,
    airport: r.destinations?.airport ?? null,
    driver_id: r.driver_id,
    needsAttention: r.needsAttention,
  }));

  return (
    <TransfersView
      rows={rows}
      lang={lang}
      statusOptions={STATUS_OPTIONS}
      activeStatus={statusFilter}
      attentionOnly={attentionOnly}
      copy={{
        filterByStatusLabel: t.filterByStatusLabel,
        needsAttentionFilterCta: t.needsAttentionFilterCta,
        transfersEmptyHeading: t.transfersEmptyHeading,
        transfersEmptyBody: t.transfersEmptyBody,
        transfersNoMatchBody: t.transfersNoMatchBody,
        needsAttentionBadge: t.needsAttentionBadge,
        colTimeId: t.colTimeId,
        colPassenger: t.colPassenger,
        colRoute: t.colRoute,
        colLifecycle: t.colLifecycle,
        colStatus: t.colStatus,
        colDriver: t.colDriver,
        colActions: t.colActions,
        rowActionView: t.rowActionView,
        driverUnassigned: t.driverUnassigned,
        adminSortLabel: t.adminSortLabel,
        sortAttention: t.sortAttention,
        sortArrival: t.sortArrival,
        sortStatus: t.sortStatus,
      }}
    />
  );
}
