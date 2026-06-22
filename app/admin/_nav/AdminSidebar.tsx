"use client";
// app/admin/_nav/AdminSidebar.tsx — persistent admin slate sidebar (AUI-01, D-04).
//
// Client island modeled on app/driver/_nav/DriverBottomNav.tsx: labels arrive already
// resolved (prop-bag, no `lang`); usePathname() derives the active item via the shared
// ./tabs builder (single source of truth). Active item = teal icon + label + a redundant
// teal indicator bar (colour is never the sole cue) and aria-current="page".
//
// RESPONSIVE (D-04 — the one piece of client state the driver nav lacks):
//  - lg+ : a persistent fixed slate panel (~256px) always visible.
//  - <lg : the panel is hidden; a hamburger button toggles a slate overlay drawer
//          driven by a useState open/close. The backdrop and any nav-link click closes it.
//
// No authz rides on this highlight — every admin route still re-gates server-side via
// getCurrentRole(). Labels are 14px/600 (Label role) — NOT the driver nav's 12px exception.
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildAdminTabs, type AdminNavCopy } from "./tabs";

export type AdminSidebarCopy = AdminNavCopy & {
  // Accessible label for the hamburger toggle + the nav landmark.
  navMenuLabel: string;
};

// The shared inner nav list — rendered both in the persistent panel and the drawer.
function NavList({
  copy,
  pathname,
  onNavigate,
}: {
  copy: AdminNavCopy;
  pathname: string;
  onNavigate?: () => void;
}) {
  const tabs = buildAdminTabs(copy, pathname);
  return (
    <ul className="flex flex-col gap-[4px] px-[12px]">
      {tabs.map(({ href, label, Icon, active }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`flex min-h-[44px] items-center gap-[12px] rounded-md px-[12px] py-[8px] transition-colors ${
              active ? "bg-white/10 text-teal" : "text-white/80 hover:bg-white/5"
            }`}
          >
            {/* Redundant teal indicator bar — colour is never the sole active cue. */}
            <span
              aria-hidden="true"
              className={`h-[20px] w-[3px] rounded-full ${
                active ? "bg-teal" : "bg-transparent"
              }`}
            />
            <Icon className="h-[22px] w-[22px]" />
            <span className="text-[14px] font-semibold leading-none">
              {label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The logo chip header (white chip so the teal mark stays on white — slate-variant pattern).
function LogoChip() {
  return (
    <span className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px]">
      <Image
        src="/brand/balkanity-logo.png"
        alt="Balkanity"
        width={96}
        height={96}
        className="h-[28px] w-auto"
      />
    </span>
  );
}

export function AdminSidebar({ copy }: { copy: AdminSidebarCopy }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Persistent slate panel — lg+ only. */}
      <aside className="hidden w-[256px] shrink-0 flex-col gap-[24px] bg-slate py-[24px] lg:flex">
        <div className="px-[24px]">
          <LogoChip />
        </div>
        <nav aria-label={copy.navMenuLabel}>
          <NavList copy={copy} pathname={pathname} />
        </nav>
      </aside>

      {/* Mobile hamburger toggle — <lg only. Lives in the sidebar island so the drawer
          state is co-located with the nav it controls. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={copy.navMenuLabel}
        aria-expanded={open}
        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-white hover:bg-white/10 lg:hidden"
      >
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay drawer — <lg only, toggled by the hamburger. */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop — click closes. */}
          <button
            type="button"
            aria-label={copy.navMenuLabel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate/60"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[256px] flex-col gap-[24px] bg-slate py-[24px] shadow-xl">
            <div className="flex items-center justify-between px-[24px]">
              <LogoChip />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.navMenuLabel}
                className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-white hover:bg-white/10"
              >
                <svg
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <nav aria-label={copy.navMenuLabel}>
              <NavList
                copy={copy}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
