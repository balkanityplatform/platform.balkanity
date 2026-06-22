// app/admin/_nav/icons.tsx — 1.5px-stroke line pictograms for the admin slate
// sidebar (Phase 12, UI-SPEC "Sidebar labels" — each label paired with a line icon
// as the redundant non-colour cue).
//
// EXACT analog: app/driver/_ui/icons.tsx (= app/(guest)/_pass/icons.tsx). These are
// simple in-source inline-<svg> LINE icons (not brand marks): literal path data only,
// stroke="currentColor", strokeWidth 1.5, round caps, aria-hidden. NEVER Material
// Symbols, NEVER a re-drawn Balkanity logo, NEVER an invented infinity loop.
//
// Declares exactly the FOUR new sidebar glyphs — Dashboard / Transfers / Drivers /
// Settings. No glyph here is re-declared from the guest/driver icon modules.
import type { SVGProps } from "react";

// Shared base props for every line pictogram (stroke 1.5px, hidden from a11y).
// Copied verbatim from app/driver/_ui/icons.tsx.
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

// Dashboard — a 2×2 panel/grid glyph (the Transfer Pool overview).
export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

// Transfers — a route / arrow-between-points glyph (the transfer pool list).
export function TransfersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </svg>
  );
}

// Drivers — a person glyph (the driver roster).
export function DriversIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

// Settings — a cog / gear glyph (the console settings hub).
export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  );
}
