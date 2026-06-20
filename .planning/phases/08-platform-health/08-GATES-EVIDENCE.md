---
status: partial
phase: 08-platform-health
plan: 08-05
updated: 2026-06-20
target_ref: qyhdogajtmnvxphrslwm            # Balkanity (NEVER Kalvia utyatpadtibqqswsfvtr)
gates:
  schema_apply: passed                       # migration 0008 live on Balkanity
  secret_provisioned: passed                 # Vault cron_secret + Vercel CRON_SECRET (same value)
  route_auth: passed                         # 401 without secret / 200 with secret
  gate_b_cron_fires: passed                  # cron.job_run_details shows both jobs succeeding
  gate_c_keepalive: passed                   # keepalive rows recur; backstop 200/401
  gate_a_dropped_webhook: deferred           # blocked — prod missing STRIPE + RESEND env (see Task 3)
  no_paid_write_invariant: passed            # live sweeps wrote zero paid; single-writer.test.ts green
---

# Phase 8 — Live Operational Gate Evidence (08-05)

Plans 01–04 are code-complete and the full unit suite is GREEN (177 passed, 6 skipped, 0 failed; tsc clean). This file records the live-infrastructure apply + DoD gates run against the LIVE Balkanity project (`qyhdogajtmnvxphrslwm`, eu-central-1) via the **Supabase Management API** (`SUPABASE_ACCESS_TOKEN`) and the **Vercel REST API** (`VERCEL_TOKEN`) — NOT MCP (MCP reaches only Kalvia per project memory), NOT `supabase db push`.

**Summary:** the migration apply, secret provisioning, route auth, and Gates B + C are GREEN. **Gate A (dropped-webhook → reconciliation alert + critical email) is DEFERRED** — the production Vercel deployment has no `STRIPE_SECRET_KEY` (the D-03 reconciliation source of truth) and no `RESEND_API_KEY`, and `send.balkanity.com` is still unverified (the open Phase-7 blocker). See Task 3.

---

## Task 1 — FLAGGED sign-off — ✅ DONE (2026-06-20)

Operator reviewed `supabase/migrations/0008_platform_health.sql` end-to-end and approved the flagged/irreversible live apply ("comit push and do the migration"). Independent checklist review confirmed: FLAGGED header names Balkanity ref only + forbids Kalvia/`db push`/MCP; extensions precede `cron.schedule`; `health_events` has no `transfer_id`, free-form `kind` with no CHECK, no write policy; idempotent cron block; production receiver URL.

## Task 2 — Provision cron secret + apply 0008 LIVE — ✅ DONE (2026-06-20)

**Ref guardrail (re-asserted before any DDL):** `GET /v1/projects/qyhdogajtmnvxphrslwm` →
`id: qyhdogajtmnvxphrslwm | name: balkanityplatform's Project | region: eu-central-1 | status: ACTIVE_HEALTHY`.
Kalvia (`utyatpadtibqqswsfvtr`) is NOT the target — confirmed.

### Secret provisioning (same value both sides)

| Store | Action | Result |
|-------|--------|--------|
| Supabase Vault | `select vault.create_secret('<64-hex>','cron_secret')` via Management API | `[{"created":true}]`; verify `vault.secrets` name=`cron_secret`, created_at `2026-06-20 10:52:31+00` |
| Vercel env | `POST /v10/projects/prj_6qIZGAJPt6BdWY6hNvyIYWlloB6s/env` (upsert) | `CRON_SECRET` id `qTYyaFBf1hQuQm4o`, targets `production+preview+development` |

Secret = `openssl rand -hex 32` (64 chars), never printed/logged. Receiver project `balkanity_platform_project` owns `balkanityplatformproject.vercel.app` (confirmed via domains API). Redeployed `dpl_8pfc1a3CtR7iiMkKaDxkAaDk1VZ1` (commit `07f5a7d`) so the function binds the new env.

### DDL apply

**Path:** `POST /v1/projects/qyhdogajtmnvxphrslwm/database/query` with the full `0008_platform_health.sql` body. Response: `[{"schedule":4}]` (final `cron.schedule` returns its jobid).

**Live verification (all passed):**

| Check | Query result |
|-------|-------------|
| Extensions | `pg_cron` 1.6.4, `pg_net` 0.20.3 installed ✓ |
| Table + RLS | `health_events` exists, `rowsecurity = true` ✓ |
| Columns (no PII) | `id, kind, entity_type, entity_id, detail, resolved_at, created_at` — **no `transfer_id`** ✓ |
| Policies | single `health_events_admin_read` (`polcmd = r`, SELECT only) — **no INSERT/UPDATE/DELETE policy** ✓ |
| Indexes | `health_events_pkey` + `health_events_open_idx` (partial, `where resolved_at is null`) ✓ |
| Cron jobs | `health-sweep` (jobid 3, `*/15 * * * *`, active) + `digest-hourly` (jobid 4, `0 * * * *`, active) ✓ |

### Route auth (the CRON_SECRET chain)

`POST https://balkanityplatformproject.vercel.app/api/cron/health`:
- without `x-cron-secret` → **HTTP 401** `{"error":"unauthorized"}` ✓
- with `x-cron-secret` (Vault value) → **HTTP 200** `{"ok":true}` ✓

Proves Vault secret ↔ Vercel `CRON_SECRET` match (T-08-20 mitigated) and the timing-safe gate (T-08-18).

## Task 3 — Live DoD gates

### GATE B — CRON FIRES LIVE — ✅ PASSED

`cron.job_run_details` at **2026-06-20 11:00:00 UTC**:
- jobid 3 (`health-sweep`) → `status: succeeded`, `return_message: "1 row"`
- jobid 4 (`digest-hourly`) → `status: succeeded`, `return_message: "1 row"`

(`net.http_post` is async fire-and-forget — observability is `health_events` rows + `job_run_details`, not the cron return. Pitfall 4.)

### GATE C — KEEP-ALIVE + BACKSTOP — ✅ PASSED

`health_events` keepalive rows (each `entity_type='system'`, `resolved_at` set → never open, never alerts):
- `2026-06-20 10:58:01+00` (manual authenticated invoke)
- `2026-06-20 11:00:01+00` (cron-driven sweep)

The 11:00 row is written by the live cron chain (pg_cron → route 200 → `keepalive.ts`), proving recurring DB activity defeats the 7-day pause (HLTH-05). Backstop route auth: 200 with secret / 401 without (above).

### GATE A — DROPPED WEBHOOK CAUGHT — ⏳ DEFERRED (blocked on prod env)

**Status:** NOT proven live. The reconciliation detector (`platform/health/reconcile.ts`) reads the **Stripe API as the D-03 source of truth**, and the critical alert sends via **Resend**. The production Vercel deployment (`balkanity_platform_project`) currently has only these env vars:
`CRON_SECRET, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`.

Missing for Gate A: **`STRIPE_SECRET_KEY`** (no Stripe session list → reconcile cannot detect), **`STRIPE_WEBHOOK_SECRET`** (no signature-verified replay remediation), **`RESEND_API_KEY`** + a verified `send.balkanity.com` sender (no critical email). `STRIPE_WEBHOOK_SECRET` and `RESEND_API_KEY` are not available locally either. `send.balkanity.com` remains unverified (open Phase-7 gate, see `07-GATES-EVIDENCE.md`).

**What IS proven about Gate A's core invariant (D-01, money single-writer):** the live sweeps (manual 10:58 + cron 11:00) wrote **only** `keepalive` rows — **zero** `paid` writes and zero `wp_transfers` status changes — and `single-writer.test.ts` is GREEN. The detection layer is, by construction and by live observation, detect-and-alert only.

**Remaining steps to close Gate A (operator decision required):**
1. Decide Stripe mode for the pilot (test vs live) and set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` as server-only Vercel env on `balkanity_platform_project`; redeploy.
2. Verify Resend `send.balkanity.com` (DNS) + set `RESEND_API_KEY` server-only on Vercel (closes the Phase-7 D-15 gate too).
3. Seed a paid Stripe session whose `wp_transfers` row stays `requested` (the dropped/never-delivered webhook); invoke `/api/cron/health` with the secret (or wait one window). Assert: a `health_events` `kind='reconciliation_discrepancy'` row + admin in-app notification + critical email; transfer still NOT `paid`. Then replay via the signature-verified webhook → idempotent `paid`; a second sweep does NOT re-alert. Clean up the seeded row (zero residue).

---

## Residue

No Gate-A test rows were seeded (Gate A deferred). `health_events` contains only benign recurring `keepalive` rows (by design; auto-resolved, never alerting). Live DB left as found apart from the intended schema + cron objects from migration 0008.
