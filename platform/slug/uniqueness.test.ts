// platform/slug/uniqueness.test.ts — Wave 0 unit coverage for the collision-suffix
// strategy (ONBD-03). `nextSlugCandidate` is the pure suffix helper the
// destinations server action (Plan 04) reuses; here we drive a mocked "taken"
// predicate through a small resolver loop to prove the `x` → `x-2` behaviour and
// the empty-base "dest" fallback (Pitfall 2).
import { describe, expect, it, vi } from "vitest";

import { nextSlugCandidate } from "@/platform/slug/slugify";

// Resolver mirroring the server action's loop, built on the pure helper so the
// suffix arithmetic stays under test without a DB.
async function resolveSlug(
  base: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let n = 1;
  let candidate = nextSlugCandidate(base, n);
  while (await taken(candidate)) {
    n += 1;
    candidate = nextSlugCandidate(base, n);
  }
  return candidate;
}

describe("nextSlugCandidate", () => {
  it("returns the base unchanged for the first attempt", () => {
    expect(nextSlugCandidate("sunny-beach", 1)).toBe("sunny-beach");
  });

  it("appends the ordinal suffix for later attempts", () => {
    expect(nextSlugCandidate("sunny-beach", 2)).toBe("sunny-beach-2");
    expect(nextSlugCandidate("sunny-beach", 3)).toBe("sunny-beach-3");
  });

  it("falls back to 'dest' when the base is empty (Cyrillic-empty case)", () => {
    expect(nextSlugCandidate("", 1)).toBe("dest");
    expect(nextSlugCandidate("", 2)).toBe("dest-2");
  });
});

describe("collision resolver (uniqueSlug strategy)", () => {
  it("re-suffixes once when the base is taken: 'x' → 'x-2'", async () => {
    const taken = vi
      .fn<(candidate: string) => Promise<boolean>>()
      .mockResolvedValueOnce(true) // "x" is taken
      .mockResolvedValueOnce(false); // "x-2" is free
    expect(await resolveSlug("x", taken)).toBe("x-2");
    expect(taken).toHaveBeenNthCalledWith(1, "x");
    expect(taken).toHaveBeenNthCalledWith(2, "x-2");
  });

  it("returns the base immediately when nothing is taken", async () => {
    const taken = vi.fn().mockResolvedValue(false);
    expect(await resolveSlug("free", taken)).toBe("free");
    expect(taken).toHaveBeenCalledTimes(1);
  });
});
