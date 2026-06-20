// app/admin/health/EmailCapGauge.tsx — read-only email-cap gauge widget (HLTH-03, D-07).
//
// Surfaces today's 'sent' count against the Resend daily soft cap, using the SAME
// EMAIL_SOFT_CAP constant (default 90) as the send-guardrail (platform/notifications/
// send-email.ts:34-37). This is a presentational RSC — the parent page (app/admin/health/
// page.tsx) runs the daily-count query and passes {sent, cap, copy}; this component does
// no I/O of its own.
//
// WCAG 1.4.1 (threat T-06-COLOR): colour is NEVER the sole signal. The numeric
// "{sent} / {cap}" figure ALWAYS renders, and every amber/coral state carries a worded
// TEXT label (warning → emailCapWarning, at-cap → emailCapAtCap). The fill colour is the
// ONLY state-changing colour on the page — teal (ok) / amber (warning) / coral (at-cap).
//
// State thresholds (D-07, mirrored from EmailCapGauge.test.tsx):
//   - ok       : sent < cap - 10            (i.e. < 80 for cap 90)
//   - warning  : cap - 10 <= sent < cap     (80–89) → "Approaching daily cap"
//   - at-cap   : sent >= cap                (>= 90)  → "Daily cap reached …"

// The same default as the send guardrail's softCap() — read from the NON-public env name,
// parsed defensively so a garbage value falls back to 90 (D-07).
export const EMAIL_SOFT_CAP_DEFAULT = (() => {
  const raw = Number(process.env.EMAIL_SOFT_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
})();

export type GaugeState = "ok" | "warning" | "at-cap";

// Pure state-resolver the test imports + asserts at the 80/90 boundaries (cap default 90).
export function gaugeState(sent: number, cap: number = EMAIL_SOFT_CAP_DEFAULT): GaugeState {
  if (sent >= cap) return "at-cap";
  if (sent >= cap - 10) return "warning";
  return "ok";
}

export type EmailCapCopy = {
  emailCapLabel: string;
  emailCapWarning: string;
  emailCapAtCap: string;
  emailCapZero: string;
};

// Fill colour token by state — established @theme classes (teal/amber/coral), NOT raw hex.
const FILL_BY_STATE: Record<GaugeState, string> = {
  ok: "bg-teal",
  warning: "bg-amber",
  "at-cap": "bg-coral",
};

export function EmailCapGauge({
  sent,
  cap = EMAIL_SOFT_CAP_DEFAULT,
  copy,
}: {
  sent: number;
  cap?: number;
  copy: EmailCapCopy;
}) {
  const state = gaugeState(sent, cap);
  const pct = Math.min(sent / cap, 1) * 100;

  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex items-baseline justify-between gap-[8px]">
        {/* Always-rendered worded label (14px/600) — colour-independent. */}
        <span className="text-[14px] font-semibold leading-[1.4] text-grey">
          {copy.emailCapLabel}
        </span>
        {/* The numeric "{sent} / {cap}" figure (20px/600) ALWAYS renders (WCAG 1.4.1). */}
        <span className="text-[20px] font-semibold leading-[1.3] text-slate">
          {`${sent} / ${cap}`}
        </span>
      </div>

      {/* Horizontal meter: white track, fill width = min(sent/cap,1)*100%, fill colour by state. */}
      <div
        className="h-[8px] w-full overflow-hidden rounded-full border border-grey/30 bg-white"
        role="progressbar"
        aria-valuenow={sent}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-label={copy.emailCapLabel}
      >
        <div className={`h-full ${FILL_BY_STATE[state]}`} style={{ width: `${pct}%` }} />
      </div>

      {/* WCAG 1.4.1 — every amber/coral state carries a worded TEXT badge alongside the colour.
          Zero state shows the reassuring emailCapZero copy. The 12px uppercase badge style
          mirrors the established needsAttentionBadge marker. */}
      {sent === 0 ? (
        <span className="text-[14px] leading-[1.4] text-grey">{copy.emailCapZero}</span>
      ) : state === "warning" ? (
        <span className="inline-flex w-fit items-center rounded-[4px] bg-amber px-[8px] py-[2px] text-[12px] font-semibold uppercase tracking-wide text-slate">
          {copy.emailCapWarning}
        </span>
      ) : state === "at-cap" ? (
        <span className="inline-flex w-fit items-center rounded-[4px] bg-coral px-[8px] py-[2px] text-[12px] font-semibold uppercase tracking-wide text-white">
          {copy.emailCapAtCap}
        </span>
      ) : null}
    </div>
  );
}
