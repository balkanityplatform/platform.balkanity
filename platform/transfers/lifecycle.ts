// platform/transfers/lifecycle.ts — friendly app-layer mirror of the lifecycle
// transition guard (XFER-01, D-08/D-09/D-10).
//
// THE AUTHORITY IS THE DATABASE. This file is the cosmetic app-layer mirror of the
// migration-0004 `wp_enforce_transfer_transition` Postgres BEFORE-UPDATE trigger,
// which is the HARD BACKSTOP (D-08): the trigger fires for the webhook, the future
// claim RPC, and every admin/driver write alike — service-role does NOT bypass it
// (only RLS is bypassed). `canTransition` here exists ONLY to surface a friendly
// error before the DB rejects an illegal write; never treat it as the enforcement
// boundary. The exhaustive 8×8 pair test pins THIS map to the SAME allowed-transition
// table the trigger encodes (RESEARCH Pattern 2) — any divergence fails the unit test
// (T-04-01).
//
// The state union is imported from StatusDot — the single platform-wide source of
// truth (Don't-Hand-Roll lock, T-04-02). This file declares NO local state enum.
import type { TransferState } from "@/platform/ui/StatusDot";

// Allowed-transition map — EXACTLY mirrors the migration-0004 trigger (RESEARCH
// Pattern 2; D-09 full 8-state machine; D-10 admin-cancel from the five pre-pickup
// states only). `picked_up → completed` is the lone non-cancellable forward edge;
// `completed` and `cancelled` are terminal (no outbound transitions).
export const ALLOWED_TRANSITIONS: Record<TransferState, TransferState[]> = {
  requested: ["paid", "cancelled"],
  paid: ["claimed", "cancelled"],
  claimed: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["picked_up", "cancelled"],
  picked_up: ["completed"],
  completed: [],
  cancelled: [],
};

// Friendly app-layer guard. Returns true iff `from → to` is in the allowed map.
// A same-state pair (`from === to`) is NOT a legal forward transition here — the DB
// trigger early-returns on a no-op (`new.status is not distinct from old.status`),
// so the map intentionally omits self-edges (no state lists itself in its array).
export function canTransition(from: TransferState, to: TransferState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// The 7 happy-path states in lifecycle order, for the status-page timeline (BOOK-07,
// SC4). `cancelled` is deliberately EXCLUDED — the UI renders it as a distinct
// terminal row only when reached, never inline in the happy-path order (UI-SPEC).
export const LIFECYCLE_ORDER: readonly TransferState[] = [
  "requested",
  "paid",
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
];
