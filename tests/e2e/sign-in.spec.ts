import { expect, test } from "@playwright/test";

// AUTH-04 sign-in smoke — email + password LOGIN (decision reversal from magic-link).
//
// Asserts the deterministic, no-network portion of the flow:
//   - an unauthenticated `/` redirects to /sign-in (D-03);
//   - the form renders the email + password inputs, the sign-in CTA, and the
//     forgot-password link;
//   - submitting bad credentials surfaces the generic, dictionary-keyed error via
//     the SERVER-SIDE validation path (an empty/short password is rejected before
//     any Supabase round-trip, so the assertion stays deterministic — no live OTP
//     or email, no rate-limit flakiness).
//
// The full credential round-trip (correct password → /admin) and the invite/
// recovery → /set-password walkthrough are verified MANUALLY (01-VALIDATION
// manual-only table), since they need a real Supabase session.

test("unauthenticated / redirects to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("sign-in form shows email + password inputs, the CTA and the reset link", async ({
  page,
}) => {
  await page.goto("/sign-in");

  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toBeVisible();
});

test("the forgot-password link navigates to /forgot-password", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
});

test("bad credentials surface the generic error (server-side V5)", async ({
  page,
}) => {
  await page.goto("/sign-in");
  // "a@b" passes the browser's lenient native type=email check (it has an @) but
  // FAILS our stricter server regex (requires a dotted domain), so the click
  // reaches the server action and exercises the generic-rejection path WITHOUT a
  // live Supabase call. The password field is filled so the browser lets us submit.
  await page.getByLabel("Email address").fill("a@b");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
