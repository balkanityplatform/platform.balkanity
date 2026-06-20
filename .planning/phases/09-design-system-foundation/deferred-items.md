# Phase 09 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed by the originating plan).

## 09-03 (RouteMotif) — pre-existing repo-wide lint errors (out of scope)

Observed during `npm run lint` while executing 09-03. None are in files this plan touched (`platform/ui/RouteMotif.tsx` lints clean, exit 0). Logged, not fixed:

- `app/driver/run/[id]/...` — `no-html-link-for-pages` (use next/link), `Cannot access refs during render`, `Cannot call impure function during render`.
- digest settings component — `set-state-in-effect` (setState synchronously within an effect).
- Warnings: unused `_input` (booking.test.ts), unused `_params` (checkout.test.ts).

These predate 09-03 and belong to the respective surface phases (11 driver / 7 notifications).
