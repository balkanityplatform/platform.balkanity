# Phase 8: Platform Health - Research

**Researched:** 2026-06-20
**Domain:** Postgres scheduled jobs (pg_cron + pg_net), reconciliation/observability on Supabase free tier, admin-console health widgets
**Confidence:** HIGH (infra availability verified LIVE on Balkanity; integration shapes verified against existing code + Supabase docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (HLTH-02):** Reconciliation sweep is **detect + alert only — never auto-remediate.** On finding a Stripe-paid payment with no matching paid transfer, flag it (admin in-app notification + a logged health/reconciliation row) for a human to investigate/replay. It MUST NOT set `paid` itself — the signature-verified Stripe webhook stays the sole `paid` author (CLAUDE.md money lock). Satisfies the pilot DoD ("reconciliation catches a deliberately-dropped webhook").
- **D-02 (HLTH-02):** Cadence **every 15 minutes** via Supabase pg_cron + pg_net. Vercel Hobby cron is a daily backstop only (daily + hour-imprecise — cannot do the 15-min sweep).
- **D-03 (HLTH-02):** Detection compares Stripe-side paid events (`webhook_events` from 0003) against the transfer ledger (`wp_transfers`). Exact query/lookback window is researcher/planner territory.
- **D-04 (HLTH-04):** Stuck-transfer definition = **a PAID transfer still unclaimed within 12 hours of the guest's arrival time.** Single, clear condition for the pilot.
- **D-05 (HLTH-04):** Stuck alerts are **admin in-app only** (no email — not money-critical; bell is free against the Resend cap).
- **D-06 (HLTH-03):** Email-cap gauge lives on the **admin console**, reads the existing `email_log` (0007) daily count. Visual/in-app only.
- **D-07 (HLTH-03):** Warning threshold = **~90/day**, matching the existing send-guardrail soft cap exactly (one consistent threshold; `EMAIL_SOFT_CAP`, default 90).
- **D-08 (HLTH-05):** **Stay on Supabase FREE tier + add a keep-alive.** Do NOT upgrade to Pro now. A lightweight keep-alive (tiny scheduled pg_cron self-ping and/or the Vercel daily backstop pinging the DB) prevents the 7-day inactivity pause that would silently stop pg_cron.
- **D-09 (cross-cutting):** **In-app for stuck + cap-near; in-app + admin EMAIL (critical tier) for reconciliation money discrepancies.** A dropped-webhook discrepancy = real money unaccounted → also emails the admin via the single `sendEmail` call-site at the critical tier.
- **D-10 (digest cron):** Wire the Supabase pg_cron schedule that invokes Phase 7's existing `sendDueDigests()` (in `platform/notifications/digest.ts`) at each driver's self-chosen `digest_send_hour`. Cron must run **at least hourly**. Phase 7 built the invokable + PII gate; Phase 8 only schedules it.

### Claude's Discretion

- The exact reconciliation/health-events log table shape (new `health_events`/`reconciliation_log` vs reusing `notifications`).
- The sweep's SQL + lookback window.
- The pg_cron↔Edge-Function vs pg_cron↔pg_net-to-route-handler invocation shape.
- The precise keep-alive mechanism.
- All consistent with existing migration/RLS conventions: **writes via service-role only; RLS SELECT policies; NO client write policy; schema changes are FLAGGED/irreversible → sign-off before any migration; Balkanity ref `qyhdogajtmnvxphrslwm` ONLY.**

### Deferred Ideas (OUT OF SCOPE)

- **Supabase Pro upgrade** — revisit at go-live; pilot = free + keep-alive (D-08).
- **Broader stuck-transfer conditions** (claimed-but-not-arrived past pickup, paid-but-no-driver-action for X hours) — pilot ships the single paid-but-unclaimed-near-arrival rule only (D-04).
- **Auto-remediation of dropped webhooks** (Stripe re-fetch + apply) — deliberately NOT built (D-01); future hardening once manual replay is proven.
- **Resend domain verification + D-15 UAT** — Phase 7's deferred completion, NOT Phase 8 (`07-resend-domain-and-d15-uat.md`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HLTH-02 | Reconciliation sweep (Supabase pg_cron ~15 min) flags Stripe-paid payments with no matching paid transfer; Vercel cron is a daily backstop only | pg_cron 1.6.4 + pg_net 0.20.3 verified available LIVE on Balkanity; detection lists paid Checkout Sessions from the Stripe API ⨝ `wp_transfers` (§Reconciliation Detection, D-03 RESOLVED); invocation shape (pg_net → route handler) §Pattern 1; lookback window to avoid false positives §Pitfall 1 |
| HLTH-03 | Email-cap gauge shows usage against the Resend daily cap | Reuses `email_log` daily-count query already implemented verbatim in `send-email.ts` lines 63–71; surfaces on `app/admin` (§Email-Cap Gauge); threshold = `EMAIL_SOFT_CAP` (90) |
| HLTH-04 | Stuck-transfer alerts (paid-but-unclaimed within 12h of arrival) | SQL over `wp_transfers` (status='paid' AND driver_id IS NULL AND arrival_at <= now()+12h); dedup via `notifications`/health row; can fold into the same sweep cron (§Stuck-Transfer Detection) |
| HLTH-05 | Keep-alive prevents Supabase free-tier pause (which would stop pg_cron) | The 15-min reconciliation cron is itself a write/activity heartbeat; a dedicated tiny self-ping write into `health_events` (`kind='keepalive'`) is the belt-and-braces guarantee (§Keep-Alive) |
| D-10 (carried) | Digest cron trigger fires `sendDueDigests()` hourly honoring `digest_send_hour` | `sendDueDigests()` already filters on `digest_send_hour == current UTC hour` internally (digest.ts:117–126); Phase 8 adds one hourly `cron.schedule` → pg_net → the same route-handler entrypoint (§Digest Cron) |
</phase_requirements>

## Summary

Phase 8 adds an observability/health layer on top of the already-built money and notification spines. It introduces **no new business logic, lifecycle states, or actors** — every deliverable is a scheduled detector or a read-only admin widget. The technical core is **Supabase pg_cron + pg_net**, which I verified LIVE on the Balkanity project: `pg_cron 1.6.4` (meets the STATE-flagged ≥1.6.4 requirement) and `pg_net 0.20.3` are both **available but not yet installed** — the phase's first DDL is `create extension`. Postgres is **17.6**, and `supabase_vault 0.3.1` is **already installed**, which is the recommended place to store the shared secret the cron uses to authenticate its HTTP callback (so no secret is hardcoded in cron-job SQL or leaked to a client).

The recommended invocation shape is **pg_cron → pg_net `net.http_post` → an existing-style Next.js route handler** (`app/api/cron/*`), NOT a Supabase Edge Function. The codebase already runs all server logic in Next route handlers/server modules (the webhook is `app/api/stripe/webhook/route.ts`, runtime `nodejs`), has zero Edge Functions, and the digest/sweep logic (`sendDueDigests`, `buildDigest`) already lives in `platform/notifications/*` and would only need a thin route wrapper. The route handler authenticates the caller by comparing a shared-secret header (pulled from Vault by the cron, set as a Vercel env var on the receiver) — the route then uses the service-role client server-side; the secret never reaches a client.

Reconciliation detection is, per **D-03 RESOLVED (Stripe API is the source of truth)**, a **left-anti-join of recent paid Stripe Checkout Sessions (listed via the server-only Stripe key) against `wp_transfers`**: every Stripe session that is `paid`/`complete` whose `metadata.transfer_id` points at a `wp_transfers` row that is NOT `paid` (or is missing), **filtered to sessions older than a lookback window** (recommend 10 min) so a just-paid transfer mid-processing is never flagged. This is the only design that catches a *never-delivered* webhook (which leaves NO `webhook_events` row at all). `webhook_events` (already records `no_matching_transfer`/`write_failed` outcomes plus the full verified `payload`) remains available as a secondary effect-failure cross-check, but the Stripe API list is primary.

**Primary recommendation:** One new migration `0008_platform_health.sql` (FLAGGED — sign-off before live apply via Management API, Balkanity ref only) that (1) `create extension pg_cron, pg_net`; (2) adds a `health_events` table (service-role writes, admin-read SELECT, NO write policy — mirrors `notifications`/`email_log`); (3) schedules **two** cron jobs: the 15-min sweep+stuck+keep-alive combined job, and the hourly digest job — both calling `net.http_post` to `app/api/cron/*` route handlers guarded by a Vault-stored shared secret. The email-cap gauge is a pure read-only admin widget reusing the existing `email_log` daily-count query.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reconciliation detection (HLTH-02) | API/Backend (route handler lists Stripe paid sessions + runs the anti-join) | Database (pg_cron schedule fires the route every 15 min) | D-03 RESOLVED: the Stripe API is the source of truth, so the discrepancy is computed in TS (server-only Stripe key) against `wp_transfers`; pg_cron is the only free-tier scheduler that can fire every 15 min. The *alerting* (in-app + critical email) also belongs in the backend because it routes through `insertNotification` + `sendEmail`. |
| Reconciliation alert delivery (D-09) | API/Backend (`insertNotification` + `sendEmail` critical) | — | Reuses the single notification + single email call-sites; never a new paid writer. |
| Email-cap gauge (HLTH-03) | Frontend Server (RSC on `app/admin`) | Database (read `email_log` count) | Pure read; the daily-count query already exists in `send-email.ts`. No write, no cron — renders server-side in the admin console. |
| Stuck-transfer detection (HLTH-04) | Database (SQL predicate) | API/Backend (alert fan-out) | A predicate over `wp_transfers`; cheapest folded into the reconciliation cron's route handler. In-app only (D-05). |
| Keep-alive (HLTH-05) | Database (pg_cron self-ping write) | CDN/Vercel (daily backstop ping) | "Activity" that defeats the 7-day pause is a DB query/write; the 15-min cron already provides it, with a tiny dedicated self-ping write into `health_events` (`kind='keepalive'`) as the explicit guarantee. |
| Digest cron trigger (D-10) | Database (pg_cron hourly schedule) | API/Backend (`sendDueDigests` fan-out) | Time trigger is a DB schedule; the send logic + PII gate already exist in `digest.ts`. |
| Cron→server authentication | API/Backend (shared-secret header check) | Database (Vault stores the secret) | Vault holds the secret server-side in the DB; pg_net sends it as a header; the route handler compares it. Service-role never leaves the server. |

## Standard Stack

### Core
| Library / Extension | Version | Purpose | Why Standard |
|---------------------|---------|---------|--------------|
| `pg_cron` | **1.6.4** (available, **not installed**) | In-database job scheduler — the 15-min sweep + hourly digest | [VERIFIED: Supabase Management API /database/query on ref qyhdogajtmnvxphrslwm, 2026-06-20] The only free-tier scheduler that can fire every 15 min (Vercel Hobby = 1/day, hour-imprecise). CLAUDE.md §6 mandates it for the sweep. |
| `pg_net` | **0.20.3** (available, **not installed**) | Async HTTP from Postgres (`net.http_post`) — lets the cron job call a Next route handler | [VERIFIED: Supabase Management API, 2026-06-20] The DB→HTTP bridge pairs with pg_cron per CLAUDE.md §6. |
| `supabase_vault` | **0.3.1** (**installed**) | Stores the cron→route shared secret (`vault.decrypted_secrets`) | [VERIFIED: pg_extension on Balkanity, 2026-06-20] Avoids hardcoding the auth token in cron-job SQL (which is world-readable in `cron.job.command`). [CITED: supabase.com/docs/guides/functions/schedule-functions] |
| PostgreSQL | **17.6** | Host DB | [VERIFIED: select version() on Balkanity, 2026-06-20] Supports JSONB path ops the detection query needs. |

### Supporting (already in the repo — no new npm installs)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `platform/notifications/notify.ts` → `insertNotification` | Admin in-app health-alert sink (stuck, cap-near, reconciliation) | All three alert types write here (service-role). [VERIFIED: file read] |
| `platform/notifications/send-email.ts` → `sendEmail` | Critical-tier reconciliation admin email (D-09) | Only the reconciliation discrepancy emails; tier `"critical"` bypasses the soft cap. [VERIFIED: file read] |
| `platform/notifications/digest.ts` → `sendDueDigests` | The invokable the hourly digest cron fires (D-10) | Already filters by `digest_send_hour == current UTC hour` (lines 117–126); no logic change needed. [VERIFIED: file read] |
| `platform/payments/stripe.ts` → `getStripe` | Server-only Stripe client; lists paid Checkout Sessions for the reconciliation anti-join (D-03 source of truth) | The reconcile detection only; key never reaches a client. [VERIFIED: file read] |
| `platform/supabase/admin` → `createAdminClient` | Service-role client for all health writes + route-handler reads | Mirrors webhook/digest usage. [VERIFIED: referenced across files] |
| `email_log` (0007) daily-count query | The gauge data source — verbatim the query in `send-email.ts:63–71` | Gauge reuses it read-only. [VERIFIED: file read] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_net → Next route handler | pg_net → Supabase **Edge Function** | Edge Function is the doc's canonical example, BUT the repo has **zero Edge Functions**, all server logic is Next route handlers/server modules, and the sweep/digest logic already lives in `platform/notifications/*`. A route handler reuses that code with a thin wrapper; an Edge Function would duplicate it (Deno runtime, separate deploy, separate secret plumbing). **Route handler recommended.** |
| Stripe-API list as the reconciliation source of truth (D-03 RESOLVED) | DB-only anti-join over `webhook_events` ⨝ `wp_transfers` | The DB-only anti-join cannot see a webhook Stripe **never delivered** (no `webhook_events` row exists). D-03 resolves this: list recent paid Checkout Sessions from the Stripe API (server-only key) and anti-join `wp_transfers` paid — the only design that satisfies the DoD "catch a deliberately-dropped webhook". `webhook_events` remains a cheap secondary effect-failure cross-check. |
| Combined sweep+stuck+keep-alive in one 15-min cron | Three separate cron jobs | Free tier allows ≤8 concurrent jobs, so separate jobs are *allowed*. But folding sweep + stuck + keep-alive into one 15-min route handler call is fewer moving parts and the keep-alive comes free with any DB activity. Recommend **2 cron jobs total**: (1) 15-min health route, (2) hourly digest route. |
| Vault-stored shared secret | Hardcode token in `cron.job.command` | `cron.job.command` is readable by any DB role that can select `cron.job`; a hardcoded service-role-equivalent token there is a leak. Vault `decrypted_secrets` is the documented pattern. **Vault recommended.** |

**Installation:** No npm packages. Extensions are enabled via migration DDL (live-applied via Management API, NOT `supabase db push`):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

**Version verification:** Done LIVE against Balkanity (ref `qyhdogajtmnvxphrslwm`) via the Management API `/database/query` on 2026-06-20:
- `pg_cron` default_version `1.6.4`, installed_version `null` → **must `create extension`**.
- `pg_net` default_version `0.20.3`, installed_version `null` → **must `create extension`**.
- `supabase_vault` `0.3.1` **installed**.
- Postgres `17.6`. Kalvia ref never touched (guardrail asserted in the query script).

## Package Legitimacy Audit

> No external npm/PyPI packages are installed in this phase. All dependencies are Postgres extensions enabled on the managed Supabase instance and existing in-repo modules. slopcheck N/A.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| pg_cron | Supabase managed ext | mature (Citus) | n/a | github.com/citusdata/pg_cron | N/A (not npm) | Approved — verified available on Balkanity |
| pg_net | Supabase managed ext | mature (Supabase) | n/a | github.com/supabase/pg_net | N/A (not npm) | Approved — verified available on Balkanity |
| supabase_vault | Supabase managed ext | mature | n/a | github.com/supabase/vault | N/A (not npm) | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        ┌──────────────────────── Supabase Postgres (Balkanity ref qyhdogajtmnvxphrslwm) ──────────────────────┐
                        │                                                                                                       │
  pg_cron schedule      │   cron.schedule('health-sweep', '*/15 * * * *', $$                                                    │
  (15 min) ───────────► │     select net.http_post(                                                                            │
                        │       url := 'https://balkanityplatformproject.vercel.app/api/cron/health',                          │
                        │       headers := jsonb_build_object('Content-Type','application/json',                                │
                        │                                     'x-cron-secret',                                                  │
                        │                   (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),   │
                        │       body := '{}'::jsonb) $$);                                                                       │
                        │                                                                                                       │
  pg_cron schedule      │   cron.schedule('digest-hourly', '0 * * * *', $$ net.http_post(.../api/cron/digest ...) $$);          │
  (hourly) ───────────► │                                                                                                       │
                        │   Vault: decrypted_secrets['cron_secret']  ── read at fire time, sent as header                      │
                        └───────────────────────────────────────────────────────────────────────────────────────────┬────────┘
                                                                                                                       │ HTTPS POST
                                                                                                                       │ x-cron-secret
                                                                                                                       ▼
   ┌─────────────────────────────── Next.js route handlers (Vercel, runtime nodejs) ───────────────────────────────────────────┐
   │  app/api/cron/health/route.ts                              app/api/cron/digest/route.ts                                    │
   │   1. verify x-cron-secret === process.env.CRON_SECRET       1. verify x-cron-secret                                         │
   │      (timing-safe) → else 401, zero work                    2. await sendDueDigests()  ◄── existing digest.ts invokable     │
   │   2. createAdminClient() (service-role, server-only)           (filters drivers by digest_send_hour == current UTC hour)   │
   │   3. RECONCILIATION: list Stripe paid Checkout Sessions ⨝ wp_transfers (D-03 Stripe-API source of truth)                   │
   │      WHERE session paid AND transfer not paid AND session > lookback                                                       │
   │   4. STUCK: wp_transfers WHERE paid AND driver_id IS NULL AND arrival_at <= now()+12h                                       │
   │   5. KEEP-ALIVE: insert health_events (kind='keepalive', resolved_at=now()) — any write = activity (NO new table)          │
   │   6. for each NEW discrepancy/stuck not already alerted today:                                                              │
   │        insert health_events row (service-role)                                                                             │
   │        insertNotification(admin, ...)            ◄── in-app (all types)                                                     │
   │        if reconciliation: sendEmail(tier:'critical')  ◄── admin email (D-09 only)                                          │
   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                       │
                                                                       ▼
        ┌──────────── Admin console (app/admin, RSC, getCurrentRole gate) ────────────┐
        │  • Email-cap gauge  ── reads email_log daily 'sent' count (read-only)        │
        │  • Stuck list / health-events list ── reads health_events + notifications     │
        │  • NotificationBell ── already renders in-app alerts (Phase 7)                │
        └──────────────────────────────────────────────────────────────────────────────┘

   Vercel Hobby cron (vercel.json, daily) ── DAILY BACKSTOP ONLY ──► same /api/cron/health (or a DB ping) — catches a paused-pg_cron gap
```

### Recommended Project Structure
```
app/api/cron/
├── health/route.ts     # runtime nodejs; x-cron-secret gate → reconciliation + stuck + keep-alive (the 15-min job)
└── digest/route.ts     # runtime nodejs; x-cron-secret gate → sendDueDigests() (the hourly job)

platform/health/
├── reconcile.ts        # detection query + discrepancy fan-out (testable in Vitest, mocks the admin + Stripe clients)
├── stuck.ts            # paid-but-unclaimed-near-arrival predicate + dedup
├── keepalive.ts        # service-role heartbeat write into health_events (kind='keepalive') — NO new table
└── reconcile.test.ts   # Wave-0 contract: no-false-positive inside lookback; one alert per discrepancy

app/admin/health/       # (or fold the gauge into app/admin/page.tsx)
└── EmailCapGauge.tsx    # read-only RSC widget over the email_log daily count

supabase/migrations/
└── 0008_platform_health.sql   # FLAGGED — create extensions + health_events table + cron.schedule jobs
```

### Pattern 1: pg_cron → pg_net → Next route handler, authenticated by a Vault-stored shared secret
**What:** The cron job reads a shared secret from Vault at fire time and sends it as a header; the route handler compares it (timing-safe) before doing any work, then uses the service-role client server-side.
**When to use:** Both cron jobs (health sweep + digest).
**Example:**
```sql
-- Source: supabase.com/docs/guides/functions/schedule-functions (verified shape) + CLAUDE.md §6
-- One-time: store the secret (the SAME value goes into Vercel env CRON_SECRET).
select vault.create_secret('REPLACE_WITH_LONG_RANDOM', 'cron_secret');

-- The 15-min health sweep.
select cron.schedule(
  'health-sweep',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://balkanityplatformproject.vercel.app/api/cron/health',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret',
                 (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- The hourly digest trigger (D-10).
select cron.schedule(
  'digest-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://balkanityplatformproject.vercel.app/api/cron/digest',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret',
                 (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb
  );
  $$
);
```
```typescript
// app/api/cron/health/route.ts — Source: mirrors app/api/stripe/webhook/route.ts auth-by-secret + nodejs pattern
import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const got = req.headers.get("x-cron-secret") ?? "";
  const want = process.env.CRON_SECRET ?? "";
  if (got.length !== want.length || want.length === 0) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want)); // constant-time, V2/V4
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  // ... createAdminClient() → reconciliation + stuck + keep-alive (service-role, server-only)
  return new NextResponse(JSON.stringify({ ok: true }), { status: 200 });
}
```
**Note:** `net.http_post` is **asynchronous and fire-and-forget** — pg_net queues the request and does NOT block or surface the HTTP response to the cron job. Delivery/response is inspectable via `net._http_response` (and `net.http_request_queue`). Do not expect the cron job to "know" the route succeeded; observability of the receiver is via `health_events` rows + `cron.job_run_details` (which only records that the SQL ran, not the HTTP outcome).

### Pattern 2: Reconciliation detection as a left-anti-join (Stripe API source of truth) with a lookback window
**What:** Per D-03 RESOLVED, list recent paid Stripe Checkout Sessions (server-only Stripe key) and find any whose transfer is not `paid`, excluding sessions inside the in-flight window. This catches a never-delivered webhook (no `webhook_events` row).
**When to use:** The reconciliation core (HLTH-02).
**Example (TS — primary, D-03):**
```typescript
// Source: D-03 RESOLVED — Stripe API is the source of truth.
// List recent paid Checkout Sessions, anti-join wp_transfers paid, skip the in-flight lookback window.
const stripe = getStripe();
const sessions = await stripe.checkout.sessions.list({ limit: 100 /*, created: { gte: now - 24h } */ });
const lookbackCutoff = Math.floor(Date.now() / 1000) - 600; // ~10 min in-flight window (Pitfall 1)
for (const s of sessions.data) {
  if (s.payment_status !== "paid") continue;
  if (s.created > lookbackCutoff) continue;                 // skip in-flight (no false positive)
  const transferId = s.metadata?.transfer_id;               // the link key set by createCheckoutSession
  const { data: t } = await admin.from("wp_transfers").select("id,status").eq("id", transferId).maybeSingle();
  if (!t || t.status !== "paid") {
    // DISCREPANCY → dedup against open health_events, then alert (in-app + critical email)
  }
}
```
**Secondary cross-check (cheap, optional):** `webhook_events` already records `outcome IN ('no_matching_transfer','write_failed')` for events it *received* but couldn't apply — those are a strong effect-failure signal and can be surfaced directly. **Important nuance:** the Stripe-API list (above) is the primary detector precisely because a webhook Stripe never delivered leaves NO `webhook_events` row — DB-only reconciliation cannot see it. See Open Question 1 (RESOLVED).
```sql
-- Optional SECONDARY effect-failure cross-check over webhook_events (NOT the primary detector).
with paid_events as (
  select
    we.event_id,
    we.created_at,
    (we.payload #>> '{data,object,metadata,transfer_id}')::uuid as transfer_id,
    we.outcome
  from public.webhook_events we
  where we.type = 'checkout.session.completed'
    and we.signature_result = 'valid'
    and we.created_at < now() - interval '10 minutes'   -- LOOKBACK: skip in-flight (Pitfall 1)
)
select pe.event_id, pe.transfer_id, pe.outcome
from paid_events pe
left join public.wp_transfers t on t.id = pe.transfer_id
where t.id is null
   or t.status is distinct from 'paid';
```

### Pattern 3: Stuck-transfer predicate with per-entity dedup
```sql
-- Source: derived from 0004 columns (arrival_at, driver_id, status) — verified
select t.id, t.arrival_at
from public.wp_transfers t
where t.status = 'paid'
  and t.driver_id is null
  and t.arrival_at is not null
  and t.arrival_at <= now() + interval '12 hours';  -- D-04: within 12h of arrival
```
Dedup: before alerting, check whether a `health_events` row of `kind='stuck_unclaimed'` for that `transfer_id` already exists (no time bound, or once-per-day) so the 15-min cron does not re-alert the same transfer every cycle (Pitfall 2).

### Anti-Patterns to Avoid
- **Letting the sweep set `paid`:** Forbidden by D-01 + CLAUDE.md money lock. The sweep DETECTS and ALERTS; remediation is human-driven webhook replay (idempotent via `webhook_events.event_id`).
- **Hardcoding the service-role key or a static token in `cron.job.command`:** `cron.job` is selectable; use Vault `decrypted_secrets`. The route handler holds the matching secret as a Vercel server env (never `NEXT_PUBLIC_`).
- **Using an Edge runtime route for the cron receiver:** Match the webhook — `export const runtime = "nodejs"` so the service-role client + crypto behave.
- **Re-alerting every 15 min:** Always dedup against `health_events` (or an existing `notifications` row) before inserting a new alert.
- **Reading `wp_pool()` from the cron path:** It gates on `auth.uid()`/`is_admin()` → 0 rows under service-role (the exact CR-01 trap `digest.ts` documents). Read base tables with an explicit projection.
- **Trusting `net.http_post` to confirm delivery:** It is async fire-and-forget; verify via `health_events` rows, not the cron call's return.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recurring 15-min schedule | A Node `setInterval` in a long-running process, or a serverless self-pinger | `pg_cron` | Vercel Hobby is serverless (no daemon) + Hobby cron is daily/imprecise. pg_cron is the only free in-infra 15-min scheduler. [VERIFIED] |
| DB→HTTP call | A Postgres `plpython`/external trigger | `pg_net` `net.http_post` | Purpose-built async HTTP from Postgres; pairs with pg_cron (CLAUDE.md §6). |
| Storing the cron auth secret | A literal token in SQL or a config table | `supabase_vault` `decrypted_secrets` | Already installed; documented pattern; keeps `cron.job.command` leak-free. |
| Admin in-app alert | A new alerts table/UI | `insertNotification` + the existing `NotificationBell` | Phase 7 already ships the polymorphic feed + bell rendered on `app/admin`. |
| Critical admin email | A second Resend call-site | `sendEmail({ tier: 'critical' })` | Single-call-site invariant (`single-sender.test.ts`); critical bypasses the soft cap. |
| Daily email count | A new aggregation | The `email_log` count query in `send-email.ts:63–71` | Already battle-tested for the soft cap; gauge reuses it read-only. |
| Catching a never-delivered webhook | A DB-only anti-join over `webhook_events` | The Stripe API list (`checkout.sessions.list`) anti-joined against `wp_transfers` (D-03) | A never-delivered webhook leaves no `webhook_events` row; only the Stripe API list sees it (the DoD's "deliberately-dropped webhook"). |
| Digest scheduling-by-hour | New per-driver scheduling logic | `sendDueDigests()` as-is | It already filters `digest_send_hour == current UTC hour`; Phase 8 only fires it hourly. |

**Key insight:** Phase 8 is almost entirely *wiring* existing seams to a scheduler. The only genuinely new code is (a) two thin authenticated route handlers, (b) the detection TS (Stripe-API list + anti-join) + the stuck SQL, (c) a `health_events` table, and (d) one read-only gauge widget. Resist building any new notification, email, or scheduling primitive.

## Runtime State Inventory

> Phase 8 is additive (new extensions, new table, new cron jobs, new routes) — it is NOT a rename/refactor. This inventory covers the *new* runtime state Phase 8 itself registers, since that state lives outside git and must be reproduced on the live DB.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `health_events` table rows (service-role writes), including `kind='keepalive'` heartbeat rows. No existing data renamed. | Data migration: none. Code edit: new table in 0008. |
| Live service config | **`cron.job` entries** (the 2 schedules) live in the DB, NOT in git — only the migration that *creates* them is in git. Re-running the migration must be idempotent (unschedule-if-exists then schedule). **Vault secret `cron_secret`** lives in the DB, not git. **Vercel env `CRON_SECRET`** lives in Vercel, not git. | Migration uses `cron.unschedule('health-sweep')`-guard then `cron.schedule(...)`; Vault secret created once; Vercel env set once (manual). |
| OS-registered state | None (no OS scheduler — pg_cron is in-DB; Vercel cron is config in `vercel.json`). | The Vercel daily backstop is declared in `vercel.json` `crons[]` (git-tracked). |
| Secrets/env vars | `CRON_SECRET` (new, Vercel server env, never `NEXT_PUBLIC_`) ↔ Vault `cron_secret` (same value). Existing `SUPABASE_SERVICE_ROLE_KEY` + `STRIPE_SECRET_KEY` reused by route handlers. | Set `CRON_SECRET` in Vercel + create the matching Vault secret. Both manual, one-time. |
| Build artifacts | None — no compiled/installed package carries renamed state. | None. |

**The canonical question:** After the migration runs, the cron schedules + Vault secret are LIVE DB state reproduced only by re-running 0008's idempotent cron block; the matching Vercel `CRON_SECRET` is the one piece of state that must be set out-of-band and kept in sync with the Vault value.

## Common Pitfalls

### Pitfall 1: Reconciliation false positives during the normal in-flight window
**What goes wrong:** A guest pays; Stripe fires `checkout.session.completed`; for a few seconds the session is paid but the `paid` UPDATE hasn't committed (or the webhook is mid-retry). A sweep with no lookback flags this perfectly-healthy in-flight transfer as a money discrepancy → false critical email.
**Why it happens:** The webhook write and the sweep read are concurrent; "not yet paid" ≠ "dropped".
**How to avoid:** Only consider sessions **older than a lookback window** (`session.created < now - 600s`). 10 min is comfortably beyond Stripe's retry cadence and the webhook's sub-second processing, well inside the 15-min cadence so a real drop still alerts within ~15–25 min.
**Warning signs:** Reconciliation alerts that "resolve themselves" on the next sweep — the window is too short.

### Pitfall 2: Re-alerting the same discrepancy every 15 minutes
**What goes wrong:** A genuine stuck/dropped item fires a fresh admin notification + (for reconciliation) a critical email on every 15-min cycle → 96 emails/day from one incident, blowing the Resend cap and the operator's inbox.
**Why it happens:** No dedup between cron runs.
**How to avoid:** Write a `health_events` row per `(kind, transfer_id/event_id)` and check-before-alert: only `insertNotification`/`sendEmail` if no open/unresolved `health_events` row already exists for that entity (or none today). Mirror the cap-near alarm's once-per-day dedup pattern in `send-email.ts:131–136`.
**Warning signs:** Duplicate identical alerts in the bell; repeated critical emails for one event.

### Pitfall 3: The 7-day pause silently stops EVERYTHING
**What goes wrong:** During a quiet pilot stretch (no bookings for 7 days), the free project pauses; pg_cron stops; the sweep, stuck-check, AND digest all silently die — and reconciliation (the safety net) is exactly what's now off.
**Why it happens:** Free-tier inactivity pause; "inactivity" = no DB activity.
**How to avoid:** The 15-min health cron itself is recurring DB activity, so under normal operation it keeps the project warm. Add an explicit **keep-alive write** — a benign `health_events` row `kind='keepalive'` (immediately `resolved_at=now()` so it never alerts; NO new table) inserted inside the health route (or a tiny dedicated pg_cron job) as the belt-and-braces guarantee, plus the **Vercel daily backstop** (`vercel.json` `crons`) hitting `/api/cron/health` so even if pg_cron itself were the thing that lapsed, an external daily ping re-warms the DB. [CONFIRMED behaviour: CLAUDE.md Verified Provider Facts; community pattern travisvn/supabase-pause-prevention]
**Warning signs:** `cron.job_run_details` shows no runs for >24h; project dashboard shows "paused".

### Pitfall 4: `net.http_post` is async — no synchronous success signal
**What goes wrong:** Planner assumes the cron job fails loudly if the route 500s. It does not — pg_net queues the request and returns immediately; HTTP failures surface only in `net._http_response`.
**Why it happens:** pg_net is fire-and-forget by design.
**How to avoid:** Treat the receiver's own `health_events` writes (and `cron.job_run_details` for "the SQL ran") as the observability surface. For deeper debugging, inspect `net._http_response`. Don't gate correctness on the cron call's return value.

### Pitfall 5: Cron URL points at a preview/wrong deployment, or uses the apex without auth
**What goes wrong:** Hardcoding a Vercel preview URL, or a stale domain, sends the cron to a dead/old deployment; or omitting the secret check lets anyone POST `/api/cron/health` and trigger sends.
**How to avoid:** Use the stable production URL (`balkanityplatformproject.vercel.app` or a custom domain) in the schedule, and ALWAYS gate the route on `x-cron-secret` (timing-safe). The route does real work (emails, alerts) so it is a public-internet endpoint that must authenticate every caller.
**Warning signs:** Cron "runs" (job_run_details OK) but nothing happens (wrong URL); or unexpected alert/email volume (unauthenticated triggering).

### Pitfall 6: Extension not installed before scheduling
**What goes wrong:** `cron.schedule(...)` errors with "schema cron does not exist" because `pg_cron`/`pg_net` were never `create extension`-d on Balkanity (verified: both are available but **not installed**).
**How to avoid:** The migration's first statements are `create extension if not exists pg_cron; create extension if not exists pg_net;`. Re-verify on the live project after apply with `select * from pg_extension where extname in ('pg_cron','pg_net');`.

## Code Examples

### Health-events table (mirrors notifications/email_log conventions — service-role write, admin-read, NO write policy)
```sql
-- Source: pattern from 0007_notifications.sql (verified by reading) — FLAGGED, sign-off before live apply
create table if not exists public.health_events (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,          -- 'reconciliation_discrepancy' | 'stuck_unclaimed' | 'keepalive'
  entity_type  text,                   -- polymorphic, e.g. 'transfer' | 'checkout_session' (NO transfer_id column, SC#1)
  entity_id    text,                   -- the transfer id or stripe session/event id (text: event ids are not uuid)
  detail       jsonb,                  -- optional context (outcome, arrival_at, amount)
  resolved_at  timestamptz,            -- NULL = open; set when a human replays/clears (keepalive rows set it = now())
  created_at   timestamptz not null default now()
);
create index if not exists health_events_open_idx
  on public.health_events (kind, entity_id) where resolved_at is null;  -- backs the dedup check

alter table public.health_events enable row level security;
drop policy if exists "health_events_admin_read" on public.health_events;
create policy "health_events_admin_read" on public.health_events
  for select to authenticated using ( public.is_admin() );  -- reuses 0002 is_admin(); NO write policy
```
**Keep-alive (HLTH-05) reuses this table — NO new table:** the heartbeat is a benign `health_events` insert with `kind='keepalive'` and `resolved_at = now()` so it never appears as an open alert. If a `CHECK` constraint is ever added to `kind`, it MUST include `'keepalive'`; the recommended schema uses NO `kind` CHECK constraint (free-form text), so `'keepalive'` is allowed by construction.

### Idempotent cron (re)scheduling block (re-runnable migration)
```sql
-- Source: pg_cron API — unschedule-if-exists guard so a partial re-run is safe (mirrors 0007 re-runnability)
select cron.unschedule('health-sweep') where exists (select 1 from cron.job where jobname = 'health-sweep');
select cron.unschedule('digest-hourly') where exists (select 1 from cron.job where jobname = 'digest-hourly');
-- then the two cron.schedule(...) calls from Pattern 1
```

### Email-cap gauge data (read-only, reuses the soft-cap query)
```typescript
// Source: verbatim shape from platform/notifications/send-email.ts:63–71 (verified)
const todayUtc = new Date(); todayUtc.setUTCHours(0, 0, 0, 0);
const { count } = await admin
  .from("email_log")
  .select("id", { count: "exact", head: true })
  .gte("created_at", todayUtc.toISOString())
  .eq("outcome", "sent");
const sentToday = count ?? 0;
const cap = Number(process.env.EMAIL_SOFT_CAP) || 90; // SAME constant as the guardrail (D-07)
// states: ok (< cap-10) | warning amber (>= cap-10) | at-cap coral (>= cap)
```
Surface on `app/admin` (RSC, already `getCurrentRole`-gated). The gauge reads via the **admin-read RLS path** (cookie-bound anon client + `is_admin()`), NOT service-role, to keep the read inside the existing RLS boundary — `email_log` already has an `email_log_admin_read` SELECT policy (0007).

### Vercel daily backstop (git-tracked, in vercel.json)
```json
// Source: vercel.com/docs/cron-jobs — Hobby = 1/day, hour-imprecise; backstop only (D-02/D-08)
{ "crons": [ { "path": "/api/cron/health", "schedule": "0 3 * * *" } ] }
```
Vercel cron hits the same route; it carries Vercel's own `Authorization: Bearer ${CRON_SECRET}`-style header convention OR you accept the same `x-cron-secret` — align the route's auth to accept the backstop too. (Vercel automatically adds an `Authorization` header with the `CRON_SECRET` env when set; the route can check either header.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pg_cron` calling Edge Functions (older Supabase guides) | `pg_cron` + `pg_net` → any HTTPS endpoint (Edge Function OR your own route handler) | pg_net maturation | We can target the existing Next route handlers; no Deno Edge Function needed. |
| Secrets hardcoded in cron SQL | `supabase_vault` `decrypted_secrets` referenced in the cron body | Vault GA | No token leak via `cron.job.command`. |
| Vercel cron for everything | Vercel Hobby cron = 1/day, imprecise → backstop only; pg_cron for sub-daily | Vercel Hobby limits | 15-min cadence MUST be pg_cron (CLAUDE.md §6). |

**Deprecated/outdated:**
- `cron.schedule` with the seconds-string form (`'30 seconds'`) is supported but unnecessary here — standard 5-field cron (`'*/15 * * * *'`, `'0 * * * *'`) is clearer and sufficient.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "deliberately-dropped webhook" DoD test is satisfied by the Stripe-API source of truth (D-03 RESOLVED): the sweep lists recent paid Checkout Sessions from Stripe and anti-joins `wp_transfers`, so it catches BOTH an effect-failed event AND a never-delivered webhook (which leaves no `webhook_events` row). | Pattern 2 / Open Q1 (RESOLVED) | Low — D-03 locks the Stripe API as primary. `webhook_events` remains a cheap secondary cross-check only. |
| A2 | The link key is `session.metadata.transfer_id` (set by `createCheckoutSession`, read by the webhook at route.ts:113–117). The Stripe-API list reads it directly off each session; the optional `webhook_events` secondary path uses `payload #>> '{data,object,metadata,transfer_id}'`. | Pattern 2 | If `metadata.transfer_id` is ever unset on a session, that session cannot be linked — surface it as an unlinkable discrepancy rather than dropping it. |
| A3 | A 10-minute lookback is comfortably longer than the webhook's processing + Stripe's retry window and short enough to still alert within the 15-min cadence. | Pitfall 1 | Too short → false positives; too long → slower detection. Tunable constant; low risk. |
| A4 | The production receiver URL is `https://balkanityplatformproject.vercel.app` (from STATE handoff). A custom domain would change the cron URL. | Pattern 1 | Wrong URL → cron silently no-ops (Pitfall 5). Confirm the canonical production URL at plan time. |
| A5 | `digest_send_hour` is interpreted as a UTC hour (digest.ts uses `getUTCHours()`), so the hourly cron + the invokable's internal filter align. "Self-chosen hour" is therefore effectively UTC, not the driver's local timezone. | Digest cron / D-10 | If drivers expect local-time delivery, a TZ mapping is needed — but Phase 7 already locked UTC (`digest_send_hour` UTC, STATE decision). Out of Phase 8 scope; flag only. |

## Open Questions (RESOLVED)

1. **What exactly does the DoD "deliberately-dropped webhook" test drop?** — **RESOLVED by CONTEXT.md D-03 (2026-06-20): the Stripe API is the source of truth.** The sweep lists recent paid Checkout Sessions from Stripe (server-only key) and anti-joins them against `wp_transfers` paid, so it catches BOTH an effect-failed event AND a truly never-delivered webhook (which leaves NO `webhook_events` row). Implemented in **Plan 08-02** (`platform/health/reconcile.ts` via `getStripe().checkout.sessions.list`), proven live in **Plan 08-05** Gate A. `webhook_events` remains an available secondary effect-failure cross-check, but the Stripe-API anti-join is the primary detector and is sufficient for the pilot DoD. (Original analysis: a DB-only anti-join over `webhook_events` is blind to a never-delivered webhook — that is precisely why D-03 selected the Stripe API.)

2. **Where does the email-cap gauge live — its own `/admin/health` page or folded into `app/admin/page.tsx`?** — **RESOLVED: it lives on the new `/admin/health` console page**, built in **Plan 08-03** (`app/admin/health/page.tsx` + `EmailCapGauge.tsx`), reachable via an additive nav link from `app/admin/page.tsx`. A dedicated page is cleaner because the same console also surfaces the open reconciliation-discrepancy list and the stuck-transfer list (D-06). All read-only RSC behind the existing `getCurrentRole === 'admin'` gate.

3. **One combined 15-min job vs separate sweep / stuck / keep-alive jobs?** — **RESOLVED: a 2-job design** — (1) a single 15-min `health-sweep` job that runs reconciliation + stuck + keep-alive in one route handler, and (2) an hourly `digest-hourly` job. Both schedules are authored in **Plan 08-01** (`0008_platform_health.sql`), the health route + workers are built in **Plan 08-02**, the digest route is built in **Plan 08-04**, and both are registered live in **Plan 08-05**. Fewer moving parts; the keep-alive write rides on the same 15-min call (well within the free-tier ≤8 concurrent-jobs limit).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | HLTH-02, HLTH-04, HLTH-05, D-10 | ✓ (not yet installed) | 1.6.4 | none — required; `create extension` in 0008 |
| pg_net | HLTH-02, D-10 (DB→HTTP) | ✓ (not yet installed) | 0.20.3 | none — required; `create extension` in 0008 |
| supabase_vault | cron→route auth secret | ✓ installed | 0.3.1 | env-only secret without Vault (less safe) — Vault strongly preferred |
| PostgreSQL | host | ✓ | 17.6 | — |
| Vercel Hobby cron | HLTH-05 daily backstop | ✓ (config) | n/a | the pg_cron self-ping alone |
| Stripe API (paid session list) | HLTH-02 reconciliation source of truth (D-03) | ✓ (Phase 3 `getStripe()`) | n/a | `webhook_events` DB-only cross-check (cannot see a never-delivered webhook) |
| Resend (critical send) | D-09 reconciliation email | ✓ (Phase 7 `sendEmail`) | n/a | in-app only if Resend down |
| Production receiver URL | both cron jobs | ✓ | balkanityplatformproject.vercel.app | confirm canonical URL (A4) |

**Missing dependencies with no fallback:** None that block — but `pg_cron` and `pg_net` are **available-but-not-installed**; the migration MUST `create extension` them. This is the resolution of the STATE open item ("verify pg_cron ≥1.6.4 on Balkanity"): **CONFIRMED 1.6.4 available + pg_net 0.20.3 available, both pending install.**

**Missing dependencies with fallback:** Vault is present so no fallback needed; if a custom domain replaces the Vercel URL, update the cron `url` (A4).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (jsdom) + Playwright 1.61 (e2e) [VERIFIED: package.json] |
| Config file | `vitest.config.ts` + `vitest.setup.ts` |
| Quick run command | `npm run test` (`vitest run`) |
| Full suite command | `npm run test && npm run typecheck && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HLTH-02 | Reconciliation detects a paid-Stripe-session-with-unpaid-transfer | unit | `vitest run platform/health/reconcile.test.ts` | ❌ Wave 0 |
| HLTH-02 | NO false positive inside the lookback window (just-paid session not flagged) | unit | `vitest run platform/health/reconcile.test.ts -t lookback` | ❌ Wave 0 |
| HLTH-02 | Discrepancy fires exactly ONE alert (dedup; no re-alert on re-run) | unit | `vitest run platform/health/reconcile.test.ts -t dedup` | ❌ Wave 0 |
| HLTH-02 | Sweep NEVER writes `status:'paid'` (single-writer lock holds) | unit | extend `platform/payments/single-writer.test.ts` grep-gate to include `platform/health/*` + `app/api/cron/*` | ✅ extend existing |
| HLTH-02 | Cron route rejects a request without the valid `x-cron-secret` (401, zero work) | unit | `vitest run app/api/cron/health/route.test.ts -t unauthorized` | ❌ Wave 0 |
| HLTH-03 | Gauge computes the correct daily 'sent' count + state (ok/warning/at-cap) | unit | `vitest run app/admin/**/EmailCapGauge.test.tsx` | ❌ Wave 0 |
| HLTH-04 | Stuck predicate matches paid+unclaimed within 12h; ignores claimed/early | unit | `vitest run platform/health/stuck.test.ts` | ❌ Wave 0 |
| HLTH-04 | Stuck alert is in-app only (NO `sendEmail`) | unit (grep) | assert no `sendEmail` in `stuck.ts` | ❌ Wave 0 |
| HLTH-05 | Keep-alive performs a DB write each cycle | unit | `vitest run platform/health/*keep*` (or assert the keepalive health_events insert) | ❌ Wave 0 |
| D-10 | Digest route invokes `sendDueDigests` only when authorized | unit | `vitest run app/api/cron/digest/route.test.ts` | ❌ Wave 0 |
| DoD | Dropped-webhook is caught by the sweep (LIVE) | manual/live | live: paid Stripe session whose transfer stays unpaid, run sweep, assert a `health_events` row + critical email | manual gate |
| DoD | Cron actually fires on the live project | manual/live | `select * from cron.job_run_details order by start_time desc limit 5;` via Management API | manual gate |
| DoD | Keep-alive prevents the pause | manual/live | observe project stays active across a quiet window; `cron.job_run_details` continuous | manual gate |

### Sampling Rate
- **Per task commit:** `npm run test` (Vitest — the route-auth, reconciliation, stuck, gauge, dedup units).
- **Per wave merge:** `npm run test && npm run typecheck && npm run lint`.
- **Phase gate:** Full suite green + the three LIVE manual DoD checks (dropped-webhook caught, cron fires, keep-alive holds) — run via the Management API `/database/query` against Balkanity (NOT MCP, NOT `db push`).

### Wave 0 Gaps
- [ ] `platform/health/reconcile.test.ts` — covers HLTH-02 (detection, lookback no-false-positive, dedup)
- [ ] `platform/health/stuck.test.ts` — covers HLTH-04 (predicate + in-app-only)
- [ ] `app/api/cron/health/route.test.ts` + `app/api/cron/digest/route.test.ts` — covers the `x-cron-secret` auth gate (401 on missing/wrong)
- [ ] `app/admin/**/EmailCapGauge.test.tsx` — covers HLTH-03 (count + threshold states)
- [ ] Extend `platform/payments/single-writer.test.ts` grep-gate to include `platform/health/*` and `app/api/cron/*` so the sweep can never become a `paid` writer
- [ ] Shared service-role admin-client mock fixture (reuse the Phase 7 pattern in `send-email.test.ts`); add a `getStripe()` mock for reconcile.test.ts
- [ ] Framework install: none — Vitest + Playwright already present

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | The cron→route call authenticates via a shared secret (`x-cron-secret`) compared **timing-safe** (`crypto.timingSafeEqual`); secret stored in Vault (DB) + Vercel env, never `NEXT_PUBLIC_`. The webhook's HMAC pattern is the analog. |
| V3 Session Management | no | Cron routes are session-less machine-to-machine; admin widgets reuse the existing `getCurrentRole` session gate. |
| V4 Access Control | yes | Cron routes are public-internet endpoints doing privileged work (sends, alerts) → MUST reject unauthenticated callers (401, zero side effects). Admin widgets behind `getCurrentRole === 'admin'`. `health_events` admin-read RLS, NO client write policy. |
| V5 Input Validation | yes (light) | Cron bodies are `{}` (no untrusted input). The detection reads `session.metadata.transfer_id` from the (server-side, key-authenticated) Stripe API; the optional secondary SQL casts to `uuid` (rejects malformed). Stripe `payload` is already signature-verified at ingest. |
| V6 Cryptography | yes | Use `crypto.timingSafeEqual` for the secret compare (never `===`, which is timing-leaky). Service-role + Stripe + Resend keys stay server-only. NEVER hand-roll crypto. |
| V7 Error Handling/Logging | yes | `health_events` IS the audit log for discrepancies; log errors without PII (mirror `digest.ts` `console.error` discipline — never recipient PII). |

### Known Threat Patterns for {pg_cron + public cron route on Vercel}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated POST to `/api/cron/health` triggers mass alerts/emails | Spoofing / DoS | `x-cron-secret` timing-safe gate; 401 with zero work before any DB read |
| Service-role-equivalent token leaked via `cron.job.command` | Information Disclosure | Vault `decrypted_secrets`; never inline the token; the route's secret is a Vercel server env |
| Sweep mutated into a `paid` writer (breaks money lock) | Tampering | Detect-only (D-01); extend `single-writer.test.ts` grep-gate to the new files |
| Re-alert storm exhausts Resend cap (Pitfall 2) | DoS (self-inflicted) | Per-entity dedup against `health_events`; reconciliation email is `critical` (counts toward cap) so dedup is mandatory |
| Timing attack on the secret compare | Spoofing | `crypto.timingSafeEqual` over equal-length buffers |
| Cron fires against a stale/preview deployment | — (availability) | Pin the canonical production URL; observe `cron.job_run_details` + `health_events` |
| Reconciliation email leaks guest PII | Information Disclosure | The critical email body carries the discrepancy fact (transfer id / session id / amount), NOT guest contact PII — mirror the digest's non-PII projection discipline |

## Sources

### Primary (HIGH confidence)
- **Supabase Management API `/database/query`** on Balkanity ref `qyhdogajtmnvxphrslwm` (2026-06-20) — LIVE verification: pg_cron 1.6.4 + pg_net 0.20.3 available (not installed), supabase_vault 0.3.1 installed, Postgres 17.6. Resolves the STATE open item.
- **In-repo file reads (verified):** `platform/notifications/digest.ts`, `send-email.ts`, `notify.ts`; `platform/payments/stripe.ts`; `supabase/migrations/0003_payments_spine.sql`, `0004_transfer_entity.sql`, `0007_notifications.sql`; `app/api/stripe/webhook/route.ts`; `app/admin/page.tsx`; `package.json`; `vercel.json`.
- **CLAUDE.md** — Verified Provider Facts (pg_cron/pg_net free-tier limits, Vercel Hobby cron, 7-day pause, Resend cap, money single-writer lock) — project-locked HIGH.
- **supabase.com/docs/guides/functions/schedule-functions** — `cron.schedule` + `net.http_post` + Vault `decrypted_secrets` syntax.

### Secondary (MEDIUM confidence)
- **supabase.com/docs/guides/cron** — pg_cron usage, `cron.job` / `cron.job_run_details` (excerpt did not confirm `*/15` syntax explicitly — standard 5-field cron is supported by pg_cron upstream, HIGH by training + citusdata/pg_cron).
- **github.com/travisvn/supabase-pause-prevention** — keep-alive pattern (community).

### Tertiary (LOW confidence)
- The exact stored `payload` JSON path for the optional `webhook_events` secondary cross-check (A2) — inferred from the webhook code + Stripe event shape; no live `webhook_events` row exists yet to confirm (table empty). Not load-bearing — the Stripe-API list is the primary detector (D-03).

## Metadata

**Confidence breakdown:**
- Standard stack (pg_cron/pg_net/vault): **HIGH** — verified LIVE on Balkanity + against existing code.
- Architecture (cron→route→existing seams): **HIGH** — every seam exists and was read; only thin wrappers are new.
- Reconciliation detection (Stripe-API list + anti-join): **HIGH** — D-03 RESOLVED locks the source of truth; `getStripe()` + `wp_transfers` both verified.
- Pitfalls: **HIGH** — grounded in the existing CR-01 trap, the cap-near dedup pattern, and pg_net's documented async behaviour.

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable infra; re-verify extension versions only if the Supabase project is migrated)

## RESEARCH COMPLETE

**Phase:** 08 - platform-health
**Confidence:** HIGH

### Key Findings
- **STATE open item RESOLVED (live):** Balkanity ref `qyhdogajtmnvxphrslwm` has `pg_cron 1.6.4` (meets ≥1.6.4) + `pg_net 0.20.3` **available but not installed** → migration must `create extension`; Postgres 17.6; `supabase_vault 0.3.1` already installed (store the cron secret there).
- **Recommended invocation shape:** pg_cron → `net.http_post` → existing-style **Next route handlers** (`app/api/cron/health`, `app/api/cron/digest`, `runtime nodejs`), authenticated by a Vault-stored `x-cron-secret` (timing-safe compare) — NOT a Supabase Edge Function (repo has none; the sweep/digest logic already lives in `platform/notifications/*`). **2 cron jobs total** (15-min health = sweep+stuck+keep-alive; hourly digest).
- **Reconciliation = Stripe-API source of truth (D-03 RESOLVED):** list recent paid Checkout Sessions via `getStripe().checkout.sessions.list` and anti-join `wp_transfers` paid, filtered to sessions `> 10 min` old (lookback kills false positives); DETECT-only per D-01, alerts via existing `insertNotification` + critical `sendEmail`. `webhook_events` is a secondary cross-check only.
- **Everything else is wiring existing seams:** `sendDueDigests()` already self-filters by `digest_send_hour`; the email-cap gauge reuses the `email_log` daily-count query verbatim; `health_events` table mirrors the `notifications`/`email_log` RLS conventions (service-role write, admin-read, NO write policy); the keep-alive reuses `health_events` (`kind='keepalive'`, NO new table).

### File Created
`.planning/phases/08-platform-health/08-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Extensions verified LIVE on Balkanity |
| Architecture | HIGH | All seams read in-repo; only thin route wrappers new |
| Reconciliation | HIGH | D-03 RESOLVED (Stripe API source of truth); `getStripe()` + `wp_transfers` verified |
| Pitfalls | HIGH | Grounded in existing CR-01 trap + cap-near dedup + pg_net async docs |

### Open Questions (RESOLVED)
1. Dropped-webhook DoD semantics → RESOLVED by D-03: Stripe API is the source of truth (catches a never-delivered webhook); implemented in Plan 08-02.
2. Gauge placement → RESOLVED: dedicated `/admin/health` console page (Plan 08-03).
3. 1-vs-2 cron-job split → RESOLVED: 2-job design (15-min health + hourly digest); Plans 08-01/08-02/08-04.

### Ready for Planning
Research complete. Schema changes (extensions + `health_events` + cron schedules in `0008_platform_health.sql`) are FLAGGED/irreversible — require sign-off before live apply via the Management API (Balkanity ref only, never Kalvia). Planner can now create PLAN.md files.
