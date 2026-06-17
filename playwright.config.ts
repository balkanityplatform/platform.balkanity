import { defineConfig, devices } from "@playwright/test";

// PWA / sign-in / lang-toggle smoke specs are authored in plans 01-03 / 01-05.
// This config establishes the Wave 0 runner so later plans add specs without
// bootstrapping Playwright.
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      // Mobile viewport — the Guest/Driver surfaces are mobile PWAs.
      name: "chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
