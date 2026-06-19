# Phase 5: Claim Correctness - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The two remaining definition-of-done correctness invariants, built and **adversarially proven at the data layer** (not UI):

1. **Atomic claim (CLAIM-02):** exactly one driver wins any transfer under concurrency — first-to-claim wins, all losers get a graceful "already claimed" — enforced by an atomic conditional `UPDATE`, never by RLS.
2. **Data-layer PII gating (CLAIM-03):** full guest PII is invisible to non-owning drivers **in the API payload itself**, not just hidden in the UI.

**In scope:**
- **Migration `0005`** (FLAGGED / sign-off before apply): a masked `wp_pool` view (`security_invoker`), the `claim_transfer()` RPC (`SECURITY DEFINER`, atomic), and the claiming-driver full-row RLS policy on `wp_transfers`.
- The masked `wp_pool` view exposing ONLY pre-claim fields for `status='paid' AND driver_id IS NULL`.
- The `claim_transfer()` RPC, called with the **driver's auth context (never service-role)**.
- The claiming-driver + admin full-PII RLS policy on `wp_transfers`.
- **Both adversarial gates as automated tests** (concurrency → one winner; non-claiming-driver payload → zero PII keys), which MUST pass before the phase closes.

**Out of scope (later phases):**
- Driver pool screen, claim button, "My run", status-advance UI (CLAIM-01/04/05/06 — Phase 6).
- Admin transfers list/detail/assign/reassign/release/cancel/refund UI (Phase 6).
- Notifications on `claimed`/`arrived` (NOTF-02 — Phase 7).
- This phase builds the **data layer** those screens consume; no driver/admin-facing pages are built here beyond what the adversarial test harness needs.

</domain>

<decisions>
## Implementation Decisions

### Masked pool fields (CLAIM-01 data contract / SC1)
- **D-01:** The `wp_pool` view exposes exactly: **date, arrival time, airport, destination zone (the `destinations.zone` area — NEVER the exact address), flight no., fare (`amount_cents`), pax, luggage** for `status='paid' AND driver_id IS NULL`. All other columns (guest name, email, phone, exact address, notes) are physically omitted — the view selects only the allowed columns; masking is structural, not a UI concern.
- **D-02:** **Flight number is reclassified as operational / non-PII for v1** and is exposed pre-claim in the pool — it is route context drivers use to size up a job (airline/route), not an identity field on its own in the pilot's judgment. **This amended the locked docs:** `REQUIREMENTS.md` CLAIM-03 now drops "flight no." from the PII set; `ROADMAP.md` Phase 5 SC1/SC3/SC4 updated so flight no. is a pool field and PII = {name, contact, exact address, notes}. The SC3 adversarial gate asserts zero of {name, contact/email/phone, exact address, notes} keys appear in a non-claiming driver's payload — flight no. is expected to be present and is NOT a gate failure.

### Claim RPC contract (CLAIM-02 / SC2)
- **D-03:** `claim_transfer()` **always returns a typed result row** — shape roughly `{ ok boolean, reason text, transfer <full row or null> }`. The winner gets `ok=true`, `reason=null`, and the full transfer row (via the atomic `UPDATE ... WHERE id = $1 AND status='paid' AND driver_id IS NULL ... RETURNING *`). Every loser gets `ok=false`, `reason='already_claimed'`, and `transfer=null` (zero PII). The app layer branches on a value — no try/catch, no exception-as-control-flow.
- **D-04:** The race is decided by the **atomic conditional `UPDATE` (`WHERE status='paid' AND driver_id IS NULL`), not RLS** — RLS is the PII boundary, the UPDATE is the concurrency control. The RPC is `SECURITY DEFINER` but performs the claim **as the caller**: it reads `auth.uid()` internally and writes `driver_id = auth.uid()` (never trusts a driver-id argument from the client).
- **D-05:** **No per-driver hold cap.** A driver may hold unlimited active claimed transfers; the only rule is first-to-claim-wins on each individual transfer (consistent with CLAIM-04 "multiple active claims"). The RPC stays purely about the single-transfer race — no per-driver count check.

### Claim access & admin role (who can read the pool / claim)
- **D-06:** The pool is readable and `claim_transfer()` callable by **both drivers and admins** (role `IN ('driver','admin')`). Drivers exist only via admin invite (invite-only pilot), so no extra "active profile" gate is required before claiming.
- **D-07:** **An admin can act as a driver** — admins may claim/pick a transfer themselves (`driver_id = auth.uid()` works identically for an admin caller).
- **D-08:** **Admins see full, UNMASKED transfer details** (all PII), not the masked pool. This is served by the **existing admin RLS full-read on `wp_transfers`** (from migration 0002's `is_admin()` pattern) — the masked `wp_pool` view is for the driver pre-claim experience. Admins read the unmasked table directly; drivers read `wp_pool` pre-claim and gain the full row only for transfers they have claimed (`driver_id = auth.uid()`).

### Claude's Discretion
- **Adversarial concurrency test harness:** how to fire N truly-simultaneous `claim_transfer()` calls (parallel connections / `pg` clients, advisory-lock barrier, or a stored-proc fan-out) so the test proves real DB-level serialization — not a sequential simulation. Researcher/planner territory; the requirement is that it demonstrably yields exactly one winner.
- **PII-payload adversarial test mechanics:** how to mint/assume a non-claiming driver's JWT and assert the pool/endpoint payload contains zero PII keys.
- **Exact `wp_pool` shape & naming**, the precise RPC signature/return type (composite type vs `jsonb`), and whether the claiming-driver RLS policy is one combined `USING (driver_id = auth.uid() OR is_admin())` policy or two — left to planning, provided D-01..D-08 hold.
- **Whether a released/reassigned transfer (Phase 6) re-appears in the pool** falls out naturally from `driver_id IS NULL` — no special handling needed here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 5: Claim Correctness" — goal, the 4 success criteria (incl. the two ADVERSARIAL GATEs), and the REVIEW/SIGN-OFF note (view + RLS + `claim_transfer()` SECURITY DEFINER RPC is flagged). **Note: SC1/SC3/SC4 were amended this discussion** to reclassify flight no. as operational/non-PII.
- `.planning/REQUIREMENTS.md` — **CLAIM-02** (atomic claim, 0 double-claims) and **CLAIM-03** (data-layer PII gating). **CLAIM-03 was amended** to drop flight no. from the PII set. (CLAIM-01/04/05/06 are Phase 6 context only.)
- `.planning/PROJECT.md` — core value (zero double-claims under concurrency; PII never leaks to unclaimed drivers), locked constraints, design system.

### Existing schema (build ON this — do NOT recreate)
- `supabase/migrations/0004_transfer_entity.sql` — the `wp_transfers` PII + lifecycle columns, the `driver_id uuid references auth.users(id)` scaffold, the `wp_transfers_transition_guard` BEFORE-UPDATE trigger (already permits `paid → claimed`), and the `wp_transfers_guest_self_read` RLS policy. Phase 5 adds migration `0005` on top.
- `supabase/migrations/0003_payments_spine.sql` — original minimal `wp_transfers` (`status`, `amount_cents`, `paid_at`, `stripe_*`, `fee_cents`) + `webhook_events`.
- `supabase/migrations/0002_supply_tables.sql` — `destinations` (`zone`, `airport`, `price_cents`, …) the pool's zone/airport/fare derive from; the `is_admin()` SECURITY DEFINER helper + admin-read RLS pattern to reuse for the claiming-driver/admin policy.
- `supabase/migrations/0001_app_users_and_roles.sql` — `app_users.role` ('admin'/'driver'); role resolution backing D-06.

### Code patterns (reuse)
- `platform/transfers/lifecycle.ts` — the TS transition map mirroring the DB trigger; the claim moves `paid → claimed`.
- `platform/supabase/{admin,server,client}.ts` — three-way client split. The claim RPC is invoked via the **anon/RLS (caller-auth) client**, never the service-role admin client (roadmap lock).
- `platform/auth/role.ts` — `getCurrentRole()` (`auth.getUser()` → `app_users.role`); never `getSession()` for authz (01-03 lock).
- `app/api/stripe/webhook/route.ts` — the SOLE `paid` writer; the claim path must not introduce a second `paid` writer (it only reads `paid` rows and moves them to `claimed`).

### Provider facts & pitfalls
- `CLAUDE.md` §"Integration Patterns" #2 (atomic claim = single conditional UPDATE, concurrency-safe by construction; pre-claim driver visibility must NOT leak PII through the API; enforce at RLS/query layer not UI) and §"What NOT to Use".
- `.planning/research/PITFALLS.md` — Pitfalls 4, 5, 6 (called out in the Phase 5 roadmap note).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`wp_transfers` is fully shaped** (migration 0004): all PII columns, `driver_id`, lifecycle columns, and the transition trigger already exist. Phase 5 adds only a view, an RPC, and one RLS policy — no table ALTER for the claim itself.
- **`is_admin()` SECURITY DEFINER helper + admin-read RLS** (migration 0002) — reuse for the admin full-read and to let the claiming-driver/admin policy authorize `is_admin()`.
- **`wp_transfers_transition_guard` trigger** already permits `paid → claimed`, so the claim UPDATE passes the guard with no trigger change.
- **`platform/transfers/lifecycle.ts`** — TS transition map; claim is the `paid → claimed` edge.

### Established Patterns
- **Data-layer enforcement over UI** — RLS is the real PII boundary (Phases 1–4); this phase's whole point is proving that at the payload level.
- **Atomic conditional UPDATE for concurrency** (CLAUDE.md Integration Pattern #2) — `UPDATE ... WHERE status='paid' AND driver_id IS NULL ... RETURNING *` is the single source of claim truth.
- **RPC called with caller auth, not service-role** — the claim must run under the driver's JWT so `auth.uid()` is the real driver; `SECURITY DEFINER` is used only to perform the gated write, still keying off `auth.uid()`.
- **Schema/RLS/RPC migrations are FLAGGED → human sign-off before apply**; applied to Balkanity `qyhdogajtmnvxphrslwm` via Supabase CLI / Management token (NOT MCP — MCP hits Kalvia). `0005` is next.
- **Adversarial gates as automated tests** (Phase 3 established the pattern: forged-400, replay-once, success-spoof). Phase 5 mirrors it with concurrency-one-winner + zero-PII-payload gates.

### Integration Points
- Migration `0005` — `wp_pool` view (`security_invoker`, masked SELECT) + `claim_transfer()` RPC (`SECURITY DEFINER`, atomic UPDATE, typed return) + claiming-driver/admin full-read RLS policy on `wp_transfers`.
- New server-side claim call site (thin) — invokes the RPC via the caller-auth Supabase client; the full driver/admin UI consuming it is Phase 6.
- Test harness — concurrency runner (N parallel claims) + PII-payload assertion under a non-claiming driver JWT.

</code_context>

<specifics>
## Specific Ideas

- The masked view must **physically omit** PII columns (structural masking) — not select-then-hide. SC3's adversarial gate asserts the raw payload for a non-claiming driver contains zero PII keys ({name, contact, exact address, notes}); flight no. is expected to be present (operational).
- The winning driver must receive the **full row atomically via the claim RPC's `RETURNING *`** (no read-then-write, no second round trip) — closes the window where a claim succeeds but the follow-up PII read races.
- "Already claimed" is a **graceful, typed outcome** (`ok=false, reason='already_claimed'`), never an exception or a partial PII leak.

</specifics>

<deferred>
## Deferred Ideas

- **Per-driver hold cap / fairness throttle** — considered (soft cap on simultaneous holds) and explicitly rejected for v1 (D-05). If pilot data shows one driver hoarding the pool, revisit as a Phase 6+ policy tweak, not a data-layer change.
- **Airline/terminal-only coarse hint** (instead of full flight no.) — considered as a privacy-preserving middle ground; superseded by D-02 (full flight no. exposed as operational). Re-open only if flight no. is later re-classified as PII.

None of the above changes Phase 5 scope.

</deferred>

---

*Phase: 5-Claim Correctness*
*Context gathered: 2026-06-19*
