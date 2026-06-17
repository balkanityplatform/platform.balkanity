import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // PLAT-01 — one-way platform/modules seam, enforced at lint time.
  // platform/ is module-agnostic and MUST NOT import from modules/.
  // modules/ MAY import from platform/, never the reverse.
  // The DB half of the seam (wp_ prefix on module tables, unprefixed platform
  // tables like app_users) is a naming convention enforced in plan 01-02
  // (app_users unprefixed) and Phase 2+ (wp_ tables) — no code here.
  {
    files: ["platform/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/*",
                "modules/*",
                "../modules/*",
                "**/modules/*",
              ],
              message:
                "platform/ must not import from modules/ — the seam is one-way (modules → platform only). [PLAT-01]",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-application tooling/docs — not project source.
    ".claude/**",
    ".planning/**",
    "node_modules/**",
    "test-results/**",
    "playwright-report/**",
    "coverage/**",
    // Serwist-generated service worker bundle (gitignored, never hand-edited).
    // It is a minified Workbox build, not project source — linting it is noise.
    "public/sw*.js",
    "public/swe-worker-*.js",
  ]),
]);

export default eslintConfig;
