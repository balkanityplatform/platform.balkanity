---
phase: 04
slug: transfer-entity-booking-form
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-18
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.9` (jsdom) for unit/action specs; Playwright `^1.61.0` (chromium) for e2e |
| **Config file** | `vitest.config.ts` (includes `app/**/*.test.{ts,tsx}`, `platform/**`); `playwright.config.ts` |
| **Quick run command** | `npm run test` (vitest run) |
| **Full suite command** | `npm run test && npm run test:e2e && npm run typecheck && npm run lint` |
| **Estimated runtime** | ~30 seconds (vitest) + ~45 seconds (e2e chromium) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (fast vitest) + `npm run typecheck` (the en/bg Dict parity gate fails tsc on any missing key).
- **After every plan wave:** Run `npm run test && npm run test:e2e`.
- **Before `/gsd-verify-work`:** Full suite must be green AND the 0004 DB-trigger adversarial runbook must have passed on the live Balkanity DB (Plan 05).
- **Max feedback latency:** ~30 seconds (vitest quick run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | XFER-01 | T-04-01 / T-04-02 | TS lifecycle map mirrors the DB trigger; no second state enum | unit | `npm run test -- platform/transfers/lifecycle.test.ts && npm run typecheck` | ✅ (map+test land together) | ⬜ pending |
| 04-01-02 | 01 | 1 | BOOK-02, BOOK-03, BOOK-06, BOOK-07, AUTH-02 | — | Wave 0 RED specs reference future surfaces; tsc-clean, RED at runtime | unit + e2e | `npm run typecheck && npm run test -- app/pickup platform/transfers/confirmation.test.ts` | ❌ W0 (this task creates them) | ⬜ pending |
| 04-01-03 | 01 | 1 | BOOK-02, BOOK-04, BOOK-06, BOOK-07, AUTH-02 | — | All en/bg copy keys present; Dict parity green | typecheck | `npm run typecheck` | ✅ (en.ts/bg.ts exist) | ⬜ pending |
| 04-02-01 | 02 | 2 | XFER-01, BOOK-01 | T-04-ID1 / T-04-ID2 | Additive NULL-able PII+lifecycle ALTER; no write policy added | static (grep) | `grep -q 'add column if not exists guest_email' supabase/migrations/0004_transfer_entity.sql && grep -q 'qyhdogajtmnvxphrslwm' supabase/migrations/0004_transfer_entity.sql && grep -q 'references auth.users(id) on delete set null' supabase/migrations/0004_transfer_entity.sql && echo OK` | ✅ (file created in this plan) | ⬜ pending |
| 04-02-02 | 02 | 2 | XFER-01 | T-04-TMP1 / T-04-TMP2 | BEFORE-UPDATE trigger permits requested→paid, rejects illegal jumps; fires on service-role | static (grep) | `grep -q 'before update on public.wp_transfers' supabase/migrations/0004_transfer_entity.sql && grep -q "old.status = 'requested' and new.status in ('paid'" supabase/migrations/0004_transfer_entity.sql && grep -q "errcode = 'check_violation'" supabase/migrations/0004_transfer_entity.sql && echo OK` | ✅ (appends to 0004) | ⬜ pending |
| 04-02-03 | 02 | 2 | AUTH-02, BOOK-01 | T-04-ID1 / T-04-ID3 | Guest-self-read RLS via `auth.jwt() ->> 'email'` (never `auth.email()`); narrow active-destination anon read | static (grep) | `grep -q "auth.jwt() ->> 'email'" supabase/migrations/0004_transfer_entity.sql && ! grep -q 'auth.email()' supabase/migrations/0004_transfer_entity.sql && grep -q 'destinations_public_active_read' supabase/migrations/0004_transfer_entity.sql && grep -q 'using ( active = true )' supabase/migrations/0004_transfer_entity.sql && echo OK` | ✅ (appends to 0004) | ⬜ pending |
| 04-03-01 | 03 | 3 | BOOK-02, BOOK-03 | T-04-TMP3 / T-04-V5 / T-04-SPOOF | createBooking zod boundary → server-trusted amount → Checkout; no second paid writer | unit | `npm run test -- app/pickup/[slug]/booking.test.ts && npm run typecheck && npm run lint` | ✅ (turns Plan-01 RED spec GREEN) | ⬜ pending |
| 04-03-02 | 03 | 3 | BOOK-01 | T-04-ID4 | /pickup slug→fare display; inactive-slug neutral state; PaxStepper ≥44px | build | `npm run typecheck && npm run lint && npm run build` | ✅ (page+primitive created) | ⬜ pending |
| 04-03-03 | 03 | 3 | BOOK-02, BOOK-04 | T-04-V5 | BookingForm useActionState; disclosure-gated CTA; no client amount input | build | `npm run typecheck && npm run lint && npm run build` | ✅ (form island created) | ⬜ pending |
| 04-04-01 | 04 | 3 | BOOK-06 | T-04-SPOOF2 | Confirmation stub builds the status magic link; webhook fires it log-and-continue; no second paid writer | unit | `npm run test -- platform/transfers/confirmation.test.ts platform/payments/single-writer.test.ts && npm run typecheck && npm run lint` | ✅ (turns Plan-01 RED spec GREEN) | ⬜ pending |
| 04-04-02 | 04 | 3 | BOOK-07, AUTH-02 | T-04-ID5 / T-04-SPOOF2 | /status/[id] RLS-gated read via getUser (never getSession); timeline+receipt; post-claim driver reveal; success page display-only | unit + e2e | `npm run test -- platform/payments/single-writer.test.ts && npm run typecheck && npm run lint && npm run test:e2e -- success-spoof` | ✅ (success-spoof e2e exists; status page created) | ⬜ pending |
| 04-04-03 | 04 | 3 | AUTH-02 | T-04-TMP4 / T-04-ID6 / T-04-ID7 | /track neutral no-enumeration link re-issue; allowlisted `next` (open-redirect guard); NetworkFirst guest pages | build | `npm run typecheck && npm run lint && npm run build && grep -E "status\|pickup\|track" app/sw.ts` | ✅ (routes created; sw.ts modified) | ⬜ pending |
| 04-05-01 | 05 | 4 | XFER-01, BOOK-01, BOOK-03, AUTH-02, BOOK-07 | T-04-ENV | [BLOCKING/SIGN-OFF] Apply 0004 to Balkanity only (never Kalvia); columns/trigger/policies live; seed rows intact | manual (human-verify) | See Manual-Only Verifications — live-apply sign-off | n/a (live DB apply) | ⬜ pending |
| 04-05-02 | 05 | 4 | XFER-01 | T-04-TMP5 / T-04-ID8 / T-04-SPOOF3 | Live trigger permits requested→paid + raises check_violation on illegal jumps (service-role path); RLS zero-row isolation | manual (psql/service-role runbook) | See Manual-Only Verifications — 0004 adversarial runbook | ❌ (runbook authored in this task) | ⬜ pending |
| 04-05-03 | 05 | 4 | XFER-01, BOOK-01, BOOK-03, AUTH-02, BOOK-07 | T-04-SPOOF3 | Full suite GREEN (Plan-01 RED specs now GREEN; single-writer still one writer); live booking→pay→confirm→track smoke | unit + manual smoke | `npm run test && npm run typecheck && npm run lint` (then live e2e smoke — see Manual-Only Verifications) | ✅ (all phase specs) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The Wave 0 RED specs are authored in Plan 01 (Task 2) plus the lifecycle spec in Plan 01 (Task 1). They reference surfaces built in Plans 03/04 and stay RED until those plans land:

- [ ] `platform/transfers/lifecycle.test.ts` — XFER-01 (exhaustive 8×8 TS transition-map pairs; GREEN with its map in Plan 01 Task 1).
- [ ] `app/pickup/[slug]/booking.test.ts` — BOOK-02/BOOK-03 (zod boundary + server-trusted insert + `createCheckoutSession` call; RED until Plan 03 Task 1).
- [ ] `platform/transfers/confirmation.test.ts` — BOOK-06 (stub builds the `next=/status/<id>` magic link, no `status:'paid'` write; RED until Plan 04 Task 1).
- [ ] `tests/e2e/guest-status.spec.ts` — BOOK-07/AUTH-02 (status-page timeline + receipt render; RED until Plan 04 Task 2; live magic-link steps `test.fixme` until Plan 05).

Supporting Wave 0 work (Plan 01 Task 3): all new `en.ts`/`bg.ts` copy keys land behind the tsc Dict parity gate so later islands consume keys without re-deriving copy.

Existing infrastructure (no install needed): `platform/payments/single-writer.test.ts` and `tests/e2e/success-spoof.spec.ts` already exist and are reused as gates. No framework install — Vitest + Playwright are already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live apply of flagged migration 0004 to Balkanity only | XFER-01, BOOK-01, AUTH-02, BOOK-07 | Flagged / irreversible schema change against the live DB; requires human sign-off + Balkanity-vs-Kalvia target confirmation; applied via Supabase CLI / Management token (NOT MCP — MCP hits Kalvia). | Plan 05 Task 1: confirm ref `qyhdogajtmnvxphrslwm` (STOP if any tool reports Kalvia `utyatpadtibqqswsfvtr`); `supabase db push` / Management-token `psql`; verify the nine new NULL-able columns, the `wp_transfers_transition_guard` trigger, and the `wp_transfers_guest_self_read` + `destinations_public_active_read` policies are live; confirm Phase-3 seed rows survived. |
| 0004 DB-trigger + RLS adversarial runbook on the live schema | XFER-01 | The trigger + RLS can only be proven against the live Postgres (the build/type/test pass without the push; types come from config, not the live DB). Service-role psql against the live Balkanity DB, not automatable in CI. | Plan 05 Task 2: record in `tests/runbooks/0004-lifecycle-trigger.md` — legal chain requested→paid→…→completed all SUCCEED; the three illegal jumps (requested→completed, picked_up→cancelled, completed→requested) each RAISE `check_violation` via the service-role path; a non-owning authenticated reader returns ZERO rows; active-destination anon read returns the booking columns for an active slug and zero rows for an inactive slug. Record PASS/FAIL + exact error code per case. |
| Live booking→pay→confirm→track end-to-end smoke | BOOK-01, BOOK-03, BOOK-06, BOOK-07, AUTH-02 | Requires a live Stripe TEST Checkout + Stripe-CLI webhook forwarding + a real magic-link (PKCE) browser session — not reproducible headlessly in CI. | Plan 05 Task 3: open `/pickup/<active-slug>` (fare+form render) → submit (a `requested` row is created, redirect to a Stripe Checkout URL) → complete TEST Checkout with `stripe listen --forward-to localhost:3000/api/stripe/webhook` (webhook flips the row to `paid`; the `[BOOK-06 stub]` magic link is logged) → click the revealed magic link (`/auth/confirm` lands on `/status/<id>`, same browser/PKCE) → the status page renders the timeline + the "Paid €X on {date}" receipt for the guest's own row only. FAIL/stop on any open redirect, `getSession` on the status path, or stale-cached guest document. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Manual-Only entry (Plan 05's live-only tasks are listed under Manual-Only Verifications)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every Plan 01–04 task carries an `<automated>` command)
- [x] Wave 0 covers all MISSING references (the 4 RED specs + the lifecycle spec are authored in Plan 01)
- [x] No watch-mode flags (all commands use `vitest run` / one-shot Playwright)
- [x] Feedback latency < 30s (vitest quick run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
