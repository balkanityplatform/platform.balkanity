// app/dev/design-system/page.tsx — THROWAWAY dev-only design-system showcase (D-11).
//
// The phase's "demonstrable slice": a Server Component that renders every Phase 9
// deliverable across its states/variants so the design-system foundation can be
// eyeballed in-browser before any surface (Phases 10/11/12) consumes it —
// StatusDot × 8 states × {dot, pill}, LifecycleStepper at each STEPPER_ORDER state
// + cancelled, a RouteMotif sample, token swatches, and the 4-role type scale.
//
// SECURITY (T-09-05-01): production-gated — `process.env.NODE_ENV === "production"`
// → `notFound()` so the route 404s in prod. It is NEVER linked from any
// header/sidebar/nav (not a discoverable surface), takes NO auth gate (non-prod
// showcase), and renders ONLY static design samples + hardcoded label props —
// zero DB reads, zero env secrets, zero guest PII (T-09-05-02). Safe to delete.
import { notFound } from "next/navigation";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import {
  StatusDot,
  type StatusVariant,
  type TransferState,
} from "@/platform/ui/StatusDot";
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
import { RouteMotif } from "@/platform/ui/RouteMotif";
import { STEPPER_ORDER } from "@/platform/transfers/lifecycle";

// The full 8-state lifecycle union — rendered across BOTH StatusDot variants.
const ALL_STATES: readonly TransferState[] = [
  "requested",
  "paid",
  "claimed",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
];

// Both StatusDot variants — the dot/pill matrix axis.
const VARIANTS: readonly StatusVariant[] = ["dot", "pill"];

// The seven @theme brand colour tokens (globals.css) — name + utility class.
const COLOUR_TOKENS: ReadonlyArray<{ name: string; className: string }> = [
  { name: "teal", className: "bg-teal" },
  { name: "teal2", className: "bg-teal2" },
  { name: "amber", className: "bg-amber" },
  { name: "coral", className: "bg-coral" },
  { name: "slate", className: "bg-slate" },
  { name: "grey", className: "bg-grey" },
  { name: "white", className: "bg-white border border-grey/30" },
];

// Radii samples — the rounded-* utilities generated from --radius-* tokens.
const RADII: ReadonlyArray<{ name: string; className: string }> = [
  { name: "rounded-sm", className: "rounded-sm" },
  { name: "rounded", className: "rounded" },
  { name: "rounded-md", className: "rounded-md" },
  { name: "rounded-lg", className: "rounded-lg" },
  { name: "rounded-xl", className: "rounded-xl" },
  { name: "rounded-full", className: "rounded-full" },
];

// Spacing aliases — the --spacing-* tokens, shown as a fixed-width bar.
const SPACING: ReadonlyArray<{ name: string; className: string }> = [
  { name: "touch-target (44)", className: "w-touch-target" },
  { name: "cta-height (52)", className: "w-cta-height" },
  { name: "gutter (16)", className: "w-gutter" },
  { name: "margin (32)", className: "w-margin" },
];

// The 4 typography roles — display / heading / body / label.
const TYPE_SCALE: ReadonlyArray<{ name: string; className: string }> = [
  { name: "text-display", className: "text-display" },
  { name: "text-heading", className: "text-heading" },
  { name: "text-body", className: "text-body" },
  { name: "text-label", className: "text-label" },
];

// The stepper sample set: each STEPPER_ORDER state as `current`, plus the
// terminal cancelled treatment (D-08, off the happy path).
const STEPPER_SAMPLES: readonly TransferState[] = [...STEPPER_ORDER, "cancelled"];

export default async function DesignSystemShowcasePage() {
  // SECURITY GATE (T-09-05-01): never reachable in production.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [t] = await Promise.all([getDict(), getLang()]);

  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-white px-gutter py-margin text-slate">
      <header className="mb-margin">
        <h1 className="text-display font-semibold text-slate">
          {t.devShowcaseTitle}
        </h1>
        <p className="mt-gutter max-w-2xl text-body text-grey">
          {t.devShowcaseIntro}
        </p>
      </header>

      {/* 1. Tokens — colours / radii / spacing */}
      <section className="mb-margin">
        <h2 className="mb-gutter text-heading font-semibold text-slate">
          {t.devShowcaseTokensHeading}
        </h2>

        <h3 className="mb-2 text-label font-semibold text-grey">
          {t.devShowcaseColoursHeading}
        </h3>
        <ul className="mb-gutter flex flex-wrap gap-gutter">
          {COLOUR_TOKENS.map((c) => (
            <li key={c.name} className="flex flex-col items-center gap-1">
              <span className={`h-12 w-12 rounded-md ${c.className}`} />
              <span className="text-label text-grey">{c.name}</span>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-label font-semibold text-grey">
          {t.devShowcaseRadiiHeading}
        </h3>
        <ul className="mb-gutter flex flex-wrap gap-gutter">
          {RADII.map((r) => (
            <li key={r.name} className="flex flex-col items-center gap-1">
              <span className={`h-12 w-12 bg-teal ${r.className}`} />
              <span className="text-label text-grey">{r.name}</span>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-label font-semibold text-grey">
          {t.devShowcaseSpacingHeading}
        </h3>
        <ul className="flex flex-col gap-2">
          {SPACING.map((s) => (
            <li key={s.name} className="flex items-center gap-gutter">
              <span className={`h-3 bg-teal2 ${s.className}`} />
              <span className="text-label text-grey">{s.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Type scale */}
      <section className="mb-margin">
        <h2 className="mb-gutter text-heading font-semibold text-slate">
          {t.devShowcaseTypeScaleHeading}
        </h2>
        <ul className="flex flex-col gap-2">
          {TYPE_SCALE.map((tp) => (
            <li key={tp.name} className="flex items-baseline gap-gutter">
              <span className={`${tp.className} font-semibold text-slate`}>
                The quick brown fox
              </span>
              <span className="text-label text-grey">{tp.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. StatusDot — 8 states × {dot, pill} matrix */}
      <section className="mb-margin">
        <h2 className="mb-gutter text-heading font-semibold text-slate">
          {t.devShowcaseStatusDotHeading}
        </h2>
        <div className="flex flex-col gap-gutter">
          {VARIANTS.map((variant) => (
            <div key={variant}>
              <h3 className="mb-2 text-label font-semibold text-grey">
                {t.devShowcaseStatusDotVariantHeading}: {variant}
              </h3>
              <ul className="flex flex-wrap items-center gap-x-gutter gap-y-2">
                {ALL_STATES.map((state) => (
                  <li key={`${variant}-${state}`}>
                    <StatusDot state={state} variant={variant} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 4. LifecycleStepper — each STEPPER_ORDER state + cancelled terminal */}
      <section className="mb-margin">
        <h2 className="mb-gutter text-heading font-semibold text-slate">
          {t.devShowcaseStepperHeading}
        </h2>
        <ul className="flex flex-col gap-gutter">
          {STEPPER_SAMPLES.map((state) => (
            <li key={state} className="flex flex-col gap-2">
              <span className="text-label font-semibold text-grey">
                current = {state}
              </span>
              <LifecycleStepper current={state} />
            </li>
          ))}
        </ul>
      </section>

      {/* 5. RouteMotif — default Plane→Building + a custom-label sample */}
      <section className="mb-margin">
        <h2 className="mb-gutter text-heading font-semibold text-slate">
          {t.devShowcaseRouteMotifHeading}
        </h2>
        <div className="flex flex-col gap-margin">
          <RouteMotif />
          <RouteMotif
            start={{ icon: <PlanePin />, label: "SOF Airport" }}
            end={{ icon: <PlanePin />, label: "Seaside Villa" }}
          />
        </div>
      </section>
    </main>
  );
}

// A tiny inline line-pictogram used only for the custom-label RouteMotif sample
// (a literal in-source SVG, never an injected/untrusted mark).
function PlanePin() {
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
      <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
