"use client";
// app/admin/_nav/AdminTopBar.tsx — admin slate top bar (AUI-05).
//
// Client island carrying three slots:
//  (a) a client-side search <input type="search"> reusing the controlled-input +
//      focus-visible:outline-teal shape from app/admin/transfers/TransfersView.tsx.
//      FOR THIS PLAN the input is PRESENTATIONAL — its value is held in local useState
//      but not yet wired to row filtering. The loaded-rows filter wiring lands in Plan 03
//      (AUI-05 completion); the `onSearchChange` callback prop is the stable seam the
//      layout/Plan-03 surface will pass through. No data path / no PII here (threat
//      T-12-04 accept).
//  (b) an `actions` slot rendering the layout-provided NotificationBell + LanguageToggle
//      (the shell owns the single bell seed — never mounted twice).
//  (c) the signed-in admin identity — a worded "Signed in as" label + email, passed in as
//      a prop. No auth call in this client island (identity is read in the layout RSC from
//      the verified session).
//
// Labels arrive already dictionary-resolved (prop-bag, no `lang`). ≥44px hit targets.
import { useState } from "react";
import type { ReactNode } from "react";

export type AdminTopBarCopy = {
  // Placeholder for the presentational search input (reuses transferSearchPlaceholder).
  searchPlaceholder: string;
  // Worded label for the signed-in identity (reuses signedInAs).
  signedInAs: string;
  // Accessible label for the hamburger-toggle slot region (where the sidebar toggle sits).
  menuSlotLabel: string;
};

export function AdminTopBar({
  copy,
  identity,
  actions,
  menuSlot,
  onSearchChange,
}: {
  copy: AdminTopBarCopy;
  // The signed-in admin's email (always present from the verified session); name optional.
  identity: { email: string; name?: string | null };
  // The NotificationBell + LanguageToggle, mounted ONCE by the layout shell.
  actions: ReactNode;
  // The mobile sidebar hamburger toggle (the AdminSidebar renders it; the layout slots
  // it here so it sits in the top bar below the desktop breakpoint).
  menuSlot?: ReactNode;
  // Plan-03 seam: presentational here; Plan 03 wires it to loaded-rows filtering.
  onSearchChange?: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const displayName = identity.name?.trim() || identity.email;

  return (
    <header className="flex h-[64px] items-center gap-[16px] bg-slate px-[24px]">
      {/* Mobile sidebar toggle slot (<lg). */}
      {menuSlot ? (
        <span aria-label={copy.menuSlotLabel} className="lg:hidden">
          {menuSlot}
        </span>
      ) : null}

      {/* (a) Client-side search — presentational for this plan; Plan-03 wires filtering. */}
      <form role="search" className="flex flex-1 justify-start" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          name="q"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onSearchChange?.(e.target.value);
          }}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
          className="min-h-[44px] w-full max-w-[420px] rounded-md border border-white/20 bg-white/10 px-[16px] text-[16px] text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        />
      </form>

      {/* (c) Signed-in identity — worded label + email/name (no auth call here). */}
      <span className="hidden flex-col items-end leading-tight text-white sm:flex">
        <span className="text-[12px] font-medium text-white/60">
          {copy.signedInAs}
        </span>
        <span className="text-[14px] font-semibold">{displayName}</span>
      </span>

      {/* (b) Bell + LanguageToggle slot — mounted once by the layout. */}
      <span className="inline-flex items-center gap-[8px] text-white">
        {actions}
      </span>
    </header>
  );
}
