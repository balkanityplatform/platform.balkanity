import { expect, test } from "@playwright/test";

// ONBD-06 second-company acceptance bar — a SECOND company onboarded end-to-end
// (company → property → destination) through the UI only, with zero code/DB edits.
//
// Like sign-in.spec.ts and driver-invite.spec.ts, this asserts the DETERMINISTIC,
// no-live-session portion automatically:
//   - each of the three onboarding routes (/admin/companies, /admin/properties,
//     /admin/destinations) is admin-gated: an unauthenticated visit redirects to
//     /sign-in (the RSC getCurrentRole() → redirect("/sign-in") gate). This proves the
//     no-code onboarding surface exists at all three hierarchy levels and is uniformly
//     protected — the precondition for the full ONBD-06 chain.
//
// The FULL signed-in walkthrough — create a NEW company, add a property under it
// (parent picker), add a destination under that property (label + auto-filled slug +
// price + commission), then find the new destination in the list with its slug and an
// "Active" status — is the HUMAN-VERIFIED portion of the Task-3 checkpoint. It needs a
// real Supabase admin session and MUTATES live company/property/destination + (on the
// driver path) auth state, and depends on the Balkanity project's seeded admin — none of
// which the automated runner provisions. Driving it here would write live rows and
// depend on dashboard config, so it stays manual (mirrors sign-in.spec.ts, whose live
// credential round-trip is manual-only). Use UNIQUE names per run (timestamp suffix) so
// re-runs don't collide on the global slug.
//
// MANUAL CHECKPOINT STEPS (ONBD-06 — run once signed in as the seeded admin against the
// Balkanity project ref qyhdogajtmnvxphrslwm — NEVER Kalvia utyatpadtibqqswsfvtr):
//   1. Sign in as admin. Go to /admin/companies → "Create company" with a unique name
//      (e.g. "Acme Stays <timestamp>"). Confirm it appears Active in the list.
//   2. Go to /admin/properties → "Add property": pick the new company in the parent
//      Select, name it (e.g. "Downtown Loft <timestamp>"). Confirm it appears Active,
//      labelled "<property> — <company>".
//   3. Go to /admin/destinations → "Save destination": pick the new property in the
//      parent Select, type a label (the slug auto-fills, editable), enter a price and a
//      commission %. Confirm the live "you keep" panel renders, then save.
//   4. Confirm the new destination appears in the list with its /slug and an "Active"
//      indicator — proving a second company onboarded end-to-end with zero code/DB edits.

const ONBOARDING_ROUTES = [
  "/admin/companies",
  "/admin/properties",
  "/admin/destinations",
];

for (const route of ONBOARDING_ROUTES) {
  test(`unauthenticated ${route} redirects to the sign-in page (admin gate)`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in/);
  });
}

test("the no-code onboarding chain spans all three hierarchy levels", async ({
  page,
}) => {
  // The three-level no-code surface exists and is uniformly admin-gated: visiting each
  // level while unauthenticated lands on /sign-in. Together these are the precondition
  // for the full ONBD-06 walkthrough (manual checkpoint above).
  for (const route of ONBOARDING_ROUTES) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in/);
  }
});
