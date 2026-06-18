# Phase 3: Payments Trust Spine - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The money path — built and adversarially proven **before** any booking UI or claim logic. Specifically: a **code-created Stripe Checkout Session** (never a dashboard Payment Link) carrying `metadata.transfer_id`, and a **signature-verified, raw-body, `event.id`-idempotent webhook** that is the **ONLY** writer of `paid`, backed by a `webhook_events` log. Delivers BOOK-05 and HLTH-01.

In scope: Checkout Session creation, the `nodejs`-runtime webhook handler (raw `req.text()` + signature verification), the `webhook_events` table (UNIQUE `event_id` idempotency + signature result + outcome), the minimal `wp_transfers` table the webhook flips to `paid`, fee recording, and the adversarial test gates (forged/unsigned POST → 400 + zero state change; replayed `event.id` → exactly one effect; spoofed success-URL never writes `paid`).

Out of scope (later phases): the guest booking form + per-destination slug link (Phase 4), the full `wp_transfers` PII/lifecycle columns + status timeline + confirmation email (Phase 4), the masked pool view + atomic claim RPC (Phase 5), admin refund UI (Phase 6), the reconciliation sweep + email-cap gauge + keep-alive (Phase 8). Live Stripe keys (deferred to pilot launch — see D-02).
</domain>

<decisions>
## Implementation Decisions

### Currency
- **D-01:** Stripe Checkout charges and settles in **EUR**. Rationale: EUR is the locked display currency (Phase 2 D-07), Bulgaria has adopted the euro, and the EEA fee facts (€0.25 + 1.5%) are in EUR. This resolves the ROADMAP's flagged "settlement currency must be decided before this phase" item. No BGN currency layer.

### Stripe environment
- **D-02:** Build and run **all** adversarial gates in Stripe **TEST mode** (test keys + Stripe CLI to forge/replay `checkout.session.completed` events). The live-key cutover is **deferred to pilot launch** — no real money moves during this phase. `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are server-only, never `NEXT_PUBLIC_` (carried-forward lock). Stripe API version pinned `2026-05-27.dahlia`.

### Paid-target seam (what the webhook flips)
- **D-03:** Phase 3 **creates a minimal `wp_transfers` table now** — only the columns the money spine needs: `id`, `status` (the `paid` writer's target), amount/total in integer cents, `currency`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, recorded fee (cents), `paid_at`, plus FK to a destination (so `metadata.transfer_id` resolves to a real row). The webhook's single-writer + idempotency guarantees are proven against this **real** table, not a throwaway fixture.
- **D-04:** **Phase 4 ALTERs (extends) `wp_transfers`** to add the PII + full lifecycle columns — it does NOT create the table. This is a **FLAGGED / irreversible schema migration** (next is `0003`); schema sign-off applies before apply, same gate as Phase 2's `0002`. Phase 4's planner must be told the table already exists.

### Fee recording
- **D-05:** On the `paid` transition, record the **actual** processing fee fetched from the Stripe **balance transaction** (`payment_intent` → `charge` → `balance_transaction`, one extra API call), stored in integer cents on the `wp_transfers` row. Rationale: the commission ledger and refund-non-recovery tracking need real numbers; fits the trust-spine ethos. The Phase 2 `commission.ts` estimate (€0.25 + 1.5%) remains the **display** estimate pre-payment; the actual fee is the recorded truth post-payment. Note the refund non-recovery fact (refunds do not return the original fee).

### Claude's Discretion
- Raw-body handling mechanics for Next 16 App Router (must be verified with the forged-POST test before done — ROADMAP note), the exact dedup transaction shape (insert-into-`webhook_events`-first vs advisory lock), `webhook_events` column set beyond the mandated idempotency key / signature result / outcome, Checkout success/cancel URL pages this phase (no booking UI yet — minimal/test pages are fine), and how the adversarial forged/replay tests are seeded. All planner/researcher territory.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 3: Payments Trust Spine" — goal, the 5 success criteria (incl. the two adversarial gates), and the REVIEW/SIGN-OFF note
- `.planning/REQUIREMENTS.md` — **BOOK-05** (`paid` only by signature-verified raw-body webhook, idempotent on event id; client redirect never sets `paid`) and **HLTH-01** (`webhook_events` log records idempotency, signature result, outcome)
- `.planning/PROJECT.md` — core value (money only ever `paid` by a verified webhook), locked payments constraints, deferred items (Stripe Connect)

### Stripe / provider facts (verified)
- `CLAUDE.md` §"Verified Provider Facts" — Stripe EEA fee **1.5% + €0.25**, intl 3.25% + €0.25, UK 2.5% + €0.25, +2% conversion, **refunds don't return the original fee**; Stripe API version `2026-05-27.dahlia`; `stripe-node` v22
- `CLAUDE.md` §"Integration Patterns" #3/#4 — code-created Checkout Session shape, webhook money-authoritative path (raw `req.text()` + `constructEvent`, `nodejs` runtime, service-role write)
- `CLAUDE.md` §"What NOT to Use" — no dashboard Payment Links, no `.json()` body parse, no Edge runtime for the webhook, never set `paid` from success_url/client, service-role/Stripe keys never `NEXT_PUBLIC_`

### Prior context (carried-forward locks)
- `.planning/phases/02-supply-side-onboarding/02-CONTEXT.md` — D-07 (EUR display currency), admin-only RLS + service-role-write pattern the webhook reuses
- `.planning/phases/01-platform-foundation/01-CONTEXT.md` — three-way Supabase client split, secret boundary
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/supabase/admin.ts` — service-role client (`import "server-only"`); this is the client the webhook uses to write `paid` (the single authoritative writer).
- `platform/supabase/server.ts` / `client.ts` — RLS-scoped clients (not used for the `paid` write).
- `platform/money/commission.ts` — integer-cents fee/commission math (EEA €0.25 + 1.5% estimate); reuse for the pre-payment display estimate. The actual recorded fee (D-05) comes from Stripe's balance transaction, not this.
- `supabase/migrations/0001_*.sql`, `0002_supply_tables.sql` — migration authoring pattern + RLS conventions; next migration is **`0003`** (webhook_events + minimal wp_transfers), FLAGGED.

### Established Patterns
- Writes go through service-role only; RLS tables carry admin-read policies and NO write policies (Phase 2 pattern) — apply the same to `wp_transfers`/`webhook_events`.
- Migrations applied to Balkanity `qyhdogajtmnvxphrslwm` via Supabase CLI/Management token (NOT MCP — MCP hits Kalvia); IPv4 pooler for verification. Schema migrations are FLAGGED → human sign-off before apply.

### Integration Points
- New `app/api/stripe/webhook/route.ts` (`export const runtime = 'nodejs'`) — none exists yet (`app/api/` is empty).
- New Checkout-session creation path (server action or route handler) carrying `metadata.transfer_id`.
- New env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (test-mode values this phase) — server-only; none present in `.env.local` yet. New `stripe` npm dep (`^22.2`) — not yet in `package.json`.
</code_context>

<specifics>
## Specific Ideas

- The two ADVERSARIAL GATES are hard acceptance bars (must pass before the phase closes): (1) forged/unsigned webhook POST → 400 + zero state change, spoofed success-URL never writes `paid`; (2) replayed `event.id` → exactly one effect (UNIQUE constraint on `webhook_events.event_id` + insert-first dedup in the same transaction as the `paid` transition).
- A grep gate must confirm `paid` is set in exactly one code path (no other `status='paid'` writer).
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 3-Payments Trust Spine*
*Context gathered: 2026-06-18*
