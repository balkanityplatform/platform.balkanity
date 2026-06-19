// app/api/stripe/webhook/route.ts — the MONEY-AUTHORITATIVE path (BOOK-05, HLTH-01).
//
// This is the ONLY code path anywhere in the repo that writes `wp_transfers.status =
// 'paid'` (enforced by platform/payments/single-writer.test.ts). It is the trust spine:
// every euro recorded as paid passed through the HMAC-verified Stripe signature here.
//
// Hard invariants (CLAUDE.md "What NOT to Use" + Pitfalls 1/3; adversarially verified
// in Plan 05). DO NOT relax any of these:
//
//   1. `export const runtime = "nodejs"` — NEVER Edge. The Edge runtime mangles
//      raw-body + crypto handling and silently breaks signature verification.
//   2. The first body read is `await req.text()` (RAW bytes) — NEVER `req.json()`.
//      `.json()` re-encodes the payload and breaks `stripe.webhooks.constructEvent`.
//   3. The payload is UNTRUSTED until `constructEvent` succeeds (V5). A missing
//      `stripe-signature` header or a `constructEvent` throw (forged/unsigned) returns
//      400 with ZERO state change.
//   4. Idempotency is insert-first: every verified event is recorded in `webhook_events`
//      keyed on UNIQUE `event_id` BEFORE any `paid` effect is applied. A replayed
//      `event.id` collides on the UNIQUE index → no second effect (SC3).
//   5. ALL DB writes use the SERVICE-ROLE client (createAdminClient), which bypasses
//      RLS. The webhook authenticates the SENDER via HMAC, not a user session — the
//      @supabase/ssr server client (cookie/JWT) is NEVER used here.
//   6. The actual Stripe fee (recordedFeeCents, read from the expanded balance
//      transaction — the recorded truth D-05) is persisted on the paid transition.
import { type NextRequest, NextResponse } from "next/server";
import { getDictFor } from "@/platform/i18n/dictionary";
import { sendEmail } from "@/platform/notifications/send-email";
import { buildAdminBookingEmail } from "@/platform/notifications/templates";
import { insertNotification } from "@/platform/notifications/notify";
import { recordedFeeCents } from "@/platform/payments/fee";
import { getStripe } from "@/platform/payments/stripe";
import { createAdminClient } from "@/platform/supabase/admin";
import { sendBookingConfirmation } from "@/platform/transfers/confirmation-email";

// CONTEXT D-02 lock — Node runtime ONLY. Raw-body + crypto are fragile on Edge.
export const runtime = "nodejs";

// JSON response helper. We deliberately build responses via the NextResponse
// constructor + JSON.stringify rather than the framework's response-dot-json helper
// so the source contains ZERO occurrences of the `.json(` token — the contract
// (route.contract.test.ts) forbids it outright to guarantee the request body is never
// parsed with `req.json()` (which would re-encode the bytes and break the HMAC verify).
function jsonResponse(payload: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  // INVARIANT 2: RAW bytes — never req.json() (re-encoding breaks the HMAC check).
  const body = await req.text();

  // INVARIANT 3: a missing signature header is rejected before any state change.
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return jsonResponse({ error: "missing signature" }, 400);
  }

  // INVARIANT 3: verify the HMAC signature against the RAW body. A forged/unsigned
  // request throws here → 400 with ZERO state change (nothing below runs).
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return jsonResponse({ error: "invalid signature" }, 400);
  }

  // INVARIANT 5: service-role client for every write below (bypasses RLS; the tables
  // carry admin-read SELECT only and NO write policy — migration 0003).
  const admin = createAdminClient();

  // INVARIANT 4: insert-first idempotency. Record the verified event BEFORE applying
  // any effect. The UNIQUE webhook_events.event_id index is the race-safe replay
  // authority — a replayed event.id violates it (Postgres 23505). We branch EXPLICITLY
  // on that error code so a genuine replay (→ 200 short-circuit, exactly one effect, SC3)
  // is never confused with a transient failure (→ 5xx so Stripe RETRIES; CR-01/CR-02).
  const { data: inserted, error: insertErr } = await admin
    .from("webhook_events")
    .insert({
      event_id: event.id,
      type: event.type,
      signature_result: "valid",
      outcome: "received",
      payload: event as unknown as Record<string, unknown>,
    })
    .select("event_id")
    .maybeSingle();

  if (insertErr) {
    // 23505 = duplicate event_id → genuine replay; short-circuit with exactly one effect (SC3).
    if (insertErr.code === "23505") {
      return jsonResponse({ received: true, duplicate: true });
    }
    // Any other error is transient (connection drop, statement timeout, project cold-start).
    // Return 5xx WITHOUT applying any effect so Stripe retries the verified event (CR-01).
    return jsonResponse({ error: "audit insert failed" }, 500);
  }

  if (!inserted) {
    // Defensive: no error but also no row (should not happen for a successful insert).
    // Treat as a transient anomaly and let Stripe retry rather than silently dropping.
    return jsonResponse({ error: "audit insert returned no row" }, 500);
  }

  // The ONLY money-bearing event we act on. Everything else is recorded-and-ignored.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { transfer_id?: string | null } | null;
      payment_intent?: string | { id?: string } | null;
    };

    const transferId = session.metadata?.transfer_id ?? null;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    if (!transferId) {
      // Pitfall 6: an unresolvable transfer is logged, NOT 500'd — Phase 8
      // reconciliation flags it. The verified event is already audited above.
      await admin
        .from("webhook_events")
        .update({ outcome: "no_matching_transfer" })
        .eq("event_id", event.id);
      return jsonResponse({ received: true });
    }

    // The RECORDED fee (D-05) is the actual fee Stripe charged, read VERBATIM from the
    // expanded latest_charge.balance_transaction. Retrieve the expanded PaymentIntent,
    // then narrow via recordedFeeCents (returns null when not yet available → Phase 8
    // backfills; Pitfall 5). No fee retrieval when there is no payment_intent.
    let feeCents: number | null = null;
    if (paymentIntentId) {
      try {
        const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge.balance_transaction"],
        });
        feeCents = recordedFeeCents(pi);
      } catch {
        // Fee unavailable at capture time → leave null; reconciliation backfills.
        feeCents = null;
      }
    }

    // INVARIANT 1 (the single-writer gate): the ONLY `status: "paid"` write in the repo.
    // `.neq("status", "paid")` is the idempotency backstop on top of the insert-first
    // dedup — even a duplicate that somehow reached here cannot re-stamp paid_at.
    const { data: paidRows, error: paidErr } = await admin
      .from("wp_transfers")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        fee_cents: feeCents,
      })
      .eq("id", transferId)
      .neq("status", "paid")
      .select("id, guest_email");

    if (paidErr) {
      // CR-01: a transient failure on the money-bearing write must NOT be mistaken for
      // "no matching transfer". Record outcome=write_failed (distinct from the absent-row
      // case so reconciliation can tell them apart) and return 5xx so Stripe RETRIES —
      // a charged customer is never silently left unpaid.
      await admin
        .from("webhook_events")
        .update({ outcome: "write_failed" })
        .eq("event_id", event.id);
      return jsonResponse({ error: "paid write failed" }, 500);
    }

    if (!paidRows || paidRows.length === 0) {
      // No row matched the transfer id (absent, or already paid) → audit and 200.
      // An absent id is reconciliation's concern (Pitfall 6), not a 500.
      await admin
        .from("webhook_events")
        .update({ outcome: "no_matching_transfer" })
        .eq("event_id", event.id);
      return jsonResponse({ received: true });
    }

    await admin
      .from("webhook_events")
      .update({ outcome: "processed" })
      .eq("event_id", event.id);

    // BOOK-06: fire the booking-confirmation magic link off the verified `paid`
    // transition (the send is STUBBED/logged in Phase 4; Phase 7 wires Resend).
    // This is NOT a second `paid` writer — it performs no transfer write. It is
    // wrapped in log-and-continue so a failed/missing send NEVER changes the HTTP
    // status of the money-bearing write above (reconciliation / Phase 7 resend the
    // confirmation; a charged guest is never lost to an email failure).
    const guestEmail = paidRows[0]?.guest_email ?? null;
    if (guestEmail) {
      try {
        await sendBookingConfirmation(transferId, guestEmail);
      } catch (err) {
        console.error("[BOOK-06] confirmation send failed (continuing)", err);
      }
    }

    // NOTF-03 paid fan-out — three INDEPENDENT log-and-continue blocks hanging off the
    // verified `paid` transition. NONE is a second `paid` writer (each writes ZERO
    // wp_transfers rows — single-writer.test.ts stays green) and NONE may change the HTTP
    // status of the money-bearing write above. Each catch logs the error OBJECT ONLY,
    // never the recipient address / PII (threat T-07-FO5), and continues.

    // Resolve admin recipient(s) once (Open Q2 — the forward-compatible app_users query
    // over a single ADMIN_ALERT_EMAIL env). A failure here is swallowed so the driver
    // pool fan-out below still runs.
    let admins: { id: string; email: string | null }[] = [];
    try {
      const { data } = await admin
        .from("app_users")
        .select("id, email")
        .eq("role", "admin");
      admins = (data ?? []) as { id: string; email: string | null }[];
    } catch (err) {
      console.error("[NOTF-03] admin recipient resolution failed (continuing)", err);
    }

    // 1) Admin booking-alert email (best_effort, D-09) — soft-cap eligible (the in-app
    //    notification below carries the same signal for free). EN-only, no guest/driver PII.
    for (const a of admins) {
      if (!a.email) continue;
      try {
        const { subject, html } = buildAdminBookingEmail({ to: a.email });
        await sendEmail({
          to: a.email,
          subject,
          html,
          tier: "best_effort",
          idempotencyKey: `admin-alert:${transferId}`,
        });
      } catch (err) {
        console.error("[NOTF-03] admin alert send failed (continuing)", err);
      }
    }

    // 2) Admin `new_paid_booking` in-app notification (D-03) — the title is the
    //    pre-rendered EN dictionary copy (the row stores the title string, not a key).
    const adminTitle = getDictFor("en").notifNewBookingTitle;
    for (const a of admins) {
      try {
        await insertNotification({
          recipientId: a.id,
          type: "new_paid_booking",
          entityType: "transfer",
          entityId: transferId,
          title: adminTitle,
        });
      } catch (err) {
        console.error("[NOTF-03] admin notification failed (continuing)", err);
      }
    }

    // 3) Driver `new_paid_pool` in-app notifications to ALL drivers (D-02) — a new paid
    //    transfer entered the claimable pool. These are DB inserts, NOT Resend calls, so
    //    they never count against the email cap (Pitfall 3). Title is pre-rendered EN copy.
    try {
      const { data: drivers } = await admin
        .from("app_users")
        .select("id")
        .eq("role", "driver");
      const poolTitle = getDictFor("en").notifNewPoolTitle;
      for (const d of (drivers ?? []) as { id: string }[]) {
        await insertNotification({
          recipientId: d.id,
          type: "new_paid_pool",
          entityType: "transfer",
          entityId: transferId,
          title: poolTitle,
        });
      }
    } catch (err) {
      console.error("[NOTF-03] driver pool fan-out failed (continuing)", err);
    }
  }

  return jsonResponse({ received: true });
}
