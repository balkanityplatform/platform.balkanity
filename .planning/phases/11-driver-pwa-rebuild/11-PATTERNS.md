# Phase 11: Driver PWA Rebuild - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 13 (4 new, 8 restyle, 1 modify)
**Analogs found:** 13 / 13 (every file has a strong in-repo analog)

> Presentation-only re-skin. Every backend primitive (`wp_pool()`, `claim_transfer`, `advanceStatus`, claiming-driver RLS, auth) is reused VERBATIM. The reuse surface below was read in full this session — excerpts are exact, with file paths + line numbers. Planner: copy the named patterns; do NOT touch action/RPC/RLS internals.

---

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `app/driver/layout.tsx` | NEW | layout/provider | request-response (RSC chrome) | `app/driver/{page,run/page,settings/page}.tsx` header blocks + `app/layout.tsx` | role-match (no nested layout exists yet) |
| `app/driver/_nav/DriverBottomNav.tsx` | NEW | component (client island) | event-driven (routing/highlight) | `platform/ui/LanguageToggle.tsx` + `usePathname` islands | role-match |
| `app/driver/_ui/icons.tsx` | NEW | utility (assets) | static | `app/(guest)/_pass/icons.tsx` | exact |
| `app/driver/run/[id]/DetailView.tsx` | NEW | component (client island) | event-driven (advance write) | `RunView.tsx` advance logic (lines 67-83, 129-146) | exact (logic), role-match (island) |
| `app/driver/settings/actions.ts` (add `signOutAction`) | MODIFY | service (server action) | request-response (auth) | `app/driver/settings/actions.ts` existing action skeleton; RESEARCH §Code Examples | role-match |
| `app/driver/page.tsx` | RESTYLE | controller (RSC) | CRUD-read | self (header moves to layout) | exact |
| `app/driver/PoolView.tsx` | RESTYLE | component (client island) | event-driven (claim) | self + `RouteMotif`/`StatusDot pill` | exact |
| `app/driver/run/page.tsx` | RESTYLE | controller (RSC) | CRUD-read | self | exact |
| `app/driver/run/RunView.tsx` | RESTYLE | component (client island) | event-driven (advance) | self (keep ordering + Completed-today) | exact |
| `app/driver/run/[id]/page.tsx` | RESTYLE | controller (RSC) | CRUD-read | self (swap stepper, pass props to island) | exact |
| `app/driver/settings/page.tsx` | RESTYLE | controller (RSC) | CRUD-read | self + `auth.getUser()` identity | exact |
| `app/driver/settings/DigestPreferenceCard.tsx` | RESTYLE | component (client island) | event-driven (pref save) | self (chrome only) | exact |
| `platform/i18n/{en,bg}.ts` | MODIFY | config (i18n) | static | self (append keys to both) | exact |

---

## Pattern Assignments

### `app/driver/layout.tsx` (NEW — layout, D-01)

**Analog:** the duplicated `<header>` blocks in `PoolView.tsx` (lines 151-170), `RunView.tsx` (lines 151-170), `settings/page.tsx` (lines 59-70), `run/[id]/page.tsx` (lines 89-97). No nested layout exists today — root `app/layout.tsx` is the only layout. This file CONSOLIDATES the four headers + the bell seed.

**Header markup to lift (verbatim from `PoolView.tsx` lines 151-170):**
```tsx
<header className="flex items-center justify-between border-b border-grey/20 bg-white px-[24px] py-[16px]">
  <span className="inline-flex items-center">
    <Image src="/brand/balkanity-logo.png" alt="Balkanity" width={96} height={96} className="h-[28px] w-auto" />
  </span>
  <span className="inline-flex items-center gap-[8px]">
    <NotificationBell initial={bellInitial} lang={lang} copy={bellCopy} />
    <LanguageToggle current={lang} label={copy.langToggle} />
  </span>
</header>
```

**Bell seed (lift from `app/driver/page.tsx` line 43):** `const bellInitial = await readOwnNotifications();` — a layout RSC may call this (it is server-side). After lifting, DELETE the `<header>` + `bellInitial`/`bellCopy` props from all four pages/islands (Pitfall 1 — avoid double bell render).

**Shell shape (RESEARCH Pattern 2):**
```tsx
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const bellInitial = await readOwnNotifications();
  return (
    <div className="min-h-dvh bg-white pb-[calc(64px+env(safe-area-inset-bottom))]">
      <header>{/* logo · NotificationBell · LanguageToggle */}</header>
      <main>{children}</main>
      <DriverBottomNav lang={lang} copy={{ navAvailable, navMyTrips, navProfile }} />
    </div>
  );
}
```
Imports: `getDict, getLang` from `@/platform/i18n/dictionary`; `readOwnNotifications` from `@/platform/notifications/feed`; `NotificationBell` from `@/platform/ui/NotificationBell`; `LanguageToggle` from `@/platform/ui/LanguageToggle`.

---

### `app/driver/_nav/DriverBottomNav.tsx` (NEW — client island, DUI-02)

**Analog:** `platform/ui/LanguageToggle.tsx` (small client island taking a `current` + `label`/copy prop bag). Active-state via `usePathname()` from `next/navigation`.

**Contract (UI-SPEC line 148):** fixed to viewport bottom, white bg, 1px top border (`border-grey/20`), `pb-[env(safe-area-inset-bottom)]`. Three tabs (line-icon + 12px/600 label): Available `/driver`, My Trips `/driver/run`, Profile `/driver/settings`. Active = teal icon+label (+ teal indicator); inactive = slate/grey. ≥44px hit target per tab.

**Active state:** `const pathname = usePathname();` — My Trips tab also active on `/driver/run/[id]` (D-02). Note `/driver` is an exact match (not prefix) so it doesn't light up under `/driver/run`.

**Geometry note:** the 12px/600 nav label is the ONE deliberate sub-14px exception (UI-SPEC Typography line 88) — icons carry redundant signal.

---

### `app/driver/_ui/icons.tsx` (NEW — assets)

**Analog:** `app/(guest)/_pass/icons.tsx` (EXACT — copy the structure).

**`baseProps` factory pattern to mirror (lines 13-26):**
```tsx
function baseProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round",
    strokeLinejoin: "round", "aria-hidden": true, ...props };
}
export function PlaneIcon(props: SVGProps<SVGSVGElement>) { return <svg {...baseProps(props)}>...</svg>; }
```
Reuse `PlaneIcon`/`BuildingIcon`/`CalendarIcon`/`ClockIcon`/`PeopleIcon` verbatim (import from the guest module OR re-declare in same style). ADD: `LuggageIcon` + 3 nav-tab icons (Available/MyTrips/Profile) in the same 1.5px-stroke literal-path style. NEVER Material Symbols / re-drawn logo / invented loop.

---

### `app/driver/run/[id]/DetailView.tsx` (NEW — client island, DUI-04)

**Analog:** `RunView.tsx` advance logic — copy `nextEdgeCta` (lines 67-83) and `onAdvance` (lines 129-146) VERBATIM, changing only the `en_route` label.

**Next-forward-edge resolution (RunView.tsx lines 71-82):**
```tsx
const next = ALLOWED_TRANSITIONS[status].find((s) => s !== "cancelled" && s !== "paid");
if (!next) return null;
const labelByNext: Partial<Record<TransferState, string>> = {
  en_route: copy.advanceToEnRouteCta,
  arrived: copy.driverConfirmArrivalCta, // NEW KEY — "Confirm arrival" for the en_route→arrived edge
  picked_up: copy.advanceToPickedUpCta,
  completed: copy.advanceToCompletedCta,
};
```
> Note: "Confirm arrival" labels the **en_route → arrived** edge (status `en_route`, `next === "arrived"`). Key the label on `next`, exactly as `labelByNext` does.

**Advance handler (RunView.tsx lines 129-146):** `useTransition` + `advanceStatus(id)`; on `!result.ok` → `setToast(copy.advanceFailedToast)` (coral). Import `advanceStatus` from `../../actions` (it lives in `app/driver/actions.ts`, NOT touched). Import `ALLOWED_TRANSITIONS` from `@/platform/transfers/lifecycle`, `TransferState` from `@/platform/ui/StatusDot`.

**RSC wiring:** `app/driver/run/[id]/page.tsx` reads the row (unchanged) and passes `{ id, status: row.status, copy }` to `<DetailView />`. The server action cannot be invoked from the RSC — the island holds the interaction (Pitfall 2: this CTA must be CREATED, not restyled).

---

### `signOutAction` in `app/driver/settings/actions.ts` (MODIFY — D-05, the lone new write)

**Analog:** existing `saveDigestPreference` skeleton in the same file (`"use server"` + `createClient` from `@/platform/supabase/server`). Sign-out is far simpler — auth/session only, no zod, no service-role, no schema.

**Exact shape (RESEARCH §Code Examples, lines 328-339):**
```ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/platform/supabase/server";
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
```
> Does NOT trip the schema/auth review gate beyond a normal sign-out. No payload, no RLS, no table.

---

### `app/driver/page.tsx` + `PoolView.tsx` (RESTYLE — DUI-01 / DUI-05)

**Analog:** self. Keep VERBATIM: the masked read `await supabase.rpc("wp_pool")` (page line 40), the `PoolRow` map (lines 45-55, 9 columns, zero PII keys), the focus+25s poll (`PoolView.tsx` lines 96-121), and the claim branch (lines 127-145):
```tsx
const result = await claimAction(id);
if (result.ok) { router.push(`/driver/run/${id}`); return; }            // WIN
if (result.reason === "already_claimed") {                              // LOSE (neutral)
  setToast({ message: copy.claimLostToast, tone: "neutral" });
  setRows((prev) => prev.filter((r) => r.id !== id)); return;
}
setToast({ message: copy.claimFailedToast, tone: "error" });           // ERROR
```

**Restyle the card** (replaces `PoolView.tsx` lines 184-220):
- Status badge: today renders `<StatusDot state="paid" />` (line 193). REPLACE with the coral "Unclaimed" presentation — `<StatusDot state="..." variant="pill" />` rendered coral + worded label, OR a coral pill using the new `driverUnclaimedBadge` key. **Do NOT add a `"unclaimed"` `TransferState` or edit `STATE_META`** (Pitfall 5). `StatusDot variant="pill"` + coral is the DS-02 mechanism (StatusDot.tsx lines 87-98).
- Route: `<RouteMotif start={{ icon: <PlaneIcon/>, label: r.airport ?? copy.airportLabel }} end={{ icon: <BuildingIcon/>, label: r.zone ?? copy.zoneLabel }} />` (RouteMotif props lines 22-35).
- Money: `fmtEur(r.amount_cents)` (already imported, line 33).
- CTA: `<Button className="w-full" disabled={claimingId===r.id} onClick={() => onClaim(r.id)}>{copy.claimTransferCta}</Button>` — Button is 52px/≥44px by construction (Button.tsx line 21).
- DELETE the `<header>` (lines 151-170) — moves to layout.

---

### `app/driver/run/page.tsx` + `RunView.tsx` (RESTYLE — DUI-03)

**Analog:** self. MUST KEEP (RunView.test.tsx source-grep gate, Pitfall 4): `arrival_at` ASC sort (lines 123-126), the `completedToday` partition on `status === "completed"` (line 127), and the `completedTodayTitle` / "Completed today" `<details>` block (lines 229-253). Keep `nextEdgeCta`/`onAdvance` unchanged.

**Restyle the trip card** (lines 191-222): add per-row `<StatusDot state={r.status} />` (real state, NOT a coral override here — Claimed=teal/En route=amber/Completed=grey/Cancelled=hollow ring per STATE_META lines 35-43), `RouteMotif` or compact teal route line (Open Question 2 — full motif may be too tall in a dense list; executor's call), teal details link to `/driver/run/${r.id}` (existing pattern lines 199-206). NO earnings/ratings. DELETE the `<header>` (lines 151-170).

---

### `app/driver/run/[id]/page.tsx` (RESTYLE — DUI-04)

**Analog:** self. The single mandated component swap (line 100):
```tsx
// REMOVE: import { LifecycleTimeline } ... ; <LifecycleTimeline current={row.status as TransferState} />
import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";
<LifecycleStepper current={row.status as TransferState} />   // props: { current: TransferState } (LifecycleStepper.tsx line 45)
```
Keep the row read (lines 64-77, claiming-driver RLS) VERBATIM. Keep `Fact` blocks (lines 40-50) but replace hardcoded English captions (lines 107-121: "Arrival"/"Flight"/"Fare"/"Passengers"/"Luggage"/"Guest name"/"Guest phone"/"Notes") with NEW dictionary keys (Pitfall 6). Pass `{ id, status, copy }` to the new `DetailView` island for the Confirm-Arrival CTA. DELETE the back-link `<header>` (lines 89-97) — nav now lives in the layout (D-02: My Trips tab stays active here).

---

### `app/driver/settings/page.tsx` + `DigestPreferenceCard.tsx` (RESTYLE — D-03/D-04)

**Analog:** self. Add the identity header using the existing verified session (page already calls `auth.getUser()` at lines 36-41):
```tsx
const { data: { user } } = await supabase.auth.getUser();   // already present (line 37-38)
// identity header: user.email (always present); name optional from user_metadata or driver_profiles.name
```
Discretion A1: use `driver_profiles.name` if reliably present (it is read at `app/driver/actions.ts` line 70), else email alone (D-03 permits). NO avatar photo — initials chip permitted.

Compose top→bottom (D-03): identity header → restyled `<DigestPreferenceCard />` (chrome only; behaviour at DigestPreferenceCard.tsx unchanged) → `<LanguageToggle />` as a settings row → sign-out button wired to `signOutAction`. DELETE the `<header>` (lines 59-70) — moves to layout. NO earnings/ratings/stats (D-04 truthfulness guard).

---

### `platform/i18n/en.ts` + `bg.ts` (MODIFY — parity gate)

**Analog:** self. `Dict = typeof en`; `bg: Dict` — a missing key fails `tsc` (Pitfall 6). Add to BOTH files: `navAvailable`, `navMyTrips`, `navProfile`, `driverUnclaimedBadge`, `driverConfirmArrivalCta`, `driverSignOutCta`, plus detail-grid caption keys replacing the hardcoded English in `[id]/page.tsx` and any trip-card captions. REUSE verbatim where present: `claimTransferCta`, `claimLostToast`, `claimFailedToast`, `poolEmptyHeading/Body`, `myRunTitle`, `runEmptyHeading/Body`, `completedTodayTitle`, `advanceTo*Cta`, `advanceFailedToast`, `airportLabel`, `zoneLabel`, `addressLabel`, `langToggle`.

---

## Shared Patterns

### RSC server-guard → resolve copy → prop bag to client island
**Source:** `app/driver/page.tsx` lines 28-33.
**Apply to:** all four driver RSC routes (preserve exactly).
```tsx
export const dynamic = "force-dynamic";
export default async function Page() {
  if ((await getCurrentRole()) !== "driver") redirect("/sign-in");
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  // ...read data, render <Island copy={{...}} lang={lang} />
}
```
`getCurrentRole()` revalidates the JWT (never `getSession` — CLAUDE.md authz rule).

### Warm-light chrome tokens
**Source:** all driver pages.
**Apply to:** the new layout + every restyled surface.
- Page/card bg `bg-white`; cards `rounded-md border border-grey/30 bg-white p-[16px] shadow-sm`.
- Headings slate `text-slate`; meta `text-grey`; accent `text-teal`.
- Mobile gutter `px-[24px]`, content column `max-w-2xl` centered.

### Toast feedback
**Source:** `PoolView.tsx` lines 226-234 / `RunView.tsx` lines 256-260.
**Apply to:** claim, advance, sign-out error surfaces.
```tsx
<div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-50 flex justify-center px-[24px]">
  <Toast message={msg} tone={tone /* "neutral" | "error" */} onDismiss={() => setToast(null)} />
</div>
```
Neutral tone for already-claimed (NOT an error, D-03); coral `error` for genuine failures.

### Gated service-role write (DO NOT re-implement — reuse)
**Source:** `app/driver/actions.ts` `advanceStatus` (lines 135-208) + `settings/actions.ts` `saveDigestPreference`.
**Apply to:** nothing new — `advanceStatus`/`saveDigestPreference` reused verbatim from the islands. `createAdminClient()` is invoked ONLY inside `"use server"` actions, never a client component.

---

## No Analog Found

None. Every file maps to an in-repo analog. The only near-miss is `app/driver/layout.tsx` (no nested layout exists yet) — but its content is the four existing `<header>` blocks consolidated, so the analog is concrete (header markup above + RESEARCH Pattern 2).

---

## Metadata

**Analog search scope:** `app/driver/**`, `platform/ui/**`, `app/(guest)/_pass/**`, `platform/i18n/**`, `platform/transfers/**`, `app/layout.tsx`.
**Files scanned (read in full this session):** `app/driver/{page,PoolView,actions}.tsx`, `app/driver/run/{page,RunView}.tsx`, `app/driver/run/[id]/page.tsx`, `app/driver/settings/{page,actions,DigestPreferenceCard}.tsx`, `platform/ui/{LifecycleStepper,StatusDot,RouteMotif,Button}.tsx`, `app/(guest)/_pass/icons.tsx`, `platform/i18n/en.ts` (head).
**Pattern extraction date:** 2026-06-22
