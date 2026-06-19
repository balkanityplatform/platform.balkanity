"use server";
// app/driver/actions.ts — driver pool server actions (CLAIM-01/CLAIM-02, D-03/D-04).
//
// claimAction wraps the caller-auth `claimTransfer` (platform/transfers/claim.ts) and adds
// NO logic on top — claim.ts is the authority (the migration-0005 atomic conditional UPDATE
// derives the driver from auth.uid() internally). NEVER the service-role admin client on this
// path (D-04): service-role bypasses RLS AND keys auth.uid() to NULL, breaking the claim.
//
// refetchPool re-reads the masked wp_pool() RPC on the caller-auth client for the live poll —
// the SAME masked read the RSC page uses, so the poll can NEVER widen the pool's PII surface.
//
// advanceStatus (Plan 03) is the D-13 gated service-role driver write path — the ONE genuinely
// new write surface in the driver UI. Drivers have NO RLS write policy (Pitfall 1), so the write
// MUST use the service-role admin client; the in-action ownership check (row.driver_id === the
// authenticated caller's id) is therefore the only authorization gate, and the migration-0004
// transition trigger is the hard state-legality backstop. It NEVER opens a new RLS write policy
// and NEVER runs from the client.
import { revalidatePath } from "next/cache";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { ALLOWED_TRANSITIONS } from "@/platform/transfers/lifecycle";
import type { TransferState } from "@/platform/ui/StatusDot";
import { claimTransfer, type ClaimResult } from "@/platform/transfers/claim";
import type { PoolRow } from "./PoolView";

// Typed result for the driver advance write (mirrors the admin action-state shape).
export type AdvanceState = { ok: boolean };

// Thin pass-through to the caller-auth claim wrapper. The typed result is returned unchanged:
// ok=true + the winner's full row in `transfer`; ok=false + reason='already_claimed' for a
// graceful loser; ok=false + a transport reason for a genuine error (D-03).
export async function claimAction(transferId: string): Promise<ClaimResult> {
  return claimTransfer(transferId);
}

// Re-read the masked pool for the live poll (focus-refetch + interval). Same wp_pool() RPC
// and same caller-auth client as the page — structural PII omission is preserved.
export async function refetchPool(): Promise<PoolRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("wp_pool");

  return (data ?? []).map((r: Record<string, unknown>) => ({
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
}

// advanceStatus(transferId) — the D-13 gated service-role driver write path (CLAIM-04/CLAIM-05).
//
// Authz is a TWO-part gate, because the service-role admin write below bypasses RLS:
//   1. Caller identity via the caller-auth client → auth.getUser() + getCurrentRole()==='driver'.
//   2. OWNERSHIP: the row's driver_id MUST equal the authenticated caller's id (Pitfall 1) —
//      derived from auth.uid() server-side, NEVER a client-supplied id. A forged call for another
//      driver's transfer is rejected here and writes nothing (T-06-EOP1).
//
// The next status is resolved THROUGH ALLOWED_TRANSITIONS as the single forward driver edge
// (claimed→en_route→arrived→picked_up→completed) — release (→paid) and cancel (→cancelled) are
// NOT driver-forward edges, so they are filtered out; an illegal/skip-ahead target is never even
// attempted (the migration-0004 trigger is the hard backstop regardless, T-06-LEGAL).
//
// The write carries a `.eq("status", current)` optimistic-concurrency guard so a stale/duplicate
// advance affects 0 rows (T-06-CONCUR) rather than racing a read-then-write. Driver advances are
// NOT audit-reason-gated — last_action_* is admin-action audit (Plan 05), not written here.
export async function advanceStatus(transferId: string): Promise<AdvanceState> {
  await getDict(); // (errors are surfaced as a generic toast by the caller; no copy leaked here)

  // 1) Caller identity on the caller-auth client (auth.uid() resolves to the real driver).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await getCurrentRole()) !== "driver") {
    return { ok: false };
  }

  // 2) Read the row's status + owner with the service-role client (the ownership check is the gate).
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("wp_transfers")
    .select("status,driver_id")
    .eq("id", transferId)
    .eq("driver_id", user.id) // OWNERSHIP scope — a non-owner read returns no row (Pitfall 1).
    .single();
  if (!row || row.driver_id !== user.id) {
    return { ok: false };
  }

  // Resolve the single forward driver edge via the lifecycle map (never cancelled/paid).
  const current = row.status as TransferState;
  const next = ALLOWED_TRANSITIONS[current].find(
    (s) => s !== "cancelled" && s !== "paid",
  );
  if (!next) {
    // Terminal / no forward driver edge (e.g. completed) — nothing to advance.
    return { ok: false };
  }

  // Service-role write with the optimistic-concurrency guard. The trigger rejects any illegal
  // edge regardless; the .eq("status", current) makes a stale double-advance a 0-row no-op.
  const { error } = await admin
    .from("wp_transfers")
    .update({ status: next })
    .eq("id", transferId)
    .eq("status", current);
  if (error) {
    return { ok: false };
  }

  revalidatePath("/driver/run");
  return { ok: true };
}
