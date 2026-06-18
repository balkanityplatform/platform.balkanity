import { expect, test } from "@playwright/test";

// D-06 live "you keep" panel — on the destination form, entering a price + commission %
// recomputes the commission amount, the net (you keep, before fees), and the estimated
// Stripe-fee note LIVE; changing the inputs recomputes them.
//
// Like sign-in.spec.ts and second-company.spec.ts, the destination form lives behind the
// RSC admin gate, so the DETERMINISTIC, no-live-session portion asserted automatically
// here is the gate: an unauthenticated /admin/destinations redirects to /sign-in. The
// LIVE recompute itself — a pure client-side, display-only calculation — is proven
// automatically (green, session-free) by the co-located component test
// app/admin/destinations/you-keep.test.tsx, which renders DestinationForm and asserts:
//
//   price €100.00 + 15% → commission €15.00, you keep (before fees) €85.00, fee note
//   containing "~1.5% + €0.25"; then €200.00 + 10% → €20.00 / €180.00 on change.
//
// The full signed-in walkthrough of the SAME recompute inside the real /admin/destinations
// route is the HUMAN-VERIFIED portion of the Task-3 checkpoint (needs a live admin
// session, which the runner does not provision).
//
// MANUAL CHECKPOINT STEPS (D-06 — signed in as the seeded admin, Balkanity ref
// qyhdogajtmnvxphrslwm — NEVER Kalvia utyatpadtibqqswsfvtr):
//   1. Go to /admin/destinations, open the create form.
//   2. Enter price "100.00" and commission "15".
//   3. Confirm the "you keep" panel shows:
//        - "Company commission (15%): €15.00"
//        - "You keep (before fees): €85.00"   ← net recomputed live
//        - the fee note "Estimated Stripe fee ~1.5% + €0.25 ..."
//   4. Change price to "200.00" and commission to "10" → confirm the lines recompute live
//      to "€20.00" / "€180.00" without a page reload.

test("unauthenticated /admin/destinations redirects to the sign-in page (admin gate)", async ({
  page,
}) => {
  await page.goto("/admin/destinations");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the destination form (with the live you-keep panel) is admin-gated", async ({
  page,
}) => {
  // The you-keep panel (whose live recompute yields "you keep ... €85.00" at €100/15%,
  // proven green by app/admin/destinations/you-keep.test.tsx) is reachable only behind
  // the admin gate; an unauthenticated visit never renders it and lands on /sign-in.
  await page.goto("/admin/destinations");
  await expect(page).toHaveURL(/\/sign-in/);
});
