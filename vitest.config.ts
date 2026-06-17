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
    include: ["platform/**/*.test.{ts,tsx}", "modules/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
