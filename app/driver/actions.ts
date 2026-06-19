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
// NOTE: advanceStatus is intentionally NOT added here — it is Plan 03's task. This file stays
// open for it.
import { createClient } from "@/platform/supabase/server";
import { claimTransfer, type ClaimResult } from "@/platform/transfers/claim";
import type { PoolRow } from "./PoolView";

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
