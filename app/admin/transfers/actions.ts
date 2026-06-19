"use server";
// app/admin/transfers/actions.ts — admin transfer ops mutations (OPS-03 / OPS-04, D-10/D-14/D-15).
//
// Five gated Server Actions over the LOCKED transfer data layer, each following the
// companies/actions.ts skeleton:
//   1. RE-GATE the caller with getCurrentRole() !== "admin" (threat T-06-AC2) — the
//      createAdminClient() service-role write BYPASSES RLS, so this in-action role check
//      is THE authorization gate. A direct (non-UI) call by a non-admin is rejected here.
//   2. Validate input with zod at the trust boundary (threat T-06-INPUT) — generic,
//      dictionary-keyed errors only; no provider/Stripe-detail leak.
//   3. Write via createAdminClient() (service-role) because wp_transfers has NO
//      anon/authenticated write policy (the no-write-policy lock; migration 0002-0006).
//
// The five actions (D-10 reason gate on the destructive four; assign is one-tap):
//   • assign(id, driverId)          — one-tap; set driver_id AND move paid->claimed in the SAME
//                                      write (guarded .eq("status","paid")). There is NO trigger
//                                      that moves status on a driver_id-only change, so the status
//                                      MUST be set here or the row would orphan (stay paid, drop
//                                      out of wp_pool because driver_id is set, and never enter the
//                                      assigned driver's run). The 0004 trigger permits paid->claimed.
//   • reassign(id, driverId, reason)— swap the claiming driver of an ACTIVE claimed transfer
//                                      (claimed/en_route/arrived/picked_up); persist last_action_*;
//                                      reason req. Guarded .in(status, active) so a paid/cancelled/
//                                      completed row is never silently re-owned (status is unchanged,
//                                      so the trigger never fires — the guard is the only protection).
//   • release(id, reason)           — the D-14 backward edge: GUARDED to status='claimed', writes
//                                      { driver_id: null, status: 'paid', last_action_* }. This is
//                                      the ONE narrow gated status='paid' writer (D-15) — in the
//                                      single-writer allowlist with the webhook; the live 0006
//                                      trigger permits the claimed->paid edge. Reason required.
//   • cancel(id, reason)            — trigger-legal -> cancelled; persist last_action_*; reason req.
//                                      NEVER auto-refunds (D-11 — refund is a separate action).
//   • refund(id, amount?, reason)   — resolve stripe_payment_intent_id from the row, call the
//                                      server-only refundPayment hook with a stable idempotencyKey
//                                      (Pitfall 3 — no double-refund on retry), persist last_action_*.
//                                      NEVER writes status='paid' (a refund is not a payment, D-12).
//
// last_action_by is the ACTING ADMIN's auth uid (recorded server-side from the verified JWT —
// never a client arg). The migration-0004/0006 trigger is the hard state-legality backstop; the
// action does not re-implement lifecycle legality (it only restricts release to claimed, D-14).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { refundPayment } from "@/platform/payments/refund";
import { createAdminClient } from "@/platform/supabase/admin";
import { createClient } from "@/platform/supabase/server";

export type TransferActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const uuid = z.string().uuid();

// assign: id + driverId (one-tap, no reason).
const assignSchema = z.object({
  id: uuid,
  driverId: uuid,
});

// reassign: id + driverId + a non-empty reason (D-10).
const reassignSchema = z.object({
  id: uuid,
  driverId: uuid,
  reason: z.string().trim().min(1),
});

// release / cancel: id + a non-empty reason (D-10).
const reasonSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(1),
});

// refund: id + a non-empty reason; amount OPTIONAL (omit → full refund, D-12). When present,
// amount is a positive integer in MAJOR euro units (the form shows euros); the action validates
// it is positive and within the paid amount, then converts to cents for the Stripe hook.
const refundSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(1),
  amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: "invalid",
    }),
});

// The acting admin's verified uid (revalidated JWT, never a client arg) — recorded as
// last_action_by. Returns null when no signed-in user (the role gate already rejected non-admins).
async function actingAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// assign — one-tap; set driver_id AND move paid->claimed in one write. No reason (D-10).
// Guarded .eq("status","paid") so assign only acts on an unclaimed paid row, and a row-count
// check rejects the no-op (already claimed/cancelled/etc.). No trigger reacts to a driver_id-only
// change, so omitting status:'claimed' would orphan the row (CR-01).
// ---------------------------------------------------------------------------
export async function assign(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = assignSchema.safeParse({
    id: formData.get("id"),
    driverId: formData.get("driverId"),
  });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  // Set driver_id + status=claimed atomically, guarded to a currently-paid (unclaimed) row.
  // The 0004 trigger permits the paid->claimed edge; .eq("status","paid") makes a stale/raced
  // assign a 0-row no-op instead of orphaning the transfer.
  const { data, error } = await admin
    .from("wp_transfers")
    .update({ driver_id: parsed.data.driverId, status: "claimed" })
    .eq("id", parsed.data.id)
    .eq("status", "paid")
    .select("id");

  if (error) {
    return { status: "error", message: t.saveFailed };
  }
  // Zero rows updated → the row was not in 'paid' (already claimed/cancelled/completed).
  if (!data || data.length === 0) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// reassign — swap the claiming driver of an ACTIVE claimed transfer; persist the D-10 audit
// reason. Reason required. Guarded .in("status", REASSIGNABLE_STATES) so a paid (unclaimed),
// cancelled, or completed row is never silently re-owned. status is unchanged here, so the
// transition trigger never fires — the .in guard + row-count check are the only protection (CR-03).
// ---------------------------------------------------------------------------
// States in which reassigning the driver is meaningful: a driver is assigned and the trip is
// not yet completed/cancelled. (paid = unclaimed → use assign; completed/cancelled = terminal.)
const REASSIGNABLE_STATES = ["claimed", "en_route", "arrived", "picked_up"];

export async function reassign(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = reassignSchema.safeParse({
    id: formData.get("id"),
    driverId: formData.get("driverId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wp_transfers")
    .update({
      driver_id: parsed.data.driverId,
      last_action_reason: parsed.data.reason,
      last_action_by: await actingAdminId(),
      last_action_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .in("status", REASSIGNABLE_STATES)
    .select("id");

  if (error) {
    return { status: "error", message: t.saveFailed };
  }
  // Zero rows updated → the row was not in an active claimed state (paid/cancelled/completed).
  if (!data || data.length === 0) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// release — the D-14 backward edge. GUARDED to status='claimed' (the .eq("status","claimed")
// optimistic guard, NOT a read-then-write). Writes driver_id=null + status='paid' so the row
// reappears in wp_pool(). This is the ONE narrow gated status='paid' writer (D-15) — sanctioned
// in single-writer.test.ts alongside the webhook. The live 0006 trigger permits claimed->paid.
// Reason required.
// ---------------------------------------------------------------------------
export async function release(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = reasonSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  // .eq("status","claimed") is the concurrency-safe guard (D-14): the row only releases if it
  // is STILL claimed at write time — never an en_route/arrived/etc. row. The 0006 trigger is the
  // hard legality backstop (claimed->paid only).
  const { data, error } = await admin
    .from("wp_transfers")
    .update({
      driver_id: null,
      status: "paid",
      last_action_reason: parsed.data.reason,
      last_action_by: await actingAdminId(),
      last_action_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("status", "claimed")
    .select("id");

  if (error) {
    return { status: "error", message: t.saveFailed };
  }
  // Zero rows updated → the row was not in 'claimed' (already released/advanced/cancelled).
  if (!data || data.length === 0) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// cancel — trigger-legal -> cancelled from a pre-pickup state; persist the audit reason.
// NEVER calls refundPayment (D-11): cancelling does not move money; the admin issues a refund
// separately via the refund action if needed. Reason required.
// ---------------------------------------------------------------------------
export async function cancel(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = reasonSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("wp_transfers")
    .update({
      status: "cancelled",
      last_action_reason: parsed.data.reason,
      last_action_by: await actingAdminId(),
      last_action_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// refund — full (no amount) or partial (amount) manual Stripe refund (OPS-04, D-12). Resolves
// stripe_payment_intent_id + amount_cents from the row, calls the server-only refundPayment hook
// with a STABLE idempotencyKey (Pitfall 3 — a retried/double-clicked refund never double-charges),
// persists the audit reason. NEVER writes status='paid' (a refund is not a payment). Reason required.
// ---------------------------------------------------------------------------
export async function refund(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const parsed = refundSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
    amount: formData.get("amount") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: t.fieldRequired };
  }

  const admin = createAdminClient();

  // Resolve the captured PaymentIntent + the paid amount from the row (the refund target is the
  // server-recorded id, never a client-trusted amount path — T-06-REFUND).
  const { data: row, error: readError } = await admin
    .from("wp_transfers")
    .select("stripe_payment_intent_id, amount_cents")
    .eq("id", parsed.data.id)
    .single();

  if (readError || !row || !row.stripe_payment_intent_id) {
    return { status: "error", message: t.saveFailed };
  }

  // Convert the optional major-euro amount to cents; reject anything over the paid amount.
  const amountCents =
    parsed.data.amount === undefined
      ? undefined
      : Math.round(parsed.data.amount * 100);
  if (amountCents !== undefined && amountCents > row.amount_cents) {
    return { status: "error", message: t.fieldRequired };
  }

  try {
    await refundPayment({
      paymentIntentId: row.stripe_payment_intent_id,
      amountCents,
      // Stable per (transfer, amount) so a retry/double-click is the SAME Stripe request.
      idempotencyKey: `refund:${parsed.data.id}:${amountCents ?? "full"}`,
    });
  } catch {
    return { status: "error", message: t.saveFailed };
  }

  // Record the audit reason ONLY (no status='paid' — a refund is not a payment, D-12).
  const { error: auditError } = await admin
    .from("wp_transfers")
    .update({
      last_action_reason: parsed.data.reason,
      last_action_by: await actingAdminId(),
      last_action_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (auditError) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "success" };
}
