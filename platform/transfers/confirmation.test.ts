// platform/transfers/confirmation.test.ts — confirmation magic-link stub (BOOK-06).
//
// NYQUIST BASELINE — RED until Plan 04 lands the confirmation builder
// (platform/transfers/confirmation-email.ts). The dynamic import below resolves a
// runtime-string specifier so this file type-checks BEFORE the implementation exists,
// then THROWS at runtime → this suite is RED now. Do NOT create the module here.
//
// What this pins (turned GREEN in Plan 04):
//   1. The confirmation builder generates the guest status-page magic link via
//      auth.admin.generateLink({type:'magiclink'}) — mirroring 02-05's driver invite —
//      and the link routes through the EXISTING /auth/confirm flow to /status/<id>:
//      it must contain `/auth/confirm?type=magiclink&next=/status/<transferId>` (AUTH-02).
//   2. THE CONFIRMATION PATH IS NOT A SECOND `paid` WRITER (CLAUDE.md money lock,
//      single-writer gate). The builder's source file must contain NO `status: 'paid'`
//      write — the email hangs off the EXISTING webhook `paid` transition. We grep the
//      target module source (comment-stripped) the way single-writer.test.ts does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TRANSFER_ID = "33333333-3333-3333-3333-333333333333";
const GUEST_EMAIL = "guest@example.com";
const FIXTURE_ACTION_LINK =
  "https://balkanity.example/auth/confirm?token_hash=abc123&type=magiclink&next=/status/" +
  TRANSFER_ID;

// auth.admin.generateLink returns the fixture action_link (the magic-link properties).
const generateLink = vi.fn();
vi.mock("@/platform/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { generateLink } },
  })),
}));

vi.mock("@/platform/i18n/dictionary", () => ({
  getDict: vi.fn(async () => ({
    confirmEmailSubject: "SUBJECT",
    confirmEmailHeading: "HEADING",
    confirmEmailBody: "BODY",
    confirmEmailCta: "CTA",
    confirmEmailFooter: "FOOTER",
  })),
}));

// Dynamic, runtime-string import so tsc stays clean before the impl file exists.
type SendBookingConfirmation = (
  transferId: string,
  guestEmail: string,
) => Promise<{ magicLink: string }>;

async function loadSendConfirmation(): Promise<SendBookingConfirmation> {
  const specifier = "@/platform/transfers/confirmation-email";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    sendBookingConfirmation: SendBookingConfirmation;
  };
  return mod.sendBookingConfirmation;
}

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

// Strip JS/TS comments so header prose can't self-satisfy or break the paid-writer grep.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("sendBookingConfirmation (BOOK-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://balkanity.example";
    generateLink.mockResolvedValue({
      data: { properties: { action_link: FIXTURE_ACTION_LINK } },
      error: null,
    });
  });

  afterAll(() => {
    if (ORIGINAL_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  });

  it("builds a magiclink routed to /status/<id> via /auth/confirm (AUTH-02)", async () => {
    const sendBookingConfirmation = await loadSendConfirmation();

    const result = await sendBookingConfirmation(TRANSFER_ID, GUEST_EMAIL);

    // generateLink is the magic-link path bound to the guest email (mirrors 02-05).
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "magiclink", email: GUEST_EMAIL }),
    );

    // The returned link carries the guest through the existing /auth/confirm route to
    // their own status page — the next param is the per-transfer status path.
    expect(result.magicLink).toContain(
      `/auth/confirm?type=magiclink&next=/status/${TRANSFER_ID}`,
    );
  });

  it("the confirmation module writes NO status:'paid' (single-writer money lock, BOOK-06)", () => {
    // Read the TARGET impl source directly (it does not exist yet → RED). When Plan 04
    // lands it, this asserts the email path never becomes a second paid writer.
    const target = join(
      process.cwd(),
      "platform/transfers/confirmation-email.ts",
    );
    const src = stripComments(readFileSync(target, "utf8"));
    expect(src).not.toMatch(/status\s*:\s*['"`]paid['"`]/);
  });
});
