// app/(guest)/_pass/icons.tsx — 1.5px-stroke line pictograms for the guest
// "Transfer Pass" surface (Phase 10, UI-SPEC Decision 1/3 + line 44).
//
// These are simple in-source inline-<svg> LINE icons (not brand marks): literal
// path data only, stroke="currentColor", strokeWidth="1.5", aria-hidden. NEVER
// Material Symbols, NEVER a re-drawn brand logo, NEVER an invented infinity loop
// (mirrors the RouteMotif T-09-03-01 stance — no untrusted/raw-HTML SVG). The
// Plane/Building path data is reused verbatim from platform/ui/RouteMotif.tsx so
// the endpoint pictograms stay visually consistent across the surface.
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

export function PlaneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M10.5 13.5 2.5 12l1-2.2 2.8.5 2.5-2.9-5.3-6 2.4-.6 6.7 4.2 3.5-4c.7-.8 1.9-.9 2.6-.2.8.7.6 2-.2 2.7l-4 3.5 4.2 6.7-.6 2.4-6-5.3-2.9 2.5.5 2.8L12 21.5l-1.5-8Z" />
    </svg>
  );
}

export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M16 9h3a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function PeopleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M17 14.5a5.5 5.5 0 0 1 3.5 5.5" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}
