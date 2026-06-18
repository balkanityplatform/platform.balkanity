---
phase: 3
slug: payments-trust-spine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` §"Validation Architecture". All adversarial gates run in Stripe TEST mode (D-02).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.9` (jsdom) for unit/source-level; Playwright `^1.61` (chromium) for e2e |
| **Config file** | `vitest.config.ts` (includes `app/**/*.test.{ts,tsx}`, `platform/**`, `modules/**`); `setupFiles: ./vitest.setup.ts` |
| **Quick run command** | `npm run test` (`vitest run`) |
| **Full suite command** | `npm run test && npm run typecheck && npm run lint` |
| **e2e command** | `npm run test:e2e` (Playwright) — live webhook / forged-POST flow |
| **Estimated runtime** | ~30 seconds (unit); e2e + CLI replay harness run at the phase gate |

> Established precedent (Phase 2): **source-level contract tests** read migration SQL text and assert the security shape (`platform/rls/supply-rls.test.ts`). Reuse this exact pattern for the `webhook_events` / `wp_transfers` RLS + UNIQUE + grep-single-writer contracts. Live-DB assertions run at the BLOCKING push-verification checkpoint + e2e.

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (quick vitest) + `npm run typecheck`
- **After every plan wave:** Run `npm run test && npm run typecheck && npm run lint`
- **Before `/gsd-verify-work`:** Full suite green + the **three adversarial gates** demonstrated via Stripe CLI in TEST mode (forged → 400, replay → one effect, success-spoof → no `paid`) + grep single-writer gate
- **Max feedback latency:** ~30 seconds (unit)

---

## Per-Task Verification Map

| Req / Criterion | Plan/Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-----------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC1 | TBD/W1 | BOOK-05 | T-SD | `paid` written in exactly one code path (grep gate; no other `status='paid'` writer) | source-level (grep) | `vitest run platform/payments/single-writer.test.ts` | ❌ W0 | ⬜ pending |
| SC1 | TBD/W1 | BOOK-05 | T-spoof | Webhook route declares `runtime='nodejs'` + reads `req.text()` (not `.json()`) | source-level | `vitest run app/api/stripe/webhook/route.contract.test.ts` | ❌ W0 | ⬜ pending |
| SC2 | TBD/W2 | BOOK-05 | Spoofing | Forged/unsigned POST → 400 + zero state change | route unit + e2e | `vitest run` + `playwright test tests/e2e/webhook-forged.spec.ts` | ❌ W0 | ⬜ pending |
| SC2 | TBD/W2 | BOOK-05 | Spoofing | Spoofed `success_url` never writes `paid` (success page display-only) | source-level + e2e | grep success page; `playwright test tests/e2e/success-spoof.spec.ts` | ❌ W0 | ⬜ pending |
| SC3 | TBD/W2 | BOOK-05 | Tampering/Replay | Replayed `event.id` → exactly one effect (UNIQUE + insert-first) | live/e2e (Stripe CLI) | `stripe events resend evt_…` then assert one `webhook_events` row + `paid_at` unchanged | ❌ W0 | ⬜ pending |
| SC3 | TBD/W1 | HLTH-01 | Tampering | `webhook_events.event_id` UNIQUE constraint present | source-level (migration text) | `vitest run platform/rls/payments-schema.test.ts` | ❌ W0 | ⬜ pending |
| SC4 | TBD/W1 | HLTH-01 | Logging | `webhook_events` records idempotency key + signature_result + outcome | source-level + unit | `vitest run platform/rls/payments-schema.test.ts` | ❌ W0 | ⬜ pending |
| SC4 | TBD/W1 | HLTH-01 | Access Control | Both `webhook_events` & `wp_transfers` RLS-enabled, admin-read, NO write policy | source-level (Phase 2 pattern) | `vitest run platform/rls/payments-schema.test.ts` | ❌ W0 | ⬜ pending |
| SC5 | TBD/W2 | BOOK-05 | — | Code-created Session carries `metadata.transfer_id`, EUR, integer `unit_amount` (no Payment Link) | unit (mock Stripe) | `vitest run platform/payments/checkout.test.ts` | ❌ W0 | ⬜ pending |
| SC5/D-05 | TBD/W2 | BOOK-05 | Tampering | Actual fee recorded from balance_transaction in integer cents | unit (mock expanded PI) | `vitest run platform/payments/fee.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Plan/Wave filled by planner.*

---

## Wave 0 Requirements

- [ ] `platform/payments/single-writer.test.ts` — grep gate: exactly one `status='paid'` writer (SC1)
- [ ] `app/api/stripe/webhook/route.contract.test.ts` — asserts `runtime='nodejs'` + `req.text()` usage (SC1)
- [ ] `platform/rls/payments-schema.test.ts` — source-level contract for `0003`: UNIQUE `event_id`, required columns, RLS-enabled + admin-read + NO write policy, Balkanity-ref guardrail (mirrors `supply-rls.test.ts`)
- [ ] `platform/payments/checkout.test.ts` — Stripe `sessions.create` called with EUR + integer `unit_amount` + `metadata.transfer_id`, mode `payment` (SC5)
- [ ] `platform/payments/fee.test.ts` — `fee_cents` derived from expanded `latest_charge.balance_transaction.fee` (D-05)
- [ ] `tests/e2e/webhook-forged.spec.ts` + `tests/e2e/success-spoof.spec.ts` — the two HTTP adversarial gates (SC2)
- [ ] CLI replay harness (documented runbook, not a unit test) — `stripe listen` + `stripe events resend` for SC3
- [ ] Framework install: none needed (Vitest + Playwright already configured); `npm install stripe@^22.2`

> All 7 Wave 0 test files above are planned in Plan 03-01 (the Wave 0 / test-scaffold plan). They are PLANNED, not yet executed — hence `wave_0_complete: false`. Every downstream task that depends on these scaffolds references them as its `<automated>` / Wave-0 dependency.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Replayed `event.id` → exactly one effect | BOOK-05 | Requires Stripe CLI event resend against a running webhook in TEST mode | `stripe listen --forward-to localhost:3000/api/stripe/webhook`, trigger `checkout.session.completed`, then `stripe events resend evt_…`; assert exactly one `webhook_events` row and `paid_at` unchanged on the second delivery |
| Migration `0003` applied to Balkanity ref `qyhdogajtmnvxphrslwm` | HLTH-01 | FLAGGED/irreversible schema migration — human sign-off before apply; applied via Supabase CLI/Management token, not MCP | Sign off on `0003` SQL, apply via CLI, verify UNIQUE + RLS via IPv4 pooler |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

> Planning-time sign-off: the six items above are satisfied by the plan set as written (all Wave 0 scaffolds planned in 03-01; every downstream task carries an automated/Wave-0 verify; no watch-mode; quick-run latency ~30s). `wave_0_complete` flips to `true` only after Plan 03-01 executes and the scaffolds exist red on disk.

**Approval:** 2026-06-18 (planning-time)
