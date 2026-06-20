---
phase: 07-notifications
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - app/admin/drivers/DriversView.tsx
  - app/admin/drivers/InviteDriverForm.tsx
  - app/admin/drivers/actions.ts
  - app/admin/drivers/invite-email.ts
  - app/admin/drivers/invite.notify.test.ts
  - app/admin/drivers/page.tsx
  - app/admin/page.tsx
  - app/admin/transfers/actions.ts
  - app/api/stripe/webhook/route.ts
  - app/driver/PoolView.tsx
  - app/driver/actions.ts
  - app/driver/advance.notify.test.ts
  - app/driver/page.tsx
  - app/driver/run/RunView.tsx
  - app/driver/run/page.tsx
  - app/driver/settings/DigestPreferenceCard.tsx
  - app/driver/settings/actions.ts
  - app/driver/settings/page.tsx
  - app/notifications/actions.ts
  - app/pickup/[slug]/actions.ts
  - platform/i18n/bg.ts
  - platform/i18n/dictionary.ts
  - platform/i18n/en.ts
  - platform/notifications/assigned-email.test.ts
  - platform/notifications/digest.test.ts
  - platform/notifications/digest.ts
  - platform/notifications/feed.ts
  - platform/notifications/locale.test.ts
  - platform/notifications/notifications-rls.test.ts
  - platform/notifications/notify.ts
  - platform/notifications/send-email.test.ts
  - platform/notifications/send-email.ts
  - platform/notifications/single-sender.test.ts
  - platform/notifications/templates.ts
  - platform/transfers/confirmation-email.ts
  - platform/transfers/confirmation.test.ts
  - platform/ui/NotificationBell.tsx
  - supabase/migrations/0007_notifications.sql
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 7 (notifications) is well-disciplined on the project's hard invariants. The single-`paid`-writer gate holds — the three new fan-out blocks in `app/api/stripe/webhook/route.ts` perform zero `wp_transfers` writes and are all log-and-continue, so a notification failure never alters the money path or the HTTP status. `send-email.ts` is the single Resend call-site with `import "server-only"`, the email_log idempotency/soft-cap layering, and a critical-vs-best_effort tiering. Server keys stay server-side; mark-read and digest-preference writes are gated service-role actions scoped to `auth.getUser()`-derived uids, not client RLS write policies. PII boundaries on the feed (RLS-scoped caller-auth read) and the assigned/arrived email recipients (always `guest_email`) are correct.

Two real defects break notification correctness in production, and both pass the test suite because the tests mock the exact path that fails:

1. **The digest's claimable-pool section is always empty in production** — it reads `wp_pool()` through the service-role client, but `wp_pool()` gates on `auth.uid()`, which is NULL under service-role, so the RPC returns 0 rows. The test mocks the RPC to return rows, masking the bug.
2. **The `assigned:<transferId>` idempotency key collides across claim / assign / reassign** — once a guest has been sent the "driver assigned" email for a transfer, a later reassignment to a *different* driver is silently deduped to `duplicate` and the guest is never told who their actual driver is (wrong name + phone).

A cluster of warnings concerns the digest send-hour timezone semantics, the soft-cap count race, and several missing-guard / dead-code items.

## Critical Issues

### CR-01: Digest claimable-pool read returns 0 rows in production (service-role calls `auth.uid()`-gated RPC)

**File:** `platform/notifications/digest.ts:65`
**Issue:** `buildDigest` reads the claimable pool via `admin.rpc("wp_pool")` on the **service-role** `createAdminClient()`. But `wp_pool()` (migration `0005_claim_correctness.sql:62-100`) is a `SECURITY DEFINER` function whose `WHERE` clause gates rows on:

```sql
and ( public.is_admin() or exists (
  select 1 from public.driver_profiles dp where dp.user_id = (select auth.uid()) ))
```

Under the service-role client there is no caller JWT, so `auth.uid()` is `NULL` and `is_admin()` is `false`. The `exists(...)` matches nothing and `is_admin()` is false, so **`wp_pool()` returns zero rows every time the cron-invoked digest runs.** The "transfers available to claim" half of every digest will silently be empty — the digest's primary value proposition is broken. `digest.test.ts:50-57` mocks `rpc` to return `POOL_ROWS`, so the suite is green while production is broken (the test never exercises the real RLS gate). The module header even acknowledges "cron has no caller JWT" for the own-runs read, but then still routes the pool read through the JWT-gated RPC.

**Fix:** Do not use the `auth.uid()`-gated `wp_pool()` from a cron/service-role context. Read the masked pool columns directly with the service-role client, mirroring the own-runs projection already in this file (the same 9 non-PII columns + the open-pool filter `status='paid' AND driver_id IS NULL`):

```ts
const { data: poolData } = await admin
  .from("wp_transfers")
  .select("id,status,arrival_at,airport,zone,flight_no,amount_cents,pax,luggage_count, destinations(airport,zone)")
  .eq("status", "paid")
  .is("driver_id", null);
// map to DigestItem (airport/zone come off the destinations join, like wp_pool does)
```

Note `airport`/`zone` live on `destinations` (see `wp_pool` body and `app/driver/run/page.tsx`), not on `wp_transfers`, so `POOL_COLUMNS` as currently written would also fail to resolve them on the base-table read — see WR-05.

### CR-02: `assigned:<transferId>` idempotency key collides across claim, assign, and reassign — guest never notified of a new driver

**File:** `app/driver/actions.ts:85`, `app/admin/transfers/actions.ts:123`
**Issue:** The guest "driver assigned" email uses `idempotencyKey: assigned:${transferId}` in all three code paths that assign a driver: self-claim (`claimAction`), admin `assign`, and admin `reassign` (via `sendAssignedEmail`). `send-email.ts:54-61` treats any prior terminal `sent` row for that key as a `duplicate` and short-circuits without sending.

Concrete failure: a transfer is claimed by driver A → guest gets the "your driver is Ivan, +359..." email and `email_log` records `assigned:<id>` = `sent`. Admin later reassigns to driver B (`reassign` calls `sendAssignedEmail` with the same `assigned:<id>` key). The send is deduped → **the guest is never told their driver changed and keeps driver A's name and phone.** The same collision occurs on release-then-reassign and on admin-assign after a self-claim. This is both a correctness defect and a guest-safety issue (the guest waits for / contacts the wrong driver).

`reassign` itself fires only the in-app driver notification (`notifyDriver`), not the guest email — so even setting aside the dedup, the guest is never re-emailed on reassign at all. But the assign path *does* attempt the email and is the one that gets silently swallowed.

**Fix:** Make the idempotency key unique per (transfer, driver) so a genuinely new assignment re-sends while a true retry of the same assignment still dedups:

```ts
idempotencyKey: `assigned:${transferId}:${driverId}`,
```

Apply in `app/driver/actions.ts` (`claimAction`) and in `app/admin/transfers/actions.ts` (`sendAssignedEmail`, which must take/forward the `driverId` it already has). Separately, decide whether `reassign` should also fire the guest assigned email (it currently does not, despite the driver changing) — if so, wire `sendAssignedEmail(admin, id, newDriverId)` into `reassign`.

## Warnings

### WR-01: Digest send-hour compares a "local" preference against UTC hour — digests fire at the wrong wall-clock time

**File:** `platform/notifications/digest.ts:92-101`
**Issue:** `digest_send_hour` is documented as the driver's **local** send hour (`0007_notifications.sql:132`: "self-chosen whole-hour (0–23) **local** send time"; `en.ts` copy "Send at"). But `sendDueDigests` matches it against `new Date().getUTCHours()`. Bulgaria is UTC+2/UTC+3, so a driver who picks 08:00 will receive the digest at 10:00/11:00 local time (or never, if the cron hour that would map to their UTC offset is skipped). For a Bulgaria-only pilot this is a consistent 2–3h skew, not a random failure, but it directly contradicts the stated contract.

**Fix:** Either (a) document and store the hour as UTC and relabel the UI, or (b) convert the stored local hour to UTC before comparison (fixed +2/+3 offset is fragile across DST — prefer storing an explicit timezone or normalizing to UTC at write time in `saveDigestPreference`). Pick one and make the column comment, the UI label, and this comparison agree.

### WR-02: Soft-cap daily count is a read-then-act race that can overshoot the Resend 100/day hard cap

**File:** `platform/notifications/send-email.ts:63-84`
**Issue:** The cap check counts today's `sent` rows, then later inserts the new outcome. Between the count and the insert there is no atomicity. Under the digest fan-out (sequenced ~250ms apart) the window is small, but the webhook fan-out + concurrent driver actions can issue several `sendEmail` calls that each read `dailyCount = 89` and all proceed past the `>= 90` gate before any records its `sent` row. The soft cap is set ~10 below the 100 hard cap specifically as headroom, so a modest overshoot is unlikely to breach 100 during the ~10-transfer pilot — hence WARNING not BLOCKER — but the guard is weaker than the header claims ("soft-blocked at >= EMAIL_SOFT_CAP"). The 10-email headroom is the only thing preventing a hard-cap breach.

**Fix:** Treat the soft cap as best-effort headroom (acceptable for the pilot) but document the race explicitly, or move the count+gate into a single atomic DB function (e.g. an `INSERT ... WHERE (select count ...) < cap RETURNING`) if the hard cap must be guaranteed.

### WR-03: `skipped_cap` / `failed` rows poison the idempotency key for later retries, dropping the audit insert silently

**File:** `platform/notifications/send-email.ts:76-84, 101-108`
**Issue:** The idempotency check at line 59 only short-circuits on a prior `sent`. A prior `skipped_cap` or `failed` row carrying the same `idempotency_key` does **not** short-circuit — the function proceeds and, after sending, attempts a second `INSERT` with the same `idempotency_key` (line 103). The `email_log_idempotency_key_key` UNIQUE index (migration `0007:98`) rejects that insert. The insert's error is never inspected (`await admin.from(...).insert(...)` result is discarded), so the row records `sent` to Resend but **leaves no `sent` audit row** — the daily count under-counts and a subsequent retry would re-send (no `sent` row to dedup against). Example: a `critical` confirmation that was earlier `skipped_cap` (can't happen for critical) or a `best_effort` assigned email that earlier `failed`, then retried.

**Fix:** Either (a) update-or-upsert the existing row by `idempotency_key` instead of blind-inserting the terminal outcome, or (b) make the idempotency keys distinct per attempt-class. At minimum, inspect the insert error and log when the audit write loses the unique race so the daily count discrepancy is visible.

### WR-04: `cancel` has no status guard and no row-count check, unlike the sibling lifecycle actions

**File:** `app/admin/transfers/actions.ts:456-468`
**Issue:** `assign`, `reassign`, and `release` all guard on status (`.eq`/`.in`) and assert `data.length > 0`. `cancel` updates with only `.eq("id", ...)`, no status guard, and never selects/checks the affected row count. It relies entirely on the migration-0004/0006 trigger to reject illegal source states. If the trigger permits `cancel` from more states than intended (or a future trigger change loosens it), an already-`completed` or `cancelled` row could be silently re-cancelled and its `last_action_*` audit overwritten with no error surfaced. The inconsistency with the other four actions is itself a maintenance hazard.

**Fix:** Mirror the others — add an explicit allowed-source-state guard and a `.select("id")` row-count check so a no-op cancel returns `error`/`saveFailed` rather than silently "succeeding".

### WR-05: `POOL_COLUMNS` selects `airport`/`zone` from `wp_transfers`, but those columns live on `destinations`

**File:** `platform/notifications/digest.ts:34-35, 72-78`
**Issue:** `POOL_COLUMNS = "id,status,arrival_at,airport,zone,flight_no,amount_cents,pax,luggage_count"` is selected directly from `wp_transfers` for the own-runs read. Per `wp_pool()` (`0005:79-90`) and `app/driver/run/page.tsx:35`, `airport` and `zone` are columns on `destinations`, joined in — they are not on `wp_transfers`. A base-table select of `airport,zone` will either error (unknown column) or return null/undefined, so the own-runs section of the digest will be missing its airport/zone fields (and may throw, taking the whole driver's digest into the catch). The own-runs test (`digest.test.ts`) mocks the row shape with `airport`/`zone` present, so it never catches this.

**Fix:** Read airport/zone via the `destinations` join (e.g. `... amount_cents,pax,luggage_count, destinations(airport,zone)`) and map them in `toDigestItem`, consistent with the run page and `wp_pool`.

### WR-06: `firstName` can return `undefined` for a whitespace-only name, producing an empty driver name in the guest email

**File:** `app/driver/actions.ts:38-40`, `app/admin/transfers/actions.ts:54-56`
**Issue:** `name.trim().split(/\s+/)[0] ?? name` — if `name` is all whitespace, `"".split(/\s+/)` returns `[""]`, so `[0]` is `""` (not `undefined`), and the `?? name` fallback never triggers, yielding an empty string. The guest "driver assigned" email then renders "Your driver  (+359...)" with a blank name. The caller guards on `p?.name` truthiness, but a whitespace-only `driver_profiles.name` is truthy and slips through. Driver names come from admin invite input (`inviteDriver` validates `name` with `z.string().trim().min(1)`), so a pure-whitespace name shouldn't normally persist — hence WARNING — but the helper's `?? name` fallback is dead for the empty-string case and misleading.

**Fix:** `const parts = name.trim().split(/\s+/).filter(Boolean); return parts[0] ?? name;` and/or guard the email send on a non-empty trimmed name.

### WR-07: `DigestPreferenceCard` always posts a non-empty `hour`, so disabling never reaches the "enabled requires hour" refine and a stale hour relies solely on the server coercion

**File:** `app/driver/settings/DigestPreferenceCard.tsx:84-97`, `app/driver/settings/actions.ts:31-46`
**Issue:** The `Select` has `defaultValue={initial.hour ?? 8}` and is only visually `disabled` when the toggle is off — but a disabled `<select>` does not submit its value, so when the driver disables the digest, `formData.get("hour")` is `null` → coerced to `undefined`. That happens to be fine because the server forces `digest_send_hour: null` when `enabled` is false. However, the schema's cross-field refine `(!d.enabled || d.hour !== undefined)` means: if the browser ever *does* submit a value while disabled (e.g. a non-standard control), the hour is written-then-nulled. More importantly the client never validates the enabled+hour pairing, so the only feedback on a missing hour is a generic `digestSaveFailed` toast with no field-level guidance. This is a UX/robustness gap, not a security issue.

**Fix:** Surface the `path: ["hour"]` refine error as a field-level message, and make the toggle-off path explicit (clear the select value on disable) so the contract is enforced client-side too, not just server-coerced.

## Info

### IN-01: `markRead` (single) is dead code — exported through two layers but never invoked

**File:** `platform/notifications/notify.ts:63-76`, `app/notifications/actions.ts:29-31`
**Issue:** `NotificationBell.tsx` only uses `markAllRead` and `refetchNotifications`. The single-item `markRead` is exported from both `notify.ts` and the action seam but has no call-site in the UI. Dead surface area that still ships a gated write path.
**Fix:** Remove `markRead` from both layers until a per-item mark-read affordance exists, or wire it into the bell's per-row click.

### IN-02: `getDictFor` accepts an untyped `Lang` while the row locale is an arbitrary string — defensive narrowing is duplicated ad hoc

**File:** `platform/i18n/dictionary.ts:28-30`, `platform/notifications/templates.ts:26-28`, `platform/transfers/confirmation-email.ts:61`
**Issue:** Three separate call-sites re-implement the `locale === "bg" ? "bg" : "en"` narrowing (`langFor`, the inline ternary in confirmation-email, etc.). Consistent but duplicated; a future locale would require touching each.
**Fix:** Export a single `coerceLang(locale: string | null | undefined): Lang` helper from `dictionary.ts` and reuse it everywhere.

### IN-03: `buildDigestEmail` returns `to: ""` and relies on the caller to override it — fragile contract

**File:** `platform/notifications/templates.ts:169`
**Issue:** `buildDigestEmail` returns `{ to: "", subject, html }`; `digest.ts` ignores the empty `to` and passes the real address to `sendEmail` separately. A future caller that trusts the builder's `to` would send to an empty recipient. The other builders return a meaningful `to`.
**Fix:** Either drop `to` from the digest builder's return type (it never carries a recipient) or have the caller pass the recipient in so the builder returns the correct `to`.

### IN-04: `email_log.recipient` stores the raw recipient address in plaintext — confirm this is intended for the health gauge

**File:** `platform/notifications/send-email.ts:78-82, 103-107`, `supabase/migrations/0007_notifications.sql:87`
**Issue:** Every send records `recipient` (the guest/driver/admin email) in `email_log`. The table is admin-read-only via RLS, so it is not exposed to drivers/guests, and the code is careful never to log addresses to `console`. But guest emails are PII and now live in a second table beyond `wp_transfers`. Acceptable for an auditable send log, but worth an explicit decision (and a retention note) given the PII-minimization posture elsewhere in the brief.
**Fix:** Confirm the admin-read-only RLS is sufficient for your PII policy; consider storing a hash or the idempotency key alone if the raw address isn't needed for the health gauge.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
