import { expect, test } from "@playwright/test";

// ONBD-05 / AUTH-03 / NOTF-04 driver-invite smoke — admin invites a driver and the
// console reveals a copy-paste set-password link (no email, D-03/D-04).
//
// Like sign-in.spec.ts, this asserts the DETERMINISTIC, no-live-session portion of
// the flow:
//   - an unauthenticated /admin/drivers redirects to /sign-in (the RSC admin gate,
//     getCurrentRole() → redirect("/sign-in"); AUTH-03 — no open access).
//
// The FULL signed-in walkthrough — admin submits the invite form with a test
// driver's email+name+phone, the console reveals an action_link whose text contains
// `/auth/confirm`, and opening that link lands on /set-password (the route already
// allowlists type=invite) — is the HUMAN-VERIFIED portion of the Task 3 checkpoint.
// It needs (a) a real Supabase admin session, (b) a live generateLink call that
// CREATES an auth user, and (c) the Balkanity Redirect URLs allowlist + the
// NEXT_PUBLIC_SITE_URL env, none of which the automated runner provisions. Driving
// it here would mutate live auth state and depend on dashboard config, so it stays
// manual (mirrors sign-in.spec.ts, whose live credential round-trip is manual-only).
//
// MANUAL CHECKPOINT STEPS (run once the allowlist + NEXT_PUBLIC_SITE_URL are set on
// the Balkanity project ref qyhdogajtmnvxphrslwm — NEVER Kalvia utyatpadtibqqswsfvtr):
//   1. Sign in as admin, go to /admin/drivers.
//   2. Submit the invite form (test email + name + phone).
//   3. Confirm the console reveals a link whose text contains `/auth/confirm`.
//   4. Open that link → confirm it resolves through /auth/confirm?type=invite to
//      /set-password (allowlist working; redirectTo NOT silently dropped to Site URL).
//   5. Set a password → confirm the new account resolves to the driver role.

test("unauthenticated /admin/drivers redirects to the sign-in page (admin gate, AUTH-03)", async ({
  page,
}) => {
  await page.goto("/admin/drivers");
  await expect(page).toHaveURL(/\/sign-in/);
});
