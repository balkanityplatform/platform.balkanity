"use client";
// app/driver/_nav/DriverBottomNav.tsx — persistent driver bottom navigation (DUI-02).
//
// A small client island modeled on platform/ui/LanguageToggle's prop-bag shape:
// labels arrive already resolved (no `lang` needed). usePathname() from
// next/navigation derives the active tab so the chrome reads as a native app.
//
// Active-state rules (D-02):
//  - Available  → active ONLY on exact "/driver" (NOT a prefix, so it does not
//    light under /driver/run or /driver/settings).
//  - My Trips   → active on the "/driver/run" prefix (covers /driver/run AND the
//    detail route /driver/run/[id], so the tab stays lit on the detail screen).
//  - Profile    → active on the "/driver/settings" prefix.
//
// No authz rides on this highlight — every route still re-gates server-side via
// getCurrentRole(). The 12px/600 nav label is the ONE deliberate sub-14px exception
// (UI-SPEC Typography); the line icon carries redundant signal.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AvailableTabIcon,
  MyTripsTabIcon,
  ProfileTabIcon,
} from "@/app/driver/_ui/icons";

export type DriverBottomNavCopy = {
  navAvailable: string;
  navMyTrips: string;
  navProfile: string;
};

export function DriverBottomNav({ copy }: { copy: DriverBottomNavCopy }) {
  const pathname = usePathname();

  const tabs = [
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

  return (
    <nav
      aria-label={copy.navAvailable}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-grey/20 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {tabs.map(({ href, label, Icon, active }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-[2px] py-[8px] transition-colors ${
                active ? "text-teal" : "text-grey"
              }`}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span className="text-[12px] font-semibold leading-none">
                {label}
              </span>
              {/* Small teal indicator — redundant colour cue for the active tab. */}
              <span
                aria-hidden="true"
                className={`mt-[2px] h-[2px] w-[16px] rounded-full ${
                  active ? "bg-teal" : "bg-transparent"
                }`}
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
