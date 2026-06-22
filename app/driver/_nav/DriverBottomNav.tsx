"use client";
// app/driver/_nav/DriverBottomNav.tsx — persistent driver bottom navigation (DUI-02).
//
// A small client island modeled on platform/ui/LanguageToggle's prop-bag shape:
// labels arrive already resolved (no `lang` needed). usePathname() from
// next/navigation derives the active tab so the chrome reads as a native app.
//
// MOBILE ONLY (<md): hidden on md+ where DriverTopNav takes over in the header. Tab
// hrefs + active-state rules live in the shared ./tabs builder (single source of truth).
//
// No authz rides on this highlight — every route still re-gates server-side via
// getCurrentRole(). The 12px/600 nav label is the ONE deliberate sub-14px exception
// (UI-SPEC Typography); the line icon carries redundant signal.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildDriverTabs, type DriverNavCopy } from "./tabs";

export type DriverBottomNavCopy = DriverNavCopy;

export function DriverBottomNav({ copy }: { copy: DriverBottomNavCopy }) {
  const pathname = usePathname();
  const tabs = buildDriverTabs(copy, pathname);

  return (
    <nav
      aria-label={copy.navAvailable}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-grey/20 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
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
