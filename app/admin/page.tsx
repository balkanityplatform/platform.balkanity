// app/admin/page.tsx — admin "Transfer Pool" dashboard (AUI-02 / D-05), server-guarded.
//
// RSC: re-verifies the admin role server-side via getCurrentRole() (revalidates the JWT,
// never the cookie-trusting getSession — CLAUDE.md authz rule) BEFORE any read or render;
// a non-admin is redirected to /sign-in (threat T-12-05 — the role gate stays ON THE PAGE,
// never moved to the layout). The slate console chrome (sidebar + top bar + bell) is owned
// by app/admin/layout.tsx (Plan 01) — this page renders NO <header> of its own.
//
// Reads ALL transfers through the ANON cookie-bound client (createClient from
// platform/supabase/server) so the wp_transfers_admin_read RLS policy is the data-layer gate
// (threat T-12-06) — NOT the elevated server client (which would bypass RLS). This is the SAME
// read shape the transfers list uses (app/admin/transfers/page.tsx) — NO new query/endpoint
// (D-03/D-05). The dashboard is READ-ONLY: it derives four KPI counts + a top-5 recent list
// from the loaded rows and writes nothing (threat T-12-07 — no `paid` writer introduced).
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import type { TransferState } from "@/platform/ui/StatusDot";
import { DashboardView, type RecentRow } from "./DashboardView";

// The unmasked admin read shape (joined destination zone/airport) — the same select the
// transfers list reuses; no new endpoint, the wp_transfers_admin_read RLS policy is the gate.
type RawRow = {
  id: string;
  status: string;
  arrival_at: string | null;
  guest_name: string | null;
  flight_no: string | null;
  driver_id: string | null;
  amount_cents: number;
  destinations: { zone: string | null; airport: string | null } | null;
};

export default async function AdminPage() {
  // Role gate PRECEDES the read (T-12-05 preservation — never moved to the layout).
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Anon cookie-bound read — the wp_transfers_admin_read RLS policy is the data gate (never
  // elevated client). Same select/ordering as app/admin/transfers/page.tsx (no new query).
  const supabase = await createClient();
  const { data } = await supabase
    .from("wp_transfers")
    .select(
      "id,status,arrival_at,guest_name,flight_no,driver_id,amount_cents, destinations(zone,airport)",
    )
    .order("arrival_at", { ascending: true });

  const raw = (data ?? []) as unknown as RawRow[];

  // KPI counts derived from the loaded rows (presentation-only, no extra read).
  const unclaimed = raw.filter((r) => r.status === "paid" && r.driver_id === null).length;
  const claimed = raw.filter((r) => r.status === "claimed").length;
  const enRoute = raw.filter((r) => r.status === "en_route").length;

  // "Total today": rows whose date field falls on the current LOCAL day. Discretion —
  // arrival_at is the field already on the row (no created_at/paid_at in the select), so it
  // is the natural "today's transfers" anchor without widening the read shape.
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const totalToday = raw.filter((r) => {
    if (!r.arrival_at) return false;
    const ms = new Date(r.arrival_at).getTime();
    return ms >= startOfDay && ms < endOfDay;
  }).length;

  // Recent transfers: the top ~5 rows by the existing arrival ordering.
  const recent: RecentRow[] = raw.slice(0, 5).map((r) => ({
    id: r.id,
    status: r.status as TransferState,
    arrival_at: r.arrival_at,
    guest_name: r.guest_name,
    zone: r.destinations?.zone ?? null,
    airport: r.destinations?.airport ?? null,
    amount_cents: r.amount_cents,
    // unclaimed paid rows are the dashboard's needs-attention marker (mirrors the
    // transfers list's "unclaimed always coral" rule, D-09) — text badge, never colour alone.
    needsAttention: r.status === "paid" && r.driver_id === null,
  }));

  return (
    <DashboardView
      counts={{ unclaimed, claimed, enRoute, totalToday }}
      recent={recent}
      lang={lang}
      copy={{
        adminDashboardTitle: t.adminDashboardTitle,
        kpiUnclaimed: t.kpiUnclaimed,
        kpiClaimed: t.kpiClaimed,
        kpiEnRoute: t.kpiEnRoute,
        kpiTotalToday: t.kpiTotalToday,
        adminRecentTransfersHeading: t.adminRecentTransfersHeading,
        adminViewAllCta: t.adminViewAllCta,
        transfersEmptyHeading: t.transfersEmptyHeading,
        transfersEmptyBody: t.transfersEmptyBody,
        needsAttentionBadge: t.needsAttentionBadge,
      }}
    />
  );
}
