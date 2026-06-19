# Phase 6: Driver & Admin Views - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 16 (new) + 2 (modified)
**Analogs found:** 16 / 16 (every new file has a strong in-repo analog; zero "no analog")

This phase is **thin UI + new gated Server Actions over a locked data layer** — almost everything copies an existing, adversarially-proven pattern. The two genuinely new shapes (the refund payments hook, the sign-off-gated migration delta) still have direct structural analogs in-repo.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/driver/page.tsx` | route (RSC page) | request-response (read) | `app/admin/drivers/page.tsx` | role-match (driver chrome vs slate) |
| `app/driver/PoolView.tsx` | component (client island) | event-driven (poll/focus refetch) | `app/admin/drivers/DriversView.tsx` | role-match |
| `app/driver/run/page.tsx` | route (RSC page) | request-response (read) | `app/admin/drivers/page.tsx` | exact (server-guard + RLS read) |
| `app/driver/run/RunView.tsx` | component (client island) | request-response + CTA | `app/admin/drivers/DriversView.tsx` | role-match |
| `app/driver/run/[id]/page.tsx` | route (RSC page) | request-response (read) | `app/admin/drivers/page.tsx` | role-match |
| `app/driver/actions.ts` | service (Server Actions) | CRUD (claim + advance write) | `platform/transfers/claim.ts` (claim) + `app/admin/companies/actions.ts` (advance) | exact / role-match |
| `app/admin/transfers/page.tsx` | route (RSC page) | request-response (read + filter/sort) | `app/admin/drivers/page.tsx` | exact |
| `app/admin/transfers/TransfersView.tsx` | component (client island) | event-driven (filter/search state) | `app/admin/drivers/DriversView.tsx` + `platform/ui/DataList.tsx` | exact |
| `app/admin/transfers/[id]/page.tsx` | route (RSC page) | request-response (read single + join) | `app/admin/drivers/page.tsx` | exact |
| `app/admin/transfers/[id]/TransferDetailView.tsx` | component (client island) | CRUD (action buttons + dialogs) | `app/admin/companies/CompaniesView.tsx` + `app/admin/drivers/InviteDriverForm.tsx` | role-match |
| `app/admin/transfers/[id]/RefundForm.tsx` | component (client island) | request-response (form) | `app/admin/drivers/InviteDriverForm.tsx` | role-match |
| `app/admin/transfers/actions.ts` | service (Server Actions) | CRUD (assign/reassign/release/cancel/refund) | `app/admin/companies/actions.ts` | exact |
| `platform/payments/refund.ts` | service (server-only hook) | request-response (external Stripe) | `platform/payments/stripe.ts` + `platform/payments/fee.ts` | role-match (new seam, established posture) |
| `platform/ui/Toast.tsx` | component (presentational) | event-driven (transient feedback) | `app/admin/drivers/InviteDriverForm.tsx` `role="status"` block | partial (closest in-repo feedback pattern) |
| `supabase/migrations/0006_*.sql` (NEW) | migration | schema/DDL (trigger edge + audit columns) | `supabase/migrations/0005_claim_correctness.sql` + `0004_transfer_entity.sql` | exact |
| `platform/i18n/en.ts` + `bg.ts` (MODIFIED) | config (dictionary) | transform | existing `en.ts`/`bg.ts` keys | exact |
| `platform/payments/single-writer.test.ts` (MODIFIED) | test | contract | existing `single-writer.test.ts` | exact |

---

## Shared Patterns

These cross-cutting patterns apply to MULTIPLE new files. Apply them everywhere the table above indicates the corresponding role.

### Server-guarded RSC page → dictionary-resolved prop bag → client island
**Source:** `app/admin/drivers/page.tsx` (lines 14-70)
**Apply to:** ALL five page.tsx (`app/driver/page.tsx`, `app/driver/run/page.tsx`, `app/driver/run/[id]/page.tsx`, `app/admin/transfers/page.tsx`, `app/admin/transfers/[id]/page.tsx`)
```typescript
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";

export default async function TransfersPage() {
  if ((await getCurrentRole()) !== "admin") {       // "driver" on the /driver/* pages
    redirect("/sign-in");
  }
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const supabase = await createClient();            // ANON cookie-bound → RLS exercised (NOT service-role)
  const { data } = await supabase.from("wp_transfers").select(/* … */).order("arrival_at", { ascending: true });
  return <TransfersView rows={data ?? []} lang={lang} copy={{ /* explicit dict keys */ }} />;
}
```
**Rules locked by the analog:** role gate is `getCurrentRole()` + `redirect("/sign-in")` (never `getSession()`, never UI-only). Reads use the **anon cookie-bound `createClient()`** so RLS is the data gate. Copy is resolved server-side and handed as an **explicit per-key prop bag** (no flash, PLAT-04). `Promise.all` the dict+lang+reads.

### Slate console chrome (admin surfaces)
**Source:** `app/admin/drivers/DriversView.tsx` (lines 51-83)
**Apply to:** `TransfersView.tsx`, `TransferDetailView.tsx`
```tsx
<main className="min-h-dvh bg-white">
  <header className="flex items-center justify-between bg-slate px-[24px] py-[16px]">
    <span className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px]">
      <Image src="/brand/balkanity-logo.png" alt="Balkanity" width={96} height={96} className="h-[28px] w-auto" />
    </span>
    <LanguageToggle current={lang} label={copy.langToggle} className="text-white" />
  </header>
  <section className="mx-auto flex max-w-2xl flex-col gap-[32px] px-[24px] py-[48px]">
    <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">{copy.transfersTitle}</h1>
    {/* … */}
  </section>
</main>
```
**Driver surfaces** use the same outer shape but **warm-light chrome** (white header w/ teal accents per UI-SPEC) — mirror the structure, swap the `bg-slate` header.

### Gated service-role write action (the authz boundary for ALL non-claim writes)
**Source:** `app/admin/companies/actions.ts` (lines 1-22, 35-63, 99-144) + `app/admin/drivers/actions.ts` (lines 58-68)
**Apply to:** `app/admin/transfers/actions.ts` (assign/reassign/release/cancel/refund), `app/driver/actions.ts` (advanceStatus)
```typescript
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";

export async function cancelTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getDict();
  if ((await getCurrentRole()) !== "admin") return { status: "error", message: t.saveFailed };  // THE authz gate (service-role bypasses RLS)
  const parsed = schema.safeParse({ id: formData.get("id"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: t.fieldRequired };
  const admin = createAdminClient();
  const { error } = await admin.from("wp_transfers").update({ /* … */ }).eq("id", parsed.data.id);
  if (error) return { status: "error", message: t.saveFailed };
  revalidatePath(`/admin/transfers/${parsed.data.id}`);
  return { status: "success" };
}
```
**Rules locked by the analog:** in-action `getCurrentRole()` re-gate is the ONLY authz gate (service-role bypasses RLS); zod at the trust boundary; **generic dictionary-keyed errors only** (never leak provider detail); `createAdminClient()` for the write; `revalidatePath` after. The migration-0004 trigger is the hard state-legality backstop — trust it, don't re-implement legality in the action.

### Driver-action ownership check (the EOP gate on advanceStatus)
**Source:** RESEARCH Pattern 4 (no direct in-repo analog for driver writes — none exist yet); authz shape from `app/admin/drivers/actions.ts` lines 66-68
**Apply to:** `app/driver/actions.ts` `advanceStatus`
```typescript
const supabase = await createClient();                       // caller-auth to read identity
const { data: { user } } = await supabase.auth.getUser();
if (!user || (await getCurrentRole()) !== "driver") return { status: "error", message: t.saveFailed };
const admin = createAdminClient();
const { data: row } = await admin.from("wp_transfers").select("status,driver_id").eq("id", id).single();
if (!row || row.driver_id !== user.id) return { status: "error", message: t.saveFailed };   // OWNERSHIP gate (Pitfall 1)
const next = /* resolve via ALLOWED_TRANSITIONS[row.status], the single forward driver edge */;
const { error } = await admin.from("wp_transfers").update({ status: next })
  .eq("id", id).eq("status", row.status);                    // optimistic-concurrency guard, NOT a read-then-claim
```
**Critical:** drivers have NO RLS write policy — service-role is required, so the `driver_id === user.id` ownership check is the only thing stopping a driver advancing another's transfer.

### `import "server-only"` boundary on money/secret modules
**Source:** `platform/payments/stripe.ts` (line 1), `platform/payments/fee.ts` (line 1), `platform/supabase/admin.ts` (line 1)
**Apply to:** `platform/payments/refund.ts` (first line)
```typescript
import "server-only";   // FIRST line — next build FAILS if a client component imports this (secret-key leak guard)
```

### Lifecycle legality via the shared map (never hand-rolled)
**Source:** `platform/transfers/lifecycle.ts` (lines 22-39)
**Apply to:** the advance-CTA next-edge resolution in `app/driver/actions.ts` + `RunView.tsx`
```typescript
import { ALLOWED_TRANSITIONS, canTransition } from "@/platform/transfers/lifecycle";
const next = ALLOWED_TRANSITIONS[current].find(s => s !== "cancelled"); // the single forward driver edge
```
The TS map is cosmetic/friendly; the migration-0004 trigger is the hard backstop. Do not re-encode the state machine.

### Status display: dot+label everywhere (WCAG 1.4.1, never colour-alone)
**Source:** `platform/ui/StatusDot.tsx` (full file) + `platform/ui/LifecycleTimeline.tsx` (lines 25-67)
**Apply to:** every pool/run/list/detail row and the "needs attention" coral marker. Coral rows MUST carry a text marker (`needsAttentionBadge`), never coral background alone.

---

## Pattern Assignments

### `app/driver/actions.ts` (service, CRUD — claim + advance)

**Claim path analog:** `platform/transfers/claim.ts` — **consume it, do not reimplement.**
- Claim CTA wraps `claimTransfer(id)` → branches on `result.ok` (claim.ts lines 29-59). Winner: render detail from `result.transfer` (D-02, no follow-up fetch). Loser `reason==="already_claimed"`: neutral toast + remove card (D-03). NEVER the service-role client on the claim path (claim.ts lines 8-11).

**Advance path analog:** the "Driver-action ownership check" shared pattern above. No driver write path exists today (RESEARCH Pitfall 1) — this is genuinely new; mirror `companies/actions.ts` authz shape + add the ownership gate.

---

### `app/admin/transfers/page.tsx` (route, request-response — list with filter/search/sort)

**Analog:** `app/admin/drivers/page.tsx` (the shared server-guard pattern) + RESEARCH Pattern 3 for the query shape.

**Read shape** (admin RLS via `wp_transfers_admin_read`, anon cookie client):
```typescript
let q = supabase.from("wp_transfers")
  .select("id,status,arrival_at,guest_name,flight_no,driver_id,amount_cents, destinations!inner(zone,airport,address)")
  .order("arrival_at", { ascending: true });        // soonest first (D-07)
if (statusFilter) q = q.in("status", statusFilter);
if (search) q = q.or(`guest_name.ilike.%${s}%,flight_no.ilike.%${s}%`);
```
Compute `needsAttention` per row in the RSC (D-09 simple constants), then stable-sort coral rows to top (D-07). Destination-name search is cleanest done in-RSC for the pilot (RESEARCH A3). This page reads **unmasked** rows (admin RLS) — distinct from the driver pool which uses the masked `wp_pool()` RPC.

---

### `app/admin/transfers/TransfersView.tsx` (component, event-driven — filter/search island)

**Analog:** `app/admin/drivers/DriversView.tsx` (slate chrome + list) + `platform/ui/DataList.tsx` (list row primitive, lines 29-62).
- Reuse `DataList` row shape OR the `<ul>` divide pattern (DriversView lines 94-108) for rows that need lifecycle StatusDot + coral marker.
- Filter chips / search box hold client state and re-query; render `StatusDot` per row; coral "needs attention" rows pinned top with the `needsAttentionBadge` text marker.

---

### `app/admin/transfers/[id]/page.tsx` + `TransferDetailView.tsx` (detail + actions)

**Page analog:** `app/admin/drivers/page.tsx` server-guard; read single unmasked row + joined destination, render `LifecycleTimeline current={row.status}` (timeline analog lines 25-67) + trip/payment facts.

**View analog:** `app/admin/companies/CompaniesView.tsx` (action-button layout) + `app/admin/drivers/InviteDriverForm.tsx` (`useActionState` form + `role="status"`/`role="alert"` feedback, lines 28-117).
- Five action controls: assign (one-tap, no reason — D-10), reassign/release/cancel/refund (confirm dialog + required reason — D-10). Destructive buttons use `--coral` (`Button` ghost/variant; Button.tsx lines 12-28).
- Cancel never auto-refunds — only offers the `cancelOfferRefundCta` shortcut (D-11).

---

### `app/admin/transfers/actions.ts` (service, CRUD — assign/reassign/release/cancel/refund)

**Analog:** `app/admin/companies/actions.ts` (the multi-mutation file with per-action re-gate + zod + service-role write + revalidate; lines 35-189). Each of the five exports follows that exact skeleton.
- **assign/reassign:** set `driver_id` on a `paid`/`claimed` row (clean — no status regression).
- **cancel:** trigger-legal `→ cancelled` edge from any pre-pickup state.
- **release:** **the one non-clean op** — see the migration assignment below; writes `driver_id=null, status='paid'` via the NEW trigger-legal `claimed→paid` edge, restricted to `status='claimed'` (D-14). This is the sole, narrow place a gated service-role action writes `paid` (D-15) — never a client, and the webhook stays the only OTHER `paid` writer.
- **refund:** wraps `platform/payments/refund.ts`; resolves `stripe_payment_intent_id` from the row; persists `last_action_reason`/by/at (D-15); NEVER writes `status='paid'`. See RESEARCH Code Example lines 404-423.

---

### `platform/payments/refund.ts` (service, server-only hook — NEW seam)

**Analog:** `platform/payments/stripe.ts` (server-only factory posture, lines 1-29) + `fee.ts` (server-only, recorded-truth discipline).
```typescript
import "server-only";
import { getStripe } from "@/platform/payments/stripe";
export async function refundPayment(opts: {
  paymentIntentId: string;
  amountCents?: number;                              // omit → full refund (D-12 full/partial)
  reason?: "requested_by_customer";
  idempotencyKey: string;                            // Pitfall 3 — stable key prevents double-refund
}) {
  return getStripe().refunds.create(
    { payment_intent: opts.paymentIntentId, amount: opts.amountCents, reason: opts.reason ?? "requested_by_customer" },
    { idempotencyKey: opts.idempotencyKey },
  );
}
```
**Disclosure (D-12):** reuse `recordedFeeCents()` from `fee.ts` for the "~€X processing fee NOT recovered" figure (`refundFeeDisclosure` key). The Stripe `reason` enum (`requested_by_customer`) is distinct from the D-10 free-text audit reason stored on the row (RESEARCH A4).

---

### `platform/ui/Toast.tsx` (component, presentational — NEW)

**Analog (partial):** `app/admin/drivers/InviteDriverForm.tsx` `role="status"` feedback block (lines 52-79) — closest in-repo transient-feedback shape. Compose Montserrat 14px/16px tokens, neutral surface for the lost-claim toast (NOT an error/coral state — D-03), coral only for genuine transport errors.

---

### `supabase/migrations/0006_*.sql` (migration — NEW, sign-off-gated/BLOCKING)

**Analog:** `supabase/migrations/0005_claim_correctness.sql` (header + Balkanity-only guardrail + re-runnability discipline) and `0004_transfer_entity.sql` (the trigger being AMENDED, lines 87-127, + the `add column if not exists` ALTER pattern, lines 49-60).

**Two minimal deltas (D-14 + D-15):**
1. **Amend `wp_enforce_transfer_transition()`** to add the trigger-legal backward edge `claimed → paid` (so `release` returns a claimed transfer to `wp_pool()`, which requires `status='paid' AND driver_id IS NULL`). Mirror the existing allowed-map shape (0004 lines 103-114). **Also update `platform/transfers/lifecycle.ts` `ALLOWED_TRANSITIONS.claimed` to include `"paid"`** — the 8×8 pair test pins the two together (lifecycle.test.ts).
2. **ALTER `wp_transfers`** add `last_action_reason text`, `last_action_by uuid`, `last_action_at timestamptz` — all NULL-able, no default (0004 ALTER pattern, lines 49-60).

**Locked migration conventions to copy verbatim from 0005 header (lines 1-9):** FLAGGED/IRREVERSIBLE banner; Balkanity ref `qyhdogajtmnvxphrslwm` ONLY, NEVER Kalvia; **authored-not-applied** — live apply is a separate BLOCKING signed-off task via the Supabase **Management API** `/database/query` with `SUPABASE_ACCESS_TOKEN` (NOT MCP, NOT `supabase db push`, NOT direct psql DDL — per project memory + the 0005 header). Every statement `create or replace` / `drop if exists` / `add column if not exists` for idempotent re-run.

---

### `platform/i18n/en.ts` + `bg.ts` (MODIFIED, config)

**Analog:** existing dictionary entries. Add every key listed in 06-UI-SPEC.md "Copywriting Contract" (driver: `claimTransferCta`, `poolEmptyHeading/Body`, `claimLostToast`, `claimFailedToast`, `myRunTitle`, `runEmptyHeading/Body`, `advanceTo*Cta`, `completedTodayTitle`, `advanceFailedToast`; admin: `transfersTitle`, `filterByStatusLabel`, `needsAttentionFilterCta`, `transferSearchPlaceholder`, `transfersEmpty*`, `transfersNoMatchBody`, `needsAttentionBadge`, `assignDriverCta`, `reassignDriverCta`, `releaseTransferCta`, `cancelTransferCta`, `refundTransferCta`, `actionReasonLabel`, `refundAmountLabel`, `refundFeeDisclosure`, `cancelOfferRefundCta`, confirm strings). EN+BG parity enforced by the tsc Dict-parity gate (PLAT-04). Reuse existing `saveFailed`/`fieldRequired`.

---

### `platform/payments/single-writer.test.ts` (MODIFIED, contract test)

**Analog:** the existing file. Extend so the contract acknowledges the ONE new narrow `status='paid'` writer (the gated service-role **release** action, D-15) while still forbidding any client/webhook-bypassing `paid` write. No Phase-6 path other than release writes `paid`; the webhook remains the only OTHER writer.

---

## No Analog Found

None. Every new file maps to a strong in-repo analog. The two "new seams" (refund hook, migration delta) reuse established postures (`server-only` payments module; the 0004/0005 migration discipline).

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| (none) | — | — | All 16 new files have an exact or role-match analog. |

---

## Metadata

**Analog search scope:** `app/admin/{drivers,companies}/`, `app/api/stripe/webhook/`, `platform/{transfers,payments,ui,auth,supabase,i18n}/`, `supabase/migrations/0004-0005`
**Files scanned:** ~16 read in full or targeted
**Pattern extraction date:** 2026-06-19
