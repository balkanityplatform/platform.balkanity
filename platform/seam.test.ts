import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Wave 0 baseline: a real green signal proving the platform/modules seam
// directories exist (PLAT-01 structural invariant). Not an empty suite.
describe("platform/modules seam", () => {
  const root = process.cwd();

  it("the platform/ directory exists", () => {
    expect(existsSync(resolve(root, "platform"))).toBe(true);
  });

  it("the modules/welcome-pickup/ directory exists", () => {
    expect(existsSync(resolve(root, "modules", "welcome-pickup"))).toBe(true);
  });
});
