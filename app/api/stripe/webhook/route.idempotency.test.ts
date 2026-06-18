// app/api/stripe/webhook/route.idempotency.test.ts — BEHAVIORAL idempotency +
// error-handling contract for the money-authoritative webhook (SC3, BOOK-05; CR-01/CR-02).
//
// route.contract.test.ts proves the SOURCE shape (nodejs runtime, req.text(), constructEvent).
// This suite proves the RUNTIME behavior the source-grep gate cannot:
//   - A duplicate event_id (Postgres 23505 on the insert-first webhook_events write) →
//     short-circuit 200 {duplicate:true} with EXACTLY ONE effect — wp_transfers is NEVER
//     touched on the replay (SC3, the replay authority that was previously only coincidental).
//   - A TRANSIENT insert error (code !== 23505) → HTTP 500 so Stripe RETRIES; the event is
//     NOT silently dropped, and wp_transfers is NOT touched.
//   - A TRANSIENT error on the paid UPDATE → HTTP 500 (Stripe retries) and the audit row is
//     marked outcome=write_failed, NOT no_matching_transfer — so a charged customer is never
//     silently left unpaid (CR-01).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A verified Stripe event the mocked constructEvent returns. The route trusts this only
// AFTER constructEvent succeeds; here we mock that success so we can exercise the DB paths.
const EVENT = {
  id: "evt_replay_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      metadata: { transfer_id: "11111111-1111-1111-1111-111111111111" },
      payment_intent: "pi_1",
    },
  },
};

const constructEvent = vi.fn(() => EVENT);
const piRetrieve = vi.fn(async () => ({ id: "pi_1" }));
vi.mock("@/platform/payments/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    paymentIntents: { retrieve: piRetrieve },
  }),
}));
vi.mock("@/platform/payments/fee", () => ({ recordedFeeCents: () => 25 }));

// Track every (table, op) the route performs so we can assert wp_transfers is untouched
// on a replay, and inspect the audit outcome written on a failed paid write.
type Ops = { table: string; op: string; payload?: Record<string, unknown> };
let ops: Ops[];

// Per-test knobs for what the mocked Supabase calls return.
let insertResult: { data: unknown; error: unknown };
let paidResult: { data: unknown; error: unknown };

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const b = {
        _op: "select" as string,
        insert(payload: Record<string, unknown>) {
          this._op = "insert";
          ops.push({ table, op: "insert", payload });
          return this;
        },
        update(payload: Record<string, unknown>) {
          this._op = "update";
          ops.push({ table, op: "update", payload });
          return this;
        },
        select() {
          return this;
        },
        eq() {
          return this;
        },
        neq() {
          return this;
        },
        maybeSingle() {
          // insert-first webhook_events read
          return Promise.resolve(insertResult);
        },
        // Awaiting the builder directly (the update chains) resolves here.
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          const res =
            table === "wp_transfers" ? paidResult : { data: null, error: null };
          return Promise.resolve(res).then(resolve, reject);
        },
      };
      return b;
    },
  }),
}));

function postReq() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=valid", "content-type": "application/json" },
    body: JSON.stringify(EVENT),
  });
}

describe("Stripe webhook idempotency + error handling (SC3, CR-01/CR-02)", () => {
  beforeEach(() => {
    ops = [];
    constructEvent.mockClear();
    insertResult = { data: { event_id: EVENT.id }, error: null };
    paidResult = { data: [{ id: "11111111-1111-1111-1111-111111111111" }], error: null };
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });
  afterEach(() => vi.resetModules());

  it("first delivery: records the event and flips the transfer to paid exactly once", async () => {
    const { POST } = await import("./route");
    const res = await POST(postReq() as never);
    expect(res.status).toBe(200);
    const wpUpdates = ops.filter((o) => o.table === "wp_transfers" && o.op === "update");
    expect(wpUpdates).toHaveLength(1);
    expect(wpUpdates[0].payload).toMatchObject({ status: "paid" });
  });

  it("replay (duplicate event_id, 23505): short-circuits 200 and NEVER touches wp_transfers (SC3)", async () => {
    insertResult = { data: null, error: { code: "23505", message: "duplicate key" } };
    const { POST } = await import("./route");
    const res = await POST(postReq() as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ duplicate: true });
    // The single load-bearing assertion: a replay produces ZERO wp_transfers writes.
    expect(ops.filter((o) => o.table === "wp_transfers")).toHaveLength(0);
  });

  it("transient audit-insert error (not 23505): returns 500 so Stripe retries, no paid write (CR-01)", async () => {
    insertResult = { data: null, error: { code: "57014", message: "statement timeout" } };
    const { POST } = await import("./route");
    const res = await POST(postReq() as never);
    expect(res.status).toBe(500);
    expect(ops.filter((o) => o.table === "wp_transfers")).toHaveLength(0);
  });

  it("transient paid-write error: returns 500 and marks audit outcome=write_failed (CR-01)", async () => {
    paidResult = { data: null, error: { code: "57014", message: "statement timeout" } };
    const { POST } = await import("./route");
    const res = await POST(postReq() as never);
    expect(res.status).toBe(500);
    const auditUpdate = ops.find(
      (o) => o.table === "webhook_events" && o.op === "update",
    );
    expect(auditUpdate?.payload).toMatchObject({ outcome: "write_failed" });
  });
});
