// platform/money/commission.ts — integer-cents commission/net/fee math (ONBD-04).
//
// DISPLAY-ONLY derivations (D-05/D-06/D-07): the admin form recomputes these live
// from `price_cents` + `commission_pct` to render the "You keep" panel. NEVER
// persist commission/net/fee — only price and pct are stored; everything else is
// derived at render. Integer cents in, integer cents out — no floats (D-07), so
// there is zero rounding drift before Stripe (Phase 3) consumes minor units.

/**
 * Whole-percent commission of a price, in cents, rounded half-up (D-05).
 * `pct` is a whole percent (e.g. 15 → 15%).
 */
export function commissionCents(priceCents: number, pct: number): number {
  return Math.round((priceCents * pct) / 100);
}

/** What the agency keeps before fees: price minus commission (D-05). */
export function netCents(priceCents: number, pct: number): number {
  return priceCents - commissionCents(priceCents, pct);
}

/**
 * Estimate-only Stripe fee for the "You keep" note (D-06).
 * EEA consumer card: 1.5% + €0.25 fixed (CLAUDE.md Verified Provider Facts).
 * No fee is actually applied here — real fee logic lives in Phase 3.
 */
export function estStripeFeeCents(priceCents: number): number {
  return Math.round(priceCents * 0.015) + 25;
}

/** Format integer cents as a two-decimal euro amount string (e.g. 8500 → "85.00"). */
export const fmtEur = (cents: number): string => (cents / 100).toFixed(2);
