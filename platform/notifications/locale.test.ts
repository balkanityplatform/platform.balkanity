// platform/notifications/locale.test.ts — D-17 guest-email locale resolution.
//
// NYQUIST BASELINE — RED until Plan 02/03 land the templates builder
// (platform/notifications/templates.ts → buildAssignedEmail / buildInviteEmail). The
// runtime-string import type-checks before the impl exists, then THROWS → RED now.
// Resend mocked for safety (D-15).
//
// What this pins (GREEN in Plan 02/03), per D-17:
//   - A guest email built for a transfer with locale='bg' resolves BG copy.
//   - locale=null resolves EN (fallback for rows never set).
//   - admin/invite emails always resolve EN regardless of any locale argument.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));

const EN_ASSIGNED = "EN assigned heading";
const BG_ASSIGNED = "BG assigned heading";
const EN_INVITE = "EN invite heading";

// getDictFor(lang) returns the per-language dict; the template must call it with the
// resolved language (bg for 'bg', en for null/'en') for guest mail, and 'en' for invite.
vi.mock("@/platform/i18n/dictionary", () => ({
  getDictFor: vi.fn((lang: "en" | "bg") => ({
    emailAssignedSubject: "subj",
    emailAssignedHeading: lang === "bg" ? BG_ASSIGNED : EN_ASSIGNED,
    emailAssignedBody: "{driverName} {driverPhone}",
    emailInviteSubject: "subj",
    emailInviteHeading: lang === "bg" ? "BG invite heading" : EN_INVITE,
    emailInviteBody: "body",
    emailInviteCta: "cta",
  })),
}));

type Templates = {
  buildAssignedEmail: (args: {
    locale: string | null;
    guestEmail: string;
    driverName: string;
    driverPhone: string;
  }) => { to: string; subject: string; html: string };
  buildInviteEmail: (args: { to: string; actionLink: string }) => {
    to: string;
    subject: string;
    html: string;
  };
};

async function loadTemplates(): Promise<Templates> {
  const specifier = "@/platform/notifications/templates";
  return (await import(/* @vite-ignore */ specifier)) as unknown as Templates;
}

describe("guest-email locale resolution (D-17)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("locale='bg' resolves BG guest copy", async () => {
    const { buildAssignedEmail } = await loadTemplates();
    const mail = buildAssignedEmail({
      locale: "bg",
      guestEmail: "g@example.com",
      driverName: "Ivan",
      driverPhone: "+359888",
    });
    expect(mail.html).toContain(BG_ASSIGNED);
    expect(mail.html).not.toContain(EN_ASSIGNED);
  });

  it("locale=null resolves EN guest copy (fallback)", async () => {
    const { buildAssignedEmail } = await loadTemplates();
    const mail = buildAssignedEmail({
      locale: null,
      guestEmail: "g@example.com",
      driverName: "Ivan",
      driverPhone: "+359888",
    });
    expect(mail.html).toContain(EN_ASSIGNED);
  });

  it("the invite email always resolves EN (admin/invite are EN-only)", async () => {
    const { buildInviteEmail } = await loadTemplates();
    const mail = buildInviteEmail({
      to: "driver@example.com",
      actionLink: "https://balkanity.example/set-password?x=1",
    });
    expect(mail.html).toContain(EN_INVITE);
  });
});
