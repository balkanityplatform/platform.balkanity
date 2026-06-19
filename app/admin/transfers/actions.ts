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
import { getDict, getDictFor } from "@/platform/i18n/dictionary";
import { sendEmail } from "@/platform/notifications/send-email";
import { buildAssignedEmail } from "@/platform/notifications/templates";
import { insertNotification } from "@/platform/notifications/notify";
import { refundPayment } from "@/platform/payments/refund";
import { createAdminClient } from "@/platform/supabase/admin";
import { createClient } from "@/platform/supabase/server";

// First token of a display name — the guest "driver assigned" email carries the driver
// FIRST name + phone only (D-16), mirroring app/driver/actions.ts firstName().
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Pre-rendered EN notification titles (the notifications row stores the title STRING,
// not a key — research Pattern 1). Resolved once via the cookie-free accessor.
const notif = () => getDictFor("en");

// Fan-out a driver run-notification — log-and-continue (a notify failure NEVER rolls back
// the lifecycle write). title is the pre-rendered EN dictionary copy.
async function notifyDriver(
  driverId: string,
  type: string,
  title: string,
  transferId: string,
): Promise<void> {
  try {
    await insertNotification({
      recipientId: driverId,
      type,
      entityType: "transfer",
      entityId: transferId,
      title,
    });
  } catch (err) {
    console.error(`[NOTF] ${type} notification failed (continuing)`, err);
  }
}

// Send the guest "driver assigned" email (name+phone of the assigned driver, D-16) —
// the SAME builder as claimAction. `to:` is ALWAYS the row's guest_email (Pitfall 5).
// Narrow service-role read of {name,phone} + {guest_email,locale}. Log-and-continue.
async function sendAssignedEmail(
  admin: ReturnType<typeof createAdminClient>,
  transferId: string,
  driverId: string,
): Promise<void> {
  try {
    const { data: transferRow } = await admin
      .from("wp_transfers")
      .select("guest_email, locale")
      .eq("id", transferId)
      .maybeSingle();
    const tr = transferRow as {
      guest_email?: string | null;
      locale?: string | null;
    } | null;
    const guestEmail = tr?.guest_email ?? null;
    if (!guestEmail) return;

    const { data: profile } = await admin
      .from("driver_profiles")
      .select("name, phone")
      .eq("user_id", driverId)
      .maybeSingle();
    const p = profile as { name?: string | null; phone?: string | null } | null;
    if (!p?.name) return;

    const { subject, html } = buildAssignedEmail({
      locale: tr?.locale ?? null,
      guestEmail,
      driverName: firstName(p.name),
      driverPhone: p.phone ?? "",
    });
    await sendEmail({
      to: guestEmail,
      subject,
      html,
      tier: "best_effort",
      idempotencyKey: `assigned:${transferId}`,
    });
  } catch (err) {
    console.error("[NOTF-02] admin assigned email failed (continuing)", err);
  }
}

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

  // NOTF-02/03 assign fan-out (log-and-continue — never rolls back the write above):
  // guest "driver assigned" email (name+phone, to=guest_email) + assigned driver
  // run_assigned in-app notification.
  await sendAssignedEmail(admin, parsed.data.id, parsed.data.driverId);
  await notifyDriver(
    parsed.data.driverId,
    "run_assigned",
    notif().notifRunAssignedTitle,
    parsed.data.id,
  );

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

  // Capture the previously-claiming driver BEFORE the swap so we can notify them too
  // (run_reassigned) if it differs from the newly-assigned driver. Best-effort read.
  let previousDriverId: string | null = null;
  try {
    const { data: prior } = await admin
      .from("wp_transfers")
      .select("driver_id")
      .eq("id", parsed.data.id)
      .maybeSingle();
    previousDriverId = (prior as { driver_id?: string | null } | null)?.driver_id ?? null;
  } catch {
    previousDriverId = null;
  }

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

  // NOTF-03 reassign fan-out (log-and-continue): notify the newly-assigned driver, and
  // the previously-claiming driver too if it differs.
  const reassignedTitle = notif().notifRunReassignedTitle;
  await notifyDriver(
    parsed.data.driverId,
    "run_reassigned",
    reassignedTitle,
    parsed.data.id,
  );
  if (previousDriverId && previousDriverId !== parsed.data.driverId) {
    await notifyDriver(
      previousDriverId,
      "run_reassigned",
      reassignedTitle,
      parsed.data.id,
    );
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

  // Capture the releasing driver BEFORE the write so we can notify them (run_released).
  let releasedDriverId: string | null = null;
  try {
    const { data: prior } = await admin
      .from("wp_transfers")
      .select("driver_id")
      .eq("id", parsed.data.id)
      .maybeSingle();
    releasedDriverId = (prior as { driver_id?: string | null } | null)?.driver_id ?? null;
  } catch {
    releasedDriverId = null;
  }

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

  // NOTF-03 release fan-out (log-and-continue): notify the previously-claiming driver
  // (run_released), and re-announce to ALL drivers that the row re-entered the claimable
  // pool (new_paid_pool — these are DB inserts, never cap-counted Resend calls).
  if (releasedDriverId) {
    await notifyDriver(
      releasedDriverId,
      "run_released",
      notif().notifRunReleasedTitle,
      parsed.data.id,
    );
  }
  try {
    const { data: drivers } = await admin
      .from("app_users")
      .select("id")
      .eq("role", "driver");
    const poolTitle = notif().notifNewPoolTitle;
    for (const d of (drivers ?? []) as { id: string }[]) {
      await notifyDriver(d.id, "new_paid_pool", poolTitle, parsed.data.id);
    }
  } catch (err) {
    console.error("[NOTF-03] release pool re-announce failed (continuing)", err);
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

  // Capture the assigned driver (if any) BEFORE the write so we can notify them on cancel.
  let cancelledDriverId: string | null = null;
  try {
    const { data: prior } = await admin
      .from("wp_transfers")
      .select("driver_id")
      .eq("id", parsed.data.id)
      .maybeSingle();
    cancelledDriverId = (prior as { driver_id?: string | null } | null)?.driver_id ?? null;
  } catch {
    cancelledDriverId = null;
  }

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

  // NOTF-03 cancel fan-out (log-and-continue): if the row HAD a driver, notify them
  // (run_cancelled). An unclaimed (paid) row had no driver — nothing to notify.
  if (cancelledDriverId) {
    await notifyDriver(
      cancelledDriverId,
      "run_cancelled",
      notif().notifRunCancelledTitle,
      parsed.data.id,
    );
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
