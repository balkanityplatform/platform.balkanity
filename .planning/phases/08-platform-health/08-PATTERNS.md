# Phase 8: Platform Health - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 10 (9 new, 1 modified config) + 1 modified test gate
**Analogs found:** 10 / 10 (every new file has an in-repo analog — Phase 8 is wiring, not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0008_platform_health.sql` | migration | DDL + scheduled-job DDL | `supabase/migrations/0007_notifications.sql` | exact (table+RLS); new (pg_cron/pg_net DDL) |
| `app/api/cron/health/route.ts` | route | request-response (machine-to-machine) | `app/api/stripe/webhook/route.ts` | role-match (route + secret-auth + service-role + nodejs) |
| `app/api/cron/digest/route.ts` | route | request-response (machine-to-machine) | `app/api/stripe/webhook/route.ts` | role-match (thin wrapper over `sendDueDigests`) |
| `platform/health/reconcile.ts` | service | transform / event-driven (detect+alert) | `platform/notifications/digest.ts` | exact (server-only, service-role, no-JWT projection, alert fan-out) |
| `platform/health/stuck.ts` | service | transform (predicate + dedup) | `platform/notifications/digest.ts` + `send-email.ts` dedup | exact (same projection + per-entity dedup) |
| `platform/health/keepalive` (heartbeat write) | service/utility | file-I/O→DB write | `platform/notifications/notify.ts` `insertNotification` | role-match (service-role write) |
| `app/admin/health/EmailCapGauge.tsx` (or fold into `app/admin/page.tsx`) | component | CRUD-read (read-only) | `send-email.ts:63–71` count query + `app/admin/page.tsx` gate | exact (verbatim count query + RSC gate) |
| `vercel.json` (add `crons[]`) | config | config | research §"Vercel daily backstop" | new (no existing cron config) |
| `platform/health/reconcile.test.ts`, `stuck.test.ts`, `app/api/cron/*/route.test.ts`, `EmailCapGauge.test.tsx` | test | n/a | `platform/notifications/send-email.test.ts` (admin-client mock fixture) | role-match |
| `platform/payments/single-writer.test.ts` (MODIFIED — extend grep gate) | test | n/a | itself (extend `ALLOWED_WRITERS` / roots) | exact |

**Shared alert-delivery sinks (reused, NOT recreated):** `platform/notifications/notify.ts` → `insertNotification`, `platform/notifications/send-email.ts` → `sendEmail`, `platform/notifications/digest.ts` → `sendDueDigests`.

---

## Pattern Assignments

### `app/api/cron/health/route.ts` (route, machine-to-machine)

**Analog:** `app/api/stripe/webhook/route.ts`

**Runtime + secret-auth pattern** — copy the `runtime = "nodejs"` lock and a header-secret gate. The webhook authenticates the *sender* via HMAC, not a session; the cron route is the same shape with `x-cron-secret` instead. Use `crypto.timingSafeEqual` (research §Security V6) — never `===`.

```typescript
// from app/api/stripe/webhook/route.ts:25-36 — copy the imports + runtime lock
import { type NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";   // INVARIANT 1: NEVER Edge (service-role + crypto fragile on Edge)
```

**Response helper** (webhook lines 43-48) — reuse the `new NextResponse(JSON.stringify(...))` shape (the webhook deliberately avoids `.json(`; match it for consistency).

**Service-role-after-auth** (webhook line 75): `const admin = createAdminClient();` only AFTER the auth gate passes — zero work before 401.

**Money lock (CRITICAL):** this route must perform ZERO `wp_transfers` writes of `status:'paid'`. It DETECTS and ALERTS only (D-01). The webhook (line 150) remains the sole `paid` writer. The `single-writer.test.ts` grep gate MUST be extended to cover `app/api/cron/*` and `platform/health/*` (see modified-file entry below).

---

### `app/api/cron/digest/route.ts` (route, machine-to-machine)

**Analog:** `app/api/stripe/webhook/route.ts` (auth shape) + `platform/notifications/digest.ts` (the invokable it wraps)

Thin wrapper: same `x-cron-secret` gate as the health route, then `await sendDueDigests()`. `sendDueDigests` already self-filters by `digest_send_hour == getUTCHours()` (digest.ts:117,126) — the route adds NO scheduling logic, just authn + the call.

```typescript
import { sendDueDigests } from "@/platform/notifications/digest";
export const runtime = "nodejs";
// POST: if (!authorized(req)) return 401-zero-work; await sendDueDigests(); return { ok: true };
```

---

### `platform/health/reconcile.ts` (service, detect+alert)

**Analog:** `platform/notifications/digest.ts`

**Server-only + service-role + no-JWT projection** — copy the digest.ts header discipline exactly:

```typescript
// from platform/notifications/digest.ts:1,31 — the boundary lock + client factory
import "server-only";  // line 1 — build fails if a client component imports this
import { createAdminClient } from "@/platform/supabase/admin";
```

**CR-01 trap (copy this awareness):** the cron path has NO caller JWT, so it MUST read base tables directly with an explicit projection — NEVER through `wp_pool()` (it gates on `auth.uid()`/`is_admin()` → 0 rows under service-role; digest.ts:67-85, 77-90). Read `webhook_events` and `wp_transfers` directly on `admin`.

**Detection query** (research §Pattern 2, anti-join over `webhook_events ⨝ wp_transfers`):
- link key `payload #>> '{data,object,metadata,transfer_id}'` — the webhook writes `session.metadata.transfer_id` (webhook route.ts:117) and stores the full event as `payload` (route.ts:89), so the session is at `data.object`.
- filter to events older than a ~10-min lookback (Pitfall 1) to skip in-flight transfers.
- D-03 RESOLVED: **Stripe API is source of truth** — list recent paid Checkout Sessions via `getStripe()` (server-only key) and anti-join `wp_transfers` paid, to catch a *never-delivered* webhook (which leaves no `webhook_events` row). `webhook_events` outcomes (`no_matching_transfer`/`write_failed`) are a secondary cross-check.

**Stripe client for the listing** — analog `platform/payments/stripe.ts`:
```typescript
import { getStripe } from "@/platform/payments/stripe";  // server-only; apiVersion pinned 2026-05-27.dahlia
// getStripe().checkout.sessions.list({ ... })  — server-only key, never client
```

**Alert fan-out** (D-09) — reuse both sinks, exactly as the webhook's paid fan-out does (route.ts:216-260):
```typescript
import { insertNotification } from "@/platform/notifications/notify";   // in-app (all health types)
import { sendEmail } from "@/platform/notifications/send-email";        // critical-tier admin email (reconciliation only)
// resolve admins: admin.from("app_users").select("id, email").eq("role","admin")  (route.ts:218-222)
// reconciliation discrepancy → insertNotification(...) AND sendEmail({ tier: "critical", idempotencyKey: ... })
```
Per-block log-and-continue (route.ts:223-225, 240-242): a failed alert must never throw past the loop.

**Dedup before alert (Pitfall 2)** — mirror the cap-near once-per-day dedup in `send-email.ts:131-136`: count existing open `health_events` for `(kind, entity_id)` and skip if already alerted (the partial index `health_events_open_idx` backs this).

---

### `platform/health/stuck.ts` (service, predicate + dedup)

**Analog:** `platform/notifications/digest.ts` (read shape) + `send-email.ts:131-136` (dedup)

Predicate (research §Pattern 3): `wp_transfers WHERE status='paid' AND driver_id IS NULL AND arrival_at IS NOT NULL AND arrival_at <= now()+interval '12 hours'` (D-04). Read directly on `createAdminClient()` with explicit columns (CR-01).

**D-05 in-app only:** stuck alerts go through `insertNotification` ONLY — NO `sendEmail` in this file (test asserts absence). Dedup per `transfer_id` against `health_events` before inserting.

---

### Keep-alive heartbeat write (HLTH-05)

**Analog:** `platform/notifications/notify.ts:47-59` (`insertNotification` service-role write shape, wrapped log-and-continue)

A tiny service-role `UPDATE health_heartbeat SET last_ping = now()` inside the health route (any DB write = "activity" that defeats the 7-day pause, Pitfall 3). Belt-and-braces with the Vercel daily backstop (`vercel.json`). Wrap in try/catch (non-fatal) like `insertNotification`.

---

### `app/admin/health/EmailCapGauge.tsx` (component, read-only RSC)

**Analog:** daily-count query in `send-email.ts:63-71` (verbatim) + `app/admin/page.tsx` role gate

**Role gate** (app/admin/page.tsx:18-23): every admin surface resolves `getCurrentRole()` and redirects non-admins to `/sign-in` BEFORE render (server-side, not UI-only).
```typescript
import { getCurrentRole } from "@/platform/auth/role";
const role = await getCurrentRole();
if (role !== "admin") redirect("/sign-in");
```

**Count query** (verbatim shape from send-email.ts:63-71, D-07 threshold):
```typescript
const todayUtc = new Date(); todayUtc.setUTCHours(0, 0, 0, 0);
const { count } = await admin
  .from("email_log")
  .select("id", { count: "exact", head: true })
  .gte("created_at", todayUtc.toISOString())
  .eq("outcome", "sent");
const cap = Number(process.env.EMAIL_SOFT_CAP) || 90;  // SAME constant as the guardrail (send-email.ts:34-37)
```
**Read path nuance:** the gauge reads via the cookie-bound caller-auth client + the `email_log_admin_read` RLS policy (0007:153-156) — NOT service-role — to stay inside the existing RLS boundary. States: ok (< cap-10) | warning (>= cap-10) | at-cap (>= cap).

---

### `supabase/migrations/0008_platform_health.sql` (migration)

**Analog:** `supabase/migrations/0007_notifications.sql`

**FLAGGED header + Balkanity-only guardrail** (copy 0007:1-9 verbatim style): authored-not-applied; live apply via Supabase Management API `/database/query` with `SUPABASE_ACCESS_TOKEN` — **NOT MCP, NOT `supabase db push`**. Target ref `qyhdogajtmnvxphrslwm` ONLY; NEVER Kalvia (`utyatpadtibqqswsfvtr`).

**`health_events` table** — mirror the `notifications`/`email_log` conventions (0007:56-66, 84-103): UNPREFIXED (platform-generic), polymorphic `entity_type`/`entity_id` (NO `transfer_id` column, SC#1), `gen_random_uuid()` PK, `created_at timestamptz default now()`. `entity_id` is `text` (Stripe event ids are not uuid).

**RLS pattern** (copy 0007:140-156 verbatim): `enable row level security`; a single admin-read SELECT policy `using ( public.is_admin() )` (reuse 0002's `is_admin()`, do NOT redefine); **NO INSERT/UPDATE/DELETE policy** → service-role-only writes (the no-write-policy lock holds).

**Re-runnability** (0007:44-46): `create table if not exists`, `create index if not exists`, `drop policy if exists` before each `create policy`.

**NEW (no 0007 analog) — extensions + cron schedules** (research §Code Examples):
```sql
create extension if not exists pg_cron;   -- 1.6.4 available, NOT installed (verified live)
create extension if not exists pg_net;    -- 0.20.3 available, NOT installed
-- idempotent reschedule guard:
select cron.unschedule('health-sweep') where exists (select 1 from cron.job where jobname='health-sweep');
select cron.unschedule('digest-hourly') where exists (select 1 from cron.job where jobname='digest-hourly');
-- then cron.schedule(...) with net.http_post → the Vercel route, x-cron-secret from vault.decrypted_secrets
```
Secret via `supabase_vault` (`0.3.1`, already installed): `vault.create_secret('<random>','cron_secret')`; same value set as Vercel env `CRON_SECRET`.

---

### `platform/payments/single-writer.test.ts` (MODIFIED test — grep gate)

**Analog:** itself. The gate (lines 28, 74-82) scans `ROOTS = ["app","platform","modules"]` for `status:'paid'` writers and asserts subset of `ALLOWED_WRITERS`. Phase 8 adds `app/api/cron/*` and `platform/health/*` — these are NOT new sanctioned writers, so the gate stays GREEN only if those files never write `status:'paid'`. No change to `ALLOWED_WRITERS` needed; the gate already covers `app/` and `platform/` roots, so it automatically guards the new files (research §Test Map asserts this is the intended belt). Confirm the new dirs fall under the existing roots (they do) — no edit may be required beyond verifying coverage.

---

## Shared Patterns

### server-only key boundary
**Source:** first line of `platform/supabase/admin.ts`, `stripe.ts`, `send-email.ts`, `notify.ts`, `digest.ts`
**Apply to:** all `platform/health/*` modules (NOT the `.tsx` component, NOT route handlers which are server by default)
```typescript
import "server-only";  // build fails if a client component imports — keeps service-role/Stripe/Resend keys out of the browser
```

### Service-role client factory
**Source:** `platform/supabase/admin.ts:21-32`
**Apply to:** reconcile, stuck, keep-alive, both cron routes (after auth)
```typescript
import { createAdminClient } from "@/platform/supabase/admin";
const admin = createAdminClient();  // service-role, bypasses RLS — server-only
```

### CR-01 no-JWT read trap
**Source:** `platform/notifications/digest.ts:67-90` (header + body)
**Apply to:** reconcile.ts, stuck.ts — any cron/service-role read
Never read `wp_pool()` or other `auth.uid()`/`is_admin()`-gated views from the cron path (returns 0 rows). Read base tables directly with an explicit non-PII projection.

### Per-entity dedup before alerting
**Source:** `send-email.ts:131-136` (cap-near once-per-day dedup)
**Apply to:** reconcile.ts, stuck.ts — every alert path (prevents the 96-emails/day re-alert storm, Pitfall 2)

### Alert sinks (reuse, never recreate)
**Source:** `notify.ts` `insertNotification`, `send-email.ts` `sendEmail`, the webhook fan-out `app/api/stripe/webhook/route.ts:216-282`
**Apply to:** reconcile (in-app + critical email), stuck (in-app only)
Resolve admins via `admin.from("app_users").select("id,email").eq("role","admin")`; isolate each alert in its own try/catch (log-and-continue, never PII in logs).

### Admin RSC role gate
**Source:** `app/admin/page.tsx:18-23` + `platform/auth/role.ts`
**Apply to:** the EmailCapGauge surface (and any `/admin/health` page)

### FLAGGED migration + live-apply-via-Management-API
**Source:** `supabase/migrations/0007_notifications.sql:1-9`
**Apply to:** `0008_platform_health.sql`
Authored-not-applied; live apply via Management API `/database/query`, Balkanity ref only, never MCP / `db push` / Kalvia.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| pg_cron / pg_net DDL + `vault.create_secret` block in 0008 | migration (scheduled-job DDL) | scheduling | No existing cron/extension DDL in repo (`create extension pg_cron/pg_net` is the phase's first such DDL). Use research §Pattern 1 / §Code Examples, NOT a codebase analog. |
| `vercel.json` `crons[]` array | config | config | Current `vercel.json` has no `crons` key. Use research §"Vercel daily backstop": `{ "crons": [ { "path": "/api/cron/health", "schedule": "0 3 * * *" } ] }`. |

## Metadata

**Analog search scope:** `app/api/`, `app/admin/`, `platform/notifications/`, `platform/payments/`, `platform/supabase/`, `platform/auth/`, `supabase/migrations/`
**Files scanned:** ~14 read in full (3 migrations referenced; 8 source modules read)
**Pattern extraction date:** 2026-06-20
