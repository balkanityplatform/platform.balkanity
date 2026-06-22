// app/driver/layout.tsx — shared driver shell (D-01).
//
// CONSOLIDATES the four duplicated <header> blocks (PoolView/RunView/settings/run[id])
// and the bell seed into ONE source, and mounts the persistent DriverBottomNav (DUI-02)
// once for every driver route. Pattern 2 (RESEARCH): an RSC that resolves copy + lang
// server-side (no-flash) and seeds the Alerts bell from the own-rows-only feed read.
//
// The bell seed is RELOCATED, not widened: readOwnNotifications() is the SAME caller-auth
// own-rows-only RLS read the page used (threat T-11-01 accept) — a layout RSC may call it
// because it is server-side. No new trust boundary, no PII surface, no data write here.
//
// NOTE: the per-page <header> blocks are deliberately NOT deleted here — each surface slice
// (Plans 02–05) removes its own page header so file ownership stays disjoint. A transient
// double-header mid-wave (until each slice lands) is acceptable.
import Image from "next/image";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { readOwnNotifications } from "@/platform/notifications/feed";
import { NotificationBell } from "@/platform/ui/NotificationBell";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { DriverBottomNav } from "./_nav/DriverBottomNav";
import { DriverTopNav } from "./_nav/DriverTopNav";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Role-gated own-rows-only seed for the Alerts bell (caller-auth RLS — never service-role).
  const bellInitial = await readOwnNotifications();

  return (
    <div className="min-h-dvh bg-white pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
      {/* Slim top header: logo chip · (desktop primary nav, centered) · Alerts bell · Language toggle.
          On md+ the DriverTopNav is absolutely centered and DriverBottomNav hides; below md the
          bottom nav owns navigation and this center slot is empty. */}
      <header className="relative flex items-center justify-between border-b border-grey/20 bg-white px-[24px] py-[16px]">
        {/* Desktop primary nav — true-centered regardless of the logo / actions widths. */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center md:flex">
          <div className="pointer-events-auto">
            <DriverTopNav
              copy={{
                navAvailable: t.navAvailable,
                navMyTrips: t.navMyTrips,
                navProfile: t.navProfile,
              }}
            />
          </div>
        </div>
        <span className="inline-flex items-center">
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </span>
        <span className="inline-flex items-center gap-[8px]">
          <NotificationBell
            initial={bellInitial}
            lang={lang}
            copy={{
              alertsTrigger: t.alertsTrigger,
              alertsTriggerAria: t.alertsTriggerAria,
              alertsPanelTitle: t.alertsPanelTitle,
              markAllReadCta: t.markAllReadCta,
              alertsEmptyHeading: t.alertsEmptyHeading,
              alertsEmptyBody: t.alertsEmptyBody,
              alertsLoadFailed: t.alertsLoadFailed,
            }}
          />
          <LanguageToggle current={lang} label={t.langToggle} />
        </span>
      </header>

      <main>{children}</main>

      <DriverBottomNav
        copy={{
          navAvailable: t.navAvailable,
          navMyTrips: t.navMyTrips,
          navProfile: t.navProfile,
        }}
      />
    </div>
  );
}
