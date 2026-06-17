import { expect, test } from "@playwright/test";

// PLAT-04 language-toggle smoke (D-04/D-05).
//
// Proves the EN/BG toggle: /sign-in loads in EN (default, no cookie) → tapping the
// toggle sets the `lang` cookie to `bg` and refreshes → on reload the BG translation
// of the magic-link CTA is server-rendered (no EN flash, because getLang reads the
// cookie server-side). String literals are the canonical copy from en.ts / bg.ts.
//
// EN canonical (en.signInCta) and BG canonical (bg.signInCta) — kept in sync with
// the dictionary; a drift here surfaces as a failing assertion.
const EN_CTA = "Send magic link";
const BG_CTA = "Изпрати магически линк";

test("toggle flips EN → BG, persists in the lang cookie, no flash on reload", async ({
  page,
  context,
}) => {
  // Default load: no cookie → EN (D-04). The CTA button renders the EN copy.
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: EN_CTA })).toBeVisible();

  // Tap the toggle (accessible name set by LanguageToggle).
  await page.getByRole("button", { name: /Switch language/ }).click();

  // The server action set the `lang` cookie to `bg`.
  await expect
    .poll(async () => {
      const cookies = await context.cookies();
      return cookies.find((c) => c.name === "lang")?.value;
    })
    .toBe("bg");

  // After the refresh the CTA is the BG translation — server-rendered, no flash.
  await expect(page.getByRole("button", { name: BG_CTA })).toBeVisible();

  // A hard reload still renders BG (cookie read server-side → no EN flash).
  await page.reload();
  await expect(page.getByRole("button", { name: BG_CTA })).toBeVisible();
  await expect(page.getByRole("button", { name: EN_CTA })).toHaveCount(0);
});
