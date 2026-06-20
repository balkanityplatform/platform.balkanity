# Deferred Items — Phase 08 platform-health

Out-of-scope discoveries logged during execution (not fixed; pre-existing, unrelated to the
current task's files per the executor SCOPE BOUNDARY rule).

## Pre-existing lint errors (discovered during 08-02 Task 3 `npm run lint`)

These all live in files NOT modified by Plan 08-02 (driver/admin UI + test files) and pre-exist
on the prior baseline (verified at HEAD~2). They are NOT caused by the health detection layer.

| File | Issue |
|------|-------|
| `app/admin/transfers/page.tsx:122` | `Cannot call impure function during render` (react-hooks) |
| `app/driver/PoolView.tsx:108` | `Cannot access refs during render` (react-hooks) |
| `app/driver/run/[id]/page.tsx:90` | `<a>` to `/driver/run/` — use `<Link />` (@next/next/no-html-link-for-pages) |
| `app/driver/settings/DigestPreferenceCard.tsx:61` | `setState synchronously within an effect` (react-hooks/set-state-in-effect) |
| `app/admin/transfers/[id]/TransferDetailView.tsx` | lint warning(s) |
| `app/admin/drivers/invite.test.ts`, `app/pickup/[slug]/booking.test.ts`, `platform/payments/checkout.test.ts` | unused-var warnings in test files |

All Plan 08-02 files (`platform/health/*.ts`, `app/api/cron/health/route.ts`) lint clean.

## Pre-existing RED-by-absence spec (discovered during 08-03 `npm run test`)

`app/api/cron/digest/route.test.ts` (2 failures) is a Plan 08-01 Wave-0 Nyquist RED spec
(committed `06df9df`) that is RED-by-absence because its target `app/api/cron/digest/route.ts`
does not yet exist — it is resolved by **Plan 08-04** (per the 08-01 Known Stubs table). NOT
caused by Plan 08-03; all 08-03 files (`app/admin/health/*`) and the EmailCapGauge spec are
GREEN. Out of scope per the executor SCOPE BOUNDARY rule.
