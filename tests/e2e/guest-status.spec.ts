import { expect, test } from "@playwright/test";

// tests/e2e/guest-status.spec.ts — guest status page timeline + receipt (BOOK-07 / AUTH-02 / SC4).
//
// NYQUIST BASELINE — RED until Plan 04 lands the status route (app/status/[id]/page.tsx)
// + the magic-link guest session on the existing /auth/confirm route. The page does not
// exist yet, so the render assertions fail now; that is the expected baseline. Do NOT
// stub the page here.
//
// What this collects + (later) proves:
//   • the lifecycle timeline renders a `[data-testid="status-dot"]` per lifecycle state
//     (StatusDot consumed verbatim — colour is never the sole signal, WCAG 1.4.1, SC4);
//   • the payment receipt renders the "Paid €X" line for a paid transfer (SC4);
//   • magic-link-gated access (AUTH-02) — the live-session steps need a seeded row + a
//     real magic-link session, both gated behind Plan 04 / live TEST-DB seeding, so they
//     are annotated test.fixme below (collected by --list, not run until ready).

// A seeded paid transfer id. Plan 04 / live TEST-DB seeding replaces this with a real row.
const SEEDED_PAID_TRANSFER_ID = "44444444-4444-4444-4444-444444444444";

test.describe("guest status page (BOOK-07 / AUTH-02 / SC4)", () => {
  // RED now: the route does not exist → no status dots render. Turns GREEN in Plan 04.
  test("renders the lifecycle timeline (a status-dot per state) for a transfer", async ({
    page,
  }) => {
    await page.goto(`/status/${SEEDED_PAID_TRANSFER_ID}`);

    // SC4: the timeline is a dot + label per state. At least the happy-path states render.
    const dots = page.locator('[data-testid="status-dot"]');
    await expect(dots.first()).toBeVisible();
    expect(await dots.count()).toBeGreaterThan(0);
  });

  // The receipt + magic-link session both require a live seeded PAID row and an
  // authenticated magic-link session (AUTH-02). Gated behind Plan 04 / live TEST-DB
  // seeding — collected by `playwright test --list` but not executed until wired.
  test.fixme(
    "shows the 'Paid €X on <date>' receipt for a paid transfer (SC4 — needs Plan 04 magic-link session + seeded paid row)",
    async ({ page }) => {
      await page.goto(`/status/${SEEDED_PAID_TRANSFER_ID}`);
      await expect(page.locator("body")).toContainText(/Paid €/);
    },
  );

  test.fixme(
    "magic-link landing authenticates the guest to read their own row via RLS (AUTH-02 — needs Plan 04 /auth/confirm next-param + session)",
    async ({ page }) => {
      // Plan 04: a generated magiclink lands on /auth/confirm?type=magiclink&next=/status/<id>,
      // verifyOtp sets the @supabase/ssr session, and the RLS guest-self-read returns the row.
      await page.goto(`/status/${SEEDED_PAID_TRANSFER_ID}`);
      await expect(page.locator('[data-testid="status-dot"]').first()).toBeVisible();
    },
  );
});
