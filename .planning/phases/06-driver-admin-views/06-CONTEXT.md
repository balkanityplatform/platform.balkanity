# Phase 6: Driver & Admin Views - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The user-facing surfaces that consume the locked Phase 5 claim data layer — two distinct UIs:

1. **Driver PWA (warm light surfaces):** the masked claim **pool** → **claim** → **transfer detail** (full PII post-claim) → **"My run"** with inline lifecycle advance (CLAIM-01, CLAIM-04, CLAIM-05, CLAIM-06).
2. **Admin console (slate chrome):** **transfers list** (filter/search, stuck/unclaimed highlighted) → **transfer detail** (lifecycle + trip/payment) → **assign/reassign/release/cancel** + **manual Stripe refund** (OPS-01..04).

**In scope:** all five Phase 6 success criteria — the driver pool/claim/run/detail screens and status-advance UX; the admin list/detail and the four ops actions + manual refund (including a NEW payments refund hook). Brand rules apply (coloured dot + label, ≥44px hits, 52px CTAs, warm-light driver / slate admin). Claim/status data is NetworkFirst (never SW-cached).

**Out of scope (later phases):**
- The claim/PII data layer itself — built + adversarially proven in Phase 5 (do NOT re-implement; consume `wp_pool()` / `claim_transfer()` / the claiming-driver RLS).
- Notifications on `claimed`/`arrived`/admin alerts (Phase 7).
- Reconciliation / email-cap gauge / stuck-transfer *alerts* / keep-alive (Phase 8). Phase 6 only *highlights* stuck rows in the admin list UI; it does not send alerts.

</domain>

<decisions>
## Implementation Decisions

### Driver pool refresh & claim feedback
- **D-01:** The pool stays current via **refetch-on-focus + a light interval poll** while open (NOT Supabase Realtime, NOT manual-only). Simplest approach that satisfies SC1's "refreshes live" on the Supabase free tier; honours the NetworkFirst rule (never SW-cached). Exact poll interval (≈20–30s) is planner discretion.
- **D-02:** On a **winning** claim, the driver lands on the **transfer detail** (now showing full PII — address, contact, flight). The claim RPC returns the full row atomically (Phase 5 D-03), so no extra fetch is needed to render detail.
- **D-03:** On a **lost** race, show a **neutral toast** ("Just claimed by another driver") and **auto-remove the card** from the pool. It is a graceful, expected outcome — never an error state (consumes Phase 5's typed `ok=false, reason='already_claimed'`).

### Driver "My run" & status advance
- **D-04:** Each run card carries an **inline single next-step 52px CTA** that advances the one next lifecycle edge in place (`claimed→en_route→arrived→picked_up→completed`). Satisfies SC3 ("arrived transition available from the run"). Advancing happens on the run card, not only on detail.
- **D-05:** Progress is shown with the **existing read-only `LifecycleTimeline`** (compact) beside the next-step CTA — glanceable state, unambiguous single action. The timeline is display-only; the CTA drives the change.
- **D-06:** On reaching **completed**, the transfer **drops out of the active run** into a small **"Completed today" collapsed section** (reassurance/history) — keeps the active run focused (SC2 scopes the run to ACTIVE claims). Run remains ordered by arrival time (CLAIM-06); a driver may hold multiple active claims and cannot un-claim (CLAIM-04, Phase 5 D-05).

### Admin transfers list
- **D-07:** Default landing sorts by **soonest arrival first**, with **"needs attention" rows pinned to the top in coral**. Optimises for "act on the next/at-risk job."
- **D-08:** Controls to build for the pilot: **status filter**, a **"needs attention" quick filter** (one-tap to the coral rows), and **free-text search across guest name / flight no. / destination**. A **driver/company filter is DEFERRED** (low pilot volume — revisit if needed). Reuses the existing `DataList` + slate-console pattern.
- **D-09:** **"Stuck" (coral) = unclaimed-near-arrival + arrived-not-picked-up.** Unclaimed is always coral; additionally a row is coral when (a) `paid` + unclaimed and arrival is approaching (within N hours), or (b) `status='arrived'` but not advanced to `picked_up` after a while. Concrete thresholds (N hours, the arrived-stall window) are planner discretion; keep them simple constants for the pilot. This is **UI highlighting only** — actual stuck *alerts* are Phase 8.

### Admin actions & manual refund
- **D-10:** **Confirm dialog + reason note required** for **Cancel**, **Refund**, and **Reassign/Release** (audit trail of why). **Assign** stays a lighter **one-tap** action (no reason — easily reversed by reassign). Pick this gate only for the three listed.
- **D-11:** **Cancel and Refund are separate actions, with a refund shortcut.** A paid transfer can be cancelled WITHOUT a refund (prepaid / non-refundable default per PROJECT.md); cancelling a paid transfer *offers* an "also issue refund?" shortcut but **never auto-refunds**.
- **D-12:** The **manual refund supports full or partial** amounts — amount field pre-filled to the full paid amount, editable down — and **always shows the "~EUR X processing fee is NOT recovered" disclosure** (reuse `platform/payments/fee.ts` for the fee figure). OPS-04 requires a **NEW server-side refund hook** (no refund code exists yet) calling `stripe.refunds.create`; it MUST live in the platform payments layer (server-only) and must never run client-side.

### Lifecycle write paths & schema delta (resolved post-research 2026-06-19)
- **D-13:** **Status-advance + admin assign/reassign/cancel use gated service-role Server Actions** (the established `app/admin/*/actions.ts` pattern), NOT new RLS write policies (would re-open Phase 5's closed no-write surface) and NOT client-side writes. Each action re-checks `getCurrentRole()` + ownership/state before writing; the migration-0004 trigger remains the state-legality backstop. (Research A1; honours "actor legality is the Phase-6 app gate".)
- **D-14:** **`release` returns a claimed transfer to the pool via a minimal sign-off-gated migration** that adds a trigger-legal **`claimed→paid`** backward edge; a gated service-role release action clears `driver_id` and sets `status='paid'` so the row reappears in `wp_pool()`. **Release is restricted to `status='claimed'`** (before `en_route`) to keep the lifecycle simple. This is a **flagged schema/RLS change to Phase 5's locked trigger — requires the migration sign-off + `supabase db push` [BLOCKING] before the release action verifies.** (Resolves research Open Q1.)
- **D-15:** **The D-10 audit reason persists in a minimal new column** `last_action_reason` (+ acting actor + timestamp) on `wp_transfers`, added in the same sign-off-gated migration as D-14. Cancel/refund/reassign/release write the reason here; **`paid` is still only ever set by the webhook** (the release edge is the sole, narrow exception, written by the gated service-role action — never a client). (Resolves research Open Q2; supersedes the CONTEXT "do NOT design new schema" note for this one minimal, reviewed delta.)

### Claude's Discretion
- Exact poll interval (D-01); concrete stuck-time thresholds (D-09); component naming/decomposition; driver pool **empty state** copy; admin **detail page layout**; whether reassign/assign share one driver-picker component; exact column types/names for D-15 (`last_action_reason text`, `last_action_by uuid`, `last_action_at timestamptz` or similar). All planner/researcher territory provided D-01..D-15 hold.
- Offline behavior of the run beyond the NetworkFirst lock (no offline claim/advance — would conflict with the atomic-claim guarantee per CLAUDE.md "Stack Patterns by Variant").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 6: Driver & Admin Views" — goal, the 5 success criteria, Notes (brand rules, NetworkFirst, no read-then-write, refund via platform payments hook, Pitfalls 4/11/12), UI hint.
- `.planning/REQUIREMENTS.md` — **CLAIM-01, CLAIM-04, CLAIM-05, CLAIM-06** (driver pool/run/advance) and **OPS-01..04** (admin list/detail/actions/refund).
- `.planning/PROJECT.md` — core value, design system (brand tokens, Montserrat, status = dot+label, 52px CTAs, warm-light driver / slate console), and the prepaid/non-refundable + manual-refund-for-exceptions policy backing D-11/D-12.

### The Phase 5 data layer this phase CONSUMES (do NOT re-implement)
- `.planning/phases/05-claim-correctness/05-CONTEXT.md` — D-01..D-08: masked pool fields, typed claim result, graceful `already_claimed`, no hold cap, admin acts-as-driver, admins read UNMASKED, claiming-driver full-row read.
- `supabase/migrations/0005_claim_correctness.sql` (LIVE on Balkanity) — `wp_pool()` masked RPC (call via PostgREST `.rpc("wp_pool")`), `claim_transfer(uuid)` RPC (typed `{ok,reason,transfer}`), `wp_transfers_claimed_driver_read` RLS policy.
- `.planning/phases/05-claim-correctness/05-GATES-EVIDENCE.md` — the proven concurrency/PII invariants the UI must not undermine (no read-then-write on the claim path).

### Code patterns to reuse
- `platform/transfers/claim.ts` — the thin caller-auth claim wrapper (`claimTransfer()`, branches on `data.ok`); extend the consuming UI on top of this, never the service-role client.
- `platform/transfers/lifecycle.ts` (+ `lifecycle.test.ts`) — the TS transition map for the driver advance CTA (next-edge resolution).
- `platform/ui/` — `LifecycleTimeline`, `StatusDot`, `DataList`, `Card`, `Button`, `Select`, `TextField`, `Toggle`, `LanguageToggle` (design-system components to reuse, not rebuild).
- `app/admin/{companies,properties,drivers,destinations}/` — the admin **slate console** pattern: server-guarded page (`getCurrentRole()` redirect, never `getSession()` for authz) + dictionary-resolved copy passed to a client `*View.tsx` island (+ `*Form.tsx`). Mirror this for transfers list/detail/actions.
- `platform/auth/role.ts` — `getCurrentRole()` server-side role gate for both driver and admin route guards.
- `platform/payments/stripe.ts` + `platform/payments/fee.ts` — the Stripe client + fee math for the new refund hook (OPS-04) and the fee-not-recovered disclosure (D-12). `app/api/stripe/webhook/route.ts` remains the SOLE `paid` writer — the refund/cancel paths must not introduce another.
- `platform/i18n/` — EN/BG dictionary resolution (server-resolved, no flash) for all new copy.

### Provider facts & pitfalls
- `CLAUDE.md` §"Integration Patterns" (#2 atomic claim / no read-then-write; #3 server redirect; auth `getUser()` not `getSession()`) and §"Stack Patterns by Variant" (no offline claim writes).
- `.planning/research/PITFALLS.md` — Pitfalls 4, 11, 12 (called out in the Phase 6 roadmap note).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Design system is real and sufficient:** `LifecycleTimeline` (driver run progress + admin detail), `StatusDot` (coloured dot + label everywhere), `DataList` (admin transfers list), `Card`/`Button`/`Select`/`TextField`/`Toggle`. No new primitives expected beyond a toast and the refund form.
- **Admin console chrome + server-guard pattern** is established across four admin slices — the transfers list/detail are a fifth slice following the same `page.tsx` (server, role-gated, dict-resolved) → `*View.tsx` (client island) shape.
- **`claim.ts` + `lifecycle.ts`** already encode the claim call and transition map — the driver UI wires CTAs to these.

### Established Patterns
- **Server-side role gate, not UI:** every driver and admin route guards via `getCurrentRole()` and redirects before render (threat pattern from Phases 1–3).
- **Dictionary-resolved copy passed server→client island** (no hydration flash, EN/BG).
- **No read-then-write on the claim path** (CLAUDE.md #2) — the winning claim renders from the RPC's returned row (D-02), not a follow-up fetch.
- **Single `paid` writer** stays the webhook — refund/cancel only move state / call `stripe.refunds.create`, never set `paid`.

### Integration Points
- Driver pool screen → `wp_pool()` RPC (caller-auth) with refetch-on-focus + poll (D-01).
- Claim button → `claim_transfer()` via `claim.ts`; win → detail from returned row (D-02), lose → toast + remove (D-03).
- Driver run → `lifecycle.ts` next-edge → status-advance write (caller-auth) with inline CTA (D-04/05).
- Admin transfers list/detail → unmasked `wp_transfers` read (admin RLS) via the console pattern; actions → assign/reassign/release/cancel writes + the NEW refund hook (`stripe.refunds.create`, server-only) with `fee.ts` disclosure (D-10/11/12).

</code_context>

<specifics>
## Specific Ideas

- Driver pool "live" feel comes from focus-refetch + light polling, not a Realtime socket — keep it boring and robust for the pilot.
- The lost-claim experience must feel **normal, not failed**: neutral toast + the card quietly leaving the pool (D-03) — mirrors Phase 5's "already claimed is a graceful outcome."
- The refund screen must make the **irrecoverable processing fee explicit** every time (D-12), so an admin never refunds assuming the fee comes back (Stripe does not return it — verified in CLAUDE.md provider facts).
- "Needs attention" is the admin's primary triage lens: coral rows pinned on top (D-07) + a one-tap quick filter (D-08).

</specifics>

<deferred>
## Deferred Ideas

- **Driver/company filter on the admin transfers list** — considered, deferred for the pilot (low volume); revisit if admins need it (D-08). Not a scope change.
- **Stuck-transfer ALERTS / reconciliation / email-cap gauge** — Phase 8. Phase 6 only highlights stuck rows in the list UI (D-09).
- **Notifications on claimed/arrived + admin booking alert** — Phase 7. Phase 6 builds the surfaces that emit those lifecycle events but sends no email/in-app notification itself.
- **Per-driver hold cap / fairness throttle** — rejected in Phase 5 (D-05); re-open only as a later policy tweak if a driver hoards the pool.
- **Offline claim/advance (queued writes)** — out of scope; conflicts with the atomic-claim guarantee (CLAUDE.md). Run stays NetworkFirst read-only offline at most.

</deferred>

---

*Phase: 6-Driver & Admin Views*
*Context gathered: 2026-06-19*
