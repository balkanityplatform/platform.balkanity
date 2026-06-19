# Phase 5: Claim Correctness - Research

**Researched:** 2026-06-19
**Domain:** Postgres concurrency control (atomic conditional UPDATE), data-layer PII gating (security_invoker views + SECURITY DEFINER RPC + RLS), adversarial test harnesses (Supabase + Vitest/Playwright)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Masked pool fields (CLAIM-01 data contract / SC1)**
- **D-01:** The `wp_pool` view exposes exactly: **date, arrival time, airport, destination zone (the `destinations.zone` area — NEVER the exact address), flight no., fare (`amount_cents`), pax, luggage** for `status='paid' AND driver_id IS NULL`. All other columns (guest name, email, phone, exact address, notes) are physically omitted — the view selects only the allowed columns; masking is structural, not a UI concern.
- **D-02:** **Flight number is reclassified as operational / non-PII for v1** and is exposed pre-claim in the pool. This amended the locked docs: `REQUIREMENTS.md` CLAIM-03 drops "flight no." from the PII set; `ROADMAP.md` Phase 5 SC1/SC3/SC4 updated so flight no. is a pool field and PII = {name, contact, exact address, notes}. The SC3 adversarial gate asserts zero of {name, contact/email/phone, exact address, notes} keys appear in a non-claiming driver's payload — flight no. is expected present and is NOT a gate failure.

**Claim RPC contract (CLAIM-02 / SC2)**
- **D-03:** `claim_transfer()` **always returns a typed result row** — shape roughly `{ ok boolean, reason text, transfer <full row or null> }`. Winner gets `ok=true`, `reason=null`, full transfer row (via atomic `UPDATE ... WHERE id = $1 AND status='paid' AND driver_id IS NULL ... RETURNING *`). Every loser gets `ok=false`, `reason='already_claimed'`, `transfer=null` (zero PII). The app layer branches on a value — no try/catch, no exception-as-control-flow.
- **D-04:** The race is decided by the **atomic conditional `UPDATE` (`WHERE status='paid' AND driver_id IS NULL`), not RLS** — RLS is the PII boundary, the UPDATE is the concurrency control. The RPC is `SECURITY DEFINER` but performs the claim **as the caller**: it reads `auth.uid()` internally and writes `driver_id = auth.uid()` (never trusts a driver-id argument from the client).
- **D-05:** **No per-driver hold cap.** A driver may hold unlimited active claimed transfers; the only rule is first-to-claim-wins on each individual transfer. The RPC stays purely about the single-transfer race — no per-driver count check.

**Claim access & admin role**
- **D-06:** The pool is readable and `claim_transfer()` callable by **both drivers and admins** (role `IN ('driver','admin')`). Drivers exist only via admin invite (invite-only pilot), so no extra "active profile" gate before claiming.
- **D-07:** **An admin can act as a driver** — admins may claim a transfer themselves (`driver_id = auth.uid()` works identically for an admin caller).
- **D-08:** **Admins see full, UNMASKED transfer details** (all PII), not the masked pool. Served by the **existing admin RLS full-read on `wp_transfers`** (migration 0002's `is_admin()` pattern). The masked `wp_pool` view is for the driver pre-claim experience. Admins read the unmasked table directly; drivers read `wp_pool` pre-claim and gain the full row only for transfers they have claimed (`driver_id = auth.uid()`).

### Claude's Discretion
- **Adversarial concurrency test harness:** how to fire N truly-simultaneous `claim_transfer()` calls so the test proves real DB-level serialization. The requirement is that it demonstrably yields exactly one winner.
- **PII-payload adversarial test mechanics:** how to mint/assume a non-claiming driver's JWT and assert the pool/endpoint payload contains zero PII keys.
- **Exact `wp_pool` shape & naming**, the precise RPC signature/return type (composite type vs `jsonb`), and whether the claiming-driver RLS policy is one combined `USING (driver_id = auth.uid() OR is_admin())` policy or two — left to planning, provided D-01..D-08 hold.
- **Whether a released/reassigned transfer (Phase 6) re-appears in the pool** falls out naturally from `driver_id IS NULL` — no special handling needed here.

### Deferred Ideas (OUT OF SCOPE)
- **Per-driver hold cap / fairness throttle** — explicitly rejected for v1 (D-05). Revisit as a Phase 6+ policy tweak only.
- **Airline/terminal-only coarse hint** instead of full flight no. — superseded by D-02. Re-open only if flight no. is later re-classified as PII.
- Driver pool screen, claim button, "My run", status-advance UI (CLAIM-01/04/05/06 — Phase 6).
- Admin transfers list/detail/assign/reassign/release/cancel/refund UI (Phase 6).
- Notifications on `claimed`/`arrived` (NOTF-02 — Phase 7).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLAIM-02 | Driver claims a transfer via an atomic conditional update (first-to-claim wins; loser gets "already claimed") — 0 double-claims under concurrency | Pattern 2 (atomic conditional `UPDATE ... WHERE status='paid' AND driver_id IS NULL ... RETURNING *`) inside the `claim_transfer()` RPC; Pattern 4 (parallel-JWT concurrency harness) proves exactly-one-winner. READ COMMITTED row-lock serialization is the concurrency control (D-04). |
| CLAIM-03 | Full guest PII (name, contact, exact address, notes) unlocks only for the claiming driver and admin, enforced at the data layer (RLS + masked view/RPC), not UI-only. *(Flight no. reclassified as operational/non-PII — exposed pre-claim.)* | Pattern 1 (security_invoker `wp_pool` view that physically omits PII columns) + Pattern 3 (claiming-driver+admin full-read RLS policy on `wp_transfers`); the winner gets the full row atomically via the RPC's `RETURNING *`. Pattern 5 (non-claiming-driver JWT payload assertion) proves zero PII keys. |
</phase_requirements>

## Summary

Phase 5 is a **schema-only correctness phase** that adds one FLAGGED migration (`0005`) on top of the already-shaped `wp_transfers` table and proves two adversarial gates with automated tests. The entire stack is locked in `CLAUDE.md`; **no new runtime packages are needed** — the concurrency harness and PII assertion both run on the already-installed `@supabase/supabase-js`, Vitest, and Playwright, and the live migration applies via the established Supabase Management API path (NOT MCP, which reaches Kalvia).

The two invariants map cleanly to two well-understood Postgres mechanisms that must stay **strictly separated** (Pitfall 6): concurrency safety comes ONLY from the atomic conditional `UPDATE ... WHERE status='paid' AND driver_id IS NULL ... RETURNING *` running under READ COMMITTED (the second writer blocks on the row lock, re-evaluates the WHERE against the committed `claimed` row, matches nothing, returns 0 rows); PII safety comes ONLY from the data layer — a `security_invoker` view (`wp_pool`) that **physically omits** PII columns, plus an RLS policy on `wp_transfers` that grants the full row to `driver_id = auth.uid() OR is_admin()`. RLS is never the concurrency control; the UPDATE is never the PII boundary.

The crux of de-risking is the test harness, not the SQL (the SQL is small and has strong precedent). The concurrency gate must fire N *truly* parallel claims — `Promise.all` over N independent supabase-js clients each authenticated as a distinct driver JWT, all targeting one seeded `paid` transfer — and assert exactly one `ok=true` and N−1 `ok=false, reason='already_claimed'`. The PII gate mints/assumes a non-claiming driver's JWT, reads `wp_pool` (and the base table), and asserts the JSON payload contains zero of `{guest_name, guest_email, guest_phone, address/notes}` keys while permitting `flight_no` (D-02).

**Primary recommendation:** Author migration `0005` (security_invoker `wp_pool` view selecting only the 8 D-01 columns + the `claim_transfer()` SECURITY DEFINER RPC with `set search_path = ''`, fully-qualified relations, `auth.uid()`-derived `driver_id`, typed composite return, `RETURNING *`, and `grant execute ... to authenticated` + `revoke ... from anon/public` + the claiming-driver/admin full-read RLS policy). Add a source-level migration-contract test (mirror `payments-schema.test.ts`), a parallel-JWT concurrency gate, and a non-claiming-JWT PII gate. Apply live via the Management API `/database/query` endpoint to Balkanity `qyhdogajtmnvxphrslwm` ONLY, behind a BLOCKING human sign-off task.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Concurrency control (one winner) | Database / Storage (Postgres row lock + conditional UPDATE) | — | D-04: decided by the atomic UPDATE under READ COMMITTED, never the app or RLS. Application-tier check-then-act races (Pitfall 4). |
| Pre-claim PII masking | Database / Storage (`wp_pool` security_invoker view — structural column omission) | — | D-01/Pitfall 5: UI masking leaks via the auto-REST/supabase-js API; the view physically omits PII columns so the payload cannot carry them. |
| Full-row PII gating post-claim | Database / Storage (RLS on `wp_transfers`: `driver_id = auth.uid() OR is_admin()`) | API (RPC `RETURNING *` hands the winner the row atomically) | Row-level RLS gates whole rows; the winner reads their own claimed rows + admins read all. RETURNING avoids a read-then-write PII race (Specifics). |
| Claim authorization (who may attempt) | Database (caller-auth: RPC reads `auth.uid()`; `grant execute to authenticated`) | API (caller-auth supabase client, never service-role) | D-06/D-07: drivers+admins call under their own JWT; the RPC is SECURITY DEFINER only to perform the gated write, still keyed off `auth.uid()`. |
| Migration apply | Database (Supabase Management API `/database/query`, IPv4) | — | MCP reaches only Kalvia; direct `db.<ref>` host is IPv6-only/unreachable. Management API is the confirmed Balkanity path (03-GATES-EVIDENCE). |
| Adversarial proof | API/Test tier (Vitest + supabase-js parallel clients; Playwright) | — | The gates are runtime behaviors source-grep cannot prove; they need live seeded rows + minted JWTs. |

## Standard Stack

**No new packages.** Every dependency this phase needs is already installed and locked in `CLAUDE.md`. This phase adds SQL (migration `0005`) and TypeScript test files only.

### Core (already installed — reused, not added)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.108` (2.108.2) | Drives the concurrency harness (N independent clients, each with a distinct driver JWT) + the PII-payload read + `.rpc('claim_transfer', …)` calls | [CITED: CLAUDE.md locked stack] Locked. The anon/caller-auth client is the claim call site (never service-role). |
| `@supabase/ssr` | `^0.12` (0.12.0) | Cookie-bound server client; the future Phase 6 server call site invokes the RPC through `createClient()` (caller-auth) | [CITED: CLAUDE.md] Locked. `platform/supabase/server.ts` already wraps it. |
| Vitest | `^4.1` | Source-level migration-contract test (mirror `payments-schema.test.ts`); optionally the live concurrency/PII gates if run against a TEST DB from Node | [VERIFIED: package.json `"test": "vitest run"`] Established test runner. |
| Playwright | `^1.61` | E2E adversarial gates against a running app/live TEST DB (mirror `webhook-forged.spec.ts` / `success-spoof.spec.ts`) | [VERIFIED: package.json `"test:e2e": "playwright test"`] Established e2e runner. |
| Supabase CLI / Management API | n/a (token) | Apply migration `0005` to Balkanity `qyhdogajtmnvxphrslwm` via `/v1/projects/<ref>/database/query`; record `schema_migrations` in the same txn | [VERIFIED: 03-GATES-EVIDENCE.md — Management API is the confirmed IPv4 Balkanity path; MCP hits Kalvia] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` admin client (`platform/supabase/admin.ts`) | `^2.108` | **Test-only seeding** of a `paid`/unclaimed `wp_transfers` row and minting/creating driver auth users for the harness; NEVER the claim call path | Seed setup + teardown in the gate tests. The claim itself MUST use a caller-auth client (D-04). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Promise.all` over N supabase-js clients (in-process parallel HTTP) | `node-postgres` (`pg`) with N raw connections + an advisory-lock barrier released simultaneously | `pg` gives tighter "release all at the same instant" control via `pg_advisory_lock`, but adds a dependency (`pg` is NOT installed), bypasses the RPC/RLS path the app actually uses, and connects with a privileged role — it would test the UPDATE but not the real `auth.uid()`-keyed RPC. `Promise.all` over real authenticated supabase-js clients tests the actual production path. **Recommend supabase-js + `Promise.all`.** |
| `Promise.all` over N clients | A single stored-proc fan-out (one SQL call spawning N concurrent claims via `dblink`/background workers) | Self-contained in SQL but far more complex, needs extensions, and still doesn't exercise the JWT/RLS layer. Not worth it for a pilot gate. |
| Composite-type RPC return | `jsonb` RPC return (`{ ok, reason, transfer }`) | Composite/typed return surfaces in generated TS types and is self-documenting; `jsonb` is looser but trivially shaped. Either satisfies D-03 — left to planning (Discretion). Composite is the cleaner default given the typed-client convention. |
| Two RLS policies (driver-self + admin) | One combined `USING (driver_id = auth.uid() OR is_admin())` policy | Postgres ORs permissive SELECT policies, so two coexist identically with the existing `wp_transfers_admin_read`/`wp_transfers_guest_self_read`. One combined policy is fewer objects; two is more granular/auditable. Left to planning (Discretion). |

**Installation:**
```bash
# NONE. All packages already in package.json. This phase adds SQL + test files only.
```

**Version verification:** Not applicable — no packages are added. All versions are pinned in `CLAUDE.md` §"Recommended Stack" and `package.json`, verified there (next 16.2.9, @supabase/supabase-js 2.108.2, @supabase/ssr 0.12.0, Vitest ^4.1, Playwright ^1.61).

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. It authors one SQL migration and TypeScript test files using already-installed, already-audited dependencies. slopcheck was unavailable at research time (`slopcheck absent`), but with no new installs there is nothing to gate.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌───────────────────────────────────────────────┐
  Driver / Admin          │  CALLER-AUTH supabase-js client (anon key +     │
  (authenticated JWT) ───▶│  user JWT)  — NEVER the service-role client     │
                          └───────────────┬───────────────────────────────┘
                                          │
                ┌─────────────────────────┼──────────────────────────────┐
                │ PRE-CLAIM READ          │            CLAIM WRITE         │
                ▼                         │                ▼               │
   ┌─────────────────────────┐           │   ┌──────────────────────────┐ │
   │  SELECT * FROM wp_pool   │           │   │ rpc('claim_transfer',{id})│ │
   │  (security_invoker view) │           │   │  SECURITY DEFINER         │ │
   │                          │           │   │  set search_path = ''     │ │
   │ physically selects ONLY: │           │   └────────────┬─────────────┘ │
   │  id, status, airport,    │           │                │               │
   │  zone, flight_no,        │           │   reads auth.uid() internally   │
   │  amount_cents, pax,      │           │                ▼               │
   │  luggage, arrival_at     │           │   ┌──────────────────────────┐ │
   │ — NO guest_name/email/   │           │   │ UPDATE public.wp_transfers│ │
   │   phone/address/notes    │           │   │ SET status='claimed',     │ │
   └───────────┬─────────────┘           │   │     driver_id=auth.uid()  │ │
               │                          │   │ WHERE id=$1               │ │
   RLS on wp_pool's base table evaluated  │   │   AND status='paid'       │ │
   AS THE DRIVER (security_invoker):      │   │   AND driver_id IS NULL   │ │
   matches only paid & unclaimed rows     │   │ RETURNING *  ◀── row lock │ │
               │                          │   └────────────┬─────────────┘ │
               ▼                          │     1 row → ok=true + full row  │
   pool payload: zero PII keys            │     0 rows → ok=false,           │
   (SC3 adversarial gate)                 │              reason='already_   │
                                          │              claimed', null     │
                                          │              (SC2 adversarial)   │
                                          └────────────────────────────────┘
                                          
  POST-CLAIM full-row read (winner only):
   SELECT * FROM wp_transfers  ─▶ RLS policy USING (driver_id = auth.uid() OR is_admin())
                                  → winner reads their own claimed row (full PII)
                                  → non-claiming driver matches NO policy → 0 rows (SC4)
                                  → admin reads ALL rows unmasked (D-08)
```

File-to-implementation mapping in the Component Responsibilities table below.

### Recommended Project Structure
```
supabase/migrations/
└── 0005_claim_correctness.sql   # FLAGGED: wp_pool view + claim_transfer() RPC + claiming-driver/admin RLS

platform/
├── transfers/
│   └── claim.ts                 # (thin, optional this phase) caller-auth RPC wrapper — full UI is Phase 6
└── rls/
    └── claim-schema.test.ts     # source-level migration-0005 contract (mirror payments-schema.test.ts)

tests/
├── claim/                       # OR co-locate; live concurrency + PII gates (need seeded DB + JWTs)
│   ├── concurrency.gate.test.ts # N parallel claims → exactly one winner (SC2)
│   └── pii-payload.gate.test.ts # non-claiming-driver JWT → zero PII keys (SC3)
└── e2e/                         # if run via Playwright against a running app instead of Node
```

> Component Responsibilities:
> - `0005_claim_correctness.sql` — the entire data-layer contract (view + RPC + RLS). The single FLAGGED deliverable.
> - `claim-schema.test.ts` — fails CI fast if anyone weakens the migration text (drops security_invoker, adds PII columns to the view, drops `search_path=''`, grants execute to anon, removes the `status='paid' AND driver_id IS NULL` predicate).
> - `concurrency.gate.test.ts` / `pii-payload.gate.test.ts` — runtime adversarial gates against a live TEST DB.

### Pattern 1: `security_invoker` masked pool view (structural PII omission) — CLAIM-03 / SC1, SC3
**What:** A view that exposes ONLY the 8 D-01 pre-claim columns and evaluates the underlying `wp_transfers` RLS **as the querying driver** (Postgres 15+ `security_invoker`).
**When to use:** The driver's pre-claim pool read. The PII columns are not "hidden" — they are never selected, so the JSON payload structurally cannot contain them.
```sql
-- Source: Postgres 15+ security_invoker views; Supabase RLS docs (CITED below).
-- security_invoker=on → the base-table RLS is checked against the INVOKING driver,
-- not the view owner. WITHOUT it the view runs as its (privileged) owner and would
-- leak rows past RLS — the documented Supabase gotcha.
create or replace view public.wp_pool
  with (security_invoker = on) as
  select
    t.id,
    t.status,
    t.arrival_at,                 -- date + arrival time (D-01)
    d.airport,                    -- from destinations (D-01)
    d.zone,                       -- AREA only, NEVER d.address (D-01)
    t.flight_no,                  -- operational, non-PII for v1 (D-02)
    t.amount_cents,               -- fare (D-01)
    t.pax,                        -- (D-01)
    t.luggage_count               -- (D-01)
  from public.wp_transfers t
  join public.destinations d on d.id = t.destination_id
  where t.status = 'paid' and t.driver_id is null;
-- NOTE: guest_name / guest_email / guest_phone / d.address / t.notes are NEVER selected.
grant select on public.wp_pool to authenticated;
```
**Critical:** `security_invoker = on` (Postgres ≥15) is mandatory. Default views run as the owner and **bypass the invoker's RLS**, which would defeat the boundary [CITED: dev.to/datadeer Postgres Views security gotcha; supabase RLS docs]. The driver still needs a base-table RLS path that matches paid/unclaimed rows for the view to return them — see the Open Questions note on the pre-claim SELECT policy.

### Pattern 2: Atomic conditional claim inside a SECURITY DEFINER RPC — CLAIM-02 / SC2
**What:** A single `UPDATE ... WHERE id=$1 AND status='paid' AND driver_id IS NULL ... RETURNING *`, wrapped in an RPC that reads `auth.uid()` and returns a typed result. The UPDATE is the concurrency control (D-04); SECURITY DEFINER is used only to perform the gated write while still keying the actor off `auth.uid()`.
**When to use:** Every claim. Never split into SELECT-then-UPDATE (Pitfall 4).
```sql
-- Source: PROJECT/CLAUDE.md Integration Pattern #2 (atomic claim); Supabase Database
-- Functions docs (search_path hardening, SECURITY DEFINER) — CITED below.
create type public.wp_claim_result as (
  ok       boolean,
  reason   text,
  transfer public.wp_transfers   -- full row for the winner; NULL for losers (D-03)
);

create or replace function public.claim_transfer(p_transfer_id uuid)
returns public.wp_claim_result
language plpgsql
security definer
set search_path = ''               -- HARDEN: empty path; every relation is schema-qualified
as $$
declare
  v_uid uuid := (select auth.uid());           -- the REAL caller; never a client-supplied id (D-04)
  v_row public.wp_transfers;
  v_out public.wp_claim_result;
begin
  if v_uid is null then
    return (false, 'not_authenticated', null)::public.wp_claim_result;
  end if;

  -- THE concurrency control: one atomic conditional UPDATE under READ COMMITTED.
  -- The 2nd writer blocks on the row lock, re-checks the WHERE against the committed
  -- 'claimed' row, matches nothing → 0 rows → loser branch. (D-04, Pitfall 4/6.)
  update public.wp_transfers
     set status = 'claimed',
         driver_id = v_uid
   where id = p_transfer_id
     and status = 'paid'
     and driver_id is null
  returning * into v_row;

  if not found then
    return (false, 'already_claimed', null)::public.wp_claim_result;   -- graceful loser (D-03, Specifics)
  end if;

  return (true, null, v_row)::public.wp_claim_result;                  -- winner gets full row atomically
end;
$$;

revoke execute on function public.claim_transfer(uuid) from public, anon;
grant  execute on function public.claim_transfer(uuid) to authenticated;  -- D-06: drivers + admins
```
**Why SECURITY DEFINER here is safe:** the no-write-policy lock means `authenticated` cannot UPDATE `wp_transfers` directly (migrations 0002/0003/0004 grant SELECT only). The RPC is the *only* sanctioned claim write path, it derives the actor from `auth.uid()` (not a client argument), and the transition guard trigger (0004) still fires for it (`paid → claimed` is permitted). `set search_path = ''` is mandatory hardening for SECURITY DEFINER [CITED: supabase.com/docs/guides/database/functions].

### Pattern 3: Claiming-driver + admin full-read RLS policy — CLAIM-03 / SC4
**What:** A permissive SELECT policy on `wp_transfers` granting the full row to the claiming driver or an admin. Coexists (OR'd) with the existing `wp_transfers_admin_read` and `wp_transfers_guest_self_read`.
```sql
-- Source: migration 0002 is_admin() pattern + 0004 RLS coexistence note (CITED: repo).
drop policy if exists "wp_transfers_claimed_driver_read" on public.wp_transfers;
create policy "wp_transfers_claimed_driver_read" on public.wp_transfers
  for select to authenticated
  using ( (select auth.uid()) = driver_id or public.is_admin() );
-- A non-claiming driver matches NEITHER this nor guest_self_read nor admin_read → 0 rows (SC4).
-- (Discretion D: this could instead be one combined policy; admin_read already covers is_admin().)
```
**Note (Discretion):** `is_admin()` is already in `wp_transfers_admin_read` (0003), so the admin clause here is redundant if you keep two policies — the driver-only `using ((select auth.uid()) = driver_id)` suffices because admin coverage already OR's in. Decide in planning.

### Pattern 4: Parallel-JWT concurrency gate (exactly-one-winner) — CLAIM-02 / SC2
**What:** Fire N truly-concurrent `claim_transfer()` calls from N independent authenticated clients at one seeded `paid` transfer; assert exactly one `ok=true` and N−1 `ok=false, reason='already_claimed'`.
**When to use:** The CLAIM-02 adversarial gate. This is the literal DoD line item.
```ts
// Source: pattern derived from existing route.idempotency.test.ts (Vitest) + supabase-js.
// SETUP (service-role admin client — TEST DB only): seed ONE paid, unclaimed wp_transfers row;
// create N driver auth users (or reuse seeded drivers) and obtain a session/access_token each.
// Each driver gets its OWN createClient(url, anonKey) with the driver's JWT set —
// independent clients so the calls are genuinely parallel HTTP requests, not serialized.
const clients = driverTokens.map((tok) => {
  const c = createClient(SUPABASE_URL, ANON_KEY);
  // attach the driver JWT so auth.uid() resolves to THIS driver inside the RPC
  return { c, tok };
});

// THE BARRIER: Promise.all fires all RPCs without awaiting between them — they hit the
// DB concurrently and contend on the single row lock (READ COMMITTED serialization).
const results = await Promise.all(
  clients.map(({ c }) => c.rpc("claim_transfer", { p_transfer_id: SEEDED_ID })),
);

const winners = results.filter((r) => r.data?.ok === true);
const losers  = results.filter((r) => r.data?.ok === false && r.data?.reason === "already_claimed");
expect(winners).toHaveLength(1);            // EXACTLY one winner (0 double-claims)
expect(losers).toHaveLength(clients.length - 1);
// Winner's payload carries the full row; losers carry transfer=null (zero PII).
expect(winners[0].data.transfer.driver_id).toBe(/* that driver's uid */);
expect(losers.every((l) => l.data.transfer == null)).toBe(true);
```
**Robustness:** repeat the run K times (loop) on freshly-reset rows to shake out timing flukes; a single pass that happens to serialize is a weak proof. `Promise.all` over independent clients is sufficient on Supabase because each `.rpc` is a separate HTTP/PostgREST request landing on a separate connection — they genuinely contend. (If a future reviewer wants a stronger "released at the exact same instant" barrier, an advisory-lock-gated `pg` harness is the upgrade — but it leaves the production RPC path; see Alternatives.)

### Pattern 5: Non-claiming-driver PII-payload gate (zero PII keys) — CLAIM-03 / SC3
**What:** Authenticate as a driver who has NOT claimed the seeded transfer; read `wp_pool` (and attempt the base table) and assert the JSON payload contains zero PII keys. Flight no. is expected present (D-02).
```ts
// Source: derived from the SC3 "looks done but isn't" PII gate (PITFALLS.md) + supabase-js.
const PII_KEYS = ["guest_name", "guest_email", "guest_phone", "address", "notes"];
const driver = createClient(SUPABASE_URL, ANON_KEY); // authenticated as a NON-claiming driver

// (a) the masked pool: structurally cannot contain PII
const { data: pool } = await driver.from("wp_pool").select("*");
for (const row of pool ?? []) {
  for (const k of PII_KEYS) expect(Object.keys(row)).not.toContain(k);
  expect(Object.keys(row)).toContain("flight_no");   // operational, EXPECTED present (D-02)
}

// (b) adversarial: hit the BASE table directly with the same JWT (the anon-key API path
//     an attacker would use). RLS must return 0 rows for a non-claiming driver — not a
//     masked row, ZERO rows — so no PII leaks even via raw PostgREST.
const { data: base } = await driver.from("wp_transfers").select("*").eq("id", SEEDED_ID);
expect(base).toHaveLength(0);
```
**Why both reads:** SC3's whole point (Pitfall 5) is that UI masking leaks via the API. Asserting the *pool* has no PII keys proves structural masking; asserting the *base table* returns 0 rows for a non-claiming driver proves the RLS boundary holds against a devtools/anon-key attacker.

### Anti-Patterns to Avoid
- **SELECT-then-UPDATE claim (read-then-write):** double-claim under concurrency (Pitfall 4). Use the single atomic conditional UPDATE only.
- **Leaning on RLS for the race:** RLS gates *who may attempt*, not *who wins* (Pitfall 6). Two policy-passing drivers still double-write without the `status='paid' AND driver_id IS NULL` predicate.
- **Default (non-invoker) view:** a plain `create view` runs as the owner and bypasses the invoker's RLS — the documented Supabase leak. Always `with (security_invoker = on)`.
- **Selecting PII then hiding it:** the view must *physically omit* PII columns (Specifics, SC3). `select *` then masking in TS leaks via the payload.
- **Trusting a client-supplied `driver_id`:** the RPC must read `auth.uid()` internally (D-04). Never accept a driver-id argument.
- **Service-role client on the claim path:** the claim MUST run under the caller's JWT so `auth.uid()` is the real driver (D-04, roadmap lock). Service-role is test-seeding only.
- **A second `paid` writer:** the claim only moves `paid → claimed`; it must never set `status='paid'` (the webhook is the sole `paid` writer — `single-writer.test.ts` enforces this).
- **`SECURITY DEFINER` without `set search_path`:** privilege-escalation vector. Always `set search_path = ''` + schema-qualify every relation [CITED: supabase docs].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mutual exclusion / one-winner | App-side lock, queue, SELECT-then-check, or `count(*)` guard | Postgres atomic conditional `UPDATE ... WHERE ... RETURNING *` under READ COMMITTED | The row lock + WHERE re-evaluation IS the mutex, by construction; any app-tier scheme races (Pitfall 4/6). |
| Column-level PII masking | TS that deletes keys after `select *` | `security_invoker` view that never selects PII columns | The payload structurally cannot carry omitted columns; TS masking leaks via the raw API (Pitfall 5). |
| Atomic "claim + return row" | Claim then a follow-up SELECT for the full row | `RETURNING *` inside the same RPC statement | A follow-up read races (the row could be reassigned); RETURNING hands the winner the row in one round-trip (Specifics). |
| "Already claimed" signalling | Exceptions / try-catch as control flow | Typed result `{ ok:false, reason:'already_claimed', transfer:null }` | D-03: branch on a value, not an exception; losers carry zero PII. |
| Role check for claim eligibility | New role table / per-driver "active" gate | Existing `is_admin()` + `grant execute to authenticated` + invite-only pilot | D-06: drivers exist only via admin invite; no extra gate needed. |
| Live-DB migration apply | MCP `apply_migration` (reaches Kalvia) or direct `db.<ref>` host (IPv6-only) | Supabase Management API `/v1/projects/<ref>/database/query` (BEGIN…COMMIT + history row) | Confirmed Balkanity IPv4 path (03-GATES-EVIDENCE); MCP targets the WRONG project. |

**Key insight:** Both invariants are *solved Postgres features*, not code to write. The only "building" is N lines of SQL + the test harness that proves them. The risk is in (a) keeping concurrency and PII strictly separate, (b) the `security_invoker`/`search_path` hardening one-liners, and (c) a concurrency harness that truly parallelizes.

## Runtime State Inventory

> This is a schema-additive phase (new view + RPC + RLS policy on an existing table), with a live migration apply. The migration writes NO data rows — it only adds DB objects. The relevant runtime state to track is the live-DB object set and the migration history, not stored business data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — migration `0005` adds objects only (view, function, policy). No INSERT/UPDATE of business rows. Existing Phase-3/4 seed rows and any live `wp_transfers` rows are untouched. | None for data. Test harness seeds + tears down its OWN `paid`/driver rows in a TEST context. |
| Live service config | Supabase project `qyhdogajtmnvxphrslwm` (Balkanity) DB schema. The new objects must be applied LIVE via the Management API. PostgREST schema cache must reflect the new view + RPC (Supabase auto-reloads on DDL via the Management API path). | BLOCKING signed-off apply via Management API `/database/query`; verify view/RPC/policy exist post-apply. Confirm PostgREST exposes `wp_pool` + `claim_transfer` (a `NOTIFY pgrst, 'reload schema'` may be belt-and-suspenders, usually automatic). |
| OS-registered state | None — no OS-level tasks/crons/services touched in this phase. | None. |
| Secrets/env vars | `SUPABASE_ACCESS_TOKEN` (Management API), `SUPABASE_DB_URL`/pooler creds, `SUPABASE_SERVICE_ROLE_KEY` (test seeding), `NEXT_PUBLIC_SUPABASE_URL`/`PUBLISHABLE_KEY` (caller-auth clients) — all already set (Phase 1–3). No new secret. | Confirm `SUPABASE_ACCESS_TOKEN` still resolves to Balkanity (the guardrail check from 03-GATES-EVIDENCE). No key changes. |
| Build artifacts / installed packages | Supabase generated TS types (`supabase gen types`) — adding a view + composite-return RPC changes the generated `Database` type if the project regenerates types. No type-gen file was found in the repo grep, so this may be deferred. | If generated types are in use, regenerate after apply so `.rpc('claim_transfer')` and `wp_pool` are typed. Verify whether the project commits generated types (none found — likely deferred). |

**Migration history note:** record `0005` in `supabase_migrations.schema_migrations` in the SAME transaction as the DDL (the established 03-GATES-EVIDENCE pattern) so a future `supabase db push` stays consistent.

## Common Pitfalls

### Pitfall 1: Default view bypasses the invoker's RLS (PII leak)
**What goes wrong:** `create view wp_pool as select ...` without `security_invoker` runs as the view *owner* (a privileged role), so RLS on `wp_transfers` is checked against the owner, not the driver — the view returns rows the driver should never see.
**Why it happens:** `security_invoker` is opt-in and off by default; it's an easy omission.
**How to avoid:** Always `with (security_invoker = on)` (Postgres ≥15; Supabase is on 15+). Assert it in the source-level migration-contract test.
**Warning signs:** A non-claiming driver reads pool rows they shouldn't; the view returns admin-visible rows. [CITED: dev.to/datadeer; pganalyze E28]

### Pitfall 2: Treating RLS as the concurrency control (double-claim)
**What goes wrong:** Relying on an RLS UPDATE policy to "ensure one driver wins." Two drivers both pass the policy and both write → double-claim.
**Why it happens:** RLS and concurrency are conflated as "DB safety" (Pitfall 6, PITFALLS.md).
**How to avoid:** The `status='paid' AND driver_id IS NULL` predicate in the UPDATE is the ONLY concurrency control (D-04). Prove it with the parallel-JWT gate, not by reasoning about RLS.
**Warning signs:** No `status='paid'` predicate in the UPDATE; concurrency test absent "because RLS handles it."

### Pitfall 3: A concurrency test that secretly serializes (false-green gate)
**What goes wrong:** The "parallel" claims actually run one-after-another (e.g. `for…await`, or one shared client that serializes requests), so the test always sees one winner — but proves nothing.
**Why it happens:** `await` inside a loop serializes; a single supabase-js client may pipeline.
**How to avoid:** Use N **independent** clients and `Promise.all` (no `await` between fires). Loop the whole gate K times on freshly-reset rows. Optionally log timing to confirm overlap.
**Warning signs:** Always exactly one winner even at high N with no losers ever showing `already_claimed` from genuine contention; suspiciously deterministic timing.

### Pitfall 4: SECURITY DEFINER without `search_path` hardening (privilege escalation)
**What goes wrong:** A SECURITY DEFINER function with a mutable `search_path` can be tricked into resolving a relation/operator to an attacker-controlled schema, running with the definer's elevated rights.
**Why it happens:** `search_path` defaults to the caller's; easy to forget on DEFINER functions.
**How to avoid:** `set search_path = ''` and fully schema-qualify every relation (`public.wp_transfers`, `auth.uid()`). [CITED: supabase.com/docs/guides/database/functions; supabase/supa_audit#29]
**Warning signs:** Supabase advisor flags "Function Search Path Mutable"; relations referenced unqualified.

### Pitfall 5: RPC executable by `anon`/`public`
**What goes wrong:** By default DB functions are executable by all roles. An unauthenticated/anon caller could invoke `claim_transfer` — `auth.uid()` would be null (so the `not_authenticated` branch returns), but defense-in-depth wants it locked.
**Why it happens:** Postgres grants EXECUTE broadly by default.
**How to avoid:** `revoke execute ... from public, anon; grant execute ... to authenticated;` (D-06). Assert in the contract test. [CITED: supabase.com/docs/guides/api/securing-your-api]
**Warning signs:** `anon` can call the RPC; no explicit grant/revoke in the migration.

### Pitfall 6: Applying the migration to the wrong project (Kalvia)
**What goes wrong:** MCP tools and some CLI paths reach only Kalvia (`utyatpadtibqqswsfvtr`), not Balkanity. Applying `0005` there is silent and wrong.
**Why it happens:** Documented project-memory blocker — MCP/CLI default to Kalvia; only the Management API token + pooler reach Balkanity.
**How to avoid:** Apply ONLY via the Management API `/v1/projects/qyhdogajtmnvxphrslwm/database/query`. Run the ref-guardrail check (curl the project, assert `qyhdogajtmnvxphrslwm`, assert Kalvia ref absent) BEFORE apply — exactly as 03-GATES-EVIDENCE did. [CITED: project memory; 03-GATES-EVIDENCE.md]
**Warning signs:** Any tool reporting "Kalvia"; an MCP `apply_migration` call; a `db.<ref>` host that times out (IPv6-only).

### Pitfall 7: Winner gets the row via a follow-up read (PII race)
**What goes wrong:** Claim succeeds, then a separate `SELECT * WHERE id=…` fetches the full row — but between the two, the row could be reassigned/cancelled, or the read could race.
**How to avoid:** `RETURNING *` inside the RPC's UPDATE hands the winner the full row atomically — no second round-trip (Specifics, D-03).
**Warning signs:** A `.select()` after `.rpc('claim_transfer')` to get PII; claim and detail as two calls.

## Code Examples

All verified patterns are in **Architecture Patterns** above (Patterns 1–5), each with a `// Source:` line. The migration SQL (Patterns 1–3), the concurrency gate (Pattern 4), and the PII gate (Pattern 5) are the load-bearing examples a planner turns into tasks.

### Source-level migration contract (mirror the established precedent)
```ts
// Source: platform/rls/payments-schema.test.ts / supply-rls.test.ts (repo precedent).
// Reads 0005 SQL text; asserts the security shape so CI fails fast if anyone weakens it.
const CODE = readFileSync("supabase/migrations/0005_claim_correctness.sql","utf8")
  .split("\n").filter(l => !l.trim().startsWith("--")).join("\n");
expect(CODE).toMatch(/security_invoker\s*=\s*on/i);                 // Pattern 1
expect(CODE).not.toMatch(/\bguest_(name|email|phone)\b/);           // view omits PII (D-01)
expect(CODE).toMatch(/set search_path\s*=\s*''/);                   // Pattern 2 hardening
expect(CODE).toMatch(/status\s*=\s*'paid'\s+and\s+driver_id is null/i); // the race predicate (D-04)
expect(CODE).toMatch(/returning \*/i);                              // winner gets full row (D-03)
expect(CODE).toMatch(/grant\s+execute on function public\.claim_transfer.*authenticated/i);
expect(CODE).toMatch(/revoke\s+execute on function public\.claim_transfer.*(public|anon)/i);
expect(MIGRATION).toContain("qyhdogajtmnvxphrslwm");                // Balkanity guardrail
expect(MIGRATION).toContain("Kalvia (utyatpadtibqqswsfvtr)");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Views always run as owner (RLS bypass risk) | `security_invoker = on` makes a view obey the invoker's RLS | Postgres 15 (Supabase on 15+) | The structural-masking pool view is RLS-correct for the querying driver [CITED: pganalyze E28]. |
| App-tier locking / queue for one-winner | Atomic conditional `UPDATE ... RETURNING *` under READ COMMITTED | Longstanding Postgres semantics | The DB *is* the mutex; no app coordination needed (Pitfall 4). |
| `SECURITY DEFINER` with default search_path | `set search_path = ''` + schema-qualified relations | Supabase best-practice (current) | Mandatory hardening; Supabase advisor flags the mutable case [CITED: supabase docs]. |

**Deprecated/outdated:**
- Plain `create view` for any RLS-protected pool → use `with (security_invoker = on)`.
- `@supabase/auth-helpers-nextjs`, `getSession()` for authz → already locked out (CLAUDE.md); the caller-auth client + `getCurrentRole()`/`auth.getUser()` stand.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A non-claiming driver currently matches NO permissive SELECT policy on `wp_transfers` and so the `security_invoker` `wp_pool` view returns the driver 0 rows pre-claim **unless** a pre-claim SELECT policy is added that exposes paid/unclaimed rows. The masked view alone does not grant row access — `security_invoker` means the *driver's* RLS is checked, and the driver has no policy matching paid/unclaimed rows today (only admin_read + guest_self_read exist). | Open Questions Q1; Pattern 1 | HIGH — if missed, the pool view returns 0 rows to every driver (functional break), OR a too-broad pre-claim policy on the base table re-introduces the PII-leak path SC3 guards against. **Must be resolved in planning.** |
| A2 | Supabase Postgres is version ≥15 so `security_invoker` is available. | Pattern 1, State of the Art | LOW — Supabase has shipped 15+ for years; verify against the live project version at apply time. |
| A3 | `Promise.all` over N independent supabase-js clients produces genuine DB-level contention on a single Supabase project (separate PostgREST requests → separate connections). | Pattern 4 | MEDIUM — if PostgREST/pooler serializes unexpectedly, the gate could false-green; mitigate by looping K times and (if needed) the `pg`-advisory-lock upgrade. |
| A4 | The live migration applies via the Management API `/database/query` endpoint with `SUPABASE_ACCESS_TOKEN`, exactly as Phase 3 did; MCP/direct-host are unavailable for Balkanity. | Don't Hand-Roll; Pitfall 6 | LOW — directly evidenced in 03-GATES-EVIDENCE.md and project memory. |
| A5 | No generated Supabase TS types are committed in the repo (grep found none), so type regeneration is optional/deferred. | Runtime State Inventory | LOW — if types ARE used elsewhere, regenerate post-apply. |

## Open Questions (RESOLVED)

1. **Pre-claim base-table read path for the `security_invoker` pool view (the load-bearing design decision).**
   - What we know: `security_invoker = on` checks the underlying `wp_transfers` RLS as the *driver*. Today the only permissive SELECT policies are `wp_transfers_admin_read` (is_admin) and `wp_transfers_guest_self_read` (JWT email = guest_email). A non-admin driver matches neither → the view returns them 0 rows.
   - What's unclear: To make the pool functional, drivers need a base-table SELECT path that matches `status='paid' AND driver_id IS NULL`. Two structurally different ways to provide it:
     - **(a)** Add a narrow pre-claim RLS SELECT policy on `wp_transfers` for `authenticated` (driver/admin) `using (status='paid' AND driver_id IS NULL)`. **Risk:** this grants the *full base row* (all PII) to any driver for paid/unclaimed transfers via the raw API — directly the SC3 leak. So this policy would need to be paired with column-level protection, which row-RLS does NOT provide. **Likely wrong.**
     - **(b)** Make `claim_transfer` and the pool a **SECURITY DEFINER read path too** — i.e. the pool is itself a SECURITY DEFINER function (or a view owned by a role whose RLS yields only the masked columns) so the driver never reads the base table directly. With a DEFINER function returning only the 8 D-01 columns, no base-table SELECT policy for drivers is needed at all, and SC3's "base table returns 0 rows for a non-claiming driver" assertion holds.
   - Recommendation: **Resolve in planning.** The cleanest data-contract that satisfies BOTH SC1 (pool works) and SC3/SC4 (base table leaks zero PII to non-claiming drivers) is option (b)-flavored: a `security_invoker` view CANNOT return rows the driver's RLS forbids, so either (i) the masked read is a SECURITY DEFINER function exposing only the 8 columns, or (ii) the pre-claim SELECT policy is written to expose paid/unclaimed rows but ONLY through the column-omitting view while the base table stays 0-rows for drivers — which `security_invoker` does not allow (it inherits base-table RLS). **Strong recommendation: implement the masked pool as a SECURITY DEFINER read (function or definer-view), NOT a security_invoker view that needs a permissive base-table policy.** The D-01 contract (physical column omission) is preserved either way; the difference is whether a base-table driver-read policy must exist (it should NOT, to keep SC4 tight). The CONTEXT names "security_invoker view" in D-01, so flag this tension for the planner/sign-off: a security_invoker view requires a base-table read grant that re-opens the PII path; a definer read does not. Pick one explicitly before authoring `0005`.

2. **Composite type vs `jsonb` for the RPC return (Discretion).**
   - What we know: D-03 wants `{ ok, reason, transfer }`. A composite type (`wp_claim_result`) is self-documenting and types well; `jsonb` is looser.
   - Recommendation: composite type (shown in Pattern 2) for the typed-client convention; either is acceptable.

3. **One combined RLS policy vs two (Discretion).**
   - What we know: `is_admin()` is already OR'd in via `wp_transfers_admin_read`. A driver-only `using ((select auth.uid()) = driver_id)` policy is enough; admin coverage already exists.
   - Recommendation: a single driver-self policy (admins already covered) — minimal new objects. Decide in planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | concurrency + PII gates, RPC calls | ✓ | ^2.108 (2.108.2) | — |
| Vitest | source-level contract + (optional) Node-run gates | ✓ | ^4.1 | — |
| Playwright | e2e adversarial gates against running app | ✓ | ^1.61 | — |
| Supabase Management API (`SUPABASE_ACCESS_TOKEN`) | live `0005` apply to Balkanity (IPv4 path) | ✓ | n/a | none — this is the ONLY working Balkanity apply path (MCP→Kalvia, direct host→IPv6-only) |
| Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) | TEST seeding of paid rows + driver users | ✓ | n/a | — |
| `pg` (node-postgres) | OPTIONAL advisory-lock concurrency upgrade | ✗ | — | `Promise.all` over supabase-js clients (recommended primary; no install needed) |
| `ctx7` / Context7 MCP | docs lookup | ✗ | — | WebSearch (used; Supabase/Postgres docs cited) |
| `slopcheck` | package legitimacy | ✗ | — | N/A — zero packages installed this phase |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `pg` (only if the advisory-lock harness upgrade is chosen — not recommended; the supabase-js `Promise.all` harness needs no install and tests the real RPC path).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1` (jsdom) for source-level/unit + Node-run live gates; Playwright `^1.61` (chromium) for e2e |
| Config file | `vitest.config.ts` (includes `platform/**`, `modules/**`, `app/**/*.test.{ts,tsx}`; `setupFiles: ./vitest.setup.ts`); `playwright.config.ts` for e2e |
| Quick run command | `npm run test` (`vitest run`) |
| Full suite command | `npm run test && npm run typecheck && npm run lint` |

> Established precedent (Phase 2/3): **source-level contract tests** read migration SQL text and assert the security shape (`platform/rls/payments-schema.test.ts`, `supply-rls.test.ts`). Reuse this EXACT pattern for the `0005` view/RPC/RLS contract. Live-DB adversarial gates run at the BLOCKING push-verification checkpoint (like Phase 3's Stripe-CLI replay gate), recorded in a `05-GATES-EVIDENCE.md`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLAIM-02 / SC2 | N parallel `claim_transfer()` → exactly 1 winner, N−1 `already_claimed` | live gate (Node/Vitest or Playwright; needs seeded DB + N driver JWTs) | `vitest run tests/claim/concurrency.gate.test.ts` (or `playwright test`) | ❌ Wave 0 |
| CLAIM-02 / SC2 | claim is a single atomic conditional UPDATE with `status='paid' AND driver_id IS NULL ... RETURNING *` (no SELECT-then-UPDATE) | source-level (migration text) | `vitest run platform/rls/claim-schema.test.ts` | ❌ Wave 0 |
| CLAIM-03 / SC1 | `wp_pool` exposes ONLY the 8 D-01 columns; physically omits PII; `security_invoker`-correct (or definer-read per Q1) | source-level + live read | `vitest run platform/rls/claim-schema.test.ts` + `tests/claim/pii-payload.gate.test.ts` | ❌ Wave 0 |
| CLAIM-03 / SC3 | non-claiming driver JWT → pool/base payload has zero PII keys (flight_no present OK) | live gate (seeded DB + non-claiming driver JWT) | `vitest run tests/claim/pii-payload.gate.test.ts` | ❌ Wave 0 |
| CLAIM-03 / SC4 | full PII readable only by claiming driver (`driver_id=auth.uid()`) + admins via RLS; winner gets full row via RPC `RETURNING *` | source-level + live gate | `vitest run platform/rls/claim-schema.test.ts` + concurrency gate winner-payload assertion | ❌ Wave 0 |
| CLAIM-02/03 | claim path uses caller-auth client, never service-role; no second `paid` writer | source-level (grep; extend `single-writer.test.ts` coverage) | `vitest run platform/payments/single-writer.test.ts` (verify still green; claim adds no `status='paid'`) | ✅ exists |

### Sampling Rate
- **Per task commit:** `npm run test` (quick vitest — source-level contract runs in CI in seconds) + `npm run typecheck`
- **Per wave merge:** `npm run test && npm run typecheck && npm run lint`
- **Phase gate:** Full suite green + **both adversarial gates demonstrated live** against the Balkanity TEST DB (N-parallel-claim → one winner; non-claiming-JWT → zero PII), recorded in `05-GATES-EVIDENCE.md`, before `/gsd-verify-work`. The FLAGGED `0005` apply is a BLOCKING signed-off task with the Balkanity-ref guardrail check.

### Wave 0 Gaps
- [ ] `platform/rls/claim-schema.test.ts` — source-level `0005` contract (security_invoker/definer-read; PII columns omitted; `search_path=''`; race predicate; `RETURNING *`; grant authenticated / revoke anon+public; Balkanity guardrail). Mirrors `payments-schema.test.ts`.
- [ ] `tests/claim/concurrency.gate.test.ts` — N parallel-JWT claim gate (CLAIM-02). Needs a seed helper (service-role) + N driver JWT mint helper. Loop K times.
- [ ] `tests/claim/pii-payload.gate.test.ts` — non-claiming-driver PII gate (CLAIM-03). Needs a non-claiming driver JWT + seeded paid row.
- [ ] Shared test fixtures: seed-paid-transfer helper, driver-user/JWT mint helper (service-role, TEST DB only), teardown.
- [ ] `05-GATES-EVIDENCE.md` runbook (mirror `03-GATES-EVIDENCE.md`): ref guardrail, sign-off, apply via Management API, post-apply object verification, recorded gate outputs.
- [ ] Framework install: none (Vitest + Playwright already configured; no new packages).

*Tests are EXPECTED red at Wave 0 (no `0005` yet) — the Nyquist baseline, exactly as Phase 3 established. Do NOT author `0005` to make them green prematurely; the live apply is the BLOCKING signed-off task.*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`. This phase IS a security boundary (PII gating + privilege-scoped writes), so ASVS V4/V5 are central.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Caller-auth supabase client + `auth.uid()` inside the RPC; `getCurrentRole()`/`auth.getUser()` (never `getSession()`) for any future authz gate. The RPC self-derives the actor — no client-supplied identity. |
| V3 Session Management | partial | Sessions handled by `@supabase/ssr` (Phase 1); this phase introduces no new session logic. JWTs minted in tests only. |
| V4 Access Control | **yes (central)** | RLS on `wp_transfers` (`driver_id = auth.uid() OR is_admin()`); `wp_pool` masked read; `grant execute … to authenticated` + `revoke … from anon/public`; the atomic `WHERE status='paid' AND driver_id IS NULL` scoping the claim. SECURITY DEFINER used narrowly with `search_path=''`. |
| V5 Input Validation | yes | The RPC takes a single `uuid` arg (type-checked by Postgres); it ignores any client-supplied driver id (derives from `auth.uid()`). Pre-claim view exposes a fixed column set — no client-controlled projection. |
| V6 Cryptography | no | No new crypto in this phase (Stripe HMAC is Phase 3). |

### Known Threat Patterns for Postgres + Supabase + Next.js (this phase)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Double-claim under concurrency (lost-update) | Tampering | Atomic conditional UPDATE under READ COMMITTED; prove with N-parallel gate (D-04). |
| PII leak via anon-key/PostgREST despite UI masking | Information Disclosure | `security_invoker`/definer masked read that physically omits PII + base-table RLS returning 0 rows to non-claiming drivers; prove with non-claiming-JWT gate (SC3, Pitfall 5). |
| SECURITY DEFINER privilege escalation via mutable search_path | Elevation of Privilege | `set search_path = ''` + fully schema-qualified relations (Pitfall 4). |
| RPC callable by anon/unauthenticated | Elevation of Privilege | `revoke execute from public, anon; grant execute to authenticated` + null-`auth.uid()` guard (Pitfall 5). |
| Client spoofs driver identity (claims as someone else) | Spoofing | RPC reads `auth.uid()` internally; never accepts a driver-id argument (D-04). |
| Default view bypasses invoker RLS | Information Disclosure | `with (security_invoker = on)` — or a definer read exposing only masked columns (Pitfall 1, Open Q1). |
| Applying schema to the wrong project (Kalvia) | Tampering / misconfig | Management API to Balkanity ONLY + pre-apply ref guardrail (Pitfall 6). |
| Second `paid` writer introduced via the claim path | Tampering (money invariant) | Claim only moves `paid → claimed`; never sets `status='paid'`; `single-writer.test.ts` stays green. |

## Sources

### Primary (HIGH confidence)
- Repo files (read this session): `supabase/migrations/0001`–`0004`, `platform/transfers/lifecycle.ts`, `platform/supabase/{admin,server,client}.ts`, `platform/auth/role.ts`, `app/api/stripe/webhook/route.ts`, `platform/rls/{payments-schema,supply-rls}.test.ts`, `app/api/stripe/webhook/route.idempotency.test.ts`, `tests/e2e/{webhook-forged,success-spoof}.spec.ts`, `vitest.config.ts`, `package.json` — established patterns, exact reuse points.
- `.planning/phases/03-payments-trust-spine/03-GATES-EVIDENCE.md` + `03-VALIDATION.md` — the live-DB apply path (Management API `/database/query`, Balkanity-ref guardrail) and the adversarial-gate evidence shape to mirror.
- `.planning/research/PITFALLS.md` Pitfalls 4, 5, 6 (and the "Looks Done But Isn't" checklist) — the exact failure modes this phase must close.
- `CLAUDE.md` §"Integration Patterns" #2 + "What NOT to Use" + locked stack — atomic claim, caller-auth-not-service-role, data-layer-not-UI enforcement.
- `supabase.com/docs/guides/database/functions` + `supabase.com/docs/guides/api/securing-your-api` — SECURITY DEFINER `search_path=''` hardening, EXECUTE grant restriction. [CITED]
- `supabase.com/docs/guides/database/postgres/row-level-security` — RLS + `security_invoker` views. [CITED]

### Secondary (MEDIUM confidence)
- pganalyze "5mins of Postgres E28" (security_invoker views, why they matter) + dev.to/datadeer "Postgres Views: The Hidden Security Gotcha in Supabase" — corroborate the default-view RLS-bypass leak and the `security_invoker = on` fix. [CITED]
- supabase GitHub discussions/issues (#28464 security-definer views; supa_audit#29 search_path) — community corroboration of the hardening requirement.

### Tertiary (LOW confidence)
- None relied upon for any load-bearing claim.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all locked in CLAUDE.md and verified in package.json.
- Architecture (atomic UPDATE, security_invoker/definer, SECURITY DEFINER hardening, RLS): HIGH — Postgres semantics + official Supabase docs + strong repo precedent.
- Test harness (parallel-JWT concurrency, PII-payload gate): MEDIUM-HIGH — pattern is sound and derived from existing tests; the only residual uncertainty is `Promise.all` contention realism (mitigated by looping + optional `pg` upgrade).
- The one design tension (Open Q1: security_invoker view vs definer-read for the masked pool) is MEDIUM — flagged explicitly for planner/sign-off resolution; both options preserve the D-01 column contract.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable domain — Postgres/Supabase RLS semantics and the locked stack change slowly; revisit if Supabase Postgres major version or the project's MCP/Management-API access changes)
