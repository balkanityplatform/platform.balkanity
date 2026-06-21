// app/driver/_ui/icons.tsx — 1.5px-stroke line pictograms for the driver PWA
// surface (Phase 11, UI-SPEC "Driver line pictograms" + Icon library rows).
//
// EXACT analog: app/(guest)/_pass/icons.tsx. These are simple in-source inline-<svg>
// LINE icons (not brand marks): literal path data only, stroke="currentColor",
// strokeWidth 1.5, round caps, aria-hidden. NEVER Material Symbols, NEVER a re-drawn
// Balkanity logo, NEVER an invented infinity loop.
//
// This module declares only the NEW driver glyphs — the luggage meta icon and the
// three bottom-nav tab icons. The five shared guest pictograms (Plane/Building/
// Calendar/Clock/People) are NOT re-declared here; surface slices import them from
// `@/app/(guest)/_pass/icons` where needed (single source of truth).
import type { SVGProps } from "react";

// Shared base props for every line pictogram (stroke 1.5px, hidden from a11y).
function baseProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

// Luggage / suitcase — the claim + trip card luggage-count meta icon.
export function LuggageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <rect x="5" y="7" width="14" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M9 11v5M15 11v5" />
    </svg>
  );
}

// Available tab — a simple list/queue glyph (the claimable pool).
export function AvailableTabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

// My Trips tab — a route / car glyph (the driver's active runs).
export function MyTripsTabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M5 17h14" />
      <path d="M6.5 17l1.2-4a2 2 0 0 1 1.9-1.4h4.8a2 2 0 0 1 1.9 1.4l1.2 4" />
      <circle cx="8" cy="17" r="1.6" />
      <circle cx="16" cy="17" r="1.6" />
    </svg>
  );
}

// Profile tab — a person glyph (the driver's own account).
export function ProfileTabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
