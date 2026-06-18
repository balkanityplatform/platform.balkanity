// vitest.setup.ts — registers @testing-library/jest-dom matchers (toHaveClass,
// toBeInTheDocument, etc.) for component tests under jsdom.
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Neutralize the `server-only` package under the jsdom test environment. The real
// package throws on import to fail `next build` when a SERVER-only module is pulled
// into a Client Component bundle (the secret-key leak guard in admin.ts / payments/*).
// That build-time guard is still enforced by `next build`; under vitest we stub it to
// a no-op so server-only modules (e.g. platform/payments/{stripe,checkout,fee}.ts) can
// be unit-tested directly. This does NOT weaken the production boundary.
vi.mock("server-only", () => ({}));
