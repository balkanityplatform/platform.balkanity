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
// parameterized PostgREST `.in("status", …)` and the name/flight search via `.or(ilike)` —
// never string-built SQL. Destination-name search is applied in-RSC after the read (pilot
// volume — RESEARCH A3). needsAttention is computed per row in the RSC with simple pilot
// constants (D-09); coral rows are stable-sorted to the top (D-07) then soonest arrival.
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
  searchParams: Promise<{ status?: string; attention?: string; q?: string }>;
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
  const search = (params.q ?? "").trim();

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

  // Free-text search across guest name / flight no. at the query layer (parameterized ilike).
  if (search) {
    const s = search.replace(/[%,()]/g, ""); // strip PostgREST filter metacharacters
    query = query.or(`guest_name.ilike.%${s}%,flight_no.ilike.%${s}%`);
  }

  const { data } = await query;
  const raw = (data ?? []) as unknown as RawRow[];

  const now = Date.now();

  // Destination-name search applied in-RSC (pilot volume — RESEARCH A3): a row is kept when
  // the query already matched (name/flight via .or) OR the destination zone/airport matches.
  const searched = search
    ? raw.filter((r) => {
        const needle = search.toLowerCase();
        const inGuest = (r.guest_name ?? "").toLowerCase().includes(needle);
        const inFlight = (r.flight_no ?? "").toLowerCase().includes(needle);
        const inDest = [r.destinations?.zone, r.destinations?.airport]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(needle));
        return inGuest || inFlight || inDest;
      })
    : raw;

  const withFlag = searched.map((r) => ({
    ...r,
    needsAttention: computeNeedsAttention(r, now),
  }));

  const filtered = attentionOnly ? withFlag.filter((r) => r.needsAttention) : withFlag;

  // Stable sort: needsAttention pinned to the TOP (D-07), then soonest arrival (the query
  // already ordered by arrival_at ASC, so a stable partition preserves that secondary order).
  const sorted = [...filtered].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return 0;
  });

  const rows: TransferRow[] = sorted.map((r) => ({
    id: r.id,
    status: r.status as TransferState,
    arrival_at: r.arrival_at,
    guest_name: r.guest_name,
    flight_no: r.flight_no,
    amount_cents: r.amount_cents,
    zone: r.destinations?.zone ?? null,
    airport: r.destinations?.airport ?? null,
    needsAttention: r.needsAttention,
  }));

  return (
    <TransfersView
      rows={rows}
      lang={lang}
      statusOptions={STATUS_OPTIONS}
      activeStatus={statusFilter}
      attentionOnly={attentionOnly}
      query={search}
      copy={{
        langToggle: t.langToggle,
        transfersTitle: t.transfersTitle,
        filterByStatusLabel: t.filterByStatusLabel,
        needsAttentionFilterCta: t.needsAttentionFilterCta,
        transferSearchPlaceholder: t.transferSearchPlaceholder,
        transfersEmptyHeading: t.transfersEmptyHeading,
        transfersEmptyBody: t.transfersEmptyBody,
        transfersNoMatchBody: t.transfersNoMatchBody,
        needsAttentionBadge: t.needsAttentionBadge,
      }}
    />
  );
}
