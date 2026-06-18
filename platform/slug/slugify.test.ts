// platform/slug/slugify.test.ts — Wave 0 unit coverage for ONBD-03 slug rules + fallback.
//
// Pure-function tests (no mocks): pins the documented slugify transform
// (RESEARCH Pattern 3) including the Cyrillic-empty edge (Pitfall 2), diacritic
// stripping, whitespace collapse, hyphen normalisation, and the 80-char cap.
import { describe, expect, it } from "vitest";

import { slugify } from "@/platform/slug/slugify";

describe("slugify", () => {
  it("lower-cases and hyphenates a plain label", () => {
    expect(slugify("Sunny Beach Resort")).toBe("sunny-beach-resort");
  });

  it("strips Latin diacritics and never leaves stray hyphens", () => {
    expect(slugify("Côte d'Azur")).toBe("cote-d-azur");
  });

  it("collapses runs of whitespace into a single hyphen", () => {
    expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
  });

  it("collapses runs of separators into a single hyphen", () => {
    expect(slugify("a -- b __ c")).toBe("a-b-c");
  });

  it("returns empty string for a Cyrillic-only label (Pitfall 2)", () => {
    expect(slugify("Слънчев бряг")).toBe("");
  });

  it("truncates to at most 80 characters", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it("does not emit leading or trailing hyphens", () => {
    const out = slugify("--Hello, World!--");
    expect(out).toBe("hello-world");
    expect(out.startsWith("-")).toBe(false);
    expect(out.endsWith("-")).toBe(false);
  });
});
