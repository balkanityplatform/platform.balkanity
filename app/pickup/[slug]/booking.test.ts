// app/pickup/[slug]/booking.test.ts — booking server-action contract (BOOK-02 / BOOK-03).
//
// NYQUIST BASELINE — RED until Plan 03 lands the createBooking server action
// (app/pickup/[slug]/actions.ts). The dynamic import below resolves a runtime-string
// specifier so this file type-checks BEFORE the implementation exists, then THROWS at
// runtime → this suite is RED now. That is the expected baseline; do NOT create the
// action here to make it green.
//
// The two load-bearing guarantees this pins (turned GREEN in Plan 03):
//   1. SERVER-TRUSTED AMOUNT (Pitfall 5 / CLAUDE.md money lock): a valid submit must
//      re-read `destinations.price_cents` server-side and insert it as the transfer's
//      `amount_cents` — the amount is NEVER taken from FormData. createCheckoutSession
//      is then called exactly once with that server-sourced amount.
//   2. VALIDATION BOUNDARY (BOOK-02): a submit missing any required field
//      (email/phone/name/pax/flight_no/arrival_date/arrival_time) returns
//      { status:'error' } and NEVER calls createCheckoutSession (no row, no payment).
//
// Mocks mirror the established drivers/invite.test.ts style: rewire the admin from-chain
// + the checkout helper per test.
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- createCheckoutSession (the code-created Stripe Checkout helper, Plan 03) ---
const createCheckoutSession = vi.fn(
  async (_input: { transferId: string; amountCents: number }) => ({
    id: "cs_test_booking",
    url: "https://checkout.stripe.com/c/pay/cs_test_booking",
  }),
);
vi.mock("@/platform/payments/checkout", () => ({ createCheckoutSession }));

// --- service-role admin client: destinations read + wp_transfers insert ---
// destinations.select(...).eq("slug", …).eq("active", true).maybeSingle() returns the
// row whose price_cents is the ONLY trusted amount source.
const destinationMaybeSingle = vi.fn();
const transfersInsert = vi.fn();

// A chainable thenable stub so the action can fluently filter the destinations read
// regardless of the exact .eq()/.select() ordering it chooses.
function destinationQuery() {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "match", "limit", "order"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = destinationMaybeSingle;
  chain.single = destinationMaybeSingle;
  return chain;
}

const from = vi.fn((table: string) => {
  if (table === "destinations") return destinationQuery();
  if (table === "wp_transfers") return { insert: transfersInsert };
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from })),
}));

// Real-ish dictionary — only the keys the action surfaces need stable strings.
vi.mock("@/platform/i18n/dictionary", () => ({
  getDict: vi.fn(async () => ({
    bookingFieldRequired: "FIELD_REQUIRED",
    bookingInvalidEmail: "INVALID_EMAIL",
    bookingInvalidPhone: "INVALID_PHONE",
    bookingFailed: "BOOKING_FAILED",
  })),
  // D-17: createBooking now also captures the booking language via getLang()
  // to persist wp_transfers.locale. Stub it so the action runs in the test env.
  getLang: vi.fn(async () => "en"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The action 303-redirects to Stripe on success; redirect throws by contract in Next.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

// Dynamic, runtime-string import so tsc stays clean before the impl file exists.
type CreateBooking = (
  prev: unknown,
  formData: FormData,
) => Promise<{ status: string; message?: string }>;

async function loadCreateBooking(): Promise<CreateBooking> {
  const specifier = "@/app/pickup/[slug]/actions";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    createBooking: CreateBooking;
  };
  return mod.createBooking;
}

const VALID_FIELDS: Record<string, string> = {
  slug: "sofia-center",
  name: "Ivan Petrov",
  email: "ivan@example.com",
  phone: "+359888123456",
  flight_no: "FB123",
  arrival_date: "2030-01-01",
  arrival_time: "14:30",
  pax: "2",
  ack: "on",
};

function formWith(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("createBooking server action (BOOK-02 / BOOK-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The trusted destination read returns price_cents = 4500 (€45.00).
    destinationMaybeSingle.mockResolvedValue({
      data: { id: "dest-1", price_cents: 4500, active: true },
      error: null,
    });
    // Insert returns the new transfer id the checkout session is bound to.
    transfersInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: "transfer-1" },
          error: null,
        })),
      })),
    });
  });

  for (const missing of [
    "email",
    "phone",
    "name",
    "pax",
    "flight_no",
    "arrival_date",
    "arrival_time",
  ]) {
    it(`rejects a submit missing '${missing}' and never calls createCheckoutSession (BOOK-02)`, async () => {
      const createBooking = await loadCreateBooking();
      const fields = { ...VALID_FIELDS };
      delete fields[missing];

      const result = await createBooking({ status: "idle" }, formWith(fields));

      expect(result.status).toBe("error");
      expect(createCheckoutSession).not.toHaveBeenCalled();
    });
  }

  it("re-reads price_cents server-side and inserts a 'requested' row with that amount, then calls checkout once (BOOK-03, Pitfall 5)", async () => {
    const createBooking = await loadCreateBooking();

    // A tampered FormData amount must be IGNORED — the server uses destinations.price_cents.
    const result = await createBooking(
      { status: "idle" },
      formWith({ ...VALID_FIELDS, amount_cents: "1", price_cents: "1" }),
    ).catch((e: Error) => e); // success 303-redirects (throws NEXT_REDIRECT)

    // The inserted row is status:'requested' carrying the SERVER-sourced amount (4500),
    // never the 1-cent value the client tried to smuggle in.
    expect(transfersInsert).toHaveBeenCalledTimes(1);
    const inserted = transfersInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.status).toBe("requested");
    expect(inserted.amount_cents).toBe(4500);

    // Checkout is called exactly once with the server-sourced amount + the new transfer id.
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ transferId: "transfer-1", amountCents: 4500 }),
    );

    // Either a redirect (thrown) or an explicit ok state — never an error on the happy path.
    if (result instanceof Error) {
      expect(result.message).toContain("NEXT_REDIRECT");
    } else {
      expect((result as { status: string }).status).not.toBe("error");
    }
  });
});
