import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// PLAT-02 — Serwist PWA shell (CLAUDE.md lock: never next-pwa).
//
// `withSerwist` builds the authored `app/sw.ts` into the generated `public/sw.js`
// (gitignored, never hand-edited). The branded `/~offline` page is added as an
// explicit precache entry so the offline fallback is always available; the
// `revision` is bumped per build to bust the cached copy on each deploy.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable the SW in `next dev` so HMR / live edits are never served stale; the
  // SW is exercised against `next build`/`next start` (and the Playwright run).
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/~offline", revision: process.env.BUILD_ID ?? `${Date.now()}` },
  ],
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist(nextConfig);
