---
status: passed
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
  gate_a_dropped_webhook: passed             # live: dropped webhook caught + alerted, no paid write, replay remediates, no re-alert
  gate_a_email_delivery: deferred            # critical email FIRED (tier=critical, logged) but outcome=failed — send.balkanity.com unverified (shared Phase-7 D-15 DNS item)
  no_paid_write_invariant: passed            # live sweeps wrote zero paid; single-writer.test.ts green
---

# Phase 8 — Live Operational Gate Evidence (08-05)

Plans 01–04 are code-complete and the full unit suite is GREEN (177 passed, 6 skipped, 0 failed; tsc clean). This file records the live-infrastructure apply + DoD gates run against the LIVE Balkanity project (`qyhdogajtmnvxphrslwm`, eu-central-1) via the **Supabase Management API** (`SUPABASE_ACCESS_TOKEN`) and the **Vercel REST API** (`VERCEL_TOKEN`) — NOT MCP (MCP reaches only Kalvia per project memory), NOT `supabase db push`.

**Summary:** ALL THREE DoD gates are GREEN on live infra. The dropped-webhook reconciliation (the pilot's core DoD) was proven end-to-end with a real paid Stripe test session: the sweep detected the discrepancy, alerted both admins in-app, **never wrote `paid`**, and a signature-verified webhook replay idempotently remediated it with no re-alert. The single remaining caveat is critical-email *delivery* — the alert fires and is logged `tier=critical`, but `outcome=failed` because the hardcoded sender `send.balkanity.com` is not yet verified in Resend (the shared open Phase-7 D-15 DNS item). All seeded test data was removed (zero residue).

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

### GATE A — DROPPED WEBHOOK CAUGHT — ✅ PASSED (live, 2026-06-20)

Operator provisioned `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` as server-only Vercel env on `balkanity_platform_project`; redeployed.

**Account note (real config finding):** the deployed `STRIPE_SECRET_KEY` belongs to account `acct_1TjISbIVJCasWEpx` ("Balkanity Travel", test mode). The webhook the operator first created was in a different sandbox (`acct_1TjlSllDYZtQFMXK`). Because `acct_1TjIS` has no live-delivering webhook, a paid session created there is structurally a "dropped webhook" — ideal for the test. **Go-live action:** the production webhook must live in the same account as the deployed key.

**Setup:** seeded `wp_transfers` row `83a43285-8332-4092-b0fa-dd842d690379` (`status=requested`); created a test Checkout Session `cs_test_a1xSrsZQ…` with `metadata.transfer_id` = that id; operator paid it with test card 4242 → `payment_status=paid`, `status=complete`; transfer stayed `requested` (webhook dropped).

**Detection (live `POST /api/cron/health` → 200, after the 10-min lookback):**

| Assertion | Result |
|-----------|--------|
| `health_events` discrepancy row | ✅ `kind=reconciliation_discrepancy`, `entity_type=transfer`, `entity_id=83a43285…`, `resolved_at=null`, detail = non-PII (session_id + transfer_id) |
| Admin in-app notifications | ✅ BOTH admins (`e4ebf1b7…`, `98933d6a…`) — `type=reconciliation_discrepancy` |
| Transfer NOT paid (D-01) | ✅ `status=requested`, `paid_at=null` — the sweep wrote NOTHING |
| Critical email | ◑ FIRED `tier=critical` (recipient `admin@balkanity.com`), `outcome=failed` — sender `send.balkanity.com` unverified. The alert path executes; only delivery is gated on DNS (shared Phase-7 D-15). |

**Remediation (signature-verified webhook replay of the real `evt_1TkNVtIVJCasWEpx…`):**

| Assertion | Result |
|-----------|--------|
| Replay #1 (valid HMAC) | ✅ `200 {received:true}` → transfer flipped `status=paid`, `paid_at` + `stripe_payment_intent_id` set |
| `webhook_events` audit | ✅ `signature_result=valid`, `outcome=processed` |
| Replay #2 (same `event.id`) | ✅ `200 {received:true,duplicate:true}` — UNIQUE `event_id` dedup, no second effect (SC3) |
| Forged signature | ✅ `400 {invalid signature}` — HMAC rejects |
| 2nd sweep after remediation | ✅ NO re-alert (notifications stayed 2, recon rows stayed 1) — reconcile skips the now-paid transfer |

**Cleanup (zero residue):** cleared the session's `metadata.transfer_id` (so reconcile permanently ignores the lingering paid test session in its 24h window), then deleted the seeded transfer + all its `notifications`, `health_events`, `webhook_events`, and `email_log` rows. A final sweep produced **no re-detection**; `select count(*) from health_events where kind <> 'keepalive'` = **0**.

---

## Residue

None. All Gate-A test rows removed. `health_events` contains only benign recurring `keepalive` rows (by design; auto-resolved, never alerting). The paid test Checkout Session remains in Stripe test mode but its `metadata.transfer_id` was cleared, so reconcile ignores it. Live DB otherwise left as found apart from the intended schema + cron objects from migration 0008.

## Open item (not blocking the DoD)

Critical-email **delivery** is the one leg not green: the sender is hardcoded to `noreply@send.balkanity.com` ([send-email.ts:30](../../../platform/notifications/send-email.ts)), and that domain is not yet verified in Resend (only `balkanity.com` exists, `not_started`). Verify `send.balkanity.com` DNS in Resend to flip both this leg and the Phase-7 D-15 gate green. The alert *fires* correctly today; only delivery is pending.
