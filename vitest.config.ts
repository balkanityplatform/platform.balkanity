import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror tsconfig "@/*" → repo root so unit tests resolve the same
      // module specifiers the app uses.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "platform/**/*.test.{ts,tsx}",
      "modules/**/*.test.{ts,tsx}",
      // Co-located route-handler/action unit tests (e.g. companies lifecycle, D-12).
      "app/**/*.test.{ts,tsx}",
      // Phase 5 live adversarial gates (concurrency one-winner, non-claiming-driver
      // zero-PII). Node-run against the live TEST DB; live-env-gated (skip when absent).
      // NOT tests/e2e/** (Playwright's testDir, which stays excluded below).
      "tests/claim/**/*.test.{ts,tsx}",
    ],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
