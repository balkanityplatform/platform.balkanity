import { expect, test } from "@playwright/test";

// PLAT-02 PWA smoke — manifest identity, the branded /~offline fallback, and (when
// the SW is active) service-worker registration + offline document fallback.
//
// SW lifecycle note: withSerwist DISABLES the service worker under `next dev`
// (NODE_ENV=development) so HMR is never served stale. The Playwright webServer
// runs `next dev`, so the deterministic assertions here are:
//   1. the manifest declares the Balkanity standalone identity (always available),
//   2. the branded /~offline page renders the dictionary copy (always available),
//   3. SW registration is asserted ONLY when navigator.serviceWorker exists AND a
//      registration is present (i.e. a production/`next start` run) — skipped in dev.
// The real offline install + airplane-mode walkthrough is verified MANUALLY at the
// deploy checkpoint (01-05 PLAN: cannot be asserted headlessly on a real device).

test("manifest declares the Balkanity standalone identity (D-07)", async ({
  request,
}) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.name).toBe("Balkanity Platform");
  expect(manifest.short_name).toBe("Balkanity");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#029B87");
  expect(manifest.background_color).toBe("#FFFFFF");
  expect(Array.isArray(manifest.icons)).toBeTruthy();
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test("the branded /~offline page renders the dictionary fallback copy (D-06)", async ({
  page,
}) => {
  await page.goto("/~offline");
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Balkanity needs a connection for this page. We'll reconnect automatically when you're back online.",
    ),
  ).toBeVisible();
});

test("service worker registers and serves /~offline when offline (production only)", async ({
  page,
  context,
}) => {
  await page.goto("/");

  // Wait briefly for any SW registration. In `next dev` the SW is intentionally
  // disabled, so there is nothing to register — skip the offline assertion there.
  const registered = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    // `serviceWorker.ready` never resolves when no SW will ever register (the
    // `next dev` case, where withSerwist disables the worker). Race it against a
    // short timeout so dev runs resolve `false` and skip rather than hang.
    const ready = navigator.serviceWorker.ready.then((reg) => !!reg.active);
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 3000),
    );
    try {
      return await Promise.race([ready, timeout]);
    } catch {
      return false;
    }
  });

  test.skip(
    !registered,
    "Service worker disabled under `next dev` — offline fallback is verified against `next start` / the deploy checkpoint.",
  );

  // SW is active: a document navigation while offline must serve the branded
  // /~offline fallback, never a stale signed-in shell (Pitfall 12 / D-06).
  await context.setOffline(true);
  await page.goto("/some-route-that-needs-network");
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();
  await context.setOffline(false);
});
