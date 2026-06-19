---
phase: 06-driver-admin-views
plan: 05
subsystem: admin-ops
tags: [admin, ops-actions, refund, migration, release, audit, single-writer]
requires:
  - "06-01 (migration 0006 authored + single-writer gate widened + RED specs)"
  - "06-04 (admin transfer detail read-only view + page)"
  - "05-03 (live-apply pattern via Management API)"
provides:
  - "Migration 0006 LIVE on Balkanity: claimed->paid release edge (D-14) + last_action_* audit columns (D-15)"
  - "Five gated admin ops Server Actions: assign/reassign/release/cancel/refund (OPS-03/OPS-04)"
  - "Server-only refundPayment hook wired into the refund action (idempotency-keyed)"
  - "Wired admin transfer detail view: confirm+reason dialogs, RefundForm, cancel->offer-refund shortcut"
  - "The narrow gated status='paid' writer (release) — single-writer contract now {webhook, admin transfers actions}"
affects:
  - "app/admin/transfers/[id]/* (detail view now mutates state)"
  - "wp_transfers live schema (release edge + audit columns)"
tech-stack:
  added: []
  patterns:
    - "Gated service-role Server Action (getCurrentRole re-gate + zod + createAdminClient + revalidatePath)"
    - "Optimistic-concurrency release guard (.eq('status','claimed')) — never read-then-write"
    - "Stable idempotencyKey per (transfer, amount) for the Stripe refund (Pitfall 3)"
    - "useActionState confirm dialog requiring the D-10 reason note before a destructive mutation"
key-files:
  created:
    - "app/admin/transfers/actions.ts"
    - "app/admin/transfers/[id]/RefundForm.tsx"
    - ".planning/phases/06-driver-admin-views/06-MIGRATION-EVIDENCE.md"
  modified:
    - "app/admin/transfers/[id]/TransferDetailView.tsx"
    - "app/admin/transfers/[id]/page.tsx"
    - "platform/i18n/en.ts"
    - "platform/i18n/bg.ts"
    - "platform/payments/refund.ts (Task 1, prior commit 572665f)"
decisions:
  - "Migration 0006 applied LIVE to Balkanity via Management API after 'approved' sign-off; ref guardrail confirmed Kalvia absent; history row inserted in the same BEGIN..COMMIT txn"
  - "release is the ONE narrow gated status='paid' writer (D-15), guarded by .eq('status','claimed') — the single-writer gate stays GREEN with exactly {webhook, admin transfers actions}"
  - "refund records last_action_* ONLY and never writes status='paid' (a refund is not a payment, D-12); cancel never auto-refunds, only offers the refund shortcut (D-11)"
  - "last_action_by is the acting admin's verified JWT uid (auth.getUser), never a client arg"
  - "Refund amount entered in euros (UI), converted to cents server-side and rejected if > paid amount (T-06-INPUT)"
metrics:
  duration: "~20min"
  completed: "2026-06-19"
  tasks: 3
  files: 9
---

# Phase 6 Plan 5: Admin Ops + Refund + Live Migration 0006 Summary

Closed Phase 6 with the admin ops/refund vertical slice and the BLOCKING live apply of migration 0006: an admin can now assign (one-tap), reassign/release/cancel (confirm+reason) and issue a full/partial Stripe refund from the transfer detail page, with the `claimed->paid` release edge and `last_action_*` audit columns live on Balkanity.

## What Was Built

**Task 1 (prior, commit `572665f`):** the server-only `refundPayment` hook (`stripe.refunds.create` + idempotency, full/partial, never sets paid) plus its TEST-mode smoke. Verified present, not redone.

**Task 2 — LIVE migration apply (BLOCKING, signed off "approved"):**
- Ran the Management-API ref guardrail FIRST: Balkanity (`qyhdogajtmnvxphrslwm`) resolved, Kalvia (`utyatpadtibqqswsfvtr`) absent from the response and `.env.local`.
- Probed pre-apply state (history at 0005; no audit columns; trigger did NOT permit `claimed->paid`).
- Applied `0006_release_and_audit.sql` verbatim via `POST /v1/projects/qyhdogajtmnvxphrslwm/database/query` in one `BEGIN…COMMIT` that also inserted the `supabase_migrations.schema_migrations` row for `0006` — **HTTP 201 `[]`** (DDL success).
- Post-apply probes confirmed: history at 0006; trigger permits `claimed->paid`; all three `last_action_*` columns present and NULL-able; only SELECT policies on `wp_transfers` (no-write-policy lock intact); the lifecycle guard trigger still attached.
- Recorded everything in `06-MIGRATION-EVIDENCE.md`, mirroring `05-GATES-EVIDENCE.md`.

**Task 3 — admin ops actions + wiring (commit `f12fe91`):**
- `app/admin/transfers/actions.ts`: five gated service-role actions, each re-gating `getCurrentRole()==='admin'`, zod at the boundary, generic dictionary-keyed errors:
  - `assign` (one-tap, no reason), `reassign` (driver swap + audit), `release` (claimed-only `driver_id=null, status='paid'` via `.eq('status','claimed')` guard — the D-15 narrow paid writer), `cancel` (→cancelled + audit, never refunds), `refund` (resolves the PaymentIntent from the row, calls `refundPayment` with a stable `idempotencyKey`, records audit, never sets paid).
- `RefundForm.tsx`: amount pre-filled to full (editable down), required reason, the ALWAYS-shown `refundFeeDisclosure` with the recorded fee substituted; submit disabled while pending.
- `TransferDetailView.tsx`: wired the five controls — assign as a one-tap inline form; reassign/release/cancel behind confirm+reason dialogs; cancel offers the refund shortcut (never auto-refunds); refund opens the RefundForm. Destructive controls use the coral token.
- `en.ts`/`bg.ts`: added `transferDriverIdLabel` + `confirmActionCta` (all other ops copy already existed).

## Verification

- `npm run typecheck` — clean.
- `npx vitest run app/admin/transfers/actions.test.ts platform/payments/single-writer.test.ts` — 8/8 GREEN. `single-writer` confirms exactly {webhook route, admin transfers actions} as the two `status='paid'` writers.
- Full suite: 142 passed | 6 skipped (the live-env-gated refund smoke + Phase-5 gates skip cleanly — no false-pass).
- Live DB probes (recorded in `06-MIGRATION-EVIDENCE.md`) prove the release edge + audit columns exist on Balkanity.

## Deviations from Plan

None — plan executed as written. The live apply used `curl` (not Python `urllib`, which lacked the system CA bundle) for the Management-API POST; this is the same transport the project's prior apply records use, not a behavioural deviation.

## Self-Check: PASSED

- `app/admin/transfers/actions.ts` — FOUND
- `app/admin/transfers/[id]/RefundForm.tsx` — FOUND
- `.planning/phases/06-driver-admin-views/06-MIGRATION-EVIDENCE.md` — FOUND
- Commit `572665f` (Task 1) — FOUND
- Commit `60facd8` (Task 2) — FOUND
- Commit `f12fe91` (Task 3) — FOUND
