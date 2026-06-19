# Deferred Items — Phase 07 (notifications)

Out-of-scope discoveries logged during plan execution. NOT fixed in the discovering plan
(scope boundary: only auto-fix issues directly caused by the current task's changes).

## From Plan 07-03 execution (2026-06-19)

### Pre-existing RED specs (later-plan TDD baselines — RED by design)
- `platform/notifications/digest.test.ts` (NOTF-05) — `buildDigest` lands in Plan 05.
- `app/admin/drivers/invite.notify.test.ts` (NOTF-04 / D-14) — invite→sendEmail un-stub lands in Plan 04.
- `app/driver/advance.notify.test.ts` (NOTF-02) — arrived-transition fan-out lands in Plan 04.

### Pre-existing breakage NOT caused by Plan 07-03 (file untouched by this plan)
- `app/pickup/[slug]/booking.test.ts` (BOOK-02 / BOOK-03) — 8 failing.
  - **Root cause:** the booking server action started importing `getLang` from
    `@/platform/i18n/dictionary` in Plan 07-01 (commit `30a284e`, "booking locale"),
    but `booking.test.ts`'s `vi.mock("@/platform/i18n/dictionary")` only stubs `getDict`,
    not `getLang` → `No "getLang" export is defined on the ... mock`, so the action throws
    before its validation/insert assertions run.
  - **Proof it is pre-existing:** at commit `122df2e` (before any Plan 07-03 work) the test
    passed 8/8; restoring the `app/pickup` tree from `122df2e` makes it pass again, so the
    booking SOURCE is unchanged by Plan 07-03 — the regression entered via the Plan 07-01
    dictionary-import change to the booking action.
  - **Fix owner:** add `getLang` to the booking test's dictionary mock — belongs to the
    Plan 07-01 follow-up or Plan 04 (which un-stubs the booking/confirmation email path).
    Do NOT fix here (out of Plan 07-03 scope; the bell does not touch `app/pickup`).
