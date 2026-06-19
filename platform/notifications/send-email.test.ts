// platform/notifications/send-email.test.ts — sendEmail cap/idempotency gate (NOTF-06).
//
// NYQUIST BASELINE — RED until Plan 02 lands the sendEmail wrapper
// (platform/notifications/send-email.ts). The dynamic runtime-string import below
// type-checks BEFORE the implementation exists, then THROWS at runtime → this suite
// is RED now. Do NOT create the module here.
//
// Resend is ALWAYS MOCKED (D-15 caveat — CI/local never depend on a live send).
//
// What this pins (turned GREEN in Plan 02), per 07-RESEARCH Pattern 3:
//   1. A `best_effort` send at email_log daily count >= SOFT_CAP returns `skipped_cap`
//      and does NOT call resend.emails.send (the cap protects the Resend 100/day cap).
//   2. A `critical` send above the cap STILL calls resend.emails.send (critical always sends).
//   3. A second call with the same idempotency_key after a prior `sent` returns `duplicate`
//      and does NOT re-send (webhook-retry safety, D-12).
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Resend mock (the ONLY resend client in the test; never a live send) ---
const emailsSend = vi.fn(async () => ({ data: { id: "re_mock" }, error: null }));
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: emailsSend } })),
}));

// --- service-role admin client mock: a from()-chain over email_log ---
// We model the two reads sendEmail performs (idempotency maybeSingle + daily count head)
// plus the outcome insert. The per-test fixtures below tune existingOutcome + dailyCount.
let existingOutcome: string | null = null; // prior email_log row for the idempotency key
let dailyCount = 0; // today's 'sent' count for the soft cap
const insertSpy = vi.fn(async () => ({ data: null, error: null }));

function makeEmailLogQuery() {
  // chainable stub: .select(...).eq(...).maybeSingle() and .select(_, {head}).gte().eq()
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.head) {
      // daily-count head query path
      return {
        gte: vi.fn(() => ({
          eq: vi.fn(async () => ({ count: dailyCount, error: null })),
        })),
      };
    }
    // idempotency lookup path
    return {
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: existingOutcome ? { id: "row", outcome: existingOutcome } : null,
          error: null,
        })),
      })),
    };
  });
  chain.insert = insertSpy;
  return chain;
}

vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "email_log") return makeEmailLogQuery();
      return { select: vi.fn(), insert: vi.fn() };
    }),
  })),
}));

type SendEmail = (opts: {
  to: string;
  subject: string;
  html: string;
  tier: "critical" | "best_effort";
  idempotencyKey: string;
}) => Promise<{ outcome: "sent" | "skipped_cap" | "duplicate" | "failed" }>;

async function loadSendEmail(): Promise<SendEmail> {
  const specifier = "@/platform/notifications/send-email";
  const mod = (await import(/* @vite-ignore */ specifier)) as { sendEmail: SendEmail };
  return mod.sendEmail;
}

const BASE = {
  to: "guest@example.com",
  subject: "S",
  html: "<p>H</p>",
  idempotencyKey: "confirm:abc",
} as const;

describe("sendEmail cap + idempotency (NOTF-06, Resend mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingOutcome = null;
    dailyCount = 0;
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_SOFT_CAP = "90";
  });

  it("best_effort at/over the soft cap returns skipped_cap and does NOT send", async () => {
    const sendEmail = await loadSendEmail();
    dailyCount = 90; // >= SOFT_CAP
    const res = await sendEmail({ ...BASE, tier: "best_effort" });
    expect(res.outcome).toBe("skipped_cap");
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it("critical over the soft cap STILL calls resend.emails.send", async () => {
    const sendEmail = await loadSendEmail();
    dailyCount = 999; // far over the cap
    const res = await sendEmail({ ...BASE, tier: "critical" });
    expect(res.outcome).toBe("sent");
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it("a repeat of an already-sent idempotency key returns duplicate, no re-send", async () => {
    const sendEmail = await loadSendEmail();
    existingOutcome = "sent"; // prior terminal 'sent' for this key
    const res = await sendEmail({ ...BASE, tier: "critical" });
    expect(res.outcome).toBe("duplicate");
    expect(emailsSend).not.toHaveBeenCalled();
  });
});
