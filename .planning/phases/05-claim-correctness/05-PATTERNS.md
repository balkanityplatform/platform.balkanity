# Phase 5: Claim Correctness - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 5 (1 migration, 1 thin call site, 1 source-level contract test, 2 live adversarial gates)
**Analogs found:** 5 / 5 (every new file has a strong in-repo analog)

> All file paths below are absolute-relative to repo root `/Users/balkanitytours/GitHub/platform.balkanity`.
> Phase 5 adds **zero packages** (RESEARCH §Standard Stack). It authors SQL + TypeScript test files only, reusing already-installed `@supabase/supabase-js`, Vitest, Playwright.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0005_claim_correctness.sql` | migration (FLAGGED) | CRUD + transform (masked view + atomic claim RPC + RLS) | `supabase/migrations/0004_transfer_entity.sql` (RLS + trigger fn) + `0002_supply_tables.sql` (`is_admin()` SECURITY DEFINER helper + admin-read RLS) | exact |
| `platform/transfers/claim.ts` (thin, optional this phase) | utility / server call site | request-response (caller-auth `.rpc()` wrapper) | `platform/auth/role.ts` (caller-auth `createClient()` + `auth.getUser()`) | role-match |
| `platform/rls/claim-schema.test.ts` | test (source-level contract) | transform (read migration text, assert shape) | `platform/rls/payments-schema.test.ts` | exact |
| `tests/claim/concurrency.gate.test.ts` (or `tests/e2e/*.spec.ts`) | test (live adversarial gate) | event-driven (N parallel claims → one winner) | `tests/e2e/webhook-forged.spec.ts` + `platform/payments/single-writer.test.ts` (Vitest harness shape) | role-match |
| `tests/claim/pii-payload.gate.test.ts` (or `tests/e2e/*.spec.ts`) | test (live adversarial gate) | request-response (non-claiming JWT read → zero PII keys) | `tests/e2e/success-spoof.spec.ts` (spoof-payload assertion) + `webhook-forged.spec.ts` | role-match |

---

## Pattern Assignments

### `supabase/migrations/0005_claim_correctness.sql` (migration, CRUD + transform)

**Analogs:** `supabase/migrations/0004_transfer_entity.sql` (primary — RLS policies, trigger fn, header guardrail, re-runnability) and `supabase/migrations/0002_supply_tables.sql` (the `is_admin()` SECURITY DEFINER helper + admin-read RLS the new policy reuses).

This is the single FLAGGED deliverable. It assembles three objects (masked pool read, `claim_transfer()` RPC, claiming-driver RLS policy) — each maps directly to an existing migration pattern. The exact masked-read mechanism (security_invoker view vs SECURITY DEFINER function) is the planner's Open-Q1 decision (RESEARCH lines 449-454); both preserve the D-01 column omission.

**FLAGGED header + Balkanity guardrail** — copy verbatim from `0004` lines 1-8 (and the `0002` lines 1-3 form):
```sql
-- 0005_claim_correctness.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
-- THIS FILE IS AUTHORED, NOT APPLIED. Live apply is a BLOCKING signed-off task via the
-- Supabase Management API /database/query — NOT MCP (MCP reaches only Kalvia; project memory).
```
The guardrail strings `qyhdogajtmnvxphrslwm` and `Kalvia (utyatpadtibqqswsfvtr)` MUST appear so the contract test (below) passes — see `0004` lines 2-3, asserted by `payments-schema.test.ts` lines 87-90.

**SECURITY DEFINER hardening pattern** — copy the shape from `0002` `is_admin()` lines 22-33, but harden `search_path` to `''` (empty, fully schema-qualified) per RESEARCH Pitfall 4 (the `0002` helper uses `set search_path = public`; the new claim RPC must use `set search_path = ''` and fully-qualify every relation):
```sql
-- 0002 is_admin() (lines 22-33) is the SECURITY DEFINER + stable + search_path template.
-- REUSE is_admin() directly (do NOT redefine it) for the admin clause of the new RLS policy.
create or replace function public.is_admin()  -- already exists from 0002; referenced, not recreated
  ...
```

**RLS SELECT policy pattern** — copy the `0004` policy shape (lines 146-149), substituting the claiming-driver predicate. Postgres ORs permissive SELECT policies, so this coexists with `wp_transfers_admin_read` (0003) and `wp_transfers_guest_self_read` (0004):
```sql
-- Mirror 0004 lines 146-149 exactly (drop-if-exists for re-runnability; (select ...) initPlan wrap).
drop policy if exists "wp_transfers_claimed_driver_read" on public.wp_transfers;
create policy "wp_transfers_claimed_driver_read" on public.wp_transfers
  for select to authenticated
  using ( (select auth.uid()) = driver_id );  -- admin already covered by wp_transfers_admin_read (D-08, RESEARCH Q3)
```

**Atomic claim RPC** (RESEARCH Pattern 2, lines 210-256) — the `paid → claimed` UPDATE passes the existing `0004` transition guard unchanged (`0004` lines 103-110 already permit `paid → claimed`; trigger fires for the RPC because service-role/DEFINER bypass RLS, NOT triggers — `0004` lines 73-86). Derive `driver_id` from `auth.uid()` internally, never a client arg (D-04). `RETURNING *` hands the winner the full row atomically (D-03, no second read). Then:
```sql
revoke execute on function public.claim_transfer(uuid) from public, anon;
grant  execute on function public.claim_transfer(uuid) to authenticated;  -- D-06
```

**No write policy on wp_transfers** — the load-bearing "no INSERT/UPDATE/DELETE policy" lock from `0002` lines 106-109 / `0004` lines 46-47 MUST hold. The RPC is the ONLY sanctioned claim write path (SECURITY DEFINER performs the gated write); add NO `for update` policy.

**Re-runnability** — every statement uses `create or replace` / `drop ... if exists` / `create ... if not exists`, exactly as `0004` line 39-40 documents.

---

### `platform/transfers/claim.ts` (utility / server call site, request-response) — thin / optional this phase

**Analog:** `platform/auth/role.ts` (the established caller-auth server pattern; the full driver/admin UI consuming the RPC is Phase 6).

**Caller-auth client pattern** (role.ts lines 8-15) — the claim invokes the RPC via the **caller-auth server client, NEVER the service-role admin client** (D-04 / roadmap lock). Mirror role.ts:
```ts
import { createClient } from "@/platform/supabase/server";  // anon/cookie-bound caller-auth (server.ts)
// NOT @/platform/supabase/admin (service-role) — that would bypass RLS and break auth.uid()-keyed claim.

export async function claimTransfer(transferId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_transfer", { p_transfer_id: transferId });
  // branch on data.ok (D-03 typed result); NO try/catch-as-control-flow, NO follow-up PII read.
  ...
}
```
`platform/supabase/server.ts` lines 13-38 is the caller-auth client; `platform/supabase/admin.ts` (service-role, `import "server-only"`) is **test-seeding only**, never the claim path.

---

### `platform/rls/claim-schema.test.ts` (test, source-level contract) — transform

**Analog:** `platform/rls/payments-schema.test.ts` (exact pattern — read migration text, strip comments, assert security shape; mirrors `supply-rls.test.ts`).

**Read + comment-strip pattern** (payments-schema.test.ts lines 14-29) — copy verbatim, pointing at `0005`:
```ts
const MIGRATION = readFileSync(join(process.cwd(), "supabase/migrations/0005_claim_correctness.sql"), "utf8");
const CODE = MIGRATION.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
```
The comment strip is load-bearing — a commented-out `-- for update` or `-- guest_name` must not satisfy/break the contract (payments-schema.test.ts lines 23-29).

**Contract assertions** (RESEARCH lines 414-422; structure mirrors payments-schema.test.ts lines 33-90):
```ts
expect(CODE).toMatch(/security_invoker\s*=\s*on/i);                       // OR definer-read per Q1
expect(CODE).not.toMatch(/\bguest_(name|email|phone)\b/);                 // view omits PII (D-01)
expect(CODE).toMatch(/set search_path\s*=\s*''/);                         // SECURITY DEFINER hardening
expect(CODE).toMatch(/status\s*=\s*'paid'\s+and\s+driver_id is null/i);   // the race predicate (D-04)
expect(CODE).toMatch(/returning \*/i);                                    // winner full row (D-03)
expect(CODE).toMatch(/grant\s+execute on function public\.claim_transfer.*authenticated/i);
expect(CODE).toMatch(/revoke\s+execute on function public\.claim_transfer.*(public|anon)/i);
expect(CODE).not.toMatch(/for update/);                                   // no write policy (0004 lock)
```
**Balkanity guardrail assertion** — copy payments-schema.test.ts lines 87-90 verbatim:
```ts
expect(MIGRATION).toContain("Kalvia (utyatpadtibqqswsfvtr)");
expect(MIGRATION).toContain("qyhdogajtmnvxphrslwm");
```
**Nyquist baseline note** — this test is EXPECTED RED at Wave 0 (no `0005` yet), exactly as payments-schema.test.ts lines 11-13 document. Do NOT author `0005` to make it green prematurely.

---

### `tests/claim/concurrency.gate.test.ts` (test, live adversarial gate) — event-driven

**Analog:** `tests/e2e/webhook-forged.spec.ts` (adversarial gate header + seeding-gated-behind-live-DB note) + `platform/payments/single-writer.test.ts` (Vitest describe/it shape if run via Node). RESEARCH Pattern 4 (lines 271-300) is the concrete harness.

**Adversarial-gate header pattern** (webhook-forged.spec.ts lines 3-21) — copy the "ONLY money/correctness path", "NYQUIST BASELINE … RED now", and "PREREQUISITES (live TEST-DB seeding via service-role)" comment structure.

**Seeding** — use the service-role admin client (`platform/supabase/admin.ts`) for TEST-DB-only seeding of ONE `paid`/unclaimed `wp_transfers` row + N driver auth users; the claim itself MUST run on caller-auth clients (RESEARCH line 86, Anti-Pattern lines 330).

**The barrier** (RESEARCH lines 280-298) — N independent `createClient(url, anonKey)` each with a distinct driver JWT, fired via `Promise.all` (NO `await` between fires — Pitfall 3 false-green):
```ts
const results = await Promise.all(clients.map(({ c }) => c.rpc("claim_transfer", { p_transfer_id: SEEDED_ID })));
const winners = results.filter((r) => r.data?.ok === true);
const losers  = results.filter((r) => r.data?.ok === false && r.data?.reason === "already_claimed");
expect(winners).toHaveLength(1);                        // 0 double-claims (CLAIM-02 / SC2)
expect(losers).toHaveLength(clients.length - 1);
expect(losers.every((l) => l.data.transfer == null)).toBe(true);  // losers carry zero PII (D-03)
```
Loop K times on freshly-reset rows (RESEARCH line 300, Pitfall 3).

---

### `tests/claim/pii-payload.gate.test.ts` (test, live adversarial gate) — request-response

**Analog:** `tests/e2e/success-spoof.spec.ts` (the "payload must NOT contain the privileged thing" negative-assertion gate) + `webhook-forged.spec.ts`. RESEARCH Pattern 5 (lines 302-322).

**Negative-assertion pattern** (success-spoof.spec.ts lines 36-38, "no paid affordance rendered") — mirror as "zero PII keys in payload":
```ts
const PII_KEYS = ["guest_name", "guest_email", "guest_phone", "address", "notes"];
const driver = createClient(SUPABASE_URL, ANON_KEY); // authenticated as a NON-claiming driver

// (a) masked pool: structurally cannot carry PII; flight_no EXPECTED present (D-02)
const { data: pool } = await driver.from("wp_pool").select("*");
for (const row of pool ?? []) {
  for (const k of PII_KEYS) expect(Object.keys(row)).not.toContain(k);
  expect(Object.keys(row)).toContain("flight_no");        // operational, NOT a gate failure (D-02)
}

// (b) adversarial base-table hit with the same JWT — RLS must return 0 rows (not a masked row)
const { data: base } = await driver.from("wp_transfers").select("*").eq("id", SEEDED_ID);
expect(base).toHaveLength(0);                              // SC4 — RLS boundary holds vs raw PostgREST
```
**Why two reads** — the pool proves structural masking; the base-table read proves the RLS boundary against a devtools/anon-key attacker (RESEARCH lines 318-322; this is the Pitfall-5 "UI masking leaks via the API" point that is Phase 5's whole reason for existing).

---

## Shared Patterns

### SECURITY DEFINER role helper (`is_admin()`)
**Source:** `supabase/migrations/0002_supply_tables.sql` lines 22-33.
**Apply to:** the new `wp_transfers_claimed_driver_read` RLS policy (admin clause) — **reuse `is_admin()`, do NOT redefine it**. Note `0002` uses `set search_path = public`; the NEW `claim_transfer()` RPC must instead use `set search_path = ''` (empty) per RESEARCH Pitfall 4 hardening.
```sql
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_users a where a.id = (select auth.uid()) and a.role = 'admin'); $$;
```

### Caller-auth client (never service-role on the claim path)
**Source:** `platform/supabase/server.ts` lines 13-38 (caller-auth) + `platform/auth/role.ts` lines 8,12-13 (usage).
**Apply to:** `platform/transfers/claim.ts` and BOTH live gate tests' claim calls. Service-role (`platform/supabase/admin.ts`) is **test-seeding only** (D-04).
```ts
import { createClient } from "@/platform/supabase/server";
const supabase = await createClient();   // anon key + cookie-bound JWT → auth.uid() is the real driver
```

### FLAGGED migration header + Balkanity-only guardrail
**Source:** `supabase/migrations/0004_transfer_entity.sql` lines 1-8; asserted by `platform/rls/payments-schema.test.ts` lines 87-90.
**Apply to:** `0005_claim_correctness.sql` header AND `claim-schema.test.ts` guardrail assertion. The strings `qyhdogajtmnvxphrslwm` and `Kalvia (utyatpadtibqqswsfvtr)` are load-bearing (Pitfall 6: never apply to Kalvia).

### Source-level contract test (strip comments, assert shape, Nyquist-red)
**Source:** `platform/rls/payments-schema.test.ts` lines 14-29 (read + comment-strip) and 11-13 (Nyquist baseline note).
**Apply to:** `claim-schema.test.ts`. The comment-strip prevents a commented-out clause from satisfying/breaking the contract.

### Adversarial-gate test scaffolding (Nyquist-red, live-seeding-gated)
**Source:** `tests/e2e/webhook-forged.spec.ts` lines 3-21 + `tests/e2e/success-spoof.spec.ts` lines 3-20.
**Apply to:** both `tests/claim/*.gate.test.ts`. Carry the "NYQUIST BASELINE … RED now, do NOT stub" + "PREREQUISITES (live TEST-DB seeding behind the signed-off apply)" comment blocks; gate live state-read assertions behind the seeding helper.

### No second `paid` writer / no write policy
**Source:** `platform/payments/single-writer.test.ts` (the existing grep gate, lines 56-75) + `0004` no-write-policy lock (lines 46-47).
**Apply to:** `0005` must NOT add any `for update` RLS policy and the claim RPC must NEVER set `status='paid'` (only `paid → claimed`). `single-writer.test.ts` MUST stay green after Phase 5 (RESEARCH Test Map line 500).

---

## No Analog Found

None. Every Phase 5 file has a strong in-repo analog. The only design choice without a direct precedent is the **masked-read mechanism** (security_invoker view vs SECURITY DEFINER function) — this is RESEARCH Open Q1 (lines 449-454), a planner/sign-off decision, NOT a missing analog. Both options reuse the `0002`/`0004` SECURITY DEFINER + RLS patterns above.

## Metadata

**Analog search scope:** `supabase/migrations/` (0001-0004), `platform/supabase/`, `platform/transfers/`, `platform/rls/`, `platform/payments/`, `platform/auth/`, `tests/e2e/`.
**Files read this session:** `0002_supply_tables.sql`, `0004_transfer_entity.sql`, `platform/transfers/lifecycle.ts`, `platform/rls/payments-schema.test.ts`, `platform/supabase/server.ts`, `platform/supabase/admin.ts`, `platform/auth/role.ts`, `tests/e2e/webhook-forged.spec.ts`, `tests/e2e/success-spoof.spec.ts`, `platform/payments/single-writer.test.ts`.
**Pattern extraction date:** 2026-06-19
