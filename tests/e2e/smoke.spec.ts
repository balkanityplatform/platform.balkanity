import { expect, test } from "@playwright/test";

// Wave 0 baseline: proves the Playwright runner + config are valid before the
// real PWA / sign-in / lang-toggle specs land in plans 01-03 / 01-05.
// Pure config-level assertion — no webServer/navigation required, so it lists
// and runs green from an otherwise-empty e2e suite.
test("playwright runner is configured", () => {
  expect(test.info().project.name).toBe("chromium");
});
