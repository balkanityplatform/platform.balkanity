// platform/i18n/dictionary.test.ts — PLAT-04 / T-04-01 (EN default + cookie gate).
//
// Proves getLang() defaults to EN when no cookie is set (D-04), selects BG only on
// an exact `bg` value, and falls back to EN for spoofed/garbage values (no
// injection surface). cookies() from next/headers is mocked per case.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: getMock }),
}));

import { getDict, getLang } from "./dictionary";
import { en } from "./en";
import { bg } from "./bg";

function setCookie(value: string | undefined) {
  getMock.mockReturnValue(value === undefined ? undefined : { value });
}

describe("getLang / getDict", () => {
  beforeEach(() => getMock.mockReset());

  it("defaults to EN when no lang cookie is set", async () => {
    setCookie(undefined);
    expect(await getLang()).toBe("en");
    expect(await getDict()).toBe(en);
  });

  it("selects BG only on an exact 'bg' cookie value", async () => {
    setCookie("bg");
    expect(await getLang()).toBe("bg");
    expect(await getDict()).toBe(bg);
  });

  it("falls back to EN for a spoofed/garbage cookie value (T-04-01)", async () => {
    setCookie("xx-INJECT");
    expect(await getLang()).toBe("en");
    expect(await getDict()).toBe(en);
  });
});
