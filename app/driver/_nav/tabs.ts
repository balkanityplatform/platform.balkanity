// app/driver/_nav/tabs.ts — single source of truth for the driver primary-nav tabs (DUI-02).
//
// Shared by DriverBottomNav (mobile, <md) and DriverTopNav (desktop, md+) so the hrefs,
// labels, and active-state rules live in ONE place. Active rules (D-02):
//  - Available  → active ONLY on exact "/driver" (NOT a prefix, so it does not light under
//    /driver/run or /driver/settings).
//  - My Trips   → active on the "/driver/run" prefix (covers /driver/run AND /driver/run/[id]).
//  - Profile    → active on the "/driver/settings" prefix.
//
// No authz rides on this highlight — every route still re-gates server-side via getCurrentRole().
import {
  AvailableTabIcon,
  MyTripsTabIcon,
  ProfileTabIcon,
} from "@/app/driver/_ui/icons";

export type DriverNavCopy = {
  navAvailable: string;
  navMyTrips: string;
  navProfile: string;
};

export type DriverTab = {
  href: string;
  label: string;
  Icon: typeof AvailableTabIcon;
  active: boolean;
};

export function buildDriverTabs(
  copy: DriverNavCopy,
  pathname: string,
): DriverTab[] {
  return [
    {
      href: "/driver",
      label: copy.navAvailable,
      Icon: AvailableTabIcon,
      // Exact match — must NOT light up under /driver/run or /driver/settings.
      active: pathname === "/driver",
    },
    {
      href: "/driver/run",
      label: copy.navMyTrips,
      Icon: MyTripsTabIcon,
      // Prefix — keeps My Trips active on /driver/run AND /driver/run/[id] (D-02).
      active: pathname.startsWith("/driver/run"),
    },
    {
      href: "/driver/settings",
      label: copy.navProfile,
      Icon: ProfileTabIcon,
      active: pathname.startsWith("/driver/settings"),
    },
  ];
}
