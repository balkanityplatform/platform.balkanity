---
phase: 11-driver-pwa-rebuild
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/driver/layout.tsx
  - app/driver/_nav/DriverBottomNav.tsx
  - app/driver/_ui/icons.tsx
  - app/driver/page.tsx
  - app/driver/PoolView.tsx
  - app/driver/run/page.tsx
  - app/driver/run/RunView.tsx
  - app/driver/run/[id]/page.tsx
  - app/driver/run/[id]/DetailView.tsx
  - app/driver/settings/page.tsx
  - app/driver/settings/actions.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the driver-facing PWA rebuild surface (shell layout, bottom nav, icons, pool, my-run list, run detail, settings) plus the supporting server actions and lifecycle/claim/role primitives they call.

**Project-invariant verdict (all PASS):**
- **No pre-claim PII leak.** `app/driver/page.tsx` and `refetchPool` read ONLY the masked `wp_pool()` RPC on the caller-auth anon client; `PoolView` renders only the 9 non-PII columns. No address/phone/name/notes/email key is ever projected on the pool path. Post-claim PII (`run/page.tsx`, `run/[id]/page.tsx`) is read on the caller-auth client gated by the claiming-driver RLS — correct.
- **`paid` is never written by any UI path.** The only writes in scope are `advanceStatus` (forward lifecycle edges, explicitly filtering out `paid` and `cancelled`) and the digest-preference update. The lifecycle map's forward-edge filter plus the migration-0004 trigger backstop hold.
- **Atomic claim intact.** `claimAction` → `claimTransfer` is a pure pass-through to the caller-auth `claim_transfer` RPC; service-role is never used on the claim path; first-to-claim semantics are preserved.
- **Sign-out / advance use the correct clients.** `signOutAction` uses the `@supabase/ssr` caller-auth client (not auth-helpers, not service-role). `advanceStatus` re-gates with `auth.getUser()` + role + ownership before the service-role write.

The defects below are correctness/robustness/quality issues, not invariant breaches. The most material is a "Completed today" section that is not actually bounded to today and grows unbounded.

## Warnings

### WR-01: "Completed today" section is unbounded — never filtered to today

**File:** `app/driver/run/page.tsx:31-43`, `app/driver/run/RunView.tsx:127,238-264`
**Issue:** The UI section is labeled `completedTodayTitle` ("Completed today") and the count `({completedToday.length})`, but the query selects EVERY `completed` row this driver owns with no date bound:
```ts
.in("status", ["claimed", "en_route", "arrived", "picked_up", "completed"])
.order("arrival_at", { ascending: true });
```
`RunView` then does `completed.filter((r) => r.status === "completed")` — also no date filter. After the pilot accumulates trips, this `<details>` block lists the driver's entire completed history under a "today" heading. This is a correctness defect (label lies) and a growing payload. `arrival_at` is also the wrong field to bound on even if a filter were added (a transfer arriving tomorrow could be completed today only via lifecycle, but "today" should key on completion time, not arrival).
**Fix:** Bound the completed bucket to the current local day. Preferred: add a `completed_at`/`last_action_at` timestamp filter in the query (`gte` start-of-day). If no completion timestamp column exists, either (a) rename the copy to "Completed" and drop the "today" claim, or (b) filter client-side on a real completion timestamp:
```ts
const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
const completedToday = completed.filter(
  (r) => r.completed_at && new Date(r.completed_at) >= startOfDay,
);
```

### WR-02: `.single()` on the detail read throws on legitimate not-found / RLS-empty instead of rendering notFound()

**File:** `app/driver/run/[id]/page.tsx:68-79`
**Issue:** The detail row is read with `.single()`. `.single()` returns a PostgREST error (PGRST116) when zero rows match — which is exactly the expected case when the driver does NOT own the claim (claiming-driver RLS returns 0 rows) or the id is bogus. The code reads `data` and checks `if (!row) notFound()`, but with `.single()` the zero-row case populates `error`, not a null `data` — `data` is null AND there is an error, so `row` is null and `notFound()` is reached only incidentally. More importantly, `error` is discarded (`const { data } = ...`), so a genuine transport error is silently treated as "not found" too. The intent ("render 404 when the driver doesn't own it") works by luck of `data` being null, but conflates real errors with absent rows.
**Fix:** Use `.maybeSingle()` (returns `data: null`, no error, on zero rows) and inspect `error` explicitly, matching the discipline in `role.ts`:
```ts
const { data, error } = await supabase
  .from("wp_transfers")
  .select("...")
  .eq("id", id)
  .maybeSingle();
if (error) { /* log + notFound() or a generic error */ }
const row = data as DetailRow | null;
if (!row) notFound();
```

### WR-03: Pool reads (`page.tsx` / `refetchPool`) silently swallow RPC errors, masking outages as an empty pool

**File:** `app/driver/page.tsx:39-41`, `app/driver/actions.ts` (`refetchPool`)
**Issue:** Both call `const { data } = await supabase.rpc("wp_pool")` and discard `error`, then `(data ?? [])`. A transient RPC failure, RLS/grant misconfig, or a paused Supabase project renders an indistinguishable **empty pool** ("No transfers available") rather than an error state. For a driver whose livelihood is claiming from this pool, a silent "nothing here" during an outage is a real operational failure — the driver assumes there is no work when the read actually failed. This contradicts the error-vs-empty discipline the codebase deliberately applies in `role.ts` and `claim.ts`.
**Fix:** Capture and branch on `error`. At minimum log it server-side; ideally surface a distinct "could not load pool, retry" state vs the genuine empty state. For `refetchPool`, throw on error so the existing `catch` in `PoolView.poll()` keeps the last-good pool instead of replacing it with `[]`:
```ts
const { data, error } = await supabase.rpc("wp_pool");
if (error) throw error; // poll() catch keeps last-good rows; page can render an error band
```

### WR-04: `run/page.tsx` discards the query error and casts straight to `RunRow[]`

**File:** `app/driver/run/page.tsx:31-39`
**Issue:** Same pattern as WR-03 on the My-Run list: `const { data } = await ...; const rows = (data ?? []) as unknown as RunRow[];`. A failed read renders the empty-run state ("nothing claimed") even when the driver has active claims and the read merely failed — a driver could believe they lost a claim. The `as unknown as RunRow[]` double-cast also defeats type checking on the join shape; if the `destinations(...)` embed returns an array (PostgREST returns embedded to-one relations as objects, but a misconfigured FK relationship returns an array), the cast hides it and `r.destinations?.airport` silently yields `undefined`.
**Fix:** Capture `error`, log/branch it, and validate the row shape (zod or a narrow runtime guard) rather than a blind double-cast — especially for the `destinations` embed which the UI dereferences as a single object.

### WR-05: `advanceStatus` always `revalidatePath("/driver/run")` — the detail route is not revalidated

**File:** `app/driver/actions.ts` (`advanceStatus`), consumed by `app/driver/run/[id]/DetailView.tsx`
**Issue:** `DetailView` (on `/driver/run/[id]`) calls the SAME `advanceStatus`, whose only cache invalidation is `revalidatePath("/driver/run")`. After a successful advance from the **detail page**, the detail route (`/driver/run/[id]`) is not in the revalidated path set, so the `LifecycleStepper` and the next-edge CTA on the page the driver is looking at may render stale until a hard navigation. The DetailView comment claims "the server revalidate refreshes the detail at the new status," but the action does not revalidate the detail path.
**Fix:** Revalidate both paths the action serves, or revalidate the layout segment:
```ts
revalidatePath("/driver/run");
revalidatePath(`/driver/run/${transferId}`);
```
(Or accept the path from the caller and revalidate it.)

## Info

### IN-01: Bottom nav `aria-label` reuses the "Available" tab label as the whole landmark name

**File:** `app/driver/_nav/DriverBottomNav.tsx:60`
**Issue:** `<nav aria-label={copy.navAvailable}>` labels the entire navigation landmark with the text "Available" (the first tab's label), which is misleading to screen-reader users — the landmark is the driver navigation, not "Available."
**Fix:** Add a dedicated nav-landmark copy key (e.g. `t.driverNavLabel` = "Driver navigation") and use it for the landmark `aria-label`, keeping `navAvailable` for the tab.

### IN-02: Duplicated advance-CTA logic across `RunView` and `DetailView` (acknowledged "verbatim copy")

**File:** `app/driver/run/RunView.tsx:71-95` and `app/driver/run/[id]/DetailView.tsx:46-77`
**Issue:** The next-forward-edge resolution + `useTransition` advance handler is copied verbatim between the two islands (the file headers state this explicitly). The only divergence is the `en_route→arrived` label. Two copies of the same gating logic drift independently over time (e.g. WR-05's revalidate fix, or a future edge-filter change, must be remembered in both).
**Fix:** Extract a shared `useAdvance(id)` hook and a `resolveNextEdge(status, labelMap)` helper into a co-located module; pass the differing label map in. Behaviour stays identical; one source of truth for the gate.

### IN-03: `firstName` / `initials` empty-string edge handling

**File:** `app/driver/actions.ts` (`firstName`), `app/driver/settings/page.tsx:39-44` (`initials`)
**Issue:** `firstName("")` → `"".split(/\s+/)` yields `[""]`, so it returns `""` (the `?? name` fallback never fires because index 0 is `""`, not `undefined`). Minor: a profile name that is whitespace-only produces an empty driver name in the guest "assigned" email. `initials` is guarded (`filter(Boolean)` → `"?"`), so it is fine; flagging `firstName` only.
**Fix:** Guard explicitly: `const first = name.trim().split(/\s+/)[0]; return first || name.trim();` — and the caller already requires `p?.name` truthy, so impact is low.

### IN-04: `localeCompare` arrival sort is locale-sensitive on ISO strings

**File:** `app/driver/run/RunView.tsx:126`
**Issue:** `a.arrival_at.localeCompare(b.arrival_at)` sorts ISO-8601 timestamp strings via locale collation. ISO-8601 is lexicographically ordered so this is correct in practice, but `localeCompare` is the wrong tool (locale-dependent, slower) for a fixed-format timestamp; the RSC already orders, making this purely defensive.
**Fix:** Use a plain string compare or `Date` compare: `(a, b) => (a.arrival_at < b.arrival_at ? -1 : a.arrival_at > b.arrival_at ? 1 : 0)`.

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
