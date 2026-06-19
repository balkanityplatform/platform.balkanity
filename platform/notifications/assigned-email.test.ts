// platform/notifications/assigned-email.test.ts — guest "driver assigned" email (NOTF-02/D-16).
//
// NYQUIST BASELINE — RED until Plan 02 lands the templates builder
// (platform/notifications/templates.ts → buildAssignedEmail). The runtime-string import
// type-checks before the impl exists, then THROWS → RED now. Resend is not even reached
// here (this pins the TEMPLATE shape), but the suite mocks it for safety per D-15.
//
// What this pins (GREEN in Plan 02), per UI-SPEC §Email Layout Contract + D-16:
//   - The "driver assigned" email body contains the driver FIRST NAME and PHONE tokens
//     (the ONLY email carrying driver name + phone).
//   - `to` is the transfer's guest_email — NEVER a driver/admin address (Pitfall 5).
import { beforeEach, describe, expect, it, vi } from "vitest";

// Resend mocked for safety (D-15) even though the template builder shouldn't send.
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));

vi.mock("@/platform/i18n/dictionary", () => ({
  getDictFor: vi.fn(() => ({
    emailAssignedSubject: "Your driver is assigned",
    emailAssignedHeading: "Your driver is on the way",
    emailAssignedBody:
      "Your driver {driverName} ({driverPhone}) has been assigned to your airport transfer.",
  })),
}));

const GUEST_EMAIL = "guest@example.com";
const DRIVER_NAME = "Ivan";
const DRIVER_PHONE = "+359888123456";

type BuildAssignedEmail = (args: {
  locale: string | null;
  guestEmail: string;
  driverName: string;
  driverPhone: string;
}) => { to: string; subject: string; html: string };

async function loadBuildAssigned(): Promise<BuildAssignedEmail> {
  const specifier = "@/platform/notifications/templates";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    buildAssignedEmail: BuildAssignedEmail;
  };
  return mod.buildAssignedEmail;
}

describe("buildAssignedEmail (NOTF-02 / D-16)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("body contains the driver first name AND phone tokens", async () => {
    const buildAssignedEmail = await loadBuildAssigned();
    const mail = buildAssignedEmail({
      locale: "en",
      guestEmail: GUEST_EMAIL,
      driverName: DRIVER_NAME,
      driverPhone: DRIVER_PHONE,
    });
    expect(mail.html).toContain(DRIVER_NAME);
    expect(mail.html).toContain(DRIVER_PHONE);
  });

  it("`to` is the guest_email — never a driver/admin address (Pitfall 5)", async () => {
    const buildAssignedEmail = await loadBuildAssigned();
    const mail = buildAssignedEmail({
      locale: "en",
      guestEmail: GUEST_EMAIL,
      driverName: DRIVER_NAME,
      driverPhone: DRIVER_PHONE,
    });
    expect(mail.to).toBe(GUEST_EMAIL);
    expect(mail.to).not.toContain(DRIVER_PHONE);
  });
});
