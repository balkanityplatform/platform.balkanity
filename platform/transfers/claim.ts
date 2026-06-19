// platform/transfers/claim.ts — thin caller-auth claim wrapper (CLAIM-02, D-03/D-04).
//
// THE DB IS THE AUTHORITY. This wraps the migration-0005 `claim_transfer` SECURITY DEFINER
// RPC, which decides the race with ONE atomic conditional UPDATE and derives the claiming
// driver from auth.uid() internally. This file adds NO logic on top of that contract — it
// invokes the RPC on the CALLER-AUTH server client (anon key + cookie-bound JWT, so auth.uid()
// resolves to the real signed-in driver) and returns the typed result unchanged.
//
// NEVER import the service-role admin client here (D-04): service-role bypasses RLS AND keys
// auth.uid() to NULL, which would break the auth.uid()-derived claim. The caller-auth client
// from server.ts is the only correct client on the claim path.
//
// The winner's full transfer row arrives inside `data.transfer` via the RPC's RETURNING *, so
// this wrapper issues NO follow-up `.select()` PII read (Pitfall 7). Losers get
// ok=false / reason='already_claimed' / transfer=null (graceful, zero PII). A genuine transport
// error is surfaced distinctly from a graceful loser (mirrors role.ts error-vs-empty discipline).
//
// The full driver/admin UI consuming this lands in Phase 6 — keep this thin.
import { createClient } from "@/platform/supabase/server";

// Local typing of the composite wp_claim_result (no generated Supabase types are committed yet).
// `transfer` is the full wp_transfers row for the winner, null for a loser.
export type ClaimResult = {
  ok: boolean;
  reason: string | null;
  transfer: Record<string, unknown> | null;
};

export async function claimTransfer(transferId: string): Promise<ClaimResult> {
  const supabase = await createClient();

  // Caller-auth RPC — auth.uid() inside claim_transfer is the real signed-in driver.
  const { data, error } = await supabase.rpc("claim_transfer", {
    p_transfer_id: transferId,
  });

  // Distinguish a genuine transport/RPC error from a graceful ok=false loser (D-03): a real
  // error (transient DB outage, RLS/grant misconfig, network blip) must NOT be collapsed into a
  // silent "already claimed". Surface it as a not-authenticated-shaped failure with no PII.
  if (error) {
    console.error("claim_transfer rpc failed", error);
    return { ok: false, reason: "rpc_error", transfer: null };
  }

  const result = data as ClaimResult | null;

  // No row / null payload (should not happen for a successful RPC, but guard defensively).
  if (!result) {
    return { ok: false, reason: "no_result", transfer: null };
  }

  // Branch on the typed result (D-03). The winner's full row is already in result.transfer via
  // RETURNING * — NO follow-up PII read is issued.
  return {
    ok: result.ok,
    reason: result.reason,
    transfer: result.ok ? result.transfer : null,
  };
}
