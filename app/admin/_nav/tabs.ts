// app/admin/_nav/tabs.ts — single source of truth for the admin slate-sidebar nav
// items (AUI-01). EXACT analog: app/driver/_nav/tabs.ts.
//
// Shared by AdminSidebar (and any future top-level admin nav) so the hrefs, labels,
// and active-state rules live in ONE place. Active rules (mirroring the driver
// exact-vs-prefix split):
//  - Dashboard → active ONLY on exact "/admin" (NOT a prefix, so it does not light
//    under /admin/transfers, /admin/drivers, or /admin/settings).
//  - Transfers → active on the "/admin/transfers" prefix (covers /admin/transfers AND
//    /admin/transfers/[id]).
//  - Drivers   → active on the "/admin/drivers" prefix.
//  - Settings  → active on the "/admin/settings" prefix (keeps the parent lit).
//
// Exactly FOUR items — the backend-less reporting tab is omitted (Decision 1).
// No authz rides on this highlight — every admin route still re-gates server-side via
// getCurrentRole() before any read.
import {
  DashboardIcon,
  TransfersIcon,
  DriversIcon,
  SettingsIcon,
} from "./icons";

export type AdminNavCopy = {
  navDashboard: string;
  transfersTitle: string;
  driversTitle: string;
  navSettings: string;
};

export type AdminTab = {
  href: string;
  label: string;
  Icon: typeof DashboardIcon;
  active: boolean;
};

export function buildAdminTabs(
  copy: AdminNavCopy,
  pathname: string,
): AdminTab[] {
  return [
    {
      href: "/admin",
      label: copy.navDashboard,
      Icon: DashboardIcon,
      // Exact match — must NOT light up under /admin/transfers, /admin/drivers, etc.
      active: pathname === "/admin",
    },
    {
      href: "/admin/transfers",
      label: copy.transfersTitle,
      Icon: TransfersIcon,
      // Prefix — keeps Transfers active on /admin/transfers AND /admin/transfers/[id].
      active: pathname.startsWith("/admin/transfers"),
    },
    {
      href: "/admin/drivers",
      label: copy.driversTitle,
      Icon: DriversIcon,
      active: pathname.startsWith("/admin/drivers"),
    },
    {
      href: "/admin/settings",
      label: copy.navSettings,
      Icon: SettingsIcon,
      active: pathname.startsWith("/admin/settings"),
    },
  ];
}
