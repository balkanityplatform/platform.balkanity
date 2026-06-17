/// <reference lib="webworker" />
// app/sw.ts — authored Serwist service worker (PLAT-02). Built into the
// generated public/sw.js by withSerwist; never hand-edit the generated file.
//
// D-06 / Pitfall 12 guard (the load-bearing rule of this worker):
//   Auth/sign-in/admin/confirm — and any future booking/claim/status route —
//   MUST be served NetworkFirst (or not cached at all). A stale-cached signed-in
//   shell or status page is a correctness/security hazard (T-05-01). We therefore
//   register an EXPLICIT NetworkFirst rule for those navigations BEFORE the
//   `defaultCache` rules, so a sensitive document never falls through to a
//   StaleWhileRevalidate/CacheFirst strategy. The only intentionally-precached
//   navigational asset is the branded `/~offline` fallback.
import { defaultCache } from "@serwist/next/worker";
import {
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
  NetworkFirst,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Pitfall 12: every sensitive document path is matched here and forced
// NetworkFirst. Listed BEFORE defaultCache so it wins for these navigations.
const SENSITIVE_DOCUMENT = /^\/(sign-in|admin|auth)(\/|$)/;

const authNetworkFirst: RuntimeCaching = {
  matcher({ request, url, sameOrigin }) {
    return (
      sameOrigin &&
      request.destination === "document" &&
      SENSITIVE_DOCUMENT.test(url.pathname)
    );
  },
  handler: new NetworkFirst({
    cacheName: "auth-pages-network-first",
    networkTimeoutSeconds: 5,
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Auth/admin/confirm NetworkFirst rule FIRST, then the Serwist defaults.
  runtimeCaching: [authNetworkFirst, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
