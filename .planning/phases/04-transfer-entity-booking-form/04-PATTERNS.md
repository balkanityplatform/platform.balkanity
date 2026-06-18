# Phase 4: Transfer Entity + Booking Form - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 12 new + 3 modified
**Analogs found:** 15 / 15 (every new/modified file maps to a proven in-repo analog)

> Phase 4 is ~80% wiring of already-proven pieces. Almost every file copies a Phase 1/2/3 analog verbatim in shape. The only genuinely new engineering is migration `0004` (lifecycle trigger + guest-self-read RLS) and threading a validated `next` param through the existing `/auth/confirm` route. Excerpts below are concrete (file + line range); planner copies from them directly.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0004_transfer_entity.sql` | migration | schema | `supabase/migrations/0003_payments_spine.sql` + `0002_supply_tables.sql` | role-match (ALTER + trigger + RLS; trigger is net-new shape) |
| `app/pickup/[slug]/actions.ts` (`createBooking`) | server action | request-response → CRUD insert | `app/admin/destinations/actions.ts` `createDestination` (lines 78-161) + `app/pay/start/route.ts` | exact (zod-at-boundary + service-role insert + 303-redirect to Checkout) |
| `app/pickup/[slug]/page.tsx` | route (RSC) | request-response (public read) | `app/pay/success/page.tsx` (RSC server read) | role-match (public read vs admin read) |
| `app/pickup/[slug]/BookingForm.tsx` | component (client island) | form / request-response | `app/admin/destinations/DestinationForm.tsx` (lines 79-279) | exact (`useActionState` + TextField + pending-disable) |
| `platform/ui/PaxStepper.tsx` | component (new primitive) | event-driven (local state) | `platform/ui/TextField.tsx` (props-spread native control) + DestinationForm controlled-state pattern | role-match (new primitive; copy a11y/44px + hidden-input convention) |
| `platform/ui/LifecycleTimeline.tsx` | component (new primitive) | transform (state → render) | `platform/ui/StatusDot.tsx` (lines 9-52) | exact (consumes `TransferState` union + STATE_META verbatim) |
| `app/status/[id]/page.tsx` | route (RSC) | request-response (RLS read) | `app/pay/success/page.tsx` + RESEARCH Code Example (getUser + RLS read) | role-match (cookie/anon RLS read vs service-role read) |
| `app/track/page.tsx` | route (RSC) | request-response | `app/admin/destinations/page.tsx` (server page renders island) | role-match |
| `app/track/actions.ts` (`requestStatusLink`) | server action | request-response (generateLink) | `app/admin/drivers/actions.ts` `inviteDriver` (lines 58-139) | exact (generateLink + neutral no-enumeration return) |
| `platform/transfers/lifecycle.ts` | utility | transform (transition map) | (TS mirror of the 0004 trigger; no prior TS map) | no analog (see No Analog Found) |
| `platform/transfers/confirmation-email.ts` (`sendBookingConfirmation`, STUB) | service | event-driven (off `paid`) | `app/admin/drivers/actions.ts` generateLink stub (lines 93-138) | role-match (generateLink + reveal/log, no send) |
| `app/auth/confirm/route.ts` (MODIFY: thread `next`) | route (handler) | request-response (auth) | itself (lines 29-73) — add validated `next` allowlist | exact (extend existing route) |
| `app/api/stripe/webhook/route.ts` (MODIFY: call email stub on `paid`) | route (handler) | event-driven | itself (lines 145-186) — add stub call in `processed` branch, NO new paid write | exact (extend existing sole-paid-writer) |
| `app/sw.ts` (MODIFY: add status/pickup/track to NetworkFirst) | config | — | itself (line 32 `SENSITIVE_DOCUMENT` regex) | exact |
| `platform/i18n/{en,bg}.ts` (MODIFY: add all new copy keys) | config | — | existing `Dict` type + DestinationFormCopy keying | exact (Dict parity gate) |

---

## Pattern Assignments

### `app/pickup/[slug]/actions.ts` — `createBooking` (server action, CRUD insert → redirect)

**Analog:** `app/admin/destinations/actions.ts` `createDestination` (lines 78-161) for zod-boundary + service-role insert; `app/pay/start/route.ts` (lines 38-59) for the amount-read + 303 redirect to Checkout.

**Imports + "use server" + zod boundary** (copy structure from `actions.ts` lines 1-52). Use `getDict()` for dictionary-keyed errors, NOT raw zod issues:
```typescript
"use server";
import { z } from "zod";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";
import { createCheckoutSession } from "@/platform/payments/checkout";
import { redirect } from "next/navigation";
```

**Server-trusted amount + service-role insert** (mirror `actions.ts` lines 120-138, but re-read `price_cents` by slug — Pitfall 5; NEVER accept amount from FormData):
```typescript
const admin = createAdminClient();
const { data: dest } = await admin.from("destinations")
  .select("id, price_cents, active").eq("slug", parsed.data.slug).maybeSingle();
if (!dest || !dest.active) return { status: "error", message: t.fieldRequired };
const { data: row, error } = await admin.from("wp_transfers").insert({
  destination_id: dest.id, status: "requested", amount_cents: dest.price_cents,
  guest_email: ..., guest_name: ..., guest_phone: ..., pax: ..., flight_no: ...,
  arrival_at, luggage_count: ... ?? null, notes: ... ?? null,
}).select("id").single();
```

**303-redirect to Checkout** (reuse `createCheckoutSession` verbatim — see contract `platform/payments/checkout.ts` lines 28-40; `app/pay/start/route.ts` line 49-59 shows the call + redirect). Do NOT catch-and-swallow `redirect()`'s `NEXT_REDIRECT` (Anti-pattern):
```typescript
const url = await createCheckoutSession({ transferId: row.id, amountCents: dest.price_cents });
if (!url) return { status: "error", message: t.saveFailed };
redirect(url); // 303 — or return url to a client useActionState that assigns location
```

> Note: `createDestination` re-gates `getCurrentRole() !== "admin"` (line 84) — **omit this gate for the guest booking action** (the booking surface is public; there is no role to check). The trust boundary here is the zod schema + the server-re-read amount, not a role gate.

---

### `app/pickup/[slug]/page.tsx` (RSC, public read)

**Analog:** `app/pay/success/page.tsx` (lines 14-46) — `export const runtime = "nodejs"`, `await searchParams`/`params`, `.maybeSingle()` read, render-from-data. For the public destination read, use the new `destinations_public_active_read` anon-read RLS policy (migration 0004) OR a service-role read (acceptable, non-PII). Render `fmtEur(price_cents)` (`platform/money/commission.ts`) + the `BookingForm` island + the BOOK-04 disclosure `Card` above the CTA. Inactive/unknown slug → neutral "not available" state (UI-SPEC lines 171-176).

---

### `app/pickup/[slug]/BookingForm.tsx` (client island)

**Analog:** `app/admin/destinations/DestinationForm.tsx` (lines 79-279) — the canonical `useActionState` form island.

**Hook + pending-disable** (lines 92-95, 267-270):
```typescript
const [state, formAction, pending] = useActionState(createBooking, initialState);
// ...
<form action={formAction} className="flex flex-col gap-[16px]">
  <Button type="submit" disabled={pending}>{copy.continueToPayment}</Button>
```

**Copy-passed-in-from-server pattern** (lines 51-77): define a `BookingFormCopy` type, pass dictionary-resolved strings from the server page (no flash), interpolate `{placeholders}` with the local `fill()` helper (lines 75-77). Map field/generic errors from `state.message` exactly as lines 147-162. Use `TextField` for name/email/phone/flight/notes; native `date`/`time` inputs styled via TextField; `PaxStepper` for pax+luggage; a native checkbox (≥44px) gating the CTA for the BOOK-04 disclosure (UI-SPEC line 228).

---

### `platform/ui/PaxStepper.tsx` (new primitive)

**Analog:** `platform/ui/TextField.tsx` (lines 8-49) for the props-spread + label + ≥44px geometry contract; DestinationForm controlled-state (lines 99-119) for the `useState`+hidden-input pattern.

Build: `−` / value / `+`, each a **≥44px square** tap target; value `text-[16px]`; `−` disabled at `min` (1), `+` disabled at 8 (UI-SPEC line 41, 229). Emit a hidden `<input name="pax">` so the server action reads it from FormData. Reuse for luggage with `min={0}`, no upper cap. Use the locked brand classes (`text-slate`, `focus-visible:outline-teal`) exactly as TextField line 38.

---

### `platform/ui/LifecycleTimeline.tsx` (new primitive)

**Analog:** `platform/ui/StatusDot.tsx` (lines 9-52) — consume the `TransferState` union and the `StatusDot` component **verbatim**. NEVER invent a new state→colour map (Don't-Hand-Roll lock).

```typescript
import { StatusDot, type TransferState } from "@/platform/ui/StatusDot";
// vertical ordered list of the 8 states in lifecycle order; each row = <StatusDot state={s} />
// + muted timestamp/empty-state; current row emphasised; future rows muted (grey, reduced opacity);
// `cancelled` rendered as a distinct terminal coral row only when reached (UI-SPEC lines 110-120, 233).
```

---

### `app/status/[id]/page.tsx` (RSC, RLS-gated read)

**Analog:** `app/pay/success/page.tsx` (structure) + RESEARCH Code Example (RLS read). Use the **cookie-bound anon client** `createClient()` from `platform/supabase/server.ts` (NOT service-role), `export const runtime = "nodejs"`, and `auth.getUser()` (NEVER `getSession()` — Pitfall 6, `server.ts` lines 4-6 lock):
```typescript
import { createClient } from "@/platform/supabase/server";
export const runtime = "nodejs";
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser(); // revalidates JWT
// RLS guest-self-read policy authorizes; no row → session-expired / not-yours state
const { data: transfer } = await supabase.from("wp_transfers")
  .select("id, status, amount_cents, paid_at, arrival_at, flight_no, pax, driver_id")
  .eq("id", id).maybeSingle();
```
Render `LifecycleTimeline` + "Paid €X on {date}" receipt (`fmtEur(amount_cents)`) + driver name/phone ONLY when `status` ∈ {claimed,en_route,arrived,picked_up,completed} (D-06 render-time gate). Session-expired → "Get a new link" CTA → `/track`.

---

### `app/track/actions.ts` — `requestStatusLink` (server action) + `app/track/page.tsx`

**Analog:** `app/admin/drivers/actions.ts` `inviteDriver` (lines 58-139) — the `generateLink` + neutral-no-enumeration template. Use `type: "magiclink"`, the **trusted `NEXT_PUBLIC_SITE_URL`** base (lines 83-86; WR-04), and always return the neutral success copy (UI-SPEC line 216 — no account enumeration, mirror the `driverAlreadyInvited` generic-copy ethos lines 104-108):
```typescript
const base = process.env.NEXT_PUBLIC_SITE_URL;
const admin = createAdminClient();
const { data } = await admin.auth.admin.generateLink({
  type: "magiclink", email: parsed.data.email,
  options: { redirectTo: `${base}/auth/confirm?type=magiclink&next=/status/${transferId}` },
});
// data.properties.action_link → the link (drivers/actions.ts line 138 consumes this shape)
// Phase 4: reveal/log; Phase 7: Resend send. ALWAYS return neutral success (no enumeration).
```
`page.tsx` is a server page rendering a `useActionState` email-only island (DestinationForm shape, single TextField + primary Button).

---

### `platform/transfers/confirmation-email.ts` — `sendBookingConfirmation` (STUB service)

**Analog:** `app/admin/drivers/actions.ts` generateLink stub (lines 93-138, reveal-not-send). `import "server-only"`. Build the magic link via `generateLink({type:"magiclink", redirectTo: ${SITE_URL}/auth/confirm?type=magiclink&next=/status/<id>})`, render the template, **`console.info` the link — do NOT send** (Phase 7 swaps the body to `resend.emails.send`). Keep the single call-site signature stable. **Must contain no `status: "paid"` string** (single-writer grep gate, RESEARCH A2).

---

### `app/api/stripe/webhook/route.ts` (MODIFY — call stub on `paid`, add NO paid writer)

**Analog:** itself (lines 145-186). Add the `sendBookingConfirmation(transferId, guestEmail)` call **inside the existing `processed` branch** (after the successful `paid` UPDATE, around line 182), guarded log-and-continue so a failed send does not roll back the paid write. Do NOT add a second `status: "paid"` write — the `.update({ status: "paid", ... }).neq("status","paid")` at lines 148-158 stays the sole writer (single-writer.test.ts gate).

---

### `app/auth/confirm/route.ts` (MODIFY — thread validated `next`)

**Analog:** itself (lines 29-72). The route currently hardcodes `/` for `magiclink` (line 51). Add a `next` param read + **allowlist** it to internal `^/status/[0-9a-f-]{36}$` only (open-redirect / WR-03 ethos already used for the `type` allowlist at lines 39-46); default `/`. Apply the validated `next` as the `magiclink` `verifiedDest` so the guest lands on `/status/<id>`.

---

### `supabase/migrations/0004_transfer_entity.sql` (FLAGGED — sign-off before apply)

**Analog:** `0003_payments_spine.sql` (header guardrail lines 1-32: Balkanity ref `qyhdogajtmnvxphrslwm` ONLY, never Kalvia; "no write policy — service-role only" lock) + `0002` admin-read/`is_admin()` pattern. Three parts:

1. **ALTER `wp_transfers`** — add NULL-able PII + lifecycle columns (guest_name, guest_email, guest_phone, pax, luggage_count, flight_no, arrival_at, notes, driver_id) so existing Phase-3 seed rows survive (RESEARCH Runtime State, A3). Keep the existing no-write-policy lock (0003 lines 75-89).
2. **BEFORE-UPDATE trigger** `wp_enforce_transfer_transition` — the full 8-state map (RESEARCH Pattern 2). Net-new shape; copy from RESEARCH lines 248-283. MUST include `requested → paid` (Pitfall 4). Triggers fire even on service-role (only RLS is bypassed).
3. **Guest-self-read RLS** — `(select auth.jwt() ->> 'email') = guest_email` (NOT deprecated `auth.email()` — RESEARCH State of the Art). Coexists with the existing `wp_transfers_admin_read` (0003 lines 85-86). Plus `destinations_public_active_read` for anon: `using ( active = true )` (Pattern 4; 0002 deferred this to Phase 4).

---

## Shared Patterns

### Server-trusted amount (never from client)
**Source:** `app/pay/start/route.ts` lines 38-52; `platform/payments/checkout.ts` lines 28-40.
**Apply to:** `createBooking` — re-read `destinations.price_cents` server-side; pass to both the row and `createCheckoutSession`. Never read amount from FormData (Pitfall 5).

### zod-at-the-trust-boundary + dictionary-keyed errors
**Source:** `app/admin/destinations/actions.ts` lines 43-52, 91-111 (and `drivers/actions.ts` 49-78).
**Apply to:** `createBooking`, `requestStatusLink`. Use `getDict()`; return generic dictionary-keyed messages, never raw zod issues.

### Service-role write, RLS-read tables, NO write policy
**Source:** `0003_payments_spine.sql` lines 75-89; `createAdminClient` used in `actions.ts` line 120, webhook line 70.
**Apply to:** all `wp_transfers` writes (booking insert via service-role; the only reader policy added in 0004 is guest-self-read SELECT).

### `auth.getUser()` for authz, never `getSession()`
**Source:** `platform/supabase/server.ts` lines 4-6.
**Apply to:** `app/status/[id]/page.tsx` (Pitfall 6).

### Trusted `NEXT_PUBLIC_SITE_URL` for constructed URLs
**Source:** `app/admin/drivers/actions.ts` lines 83-99 (`generateLink` redirectTo); `checkout.ts` lines 14-17.
**Apply to:** magic-link `redirectTo` in `confirmation-email.ts` + `requestStatusLink`. Never the request Origin (WR-04).

### `generateLink` → `data.properties.action_link` (reveal, no send in Phase 4)
**Source:** `app/admin/drivers/actions.ts` lines 93-138.
**Apply to:** `confirmation-email.ts`, `requestStatusLink`.

### useActionState client-island form (copy-passed-from-server, pending-disable)
**Source:** `app/admin/destinations/DestinationForm.tsx` lines 92-95, 51-77, 147-162, 267-270.
**Apply to:** `BookingForm.tsx`, `track/page.tsx` island.

### StatusDot / TransferState as the sole lifecycle source of truth
**Source:** `platform/ui/StatusDot.tsx` lines 9-52.
**Apply to:** `LifecycleTimeline.tsx`, `status/[id]/page.tsx`. Never a second state→colour map.

### NetworkFirst for sensitive documents
**Source:** `app/sw.ts` line 32 `SENSITIVE_DOCUMENT` regex.
**Apply to:** add `status|pickup|track` to the regex so guest pages are never served stale (Pitfall 2).

### Dict parity (all copy in en.ts + bg.ts)
**Source:** `platform/i18n/dictionary.ts`; `DestinationFormCopy` keying (DestinationForm lines 51-72).
**Apply to:** every new Phase 4 copy key (UI-SPEC Copywriting Contract) — `tsc` Dict parity gate fails on a missing key.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `platform/transfers/lifecycle.ts` | utility | transform | No prior TS transition-map exists. It is the TS mirror of the new 0004 trigger map (RESEARCH Pattern 2). Build it as a plain `Record<TransferState, TransferState[]>` consuming `StatusDot`'s `TransferState` union, with `lifecycle.test.ts` asserting every legal/illegal pair. Provides friendly app-layer errors; the DB trigger is the hard backstop (D-08). |
| `0004` BEFORE-UPDATE trigger (within the migration) | migration | schema | No prior trigger in this repo (0001-0003 are tables + RLS only). The trigger SQL shape comes from RESEARCH Pattern 2 (PostgreSQL trigger docs), not an in-repo analog — though the migration *header/RLS/comment* conventions copy 0003 verbatim. |

---

## Metadata

**Analog search scope:** `app/admin/{destinations,drivers}/`, `app/pay/`, `app/auth/confirm/`, `app/api/stripe/webhook/`, `platform/{ui,supabase,payments,i18n}/`, `supabase/migrations/`.
**Files scanned:** ~14 (early-stopped at strong matches).
**Pattern extraction date:** 2026-06-18
