---
phase: 06-driver-admin-views
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/admin/page.tsx
  - app/admin/transfers/TransfersView.tsx
  - app/admin/transfers/[id]/RefundForm.tsx
  - app/admin/transfers/[id]/TransferDetailView.tsx
  - app/admin/transfers/[id]/page.tsx
  - app/admin/transfers/actions.ts
  - app/admin/transfers/page.tsx
  - app/driver/PoolView.tsx
  - app/driver/actions.ts
  - app/driver/page.tsx
  - app/driver/run/RunView.tsx
  - app/driver/run/[id]/page.tsx
  - app/driver/run/page.tsx
  - app/sw.ts
  - platform/i18n/bg.ts
  - platform/i18n/en.ts
  - platform/payments/refund.ts
  - platform/payments/single-writer.test.ts
  - platform/transfers/lifecycle.ts
  - platform/ui/Toast.tsx
  - supabase/migrations/0006_release_and_audit.sql
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the Phase-6 driver PWA + admin transfers console: 5 gated admin Server Actions, the driver claim/advance actions, the masked pool + run RSCs, the refund hook, the lifecycle map, the release/audit migration, the single-writer test, the SW caching rules, and the EN/BG dictionaries.

The single-`status='paid'` writer invariant holds in the source under review (only the webhook and the gated release action write paid; refund never writes paid). The release action is correctly guarded with an optimistic `.eq("status","claimed")` concurrency guard. The driver `advanceStatus` ownership gate and the masked-pool / claiming-driver RLS read paths are sound. The migration trigger correctly encodes the `claimed -> paid` release edge.

However there are **three BLOCKERs**: (1) the `assign` action sets `driver_id` but never moves `status` to `claimed`, relying on a "0004 trigger" that does not exist — assigned transfers become orphaned (gone from the pool, never in the assigned driver's run); (2) `claimAction` has **no role gate** — any authenticated principal (a guest, or a signed-in admin) can invoke a driver-only claim; (3) the `reassign` action has no state guard and writes `driver_id` directly, which can silently strand a transfer in `paid` or move ownership on a terminal row depending on lifecycle state. Six warnings cover refund/amount edge cases, missing-row handling, and audit-uid loss.

## Critical Issues

### CR-01: `assign` never moves status to `claimed` — relies on a non-existent trigger; assigned transfers are orphaned

**File:** `app/admin/transfers/actions.ts:96-126`
**Issue:** The `assign` action writes **only** `{ driver_id }` and depends on a claimed comment: "The 0004 trigger moves paid->claimed when a paid row gains a driver" (lines 17, 92-94, 117). No such trigger exists. The migration-0004 `wp_enforce_transfer_transition` (verified at `supabase/migrations/0004_transfer_entity.sql:87-121`) is a BEFORE-UPDATE *transition guard* that only validates explicit `status` changes; on a `driver_id`-only update `new.status is not distinct from old.status` is true, so it early-returns and changes nothing. 0005 and 0006 add no such status-side-effect trigger either.

Result: an admin-assigned `paid` transfer keeps `status='paid'`. It disappears from `wp_pool()` (whose predicate is `status='paid' AND driver_id IS NULL` — see `0005_claim_correctness.sql:92,152`), so no driver can claim it; and it never appears in the assigned driver's "My run", which filters `status IN (claimed,en_route,arrived,picked_up,completed)` (`app/driver/run/page.tsx:36`). The transfer is silently orphaned — a fulfilment/data-integrity failure.

**Fix:** Set the status explicitly and guard the source state so the trigger accepts the edge:
```ts
const { data, error } = await admin
  .from("wp_transfers")
  .update({ driver_id: parsed.data.driverId, status: "claimed" })
  .eq("id", parsed.data.id)
  .eq("status", "paid")        // only a paid+unclaimed row can be assigned
  .is("driver_id", null)
  .select("id");
if (error || !data || data.length === 0) {
  return { status: "error", message: t.saveFailed };
}
```
(If "assign onto an already-claimed row" must also be supported, that is a `reassign`, not `assign` — keep them separate. See CR-03.)

### CR-02: `claimAction` has no role gate — any authenticated user (incl. admin/guest) can claim

**File:** `app/driver/actions.ts:34-36`
**Issue:** `claimAction` is a `"use server"` action that calls `claimTransfer` with **no `getCurrentRole() === "driver"` check**. The header comment asserts "claim.ts is the authority ... NEVER the service-role." That is true for *driver derivation* (the RPC keys the driver off `auth.uid()`), but it does not constrain *who* may call the action. Server Actions are directly invocable POST endpoints; any signed-in principal — a guest session, or an admin — can fire `claimAction(id)`. Per `0005_claim_correctness.sql:58` the RPC is documented as "Restricted to drivers + admins (D-06); a guest caller [is rejected]", so a guest may be stopped at the RPC, but an **admin** caller would succeed and become the claiming driver of a transfer, which is an authorization violation (admins manage, drivers fulfil). The other genuinely-new driver write, `advanceStatus`, *does* gate on `getCurrentRole()==='driver'` (line 81) — `claimAction` is inconsistent and unguarded.

**Fix:** Re-gate at the action boundary, mirroring `advanceStatus`:
```ts
export async function claimAction(transferId: string): Promise<ClaimResult> {
  if ((await getCurrentRole()) !== "driver") {
    return { ok: false, reason: "forbidden", transfer: null };
  }
  return claimTransfer(transferId);
}
```
Do not rely solely on RPC-internal role checks; the action is the public surface.

### CR-03: `reassign` has no state guard and writes `driver_id` without touching `status` — can strand or mis-own a transfer

**File:** `app/admin/transfers/actions.ts:131-167`
**Issue:** `reassign` updates `{ driver_id, last_action_* }` with only `.eq("id", …)` — no `.eq("status","claimed")` guard and no status write. Two failure modes:
1. If invoked on a `paid` (unclaimed) row, it sets a `driver_id` but leaves `status='paid'` — the same orphaning as CR-01 (gone from pool, absent from the new driver's run).
2. On a terminal/advanced row (`completed`, `cancelled`, `en_route`, …) it silently rewrites `driver_id`, transferring ownership/PII visibility of an in-progress or finished run to a different driver with no lifecycle legality check (the transition trigger never fires because status is unchanged).

The action header claims the "migration-0004/0006 trigger is the hard state-legality backstop," but the trigger only governs `status` transitions — it does **not** police `driver_id` reassignment. So there is no backstop here.

**Fix:** Constrain reassign to a currently-claimed row and verify the write landed:
```ts
const { data, error } = await admin
  .from("wp_transfers")
  .update({ driver_id: parsed.data.driverId, last_action_reason: parsed.data.reason,
            last_action_by: await actingAdminId(), last_action_at: new Date().toISOString() })
  .eq("id", parsed.data.id)
  .eq("status", "claimed")     // only an actively-claimed transfer can be reassigned
  .select("id");
if (error || !data || data.length === 0) return { status: "error", message: t.saveFailed };
```

## Warnings

### WR-01: `refund` partial-amount bound check misses zero/sub-cent rounding and uses the wrong error copy

**File:** `app/admin/transfers/actions.ts:304-311`
**Issue:** `amountCents = Math.round(parsed.data.amount * 100)` can round a tiny positive euro value (e.g. `0.004`) to `0`. The zod `refine` only enforces `v > 0` on the *euro* input, not on the rounded cents, so a `0`-cent refund could reach `refundPayment` and either no-op or error opaquely. Also, the over-amount rejection returns `t.fieldRequired` ("This field is required.") which is misleading copy for an out-of-range amount.
**Fix:** After rounding, reject `amountCents <= 0` as well, and use a dedicated/`saveFailed`-style message:
```ts
if (amountCents !== undefined && (amountCents <= 0 || amountCents > row.amount_cents)) {
  return { status: "error", message: t.saveFailed };
}
```

### WR-02: `refund` does not verify the transfer is in a refundable state — a cancelled/unpaid row can be refunded

**File:** `app/admin/transfers/actions.ts:294-322`
**Issue:** The action only checks that `stripe_payment_intent_id` is present; it does not check `status`. A `cancelled` or otherwise non-paid row that still carries a payment-intent id can be refunded, and there is no guard against refunding a transfer whose money was never actually captured. The idempotency key protects against *double*-refunding the same (transfer, amount) but not against refunding the wrong-state row.
**Fix:** Read `status` alongside the intent id and refuse unless the row represents captured money (e.g. `paid`/`claimed`/`en_route`/… — any state reached only after a verified `paid`). At minimum reject `requested`. This is a money-movement guard, not cosmetic.

### WR-03: Admin detail page treats "row not found" and "RLS-denied / transport error" identically

**File:** `app/admin/transfers/[id]/page.tsx:32-68`
**Issue:** `const { data } = await ...single()` discards `error`. `.single()` errors (zero rows, multiple rows, or an RLS/transport failure) all collapse into `data === null` → the generic "empty" view. A genuine backend/RLS misconfiguration is rendered to the admin as "this transfer doesn't exist," masking real failures (the same error-vs-empty discipline `role.ts` and `claim.ts` deliberately follow). 
**Fix:** Destructure `error`, log it, and render a distinct error state (or `notFound()` only on the genuine zero-row case) rather than folding all failures into the empty view.

### WR-04: `actingAdminId()` can write `last_action_by = null`, silently losing the audit author

**File:** `app/admin/transfers/actions.ts:84-90,156,204,253,330`
**Issue:** `actingAdminId()` returns `null` when `auth.getUser()` yields no user. Because the role gate runs earlier this is unlikely, but if the session lapses between the gate and the write, the audit columns persist `last_action_by: null` while still performing the privileged service-role mutation — an audit-integrity gap for D-15 (the whole point of these columns). The two `getUser()` round-trips (role gate + `actingAdminId`) are also redundant.
**Fix:** Resolve the uid once at the top, and abort if it is null:
```ts
const adminId = await actingAdminId();
if (!adminId) return { status: "error", message: t.saveFailed };
```
Then reuse `adminId` in the update payload — never write a null author on a privileged mutation.

### WR-05: Driver run detail / list discard the query `error`, masking RLS/transport failures

**File:** `app/driver/run/[id]/page.tsx:66-77`, `app/driver/run/page.tsx:31-39`
**Issue:** Both reads do `const { data } = await ...` and ignore `error`. On the detail page a transient RLS/transport error becomes `notFound()` (line 76) — indistinguishable from "you don't own this claim." On the list page an error becomes an empty run. Same error-vs-empty conflation as WR-03; for the driver this can hide a real outage as "no work."
**Fix:** Capture and log `error`; differentiate a transport error from a legitimately empty/own-less result.

### WR-06: `refetchPool` and pool RSC swallow the RPC `error` and treat failures as an empty pool

**File:** `app/driver/actions.ts:40-55`, `app/driver/page.tsx:39-51`
**Issue:** `const { data } = await supabase.rpc("wp_pool")` ignores `error`; a failed RPC yields `data ?? []` → an empty pool rendered as "No transfers to claim." A driver could see an empty pool during an RLS/transport fault and assume there is no work, when transfers are in fact waiting. (The live poll in `PoolView` has its own catch that keeps the last-good pool, but the initial RSC render and the action both hard-empty on error.)
**Fix:** Surface RPC errors distinctly (log + keep last-known or show a transient error state) rather than collapsing every failure into the empty-pool copy.

## Info

### IN-01: `computeNeedsAttention` contains a dead branch

**File:** `app/admin/transfers/page.tsx:60-66`
**Issue:** Branch (a) is gated on `unclaimed`, but the function already `return true`d for every `unclaimed` row at line 54. The block is unreachable; the inline comment even acknowledges it is "already covered by the always-true branch." Dead code that future maintainers may mistake for live logic.
**Fix:** Delete the (a) block, or restructure if the intent is to broaden "unclaimed" beyond `status==='paid'` later (then make that intent real rather than a no-op).

### IN-02: Assign-driver inputs accept free text but the action requires a UUID — guaranteed validation failure on mistyped ids

**File:** `app/admin/transfers/[id]/TransferDetailView.tsx:214-219,398-403`
**Issue:** The `driverId` inputs are `type="text"` with no pattern; the server (`assignSchema`/`reassignSchema`, `z.string().uuid()`) rejects anything non-UUID with the generic "field required" copy. Admins paste/type driver ids by hand (per the dictionary `transferDriverIdLabel: "Driver id"`), so a trivially mistyped id produces an opaque error. Not a security issue (server validates), but a real UX/usability defect for the ops console.
**Fix:** Ideally replace the raw id input with a driver picker; at minimum add `pattern`/inline validation and return a more specific "invalid driver id" message.

### IN-03: `AssignForm` receives the full `copy` bag but uses none of it

**File:** `app/admin/transfers/[id]/TransferDetailView.tsx:195-235`
**Issue:** `AssignForm` is passed `copy: TransferDetailCopy` (line 204, 380) but only consumes the explicitly-passed `driverIdLabel`/`confirmCta`; the `copy` prop is unused dead weight.
**Fix:** Drop the `copy` prop from `AssignForm`.

### IN-04: SW `SENSITIVE_DOCUMENT` does not cover `/track` (guest re-access link) but the regex's `/track/` intent is ambiguous

**File:** `app/sw.ts:32-33`
**Issue:** The NetworkFirst regex includes `track` but the guest re-access route is `/track` (per `en.ts` `trackTitle` / route `/track`) while `/status` is covered. This is fine for `/track` itself, but the comment lists "any future booking/claim/status route" as MUST-NetworkFirst; `/pickup` is matched but the booking confirmation / `/pay/success` paths are not in the list. Worth a deliberate audit so a future sensitive route is not silently served stale.
**Fix:** Add an explicit allow-list comment of every sensitive route and confirm `/pay/success` (display-only) is intentionally cacheable.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
