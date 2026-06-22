"use client";
// app/driver/_nav/DriverTopNav.tsx — desktop driver primary navigation (DUI-02).
//
// DESKTOP ONLY (md+): a horizontal Available / My Trips / Profile row rendered centered
// in the driver header. Below md it is hidden and DriverBottomNav takes over. Shares the
// tab hrefs + active-state rules with the bottom nav via the ./tabs builder.
//
// usePathname() derives the active tab; active is teal with a teal underline indicator.
// No authz rides on this highlight — every route still re-gates server-side.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildDriverTabs, type DriverNavCopy } from "./tabs";

export type DriverTopNavCopy = DriverNavCopy;

export function DriverTopNav({ copy }: { copy: DriverTopNavCopy }) {
  const pathname = usePathname();
  const tabs = buildDriverTabs(copy, pathname);

  return (
    <nav
      aria-label={copy.navAvailable}
      className="hidden md:flex items-center gap-[8px]"
    >
      {tabs.map(({ href, label, Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex flex-col items-center gap-[2px] rounded-[8px] px-[12px] py-[6px] transition-colors ${
            active ? "text-teal" : "text-grey hover:text-slate"
          }`}
        >
          <span className="inline-flex items-center gap-[6px]">
            <Icon className="h-[18px] w-[18px]" />
            <span className="text-[14px] font-semibold leading-none">
              {label}
            </span>
          </span>
          {/* Teal underline — redundant colour cue for the active tab. */}
          <span
            aria-hidden="true"
            className={`h-[2px] w-full rounded-full ${
              active ? "bg-teal" : "bg-transparent"
            }`}
          />
        </Link>
      ))}
    </nav>
  );
}
