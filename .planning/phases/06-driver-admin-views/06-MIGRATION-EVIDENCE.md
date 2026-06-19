---
phase: 06-driver-admin-views
plan: 05
type: migration-evidence
created: 2026-06-19
status: passed
gates:
  schema_apply: passed                       # migration 0006 live on Balkanity
  release_edge: passed                        # claimed->paid permitted by the live trigger (D-14)
  audit_columns: passed                       # last_action_reason/by/at present on live wp_transfers (D-15)
  no_write_policy_lock: passed                # no INSERT/UPDATE/DELETE policy added (lock intact)
target_ref: qyhdogajtmnvxphrslwm             # Balkanity (NEVER Kalvia utyatpadtibqqswsfvtr)
---

# Phase 6 — Migration 0006 Live-Apply Evidence

> Recorded commands + outputs for the FLAGGED schema apply (migration `0006_release_and_audit.sql`)
> to the LIVE Balkanity project (`qyhdogajtmnvxphrslwm`, eu-central-1). This is the BLOCKING,
> sign-off-gated task in Plan 05 (`autonomous: false`). The migration adds the trigger-legal
> `claimed -> paid` RELEASE backward edge (D-14, claimed-only) to `wp_enforce_transfer_transition()`
> and the three NULL-able audit columns `last_action_reason` / `last_action_by` / `last_action_at`
> to `wp_transfers` (D-15). It mirrors the `05-GATES-EVIDENCE.md` apply pattern exactly.

## Execution mode note

Live DB work was performed via the **Supabase Management API** (`SUPABASE_ACCESS_TOKEN` from
`.env.local`, loaded with `set -a; source .env.local; set +a`), **not MCP** (MCP reaches only
Kalvia per project memory) and **not the direct `db.<ref>.supabase.co` host** (IPv6-only;
unresolvable on this network). The Management API
`POST /v1/projects/qyhdogajtmnvxphrslwm/database/query` endpoint is the confirmed IPv4 path to
Balkanity (mirrors the Phase-3/Phase-5 precedent). Migration history
(`supabase_migrations.schema_migrations`) was inserted in the SAME `BEGIN … COMMIT` transaction
so a future `supabase db push` stays consistent. No secret values were printed anywhere.

---

## Pre-real-money gate (RESEARCH Open Q3) — Task 1 refund smoke

Per the Plan 05 `<how-to-verify>` PRE-GATE: Task 1's server-only refund hook
(`platform/payments/refund.ts`, commit `572665f`) and its Stripe TEST-MODE smoke
(`platform/payments/refund.smoke.test.ts`) were completed and committed BEFORE this live apply.
The smoke `describe.skip`s cleanly when the Stripe TEST secret env is absent (never false-pass),
mirroring the Phase-5 live-env gate discipline — so the test-mode refund path is proven (or
cleanly deferred) before any real-money-capable migration lands.

---

## Human sign-off (FLAGGED migration 0006)

**Recorded 2026-06-19.** The operator reviewed `supabase/migrations/0006_release_and_audit.sql`
end-to-end (the single new `claimed -> paid` allowed pair restricted to `status='claimed'`; the
three NULL-able audit columns with no default; the confirmation that NO INSERT/UPDATE/DELETE RLS
policy is added — the no-write-policy lock from 0002/0003/0004/0005 holds) and approved the live
apply:

> **Decision: `approved` — apply migration 0006 to the LIVE Balkanity DB.**
> The change touches ONLY the `claimed -> paid` release edge (no other backward edge — no
> `en_route -> paid`) and the three additive audit columns; it adds no write policy. Acceptable
> as a change to the locked Phase-5 trigger.

Precondition before any live DDL: the Balkanity ref guardrail (below) passed and the pre-apply
state was probed. No live DDL ran before this sign-off.

---

## Guardrail — target ref is Balkanity (T-06-KALVIA, Pitfall 6)

```
$ curl -s https://api.supabase.com/v1/projects/qyhdogajtmnvxphrslwm \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
name: balkanityplatform's Project | ref: qyhdogajtmnvxphrslwm | region: eu-central-1 | status: ACTIVE_HEALTHY

Balkanity ref (qyhdogajtmnvxphrslwm) resolved?          → YES
Kalvia ref (utyatpadtibqqswsfvtr) present in response?  → NO   (OK)

NEXT_PUBLIC_SUPABASE_URL ref → qyhdogajtmnvxphrslwm     (Balkanity ✓)
Kalvia ref anywhere in .env.local?                      → NO   (OK)
```

Ran BEFORE apply. Balkanity confirmed; Kalvia absent.

---

## Task 2 — Apply migration 0006 (FLAGGED, D-14 / D-15)

### Pre-apply live state

```
migration history → 0001, 0002, 0003, 0004, 0005
last_action_* columns on wp_transfers       → []                       (none yet)
trigger permits claimed -> paid             → has_claimed_paid_edge: false
```

All preconditions correct: the release edge and audit columns do NOT yet exist on the live DB.

### Apply (atomic — BEGIN … COMMIT, history row in the SAME txn)

```
POST /v1/projects/qyhdogajtmnvxphrslwm/database/query
body: BEGIN; <0006_release_and_audit.sql> ;
      insert into supabase_migrations.schema_migrations (version, name, statements)
      values ('0006','release_and_audit', ARRAY[$migration$ … $migration$]);
      COMMIT;
response: HTTP 201  []      # empty array = DDL success, no error
```

### Post-apply live verification (IPv4 / Management API)

```
1. migration history → 0001, 0002, 0003, 0004, 0005, 0006 (release_and_audit)        ✓

2. wp_enforce_transfer_transition permits claimed -> paid →
     has_claimed_paid_edge: true                                                       ✓ (D-14 release edge live)

3. last_action_* columns on wp_transfers →
     last_action_at     timestamp with time zone   is_nullable=YES                     ✓
     last_action_by     uuid                        is_nullable=YES                     ✓
     last_action_reason text                        is_nullable=YES                     ✓ (D-15 audit columns, all NULL-able)

4. policies on wp_transfers →
     wp_transfers_admin_read          (SELECT)
     wp_transfers_claimed_driver_read (SELECT)
     wp_transfers_guest_self_read     (SELECT)
     NO INSERT/UPDATE/DELETE policy                                                     ✓ (no-write-policy lock holds)

5. trigger wp_transfers_transition_guard → tgenabled='O' (BEFORE UPDATE, attached)     ✓
```

**Result: PASS.** `0006` is live on Balkanity (never Kalvia) and matches the source contract:
the `claimed -> paid` release edge is the ONLY new transition (claimed-only; no `en_route -> paid`),
the three NULL-able audit columns exist, the no-write-policy lock is intact, and the lifecycle
guard trigger is still attached. The release `status='paid'` write therefore stays trigger-legal
AND service-role-only behind the gated admin action (single-writer contract = {webhook, release}).

---

## Acceptance summary

| Criterion | Status |
|-----------|--------|
| Pre-real-money gate (Task 1 refund hook + smoke) committed before apply | ✅ PASS |
| Sign-off recorded (`approved`) before any live DDL | ✅ PASS |
| Ref guardrail — Balkanity confirmed, Kalvia absent — BEFORE apply | ✅ PASS |
| Migration 0006 applied to Balkanity (never Kalvia) via Management API; history row in same txn | ✅ PASS |
| Live trigger permits `claimed -> paid` (D-14, claimed-only) | ✅ PASS |
| Three `last_action_*` audit columns present on live `wp_transfers` (D-15, NULL-able) | ✅ PASS |
| No new write policy on `wp_transfers` (no-write-policy lock intact) | ✅ PASS |
| Applied to `qyhdogajtmnvxphrslwm` ONLY; Kalvia never targeted | ✅ PASS |

**Migration 0006 is live on Balkanity after sign-off.** The `claimed -> paid` release edge and
the `last_action_*` audit columns exist on the live DB; the no-write-policy lock holds; Kalvia
was never targeted. The release/audit paths can now be exercised against the live schema.
