# Phase 7: Notifications - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 13 (4 new modules, 2 new tables in 1 migration, 7 modified seams/UI)
**Analogs found:** 12 / 13 (1 genuinely new primitive: the `sendEmail()` cap/idempotency wrapper)

> The 07-RESEARCH.md already located every hook point at real line numbers and prescribed the
> implementation shapes. This map confirms those analogs against current source (line numbers
> re-verified this session) and assigns the concrete copy-from for each new/modified file.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `platform/notifications/send-email.ts` (NEW) | service (server-only) | request-response (HTTP→Resend) + DB log | `platform/transfers/confirmation-email.ts` (server-only seam) + `platform/supabase/admin.ts` (service-role) | role-match (new primitive) |
| `platform/notifications/notify.ts` (NEW) | service (server-only) | event-driven → DB insert | `platform/supabase/admin.ts` service-role insert pattern | role-match |
| `platform/notifications/templates.ts` (NEW) | utility (server-only) | transform (copy → HTML) | `platform/transfers/confirmation-email.ts` `fill()` + `getDict()` (L31-34, 76-81) | exact |
| `platform/notifications/digest.ts` (NEW) | service (server-only) | batch/transform → fan-out send | masked `wp_pool` read (Phase 5) + `sendEmail` loop | role-match |
| `supabase/migrations/0007_notifications.sql` (NEW) | migration | DDL | `supabase/migrations/0006_release_and_audit.sql` | exact |
| `platform/transfers/confirmation-email.ts` (MODIFY) | service (server-only) | un-stub send | itself (L83-91 stub → `sendEmail`) | exact (in-place) |
| `app/admin/drivers/actions.ts` (MODIFY) | controller (server action) | request-response | itself (L137-138 reveal → `sendEmail`) | exact (in-place) |
| `app/api/stripe/webhook/route.ts` (MODIFY) | controller (route handler) | event-driven fan-out | itself (L194-201 log-and-continue) | exact (in-place) |
| `app/driver/actions.ts` (MODIFY) | controller (server action) | event-driven (`arrived`/`claimed`) | `app/admin/transfers/actions.ts` gated service-role pattern | role-match |
| `app/admin/transfers/actions.ts` (MODIFY) | controller (server action) | event-driven (reassign/release/cancel) | itself (assign L106 / reassign L157 / release L208 / cancel L260) | exact (in-place) |
| `app/pickup/[slug]/actions.ts` (MODIFY) | controller (server action) | request-response (capture locale) | itself (`getDict` L51, `.insert` L103) | exact (in-place) |
| Bell client island (NEW, `app/(driver\|admin)/`) | component (client island) | poll-on-focus read | `app/driver/PoolView.tsx` (L88-112) | exact |
| `platform/i18n/dictionary.ts` (MODIFY) + `en.ts`/`bg.ts` | utility | locale-by-argument accessor | `getDict()`/`getLang()` (L15-22) | exact (in-place) |

## Pattern Assignments

### `platform/notifications/send-email.ts` (NEW — service, server-only) — the only genuinely new primitive

**Analogs:** `platform/transfers/confirmation-email.ts` (server-only boundary + `getDict` + admin client) and `platform/supabase/admin.ts` (service-role pattern). The full target shape is in 07-RESEARCH.md Pattern 3.

**Server-only boundary (copy verbatim as line 1) — from `platform/supabase/admin.ts:1` and `confirmation-email.ts:1`:**
```typescript
import "server-only";
```
This is load-bearing: it makes `next build` FAIL if any client component imports the module — the build-time guarantee the `RESEND_API_KEY` / service-role key never reach the browser (PLAT-05). The `RESEND_API_KEY` is read from a non-`NEXT_PUBLIC_` name.

**Service-role client acquisition — from `platform/supabase/admin.ts:21-32`:**
```typescript
import { createAdminClient } from "@/platform/supabase/admin";
const admin = createAdminClient();   // service-role; bypasses RLS for email_log + notifications writes
```

**Idempotency + soft-cap + send + outcome logging:** copy the full body from 07-RESEARCH.md Pattern 3 (L253-310). Key invariants:
- check `email_log` by `idempotency_key` BEFORE sending (e.g. `confirm:${transferId}`);
- daily-count query: `count` head query on `email_log` filtered `created_at >= todayUTC` and `outcome='sent'`;
- block `best_effort` at `>= SOFT_CAP` (env `EMAIL_SOFT_CAP`, default 90); `critical` always sends;
- pass Resend native `idempotencyKey` as the 2nd `emails.send` arg (defense-in-depth);
- record every outcome (`sent`/`failed`/`skipped_cap`) into `email_log`.
- This module performs ZERO `wp_transfers` writes (money lock — single-writer.test.ts grep gate).

---

### `platform/notifications/templates.ts` (NEW — utility, server-only)

**Analog:** `platform/transfers/confirmation-email.ts` (the `fill()` token interpolation + plain-HTML-string approach). Stay with plain HTML strings — do NOT add `react-email` (matches established style).

**Token interpolation helper (copy verbatim) — `confirmation-email.ts:31-34`:**
```typescript
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}
```

**Plain-HTML body pattern — `confirmation-email.ts:76-81`:**
```typescript
const html = `<!doctype html><html><body>
<h1>${t.confirmEmailHeading}</h1>
<p>${fill(t.confirmEmailBody, { amount: "", arrivalDate: "" })}</p>
<p><a href="${magicLink}">${t.confirmEmailCta}</a></p>
<p>${t.confirmEmailFooter}</p>
</body></html>`;
```
New templates (assigned / arrived / admin-alert / invite / digest) follow this exact shape with new `getDict()`/`getDictFor()` copy keys added to `en.ts`/`bg.ts` (behind the `tsc` Dict-parity gate).

---

### `platform/notifications/notify.ts` (NEW — service, server-only)

**Analog:** service-role insert (07-RESEARCH.md Code Examples L476-486). Same service-role write convention used across the repo (`createAdminClient().from(...).insert(...)`).
```typescript
import "server-only";
await createAdminClient().from("notifications").insert({
  recipient_id: driverId,
  type: "new_paid_pool",
  entity_type: "transfer",   // polymorphic — NO transfer_id column (SC#1)
  entity_id: transferId,
  title: copy.notifNewPoolTitle,
});
```
**`markRead`/`markAllRead`** = gated service-role server actions (caller-auth `recipient_id === auth.uid()` check, then service-role UPDATE) — mirror the two-part gate in `app/admin/transfers/actions.ts` (re-gate then service-role write). NO client write RLS policy (preserves the no-write-policy lock).

---

### `supabase/migrations/0007_notifications.sql` (NEW — migration)

**Analog:** `supabase/migrations/0006_release_and_audit.sql` — copy its header/conventions exactly.

**Authored-not-applied header (copy + adapt the ref guardrail) — `0006:1-8`:**
```sql
-- 0007_notifications.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
-- THIS FILE IS AUTHORED, NOT APPLIED. Live apply via Supabase Management API /database/query
-- with SUPABASE_ACCESS_TOKEN — NOT MCP, NOT `supabase db push`.
```

**Additive ALTER convention (NULL-able, no default → no row rewrite) — `0006:93-95`:**
```sql
alter table public.wp_transfers add column if not exists locale text;   -- D-17; NULL → EN fallback
```

**RLS SELECT-only + no-write-policy lock** (07-RESEARCH.md Pattern 1 + email_log shape, L196-328): `notifications` gets `notifications_own_read` (`auth.uid() = recipient_id`); `email_log` gets `email_log_admin_read` (`public.is_admin()`); NEITHER gets an INSERT/UPDATE policy — service-role-only writes (the `0002`–`0006` lock, see `0006:30-31`). `email_log.idempotency_key` UNIQUE index mirrors `webhook_events.event_id` (race-safe dedup). Platform-generic tables are UNPREFIXED (like `webhook_events`); module objects use `wp_` prefix (`0006:34`).

---

### `platform/transfers/confirmation-email.ts` (MODIFY — un-stub, signature unchanged)

**In-place change — replace the stub at `confirmation-email.ts:83-91`:**
```typescript
// REMOVE this Phase-4 stub block (L83-89):
console.info("[BOOK-06 stub] confirmation email", { to: guestEmail, magicLink });
// REPLACE with:
await sendEmail({
  to: guestEmail, subject, html,
  tier: "critical",
  idempotencyKey: `confirm:${transferId}`,
});
```
Keep the signature `sendBookingConfirmation(transferId, guestEmail)` IDENTICAL (the webhook call-site at `route.ts:197` never changes). Module MUST still contain no `status: 'paid'` literal (confirmation.test.ts + single-writer.test.ts grep gates stay green). For D-17, read persisted `wp_transfers.locale` and resolve copy via `getDictFor(locale ?? 'en')` instead of `getDict()` (no request cookie on the webhook path).

---

### `app/admin/drivers/actions.ts` (MODIFY — NOTF-04 un-stub, D-14)

**In-place change — replace the reveal at `actions.ts:137-138`:**
```typescript
// REMOVE (L138): return { status: "ok", actionLink: data.properties.action_link };
// REPLACE with:
const actionLink = data.properties.action_link;
await sendEmail({
  to: parsed.data.email, subject, html: inviteHtml(actionLink),
  tier: "critical", idempotencyKey: `invite:${userId}`,
});
return { status: "ok" };   // drop actionLink from InviteDriverState (L36-42)
```
Invite copy is EN (`getDictFor('en')`, D-17). Remove the copy-paste link reveal from `DriversView`. The existing `getCurrentRole() !== "admin"` re-gate (L66) and zod validation (L70-78) stay.

---

### `app/api/stripe/webhook/route.ts` (MODIFY — paid fan-out, NOTF-03)

**Analog: itself.** The log-and-continue block at `route.ts:194-201` is the established pattern — copy it for the new admin alert + in-app notifications:
```typescript
const guestEmail = paidRows[0]?.guest_email ?? null;
if (guestEmail) {
  try {
    await sendBookingConfirmation(transferId, guestEmail);   // CRITICAL, un-stubbed
  } catch (err) {
    console.error("[BOOK-06] confirmation send failed (continuing)", err);
  }
}
// ADD (same log-and-continue shape, each independently wrapped):
//  - admin booking-alert email (best_effort, idempotencyKey `admin-alert:${transferId}`)
//  - admin new_paid_booking notification + driver new_paid_pool notifications (notify.ts)
```
Every fan-out is independently `try/catch`-wrapped so a send/insert failure NEVER changes the HTTP status of the money-bearing write. Do NOT add a second `paid` writer.

---

### `app/driver/actions.ts` + `app/admin/transfers/actions.ts` (MODIFY — lifecycle hooks)

**Analog:** `app/admin/transfers/actions.ts` gated server-action pattern (re-gate role → service-role write). Hook points (verified line numbers):
- `app/driver/actions.ts advanceStatus` — `arrived` fires guest "driver arrived" email (best-effort-high). `en_route` fires NOTHING.
- `app/driver/actions.ts claimAction` — after successful claim, narrow service-role `{name, phone}` read of `driver_profiles`, then guest "driver assigned" email (D-16, name+phone). Keep this in the action, NOT in `claim.ts`.
- `app/admin/transfers/actions.ts`: `assign` (L106) → guest assigned + driver `run_assigned`; `reassign` (L157) → `run_reassigned`; `release` (L208) → `run_released` + `new_paid_pool` re-enters pool; `cancel` (L260) → `run_cancelled`.

All wrapped log-and-continue (a notify/send failure never rolls back the lifecycle write). `to:` for guest emails is ALWAYS the row's `guest_email` (server-read) — never a driver/admin channel (Pitfall 5).

---

### Bell client island (NEW — `app/(driver|admin)/`, component)

**Analog:** `app/driver/PoolView.tsx` — copy the poll-on-focus mechanism VERBATIM.

**Poll-on-focus + visibility + interval (copy verbatim) — `PoolView.tsx:101-112`:**
```typescript
useEffect(() => {
  const onFocus = () => pollRef.current();
  const onVisible = () => pollRef.current();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);
  const id = setInterval(() => pollRef.current(), POLL_INTERVAL_MS);
  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(id);
  };
}, []);
```
**Visibility-gated poll callback — `PoolView.tsx:88-99`:**
```typescript
const poll = useCallback(async () => {
  if (document.visibilityState !== "visible") return;
  try {
    const fresh = await refetchPool();   // → refetchNotifications() (RLS own-rows read)
    setRows(fresh);
  } catch { /* transient poll failure non-fatal — keep last good state */ }
}, []);
const pollRef = useRef(poll);
pollRef.current = poll;
```
`POLL_INTERVAL_MS = 25_000` (`PoolView.tsx:55`; ~30-60s per D-04). The refetch server action mirrors `refetchPool` (caller-auth client, RLS-scoped read of `notifications` where `recipient_id = auth.uid()`). NOT Supabase Realtime (D-04 locks polling; overrides ROADMAP SC#1 wording). Admin bell MAY reuse this component (read shape is identical — discretion).

---

### `platform/i18n/dictionary.ts` (MODIFY) + `app/pickup/[slug]/actions.ts` (MODIFY) — D-17 locale

**Analog: itself — `dictionary.ts:15-22`:**
```typescript
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "bg" ? "bg" : "en"; // EN default; only exact "bg" flips.
}
export async function getDict(): Promise<Dict> {
  return (await getLang()) === "bg" ? bg : en;
}
```
ADD a cookie-free, locale-by-argument accessor (for webhook/cron/email paths that have no request cookie):
```typescript
export function getDictFor(lang: Lang): Dict { return lang === "bg" ? bg : en; }
```
In `app/pickup/[slug]/actions.ts createBooking`: capture `const lang = await getLang();` (already imports the i18n module, uses `getDict()` at L51) and write `locale: lang` into the `.insert(...)` at L103. Existing rows → NULL → EN fallback.

## Shared Patterns

### Server-only key boundary
**Source:** `platform/supabase/admin.ts:1` and `platform/transfers/confirmation-email.ts:1`
**Apply to:** `send-email.ts`, `notify.ts`, `templates.ts`, `digest.ts` (line 1 of each)
```typescript
import "server-only";
```
Build-fails if a client component imports it. `RESEND_API_KEY` + service-role key are never `NEXT_PUBLIC_`.

### Service-role write client
**Source:** `platform/supabase/admin.ts:21-32` (`createAdminClient`)
**Apply to:** all `email_log` + `notifications` inserts/updates, the narrow `{name,phone}` driver read, the daily-count query.
```typescript
import { createAdminClient } from "@/platform/supabase/admin";
const admin = createAdminClient();
```

### Gated service-role action (re-gate → service-role write)
**Source:** `app/admin/drivers/actions.ts:66` + `app/admin/transfers/actions.ts:112,124`
**Apply to:** `markRead`/`markAllRead`, admin-triggered notifications.
```typescript
if ((await getCurrentRole()) !== "admin") { return { status: "error", message: t.saveFailed }; }
const admin = createAdminClient();   // bypasses RLS — the in-action gate is the only authz
```
For driver-self mark-read, gate on `recipient_id === auth.uid()` instead of the admin role.

### Log-and-continue fan-out
**Source:** `app/api/stripe/webhook/route.ts:194-201`
**Apply to:** every notification/email fired off `paid`/`claimed`/`arrived`/admin-ops transitions. Each send/insert independently `try/catch`-wrapped; failures `console.error` (the error, NOT recipient PII) and continue — never roll back the money/lifecycle write.

### Migration header + RLS lock
**Source:** `supabase/migrations/0006_release_and_audit.sql:1-8,30-31,93-95`
**Apply to:** `0007_notifications.sql` — Balkanity-ref-only guardrail, authored-not-applied note, additive `add column if not exists` (NULL-able, no default), RLS SELECT-only, NO write policy (service-role-only writes), `wp_` prefix for module objects / unprefixed for platform-generic tables.

### i18n token interpolation
**Source:** `platform/transfers/confirmation-email.ts:31-34,76-81`
**Apply to:** all email templates in `templates.ts`. Plain HTML strings + `fill()` + `getDictFor(lang)`. No `react-email`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `platform/notifications/send-email.ts` (the cap/idempotency/rate-limit *logic*) | service | request-response + DB | The single genuinely new primitive. No existing module enforces a daily soft-cap, idempotency-against-replay, and ≤5 req/s. Composed from existing pieces (server-only boundary + service-role client + `webhook_events`-style UNIQUE-index dedup), but the cap/tier logic itself is new — copy the prescribed shape from 07-RESEARCH.md Pattern 3 (L253-310) rather than an in-repo analog. |

## Metadata

**Analog search scope:** `platform/transfers/`, `platform/supabase/`, `platform/i18n/`, `app/driver/`, `app/admin/`, `app/api/stripe/webhook/`, `app/pickup/`, `supabase/migrations/`
**Files scanned (read this session):** `confirmation-email.ts`, `PoolView.tsx`, `admin.ts`, `webhook/route.ts` (L175-205), `admin/drivers/actions.ts`, `0006_release_and_audit.sql`, `dictionary.ts` (+ grep of `admin/transfers/actions.ts`, `pickup/[slug]/actions.ts`)
**Pattern extraction date:** 2026-06-19
