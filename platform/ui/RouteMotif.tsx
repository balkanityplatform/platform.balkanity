// platform/ui/RouteMotif.tsx — the "Balkanity Path" route motif (DS-03, D-09/D-10).
//
// A horizontal Departure → Arrival visualization: a start endpoint, a connector
// line, the FIXED midpoint Transfer Badge, another connector line, and an end
// endpoint. The midpoint is the REAL committed brand Transfer Badge served
// verbatim from public/brand/transfer-badge.svg via next/image (the same
// public/ + next/image pattern as app/admin/page.tsx) — NEVER a re-drawn logo
// or an invented infinity loop (ASSET guardrail, D-10).
//
// Endpoints are configurable via `start` / `end` `{ icon, label }` props (D-09),
// defaulting to a Plane endpoint → a Building endpoint so Guest (airport →
// property), Driver, and Admin surfaces all reuse it. Surfaces pass their own
// already-translated `label` strings (i18n is NOT wired inside the component).
// Where no brand asset exists for an endpoint (Plane / Building), a simple
// 1.5px-stroke inline line pictogram is permitted (D-10) — these are line icons,
// NOT brand marks. No raw-HTML injection / untrusted SVG anywhere: the badge is
// a static next/image asset and the line icons are literal in-source JSX <svg>
// (T-09-03-01).
import Image from "next/image";
import type { ReactNode } from "react";

export type RouteEndpoint = {
  /** Endpoint pictogram — a line icon (Plane/Building) or a surface-supplied node. */
  icon: ReactNode;
  /** Already-translated, user-facing label (surface supplies it; no i18n here). */
  label: string;
};

export type RouteMotifProps = {
  /** Departure endpoint. Defaults to a Plane line pictogram. */
  start?: RouteEndpoint;
  /** Arrival endpoint. Defaults to a Building line pictogram. */
  end?: RouteEndpoint;
  className?: string;
};

// Default endpoint line pictograms — simple 1.5px-stroke inline SVGs where no
// brand asset exists (D-10). Literal path data only (no untrusted injection).
function PlaneIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 13.5 2.5 12l1-2.2 2.8.5 2.5-2.9-5.3-6 2.4-.6 6.7 4.2 3.5-4c.7-.8 1.9-.9 2.6-.2.8.7.6 2-.2 2.7l-4 3.5 4.2 6.7-.6 2.4-6-5.3-2.9 2.5.5 2.8L12 21.5l-1.5-8Z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M16 9h3a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </svg>
  );
}

const DEFAULT_START: RouteEndpoint = { icon: <PlaneIcon />, label: "Departure" };
const DEFAULT_END: RouteEndpoint = { icon: <BuildingIcon />, label: "Arrival" };

// One endpoint column: icon over its worded label (label always present, WCAG 1.4.1).
function Endpoint({ icon, label }: RouteEndpoint) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-slate">
      <span className="inline-flex h-9 w-9 items-center justify-center">{icon}</span>
      <span className="max-w-[8rem] truncate text-label font-semibold text-slate">
        {label}
      </span>
    </div>
  );
}

// A flexible connector segment between an endpoint and the midpoint badge.
function Connector() {
  return <span className="h-px flex-1 bg-grey/40" aria-hidden="true" />;
}

export function RouteMotif({
  start = DEFAULT_START,
  end = DEFAULT_END,
  className = "",
}: RouteMotifProps) {
  return (
    <div className={`flex w-full items-center gap-2 ${className}`}>
      <Endpoint icon={start.icon} label={start.label} />
      <Connector />
      {/* Fixed midpoint = the REAL committed brand Transfer Badge served verbatim
          from public/brand (D-10). Never re-drawn; never an invented loop. */}
      <Image
        src="/brand/transfer-badge.svg"
        alt="Balkanity transfer badge"
        width={44}
        height={44}
        className="h-11 w-11 shrink-0"
        priority={false}
      />
      <Connector />
      <Endpoint icon={end.icon} label={end.label} />
    </div>
  );
}
