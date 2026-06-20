// app/admin/health/EmailCapGauge.test.tsx — email-cap gauge threshold states (HLTH-03).
//
// NYQUIST BASELINE — RED until Plan 03 lands the widget (app/admin/health/EmailCapGauge.tsx).
// The dynamic runtime-string import below type-checks BEFORE the implementation exists, then
// THROWS at runtime → this suite is RED now. Do NOT create the component here.
//
// D-07 (HLTH-03): the gauge surfaces today's 'sent' count against the Resend daily cap, using
// the SAME EMAIL_SOFT_CAP constant (default 90) as the send-guardrail soft cap. WCAG 1.4.1
// (colour is never the sole signal): every coral/amber state ALSO carries a TEXT marker, and
// the numeric "{sent} / {cap}" figure always renders. The three states at the 80/90 boundaries:
//   - ok       : sent < cap-10  (i.e. < 80)
//   - warning  : cap-10 <= sent < cap  (80–89) → renders emailCapWarning "Approaching daily cap"
//   - at-cap   : sent >= cap  (>= 90)         → renders emailCapAtCap "Daily cap reached …"
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";

// Real copy keys (en.ts strings) the gauge consumes — passed as props so the test asserts the
// worded labels + the "{sent} / {cap}" figure exactly as the page wires them.
type GaugeCopy = {
  emailCapLabel: string;
  emailCapWarning: string;
  emailCapAtCap: string;
  emailCapZero: string;
};
const copy: GaugeCopy = {
  emailCapLabel: "Emails sent today",
  emailCapWarning: "Approaching daily cap",
  emailCapAtCap: "Daily cap reached — non-critical emails paused",
  emailCapZero: "No emails sent yet today.",
};

type GaugeProps = { sent: number; cap?: number; copy: GaugeCopy };
type Gauge = ComponentType<GaugeProps>;

async function loadGauge(): Promise<Gauge> {
  const specifier = "@/app/admin/health/EmailCapGauge";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    EmailCapGauge: Gauge;
  };
  return mod.EmailCapGauge;
}

describe("email-cap gauge threshold states (HLTH-03)", () => {
  it("ok — below cap-10 (sent 40, cap 90) shows the figure, no warning/at-cap label", async () => {
    const EmailCapGauge = await loadGauge();
    render(<EmailCapGauge sent={40} copy={copy} />); // default cap 90
    expect(screen.getByText("40 / 90")).toBeInTheDocument();
    expect(screen.queryByText(copy.emailCapWarning)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.emailCapAtCap)).not.toBeInTheDocument();
  });

  it("warning — at the 80 boundary (sent 80, cap 90) shows the 'Approaching daily cap' label", async () => {
    const EmailCapGauge = await loadGauge();
    render(<EmailCapGauge sent={80} copy={copy} />);
    expect(screen.getByText("80 / 90")).toBeInTheDocument();
    expect(screen.getByText(copy.emailCapWarning)).toBeInTheDocument();
    expect(screen.queryByText(copy.emailCapAtCap)).not.toBeInTheDocument();
  });

  it("at-cap — at the 90 boundary (sent 90, cap 90) shows the 'Daily cap reached' label", async () => {
    const EmailCapGauge = await loadGauge();
    render(<EmailCapGauge sent={90} copy={copy} />);
    expect(screen.getByText("90 / 90")).toBeInTheDocument();
    expect(screen.getByText(copy.emailCapAtCap)).toBeInTheDocument();
  });

  it("zero — sent 0 renders the empty/zero copy", async () => {
    const EmailCapGauge = await loadGauge();
    render(<EmailCapGauge sent={0} copy={copy} />);
    expect(screen.getByText(copy.emailCapZero)).toBeInTheDocument();
  });
});
