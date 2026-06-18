// platform/money/commission.test.ts — Wave 0 unit coverage for ONBD-04 cents math.
//
// Pins the integer-cents commission/net/fee derivations (RESEARCH Pattern 4,
// D-05/D-06/D-07) incl. round-half-up, the EEA 1.5% + €0.25 fee estimate, and
// the EUR formatter. These values are DISPLAY-ONLY; nothing here is persisted.
import { describe, expect, it } from "vitest";

import {
  commissionCents,
  estStripeFeeCents,
  fmtEur,
  netCents,
} from "@/platform/money/commission";

describe("commissionCents", () => {
  it("takes a whole-percent cut of the price in cents", () => {
    expect(commissionCents(10000, 15)).toBe(1500); // 15% of €100.00
  });

  it("rounds half-up", () => {
    expect(commissionCents(999, 15)).toBe(150); // 149.85 → 150
  });

  it("returns 0 at the 0% endpoint and the full price at 100%", () => {
    expect(commissionCents(7350, 0)).toBe(0);
    expect(commissionCents(7350, 100)).toBe(7350);
  });
});

describe("netCents", () => {
  it("is price minus commission", () => {
    expect(netCents(10000, 15)).toBe(8500);
  });
});

describe("estStripeFeeCents", () => {
  it("is 1.5% rounded plus the €0.25 fixed fee", () => {
    expect(estStripeFeeCents(10000)).toBe(175); // round(150) + 25
  });

  it("floors at the €0.25 fixed fee for a zero price", () => {
    expect(estStripeFeeCents(0)).toBe(25);
  });
});

describe("fmtEur", () => {
  it("formats integer cents as a two-decimal euro amount", () => {
    expect(fmtEur(8500)).toBe("85.00");
  });
});
