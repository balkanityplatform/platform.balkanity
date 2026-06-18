---
phase: 03-payments-trust-spine
plan: 05
subsystem: payments
tags: [stripe, webhook, migration, rls, idempotency, adversarial-gates, supabase]
requires:
  - "03-02: wp_transfers + webhook_events schema (migration 0003)"
  - "03-03: platform/payments seam (stripe.ts, checkout.ts, fee.ts)"
  - "03-04: app/api/stripe/webhook/route.ts (the single paid writer) + pay pages"
provides:
  - "Migration 0003 LIVE on Balkanity (qyhdogajtmnvxphrslwm): wp_transfers + webhook_events, RLS-enabled, admin-read, UNIQUE event_id"
  - "03-GATES-EVIDENCE.md: recorded evidence for schema apply + GATE A (SC2) + GATE C (SC1)"
affects:
  - "Phase 4: ALTERs wp_transfers to add guest PII + lifecycle columns; uses the live schema"
  - "Phase 8: reconciliation sweep over webhook_events; SC3 replay completion"
tech-stack:
  added: []
  patterns:
    - "Live DB work via Supabase Management API (/database/query) with SUPABASE_ACCESS_TOKEN — IPv4 path to Balkanity (NOT MCP, NOT IPv6 direct host)"
    - "FLAGGED migration applied atomically (BEGIN/COMMIT) with schema_migrations history recorded in the same transaction"
    - "Adversarial gates: dummy Stripe keys inline for a genuine HMAC-rejection forged-POST test; live zero-state-change confirmation beyond HTTP status"
key-files:
  created:
    - .planning/phases/03-payments-trust-spine/03-GATES-EVIDENCE.md
  modified:
    - supabase/migrations/0003_payments_spine.sql  # applied (file unchanged; recorded in live schema_migrations)
key-decisions:
  - "Applied 0003 via Supabase Management API query endpoint (CLI direct host is IPv6-only/unresolvable here); recorded 0003 in schema_migrations for db-push consistency"
  - "GATE B (SC3 replay) deferred per operator decision — Stripe CLI + sk_test_/whsec_ keys not available; DB-level idempotency authority (UNIQUE event_id + insert-first) is in place and verified, only the live resend demo remains"
patterns-established:
  - "Balkanity-ref guardrail run BEFORE any live write (confirm qyhdogajtmnvxphrslwm via Management API; STOP on Kalvia)"
  - "Secrets passed as inline shell env for test runs only — never written to tracked files / NEXT_PUBLIC_"
requirements-completed: [BOOK-05, HLTH-01]  # partial on SC3 (replay) — see Open Items
duration: 18min
completed: 2026-06-18
---

# Phase 3 / Plan 05: Live Gates Summary

**Migration `0003` is signed off and live on the Balkanity database, and the trust-spine adversarial gates pass — forged/unsigned webhooks are rejected with zero state change and `paid` has exactly one writer — with the live replay demonstration (SC3) deferred pending the Stripe CLI + TEST keys.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-18
- **Tasks:** 2 (Task 1 full; Task 2 partial — GATE A + GATE C done, GATE B deferred)
- **Files created:** 1 (`03-GATES-EVIDENCE.md`)

## Accomplishments
- **Schema sign-off + live apply (Task 1):** Human-reviewed `0003`, confirmed the target ref echoes Balkanity (`qyhdogajtmnvxphrslwm`, never Kalvia), applied atomically, and verified live: both tables exist, RLS enabled on both, UNIQUE `event_id` present, one admin-read SELECT policy each with NO write policy, minimal money-spine columns. History now `0001/0002/0003`.
- **GATE A — SC2 (Task 2):** Forged + missing-signature POSTs → HTTP 400; spoofed `/pay/success` renders no `paid`. Confirmed **zero state change** on the live DB (0 `evt_forged` rows, 0 total `webhook_events`, 0 `paid` transfers).
- **GATE C — SC1 (Task 2):** Grep confirms exactly one `paid` writer (the webhook route); full suite green (82/82 unit, typecheck clean, lint 0 errors).
- **Evidence recorded:** `03-GATES-EVIDENCE.md` captures every command + output.

## Open Items (phase NOT fully complete)
- **GATE B — SC3 (replay → exactly one effect): DEFERRED.** Needs `stripe` CLI + real `sk_test_`/`whsec_` keys. The DB-level idempotency authority (UNIQUE `webhook_events_event_id_key` + insert-first route logic) is live and verified; only the `stripe events resend` live demo remains. Completion runbook is in `03-GATES-EVIDENCE.md` §GATE B and `03-REPLAY-RUNBOOK.md`.

## Verification
- Live schema verified via Supabase Management API (IPv4) post-apply.
- `npm run test:e2e -- webhook-forged success-spoof` → 3 passed.
- `npm run test && npm run typecheck && npm run lint` → green (1 pre-existing lint warning).

## Deviations
- **Apply path:** Used the Supabase Management API `/database/query` endpoint rather than `supabase db push` — the direct `db.<ref>.supabase.co` host is IPv6-only and unresolvable on this network, and MCP reaches only Kalvia. Management API is the project's confirmed IPv4 path to Balkanity (per memory). `schema_migrations` was updated in the same transaction so `db push` stays consistent.
- **GATE B deferred** (operator decision) — see Open Items.
