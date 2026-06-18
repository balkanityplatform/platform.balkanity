# Phase 4: Transfer Entity + Booking Form - Research

**Researched:** 2026-06-18
**Domain:** Next.js 16 App Router server actions + Stripe Checkout reuse + Supabase RLS/triggers (Postgres state machine) + passwordless magic-link guest session
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Booking form fields**
- **D-01:** Scheduling = **manual arrival date + manual arrival time** + a **required flight number**. No flight-tracking dependency in v1. The stored arrival timestamp is what the Phase 5/6 claim pool sorts on (CLAIM-06).
- **D-02:** Required fields: email, phone, guest name, passenger count, flight number, arrival date, arrival time. Optional: luggage (bag count), notes. (**Phone is required** — deliberate change from PROJECT.md "phone optional".)
- **D-03:** Passengers = integer **number stepper (1–8)** (required); luggage = integer **number of bags** (optional).
- **D-04:** **Guest name is required.** It is claim-gated PII (revealed only to the claiming driver + admin + the guest themselves).

**Status-page access (AUTH-02 — flagged auth)**
- **D-05:** Guest reaches status page via a **Supabase magic-link session**. Confirmation email carries a magic link; clicking establishes a guest auth session. Status page reads the transfer **at the data layer via RLS** — a new policy `auth.email() = wp_transfers.guest_email` — NOT service-role-by-token. **Migration `0004` adds this guest-self-read RLS policy.**
- **D-06:** **Driver first name + phone shown to the guest only after `claimed`** (deliberate reverse-PII reveal). Before claim, no driver identity.
- **D-07:** **Re-access by email** — a "track my booking" page where the guest enters their email and gets a fresh magic link. Self-service, no admin.

**Lifecycle enforcement (XFER-01 / SC5 — flagged schema)**
- **D-08:** Lifecycle transition guards are **DB-level**: a Postgres **BEFORE-UPDATE trigger** (in migration `0004`) validates every old→new `status` transition against the allowed-transition map, regardless of which client writes. This is the authority. (A thin app-layer guard for friendly errors is allowed, but the trigger is the hard backstop.)
- **D-09:** Phase 4 defines the **complete 8-state machine now** (`requested → paid → claimed → en_route → arrived → picked_up → completed` + `cancelled`), even though Phase 4 only drives `requested → paid`.
- **D-10:** **Cancellation is admin-only**, allowed only from **non-terminal pre-pickup states** (`requested`, `paid`, `claimed`, `en_route`, `arrived`) — never from `picked_up`/`completed`. The map encodes this now; the admin cancel UI lands in Phase 6.

### Claude's Discretion
- **Status-page liveness:** default to **fetch-fresh on load with NetworkFirst** (never served stale from SW cache — roadmap lock). Realtime is optional; a light poll is an acceptable middle ground. Researcher/planner territory.
- **Confirmation-email mechanic:** generate the status-page magic link via `auth.admin.generateLink({ type: 'magiclink' })`, carry it inside the (Phase-4-stubbed) confirmation email — mirroring 02-05's driver invite. Send is **stubbed** (revealed inline / logged); Phase 7 wires Resend.
- **Guest role resolution:** ensure the guest magic-link account resolves to the `guest` role (default / no `app_users` row) and never collides with admin/driver `getCurrentRole()`. Verify against the 01-03 role layer.
- Inactive-slug handling on `/pickup/<slug>` (slug exists but `active=false`), abandoned/unpaid `requested`-row handling (cleanup is Phase 8), exact form layout/microcopy, receipt format ("Paid EUR X on {date}").

### Deferred Ideas (OUT OF SCOPE)
- **Flight tracking** (auto-derive arrival from flight no.) — promote GROW-03 to a dedicated future phase post-pilot. Needs a paid flight API, polling/refresh, delay-handling UX, lookup-failure fallback. Phase 4 ships **manual** arrival date/time. Do not research flight APIs.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOK-01 | Guest opens `/pickup/<slug>` showing destination + fare | New public RSC route resolves slug → `destinations` (needs new narrow anon-read RLS policy for `active=true` slugs; see Pitfall 1). Reuses `fmtEur`. |
| BOOK-02 | Guest completes a short guestless booking form | Server action + zod at the trust boundary (mirror `app/admin/drivers/actions.ts`). Fields per D-02/D-03/D-04. UI primitives `TextField`/`Select`/`Button` reused; pax stepper is a new small island. |
| BOOK-03 | Booking creates a `requested` transfer + a code-created Checkout Session | Reuse `createCheckoutSession({transferId, amountCents})` verbatim. Insert `requested` row via service-role, then 303-redirect to `session.url`. |
| BOOK-04 | Checkout states prepaid & non-refundable before payment | Disclosure on the form/confirm step (must be visible pre-submit, not buried). Copy in en.ts/bg.ts. |
| BOOK-06 | On `paid`, guest receives a confirmation email | Hangs off the **existing** webhook `paid` transition. Phase 4 **stubs** the send (generate magic link + render template; log/reveal it). Phase 7 swaps the stub for Resend. No second `paid` writer. |
| BOOK-07 | Status page: live lifecycle timeline + visible payment receipt | New magic-link-gated status route. Timeline consumes `StatusDot`; receipt = "Paid EUR X on {date}" from `amount_cents`/`paid_at`. NetworkFirst (never SW-cached). |
| XFER-01 | Locked lifecycle requested→…→completed (+cancelled) | DB BEFORE-UPDATE trigger in migration 0004 encoding the full 8-state map (D-08/D-09/D-10). Adversarial test: every illegal transition raises. |
| AUTH-02 | Guest views status via passwordless Supabase magic link | `generateLink({type:'magiclink'})` → carry `token_hash` link → existing `/auth/confirm` route verifies via `verifyOtp` → guest `@supabase/ssr` session → RLS-gated read. |
</phase_requirements>

## Summary

Phase 4 is the first guest-facing vertical: it turns the proven Phase 3 money spine into a real booking flow. Almost nothing here is net-new infrastructure — the high-value engineering work is (1) **migration `0004`** that ALTERs the minimal `wp_transfers` into the full PII + lifecycle entity, adds a **Postgres BEFORE-UPDATE transition-guard trigger** for the whole 8-state machine, and adds a **guest-self-read RLS policy**; and (2) wiring a **passwordless magic-link guest session** onto the *existing* `/auth/confirm` route so the status page reads the transfer through RLS rather than a service-role token. The booking form itself is a straightforward server-action + zod + reuse-`createCheckoutSession` flow that mirrors the established Phase 2 admin-action pattern.

The single most important correction this research surfaces: **`auth.email()` is deprecated in Supabase.** CONTEXT.md D-05 specifies the policy shape `auth.email() = wp_transfers.guest_email`, but the current, non-deprecated, performance-correct form is **`(select auth.jwt() ->> 'email') = wp_transfers.guest_email`**. The semantics D-05 wants are identical (compare the JWT email claim to the row's stored guest email); only the helper name changes. This is a `[VERIFIED]` finding — the planner should encode the `auth.jwt()` form, not `auth.email()`.

The other load-bearing facts are all already proven in this codebase: the webhook is the *sole* `paid` writer (BOOK-06's email hangs off that existing transition — do **not** add a writer), the success page stays display-only (SC5), magic-link verification already lands on `/auth/confirm` with a `verifyOtp(token_hash)` path, and the Serwist SW already forces NetworkFirst for sensitive documents (the status route must be added to that regex). No new npm packages are required — every dependency (zod, @supabase/ssr, stripe) is already installed and locked.

**Primary recommendation:** Author migration `0004` first (flagged/irreversible — sign-off gate), using the `(select auth.jwt() ->> 'email')` RLS form and a BEFORE-UPDATE trigger encoding the full 8-state map with admin-gated cancel; then build the booking server-action (reusing `createCheckoutSession`), the `/pickup/<slug>` RSC, the magic-link status page (extending the existing `/auth/confirm` + `SENSITIVE_DOCUMENT` regex), and a stubbed confirmation-email wrapper that Phase 7 swaps for Resend. Use `auth.getUser()` for the guest session, never `getSession()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slug → destination + fare display | API/Backend (RSC server read) | Database (new anon-read RLS for active slugs) | `/pickup/<slug>` is a public RSC; the active-slug read must be authorized at the DB layer (RLS), not just the UI. |
| Booking form validation | API/Backend (server action + zod) | — | Trust boundary is server-side. Client form is dumb; zod re-validates everything (mirror Phase 2). |
| `requested` row insert | API/Backend (service-role write) | Database (`wp_transfers`) | Tables carry NO write policy → service-role only, exactly as 0002/0003. |
| Checkout Session creation | API/Backend (`createCheckoutSession`) | External (Stripe) | Reuse verbatim. Server 303-redirect to hosted Checkout (no client Stripe.js). |
| `paid` transition + confirmation email trigger | API/Backend (existing webhook, service-role) | External (Stripe HMAC) | The webhook is the **single** paid writer. Email send fires off this existing transition. |
| Lifecycle transition enforcement | **Database (BEFORE-UPDATE trigger)** | API/Backend (thin friendly-error guard) | D-08: the DB trigger is the authority regardless of which client writes. App guard is cosmetic. |
| Guest PII gating (self-read + post-claim driver reveal) | **Database (RLS policy on `wp_transfers`)** | — | D-05/D-06: RLS is the real boundary; UI masking leaks via the auto-REST API. |
| Magic-link session establishment | API/Backend (`/auth/confirm` `verifyOtp`) | External (Supabase GoTrue) | Existing route already does token_hash `verifyOtp`; reuse. Session via `@supabase/ssr` cookies. |
| Status timeline + receipt render | Frontend Server (RSC) | Browser (optional light poll for liveness) | RSC reads the RLS-scoped row; NetworkFirst keeps it fresh; optional client poll only if pilot needs live. |
| Magic-link generation for confirmation email | API/Backend (`generateLink`, service-role admin API) | — | Mirror 02-05 invite. Send STUBBED in Phase 4. |

## Standard Stack

### Core (all already installed — no new installs)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `^16.2` (16.2.9) | App Router RSC + route handlers + server actions | Locked. Booking form is a server action; `/pickup` and `/status` are RSC routes. [VERIFIED: package.json] |
| `react` | `^19.2` | UI runtime; `useActionState` form islands | Locked. The pax stepper + form error display are client islands. [VERIFIED: package.json] |
| `@supabase/ssr` | `^0.12.0` | Cookie-bound guest magic-link session (`createServerClient`, getAll/setAll) | Locked. `platform/supabase/server.ts` + `proxy.ts` already implement the getAll/setAll + getUser pattern. [VERIFIED: codebase] |
| `@supabase/supabase-js` | `^2.108.2` | `auth.admin.generateLink` (service-role) for the status magic link | Locked. `createAdminClient()` already wraps it. [VERIFIED: codebase] |
| `stripe` | `^22.2.1` | Reused via `createCheckoutSession`; no direct new usage | Locked. apiVersion `2026-05-27.dahlia` pinned. [VERIFIED: codebase] |
| `zod` | `^4.4` | Server-side booking-form validation at the trust boundary | Locked. Already used in checkout.ts + every admin action. [VERIFIED: package.json] |
| `serwist` / `@serwist/next` | `^9.5.11` | SW; status route must be added to NetworkFirst regex | Locked. `app/sw.ts` already has the `SENSITIVE_DOCUMENT` rule. [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | **No new dependency is required for Phase 4.** Realtime (if chosen for liveness) uses `@supabase/supabase-js` which is already installed; no `@supabase/realtime-js` direct dep needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NetworkFirst RSC fetch-on-load (recommended) | Supabase Realtime subscription | Realtime is "truly live" but adds a client subscription, an extra RLS-on-Realtime config surface, and complexity for a ~10-transfer pilot. Gold-plating; defer unless the pilot demands it. |
| NetworkFirst RSC fetch-on-load | Light client poll (e.g. refetch every 20–30s) | Acceptable middle ground; trivially simple. Recommend only if "open the page and watch it advance" is a real pilot need. Default to no poll (guest reloads). |
| Server 303-redirect to `session.url` | `@stripe/stripe-js` client redirect | CLAUDE.md lock + existing `pay/start` already 303-redirects. No client Stripe.js dependency. |
| `auth.email()` (D-05 wording) | **`(select auth.jwt() ->> 'email')`** | `auth.email()` is **deprecated** (see State of the Art). Same semantics; use the `auth.jwt()` form. |

**Installation:** None. All Phase 4 dependencies are already present and locked.

## Package Legitimacy Audit

**Not applicable — Phase 4 installs zero external packages.** Every library it uses (`next`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `stripe`, `zod`, `serwist`, `@serwist/next`) is already a locked, installed dependency verified in prior phases (see `package.json` and CLAUDE.md §"Sources" npm-registry pins). No slopcheck run is required because no new install occurs. If the planner discovers a need for a new package (it should not), the Package Legitimacy Gate must run before that install.

## Architecture Patterns

### System Architecture Diagram

```
GUEST (mobile PWA)
   │
   │ 1. opens /pickup/<slug>
   ▼
[/pickup/[slug]/page.tsx  (RSC)]
   │   anon Supabase client → SELECT destination WHERE slug=? AND active=true
   │   (NEW narrow anon-read RLS policy on destinations)
   │   renders: label, zone, airport, fmtEur(price_cents) + BookingForm island
   │   + BOOK-04 "prepaid & non-refundable" disclosure (visible pre-submit)
   │
   │ 2. submits form (email, phone, name, pax, flight no., arrival date+time, luggage?, notes?)
   ▼
[createBooking server action]
   │   getDict() → zod.safeParse (trust boundary; D-02/D-03/D-04 rules)
   │   re-read destination price_cents (anon or service-role) → amount_cents (server-trusted, NOT from client)
   │   createAdminClient().from('wp_transfers').insert({ status:'requested', destination_id,
   │      amount_cents, guest_email, guest_name, guest_phone, pax, luggage_count,
   │      flight_no, arrival_at, notes })  →  returns new transfer id
   │   createCheckoutSession({ transferId, amountCents })  → session.url
   │   redirect(session.url, 303)
   ▼
[Stripe hosted Checkout]  ──pays──►  Stripe fires checkout.session.completed
   │                                          │
   │ success_url 303 → /pay/success?t=<id>    │ (verified HMAC)
   ▼                                          ▼
[/pay/success  (RSC, DISPLAY-ONLY, SC5)]   [app/api/stripe/webhook/route.ts]
   reads status; NEVER writes paid           THE SOLE paid writer (service-role)
                                              UPDATE wp_transfers SET status='paid'...
                                              (BEFORE-UPDATE trigger validates requested→paid ✓)
                                                  │
                                                  │ 3. on paid transition → BOOK-06
                                                  ▼
                                       [sendBookingConfirmation()  (STUBBED wrapper)]
                                          generateLink({type:'magiclink', email:guest_email,
                                             redirectTo: ${SITE_URL}/auth/confirm?type=magiclink&next=/status/<id>})
                                          render confirmation template w/ action_link
                                          Phase 4: LOG/reveal the link (no real send)
                                          Phase 7: swap stub → Resend
                                                  │
   GUEST clicks magic link ◄───────────────────── (in confirmation email)
   │
   ▼
[/auth/confirm  (EXISTING route)]  verifyOtp({token_hash, type:'magiclink'}) → guest @supabase/ssr session cookies
   │   redirects to next (/status/<id>)
   ▼
[/status/<id>  (RSC, NetworkFirst — never SW-cached)]
   anon/cookie Supabase client → auth.getUser()  (NOT getSession)
   SELECT * FROM wp_transfers WHERE id=<id>
      └─ RLS guest-self-read policy: (select auth.jwt() ->> 'email') = guest_email
   renders: StatusDot timeline (all 8 states incl en_route) + "Paid EUR X on {date}" receipt
      + (post-claim, status>='claimed') driver first name + phone  (D-06 reverse-reveal)

[/track  (re-access page, D-07)]  guest enters email → server action generateLink → re-send/reveal fresh magic link
```

### Recommended Project Structure
```
app/
├── pickup/
│   └── [slug]/
│       ├── page.tsx          # RSC: resolve slug, show destination+fare, render form (BOOK-01)
│       ├── BookingForm.tsx    # client island: fields + pax stepper + useActionState (BOOK-02)
│       └── actions.ts         # createBooking server action: zod → insert requested → checkout (BOOK-02/03)
├── status/
│   └── [id]/
│       └── page.tsx          # RSC, NetworkFirst: magic-link-gated RLS read; timeline+receipt (BOOK-07)
├── track/
│   ├── page.tsx              # re-access by email (D-07)
│   └── actions.ts            # requestStatusLink server action (generateLink)
platform/
├── transfers/
│   ├── lifecycle.ts          # the allowed-transition map (TS mirror of the DB trigger; friendly errors)
│   ├── lifecycle.test.ts     # Wave 0: every legal/illegal transition asserted (mirrors DB map)
│   └── confirmation-email.ts # STUBBED sendBookingConfirmation() wrapper (Phase 7 swaps body)
supabase/migrations/
└── 0004_transfer_entity.sql  # FLAGGED: ALTER wp_transfers + trigger + guest-self-read RLS + anon slug-read
```

### Pattern 1: Booking server action (mirror of Phase 2 admin actions)
**What:** zod-at-the-boundary, service-role insert, then 303-redirect to Checkout. The amount is server-trusted (re-read from `destinations.price_cents`), never taken from the client.
**When to use:** the form submit.
```typescript
// Source: pattern from app/admin/destinations/actions.ts + app/pay/start/route.ts (this codebase)
"use server";
import { z } from "zod";
import { getDict } from "@/platform/i18n/dictionary";
import { createAdminClient } from "@/platform/supabase/admin";
import { createCheckoutSession } from "@/platform/payments/checkout";
import { redirect } from "next/navigation";

const bookingSchema = z.object({
  slug: z.string().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),          // D-02: phone REQUIRED
  name: z.string().trim().min(1),           // D-04: name REQUIRED (claim-gated PII)
  pax: z.coerce.number().int().min(1).max(8),// D-03: stepper 1–8
  flight_no: z.string().trim().min(1),      // D-01: REQUIRED
  arrival_date: z.string().min(1),          // combine into arrival_at server-side
  arrival_time: z.string().min(1),
  luggage_count: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().optional(),
});

export async function createBooking(_prev: BookingState, fd: FormData): Promise<BookingState> {
  const t = await getDict();
  const parsed = bookingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { status: "error", message: t.fieldRequired };

  const admin = createAdminClient();
  // amount is SERVER-trusted — re-read price from the destination, never trust client.
  const { data: dest } = await admin.from("destinations")
    .select("id, price_cents, active").eq("slug", parsed.data.slug).maybeSingle();
  if (!dest || !dest.active) return { status: "error", message: t.fieldRequired };

  const arrival_at = new Date(`${parsed.data.arrival_date}T${parsed.data.arrival_time}`).toISOString();
  const { data: row, error } = await admin.from("wp_transfers").insert({
    destination_id: dest.id, status: "requested", amount_cents: dest.price_cents,
    guest_email: parsed.data.email, guest_name: parsed.data.name, guest_phone: parsed.data.phone,
    pax: parsed.data.pax, flight_no: parsed.data.flight_no, arrival_at,
    luggage_count: parsed.data.luggage_count ?? null, notes: parsed.data.notes ?? null,
  }).select("id").single();
  if (error || !row) return { status: "error", message: t.saveFailed };

  const url = await createCheckoutSession({ transferId: row.id, amountCents: dest.price_cents });
  if (!url) return { status: "error", message: t.saveFailed };
  redirect(url); // 303 to hosted Checkout (note: redirect() throws; do not wrap in try/catch swallowing NEXT_REDIRECT)
}
```
> Note: `redirect()` throws `NEXT_REDIRECT`; in a server action prefer returning the URL to a client `useActionState` that `window.location.assign`es, OR call `redirect()` directly (it is caught by Next). The existing `pay/start` route uses `NextResponse.redirect(url, 303)`. The planner picks one; do not catch-and-swallow the redirect.

### Pattern 2: Postgres BEFORE-UPDATE lifecycle transition guard (D-08)
**What:** A trigger function that rejects any `status` change not in the allowed-transition map. This is the authority — it fires for the webhook, the future claim RPC, admin/driver writes alike.
**When to use:** added in migration `0004`; never bypassed (service-role does NOT bypass triggers — only RLS).
```sql
-- Source: PostgreSQL trigger docs (postgresql.org/docs/current/plpgsql-trigger.html) +
--         this project's "enforce at the data layer" ethos (0002/0003 pattern)
create or replace function public.wp_enforce_transfer_transition()
returns trigger
language plpgsql
as $$
begin
  -- Only guard status changes; other column updates pass through.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Allowed-transition map (D-09 full 8-state machine; D-10 admin-cancel from pre-pickup).
  if not (
    (old.status = 'requested' and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid'      and new.status in ('claimed', 'cancelled'))
    or (old.status = 'claimed'   and new.status in ('en_route', 'cancelled'))
    or (old.status = 'en_route'  and new.status in ('arrived', 'cancelled'))
    or (old.status = 'arrived'   and new.status in ('picked_up', 'cancelled'))
    or (old.status = 'picked_up' and new.status in ('completed'))
    -- 'completed' and 'cancelled' are terminal: no outbound transitions.
  ) then
    raise exception 'illegal transfer transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger wp_transfers_transition_guard
  before update on public.wp_transfers
  for each row
  execute function public.wp_enforce_transfer_transition();
```
> **D-10 nuance:** the trigger above permits `cancelled` from the five pre-pickup states, satisfying "admin-only cancel from non-terminal pre-pickup." The trigger cannot tell *who* is cancelling (it has no auth context in the service-role path); the admin-only constraint is enforced at the **app layer** (admin cancel action re-gates `getCurrentRole()==='admin'`, lands Phase 6). The trigger guarantees the *state* legality; the app guarantees the *actor* legality. Document this split in the migration comment.

> **Adversarial test (XFER-01 / SC5):** seed a `paid` transfer, attempt `paid → completed` (skip), `picked_up → cancelled` (terminal-ish), `completed → anything` → each must raise. Test via `psql`/service-role UPDATE so it proves the trigger fires even on the service-role path (triggers are NOT bypassed by service-role; only RLS is).

### Pattern 3: Guest-self-read RLS policy (D-05) — corrected helper
**What:** A SELECT policy letting a magic-link-authenticated guest read exactly their own transfer, by matching the JWT email claim to the stored `guest_email`.
**When to use:** added in migration `0004` alongside the existing `wp_transfers_admin_read`.
```sql
-- Source: Supabase RLS docs + deprecated-RLS-features (auth.email() → auth.jwt()->>'email')
--         + RLS performance best-practice (wrap auth.* in a subquery for initPlan caching).
-- D-05 wanted: auth.email() = wp_transfers.guest_email  →  current form below.
create policy "wp_transfers_guest_self_read" on public.wp_transfers
  for select to authenticated
  using ( (select auth.jwt() ->> 'email') = guest_email );
```
- Coexists with `wp_transfers_admin_read` — Postgres ORs multiple permissive SELECT policies, so admins still read everything and a guest reads only their row.
- **PII non-leak:** there is still NO write policy and NO broad read policy; an authenticated *driver* (whose JWT email ≠ guest_email) matches neither policy → zero rows. This is the data-layer guarantee Phase 5 builds on.
- **Post-claim driver reveal (D-06):** the guest's own row already contains the driver scaffold columns (e.g. `driver_id`, and the status). The status page reads driver first name + phone **only when `status` is at/after `claimed`** — this is a render-time gate on the guest's own already-authorized row, joined to `driver_profiles`. (The driver-side PII reveal — drivers seeing *guest* PII post-claim — is Phase 5; D-06 here is the *reverse* reveal, guest seeing driver contact, which is low-sensitivity and expressible at render from the guest's own row.)

### Pattern 4: Narrow anon-read for active destination slugs (BOOK-01)
**What:** `/pickup/<slug>` is public (no auth). The existing `destinations_admin_read` policy only lets admins read. A new policy must allow **anon** to read **active** destinations.
```sql
-- Source: 0002 explicitly notes "Phase 4 will add a NARROW anon/guest SELECT policy for
--         ACTIVE destination slugs only (the /pickup public read path)".
create policy "destinations_public_active_read" on public.destinations
  for select to anon, authenticated
  using ( active = true );
```
> Scope check: this exposes label/zone/airport/price/slug of **active** destinations to the public — which is exactly the booking page content (intended). It does NOT expose `commission_pct` meaningfully as a secret (it is not PII), but the planner may project only the needed columns in the query regardless. Inactive destinations return zero rows → `/pickup/<inactive-slug>` shows a "not available" state (Claude's discretion item).

### Pattern 5: Magic-link session via the EXISTING /auth/confirm route (AUTH-02)
**What:** `generateLink({type:'magiclink'})` returns an `action_link` + `hashed_token`. Build a link to the existing `/auth/confirm?token_hash=...&type=magiclink&next=/status/<id>` route, which already calls `verifyOtp` and sets the `@supabase/ssr` session cookies.
```typescript
// Source: 02-05 invite pattern (this codebase) + Supabase generateLink docs + catjam.fi PKCE writeup
const admin = createAdminClient();
const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: guestEmail,
  options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=magiclink&next=/status/${transferId}` },
});
// data.properties.action_link  → the clickable link (Supabase default-template/PKCE shape)
// data.properties.hashed_token → token_hash for the custom-template token_hash flow
```
- **`/auth/confirm` change needed:** the existing route hardcodes the post-verify destination to `/` for `email`/`magiclink`. Phase 4 must thread a validated `next` param so a magic-link guest lands on `/status/<id>` instead of `/` (which bounces guests to /sign-in). Allowlist `next` to internal paths only (no open-redirect — WR-03 ethos: never forward an attacker-controlled redirect verbatim).
- **Free-tier caveat (carried from 02-05):** without a custom email template, Supabase's default template emits the PKCE `?code=` flow (same-browser only). Phase 4 stubs the send anyway; Phase 7 (custom Resend template) emits the `token_hash` flow (cross-device). For Phase 4 stub testing, the revealed link works in the same browser.

### Pattern 6: Guest role resolution (Claude's discretion verify)
**What:** confirm a magic-link guest does not collide with admin/driver.
**Verified against `platform/auth/role.ts` + `app/page.tsx` (this codebase):** `getCurrentRole()` reads `app_users.role`; a magic-link guest has **no `app_users` row** → `maybeSingle()` returns `data:null` → `getCurrentRole()` returns `null`. So a guest is NOT `admin` and NOT `driver`. The status route must therefore **not** gate on `getCurrentRole()==='guest'` (it would be `null`); it gates on a valid `auth.getUser()` session + the RLS read returning the row. `app/page.tsx` already documents guests use `/pickup/<slug>` and bounce from `/`. **No role-layer change required** — just do not route the guest through `/` or `getCurrentRole`. (Optional: a literal `AppRole='guest'` exists in the type union but is unused for session-bearing guests; that is fine.)

### Anti-Patterns to Avoid
- **Trusting the client-submitted amount.** Always re-read `destinations.price_cents` server-side; never accept a price from FormData (tamper → underpay). [VERIFIED: checkout.ts takes `amountCents` from caller — caller must source it server-side.]
- **Adding a second `paid` writer.** BOOK-06's email must hang off the *existing* webhook `paid` transition. A grep gate (`single-writer.test.ts`) forbids any other `status='paid'` write.
- **Using `auth.email()` in the RLS policy.** Deprecated. Use `(select auth.jwt() ->> 'email')`.
- **Gating the status page on `getCurrentRole()==='guest'`.** A magic-link guest resolves to role `null` (no `app_users` row). Gate on the session + RLS, not the role enum.
- **Catching and swallowing `redirect()`'s NEXT_REDIRECT** in the booking action (breaks the Checkout redirect).
- **Letting the status route fall through to the SW default cache.** Must be NetworkFirst (add to `SENSITIVE_DOCUMENT` regex in `app/sw.ts`).
- **Parsing the trigger as a substitute for the actor (admin-only cancel).** The trigger validates the *transition*; the admin-only-cancel actor check is an app-layer `getCurrentRole()` gate (Phase 6 UI).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkout Session creation | A new Stripe session builder | `createCheckoutSession({transferId, amountCents})` | Already built, EUR/integer-cents, metadata-bound, trusted URLs, server-only. Reuse verbatim (BOOK-03). |
| `paid` write | A success-page or action paid-write | The existing webhook (sole writer) | SC5 / BOOK-05 lock. The email fires off it. |
| Magic-link verification + session cookies | A custom token endpoint | The existing `/auth/confirm` route (`verifyOtp` + `@supabase/ssr`) | Already handles PKCE + token_hash flows and sets cookies. Only add a validated `next` param. |
| Magic-link generation | Hand-built JWT/OTP | `auth.admin.generateLink({type:'magiclink'})` | GoTrue admin API; mirrors 02-05 invite. |
| Lifecycle enforcement | App-only `if` checks | Postgres BEFORE-UPDATE trigger | D-08: must hold regardless of which client writes (service-role bypasses RLS but NOT triggers). |
| PII gating | UI-only hiding | RLS policy on `wp_transfers` | UI masking leaks via the auto-generated REST API. |
| Money formatting | New formatter | `fmtEur()` from `platform/money/commission.ts` | Already integer-cents → "85.00". |
| Form field markup | New inputs | `TextField`, `Select`, `Button` (52px CTA) | Locked design-system primitives. Only the pax stepper is a small new island. |
| Status colours/labels | A new state→colour map | `StatusDot` + its `TransferState` union | The platform-wide contract; "consumed fully from Phase 4." |

**Key insight:** Phase 4 is ~80% wiring of already-proven pieces. The only genuinely new, careful engineering is migration `0004` (trigger + RLS) and threading the `next` param through `/auth/confirm`.

## Runtime State Inventory

> Phase 4 ALTERs an existing table (`wp_transfers`) and changes auth/RLS — included for the schema-migration risk surface.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `wp_transfers` is **empty in production except seeded TEST rows** from Phase 3 live gates (replay/forged/spoof seeds on Balkanity `qyhdogajtmnvxphrslwm`). The 0004 ALTER adds NULL-able PII/lifecycle columns → existing seed rows survive the ALTER (new columns NULL). | Migration must add columns NULL-able or with defaults so the ALTER does not fail on existing rows. Optionally clean up Phase-3 TEST seed rows before/after (not required; they are harmless `requested`/`paid` rows). |
| Live service config | **Supabase Auth Redirect-URLs allowlist** must include the new magic-link `redirectTo` (`${SITE_URL}/auth/confirm?type=magiclink...`). 02-05 already allowlisted `/auth/confirm?type=invite`; confirm the base `/auth/confirm` (and the `next`-carrying variant) is allowlisted or the link silently falls back to Site URL (02-05 Pitfall 1). | Verify/extend the Balkanity Auth Redirect-URLs allowlist (Management token, NOT MCP). Magic-link email template may need the `token_hash` shape for cross-device (Phase 7). |
| OS-registered state | None — no cron/scheduler/OS registration in Phase 4 (reconciliation + keep-alive are Phase 8). | None. |
| Secrets/env vars | No new env required (CONTEXT line 112). Reuses `NEXT_PUBLIC_SITE_URL`, Stripe + Supabase keys. `NEXT_PUBLIC_SITE_URL` must be set in Vercel prod (already is, per 02-05). | None new. Confirm `NEXT_PUBLIC_SITE_URL` present (it is). |
| Build artifacts | The Serwist `public/sw.js` is regenerated each build from `app/sw.ts`; adding the status route to `SENSITIVE_DOCUMENT` regenerates it. No stale-artifact risk. | None — handled by the normal build. |

**Nothing found in category (OS-registered):** None — verified by absence of any cron/scheduler/task in Phase 4 scope (reconciliation + keep-alive explicitly deferred to Phase 8, CONTEXT lines 26).

## Common Pitfalls

### Pitfall 1: Forgetting the anon-read RLS policy for `/pickup/<slug>`
**What goes wrong:** `/pickup/<slug>` renders blank/"not found" for everyone because `destinations` only has `destinations_admin_read` — anon gets zero rows.
**Why it happens:** Phase 2 deliberately deferred the public-read policy to Phase 4 (0002 comment explicitly says so).
**How to avoid:** add `destinations_public_active_read` (Pattern 4) in migration `0004`. Or read destinations via the service-role client in the RSC (acceptable since it is a public, non-PII read) — but the RLS policy is cleaner and lets a client-side fetch work too. Recommend the RLS policy.
**Warning signs:** `/pickup/<valid-slug>` shows the empty/not-available state for a known-active destination.

### Pitfall 2: Stale status page from the SW cache (correctness/security)
**What goes wrong:** the guest sees an old lifecycle state (e.g. still "paid" after the driver is "en_route"), or worse a cached page from another session.
**Why it happens:** the status route falls through to Serwist's `defaultCache` (StaleWhileRevalidate).
**How to avoid:** add the status (and pickup/track) document paths to the `SENSITIVE_DOCUMENT` regex in `app/sw.ts` so they are forced NetworkFirst (the existing rule already covers `sign-in|admin|auth|driver`). Roadmap lock.
**Warning signs:** offline or flaky-network testing shows a stale timeline.

### Pitfall 3: Magic link silently falls back to Site URL
**What goes wrong:** clicking the magic link lands on `/` (then bounces guest to /sign-in) instead of `/status/<id>`.
**Why it happens:** the `redirectTo` URL is not in the Supabase Redirect-URLs allowlist → GoTrue ignores it and uses the project Site URL (02-05 Pitfall 1). Or the `/auth/confirm` route never threads the `next` param.
**How to avoid:** allowlist the `/auth/confirm` redirect target; thread a validated internal-only `next` param through `/auth/confirm`; use the trusted `NEXT_PUBLIC_SITE_URL` base (never Origin).
**Warning signs:** the stub-revealed link lands on sign-in.

### Pitfall 4: The trigger blocks the webhook's `requested → paid`
**What goes wrong:** the trigger's allowed-map omits `requested → paid`, so the very first real transition (the webhook) raises and Stripe sees a 5xx and retries forever.
**Why it happens:** off-by-one in the transition map.
**How to avoid:** the map MUST include `requested → paid` (Pattern 2 has it). Wave-0 test the webhook's exact transition against the trigger before the live apply. Also confirm the webhook's `.neq("status","paid")` idempotency backstop still composes with the trigger (a duplicate `paid→paid` is filtered by `.neq` before the trigger sees a no-op; and `is not distinct from` early-returns).
**Warning signs:** live Checkout completes but the transfer never flips to paid; `webhook_events.outcome='write_failed'`.

### Pitfall 5: Trusting a client-submitted price/amount
**What goes wrong:** a tampered form posts `amount_cents=1` and the guest underpays.
**Why it happens:** convenience of passing the displayed price through the form.
**How to avoid:** the server action re-reads `destinations.price_cents` by slug and uses that for both the row and the Session. Never read amount from FormData.
**Warning signs:** Checkout amount ≠ destination fare.

### Pitfall 6: `getSession()` for the guest authz
**What goes wrong:** spoofable cookie-trusting read used to authorize the status page.
**Why it happens:** habit / convenience.
**How to avoid:** `auth.getUser()` only (01-03 lock, codified in `role.ts` + `proxy.ts`). The RLS policy is the real boundary anyway, but the session read must still be `getUser()`.
**Warning signs:** code review finds `getSession()` on the status path.

## Code Examples

### Reading the guest's own transfer on the status page (RLS-scoped, getUser)
```typescript
// Source: platform/supabase/server.ts + platform/auth/role.ts patterns (this codebase)
import { createClient } from "@/platform/supabase/server"; // cookie-bound anon client
export const runtime = "nodejs"; // Supabase auth cookie handling (mirror /auth/confirm)

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(); // revalidates JWT — NOT getSession
  if (!user) { /* no session → prompt to re-request link via /track */ }

  // RLS does the authorization: guest-self-read policy returns the row ONLY if the
  // JWT email matches guest_email. No row → not-yours / not-found state.
  const { data: transfer } = await supabase
    .from("wp_transfers")
    .select("id, status, amount_cents, paid_at, arrival_at, driver_id")
    .eq("id", id)
    .maybeSingle();
  // render StatusDot timeline + fmtEur(amount_cents) receipt + (status>='claimed') driver reveal
}
```

### Stubbed confirmation-email wrapper (Phase 7 swaps the body)
```typescript
// Source: 02-05 generateLink stub pattern (reveal link, no send) — this codebase
import "server-only";
import { createAdminClient } from "@/platform/supabase/admin";

export type ConfirmationEmail = { to: string; magicLink: string; html: string };

/** Phase 4: builds the email + magic link but DOES NOT SEND (stub). Phase 7 wires Resend. */
export async function sendBookingConfirmation(transferId: string, guestEmail: string): Promise<ConfirmationEmail> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: guestEmail,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=magiclink&next=/status/${transferId}` },
  });
  const magicLink = data?.properties?.action_link ?? "";
  const html = renderConfirmationHtml({ magicLink /*, fare, arrival, …*/ }); // react-email or plain HTML
  // Phase 4 STUB: log/return; no Resend call yet (BOOK-06 send → Phase 7).
  console.info("[BOOK-06 stub] confirmation email", { to: guestEmail, magicLink });
  return { to: guestEmail, magicLink, html };
}
```
> **Stub boundary for clean Phase-7 swap:** keep `sendBookingConfirmation` as the single call-site the webhook invokes on the `paid` transition. Phase 7 replaces only the body (`console.info` → `resend.emails.send`) and adds the `email_log` idempotency check — the signature and call-site stay identical. The webhook calls this *after* the successful `paid` UPDATE (inside the `processed` branch), guarded so a failed send does not roll back the paid write (log-and-continue; reconciliation/Phase 7 handle resend).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.email()` RLS helper | `(select auth.jwt() ->> 'email')` | Deprecated per Supabase "Deprecated RLS features" troubleshooting doc | **D-05 wording is stale — planner must use the `auth.jwt()` form.** Same semantics. [VERIFIED] |
| `auth.uid()`/`auth.jwt()` called bare in policy | wrap in `(select …)` subquery | Supabase RLS performance best-practice (initPlan caching) | Negligible at pilot scale, but it is the documented-correct form; use it. [VERIFIED] |
| `middleware.ts` | `proxy.ts` (Next 16) | Next 16 | Already adopted in this repo. No change. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | — | Already adopted. Never use the deprecated helper. |

**Deprecated/outdated:**
- `auth.email()`, `auth.role()` Supabase helpers — replaced by `auth.jwt() ->> '<claim>'`.
- `next-pwa` — replaced by Serwist (already adopted).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `generateLink` returns `properties.action_link` (and `properties.hashed_token`) for `type:'magiclink'` exactly as it does for `type:'invite'` (proven in 02-05). | Pattern 5 / Code Examples | LOW — 02-05 already consumes `data.properties.action_link` from `generateLink`; the return shape is shared across link types. If `hashed_token` is needed for a custom-template link, it is also present (verified via search). |
| A2 | The webhook can call `sendBookingConfirmation` inside its `processed` branch without violating the single-writer grep gate (the gate forbids `status='paid'` writes, not function calls). | Code Examples (stub) | LOW — the gate is a source grep for paid-status writes; a send-email call adds none. Confirm the new module contains no `status: "paid"` string. |
| A3 | Adding NULL-able PII/lifecycle columns via ALTER on the existing `wp_transfers` does not break the Phase-3 webhook (which only references `status`, `paid_at`, `stripe_payment_intent_id`, `fee_cents`). | Runtime State Inventory | LOW — additive NULL-able columns are backward-compatible; the webhook's column list is a strict subset. |
| A4 | `driver_id` + driver reveal columns can be scaffolded NULL in 0004 and populated in Phase 5/6; D-06's reverse reveal reads `driver_profiles` joined on that scaffold. | Pattern 3 / D-06 | MEDIUM — the exact driver FK/column name and whether D-06 joins `driver_profiles` (name+phone) vs duplicates them must be settled in planning; both are expressible. Adversarial PII check (driver-side, Phase 5) is out of scope here. |
| A5 | The pilot does not need true real-time status; NetworkFirst fetch-on-load (guest reloads) is sufficient. | Liveness recommendation | LOW — explicitly Claude's discretion; a light poll is the fallback if the pilot wants live. Realtime is gold-plating for ~10 transfers. |

## Open Questions

1. **Exact driver-reveal data path for D-06.**
   - What we know: the guest can read their own row (RLS); driver name+phone live in `driver_profiles`.
   - What's unclear: whether 0004 scaffolds a `driver_id` FK now (recommended, so Phase 5 only adds the claim logic) and whether the status page joins `driver_profiles` or denormalizes name/phone onto the transfer at claim time.
   - Recommendation: scaffold `driver_id uuid references auth.users(id)` NULL in 0004; status page joins `driver_profiles` and shows name+phone only when `status` ∈ {claimed, en_route, arrived, picked_up, completed}. Confirm in planning.

2. **`/auth/confirm` `next`-param threading + open-redirect guard.**
   - What we know: the route currently hardcodes `/` for magiclink; it must support landing on `/status/<id>`.
   - What's unclear: exact allowlist shape for `next`.
   - Recommendation: accept `next` only if it matches `^/status/[0-9a-f-]{36}$` (or a small internal allowlist); otherwise default to `/`. Never forward an arbitrary `next` (open-redirect / WR-03 ethos).

3. **Abandoned `requested` rows + slug-inactive UX.**
   - What we know: cleanup is Phase 8; inactive-slug handling is Claude's discretion.
   - Recommendation: `/pickup/<inactive-slug>` shows a neutral "not available" state; abandoned `requested` rows are left for Phase 8 reconciliation. No Phase-4 work beyond the UX state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (Balkanity `qyhdogajtmnvxphrslwm`) | migration 0004 apply, auth, RLS | ✓ | hosted | — (NEVER Kalvia) |
| Supabase CLI / Management token (psql) | apply flagged migration 0004 (NOT MCP) | ✓ | — | Management API curl (MEMORY: MCP hits Kalvia) |
| Stripe (test mode) | Checkout Session + webhook (reused) | ✓ | apiVersion `2026-05-27.dahlia` | — |
| Stripe CLI | local webhook forwarding for the `paid`→email path | ✓ (used in Phase 3) | — | — |
| `NEXT_PUBLIC_SITE_URL` (Vercel prod env) | magic-link `redirectTo` + Checkout URLs | ✓ | set in 02-05 | — |
| Resend | confirmation email SEND | ✗ (intentionally) | — | **STUBBED in Phase 4** → Phase 7 |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Resend send — intentionally stubbed (BOOK-06 send wires in Phase 7); the stub logs/reveals the magic link.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` (jsdom) for unit/action; Playwright `^1.61.0` (chromium) for e2e |
| Config file | `vitest.config.ts` (includes `app/**/*.test.{ts,tsx}`, `platform/**`); `playwright.config.ts` |
| Quick run command | `npm run test` (vitest run) |
| Full suite command | `npm run test && npm run test:e2e && npm run typecheck && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XFER-01 | Lifecycle transition map (legal/illegal) — TS mirror of the trigger | unit | `vitest run platform/transfers/lifecycle.test.ts` | ❌ Wave 0 |
| XFER-01 | DB trigger rejects illegal transitions (adversarial) | integration (psql/service-role) | runbook script against Balkanity (manual/gated, like 03-05 gates) | ❌ Wave 0 |
| BOOK-02 | Booking action zod rejects missing required fields (email/phone/name/pax/flight/arrival) | unit | `vitest run app/pickup/[slug]/booking.test.ts` | ❌ Wave 0 |
| BOOK-03 | Booking action inserts `requested` + calls `createCheckoutSession` (mocked) | unit | `vitest run app/pickup/[slug]/booking.test.ts` | ❌ Wave 0 |
| BOOK-05/SC5 | Success page never renders "paid" without a real paid status (existing) | e2e | `playwright test tests/e2e/success-spoof.spec.ts` | ✅ exists |
| BOOK-06 | Confirmation stub builds a magic link + does not write `status='paid'` | unit | `vitest run platform/transfers/confirmation.test.ts` | ❌ Wave 0 |
| BOOK-07/AUTH-02 | Status page renders timeline + receipt; RLS returns only own row | e2e + unit | `playwright test tests/e2e/guest-status.spec.ts` | ❌ Wave 0 |
| (gate) | Single-writer grep: no new `status='paid'` writer | unit | `vitest run platform/payments/single-writer.test.ts` | ✅ exists |

### Sampling Rate
- **Per task commit:** `npm run test` (fast vitest) + `npm run typecheck` (Dict parity gate fails on a missing en/bg key).
- **Per wave merge:** `npm run test && npm run test:e2e`.
- **Phase gate:** full suite green + the DB-trigger adversarial runbook passed on Balkanity before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `platform/transfers/lifecycle.test.ts` — covers XFER-01 (TS transition map, every legal/illegal pair).
- [ ] `app/pickup/[slug]/booking.test.ts` — covers BOOK-02/BOOK-03 (zod boundary + insert/checkout call).
- [ ] `platform/transfers/confirmation.test.ts` — covers BOOK-06 (stub builds link, no paid write).
- [ ] `tests/e2e/guest-status.spec.ts` — covers BOOK-07/AUTH-02 (status page timeline + receipt render).
- [ ] DB-trigger adversarial runbook (psql/service-role) — covers XFER-01 at the data layer (mirror the 03-05 gate style).
- [ ] All new copy keys added to BOTH `en.ts` and `bg.ts` (the `tsc` Dict parity gate enforces parity).

## Security Domain

> security_enforcement enabled (ASVS L1, block_on: high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase magic-link (GoTrue) via `generateLink` + `verifyOtp`; `auth.getUser()` revalidation; admin/driver login unchanged (email+password). |
| V3 Session Management | yes | `@supabase/ssr` cookie session; `proxy.ts` refresh; never `getSession()` for authz. |
| V4 Access Control | yes | RLS on `wp_transfers` (admin-read + new guest-self-read); narrow anon-read on active destinations; service-role writes only; **trigger** for state-transition integrity. |
| V5 Input Validation | yes | zod at the booking trust boundary (D-02/D-03/D-04); server-trusted amount (re-read price); allowlisted `next` redirect param; trusted `NEXT_PUBLIC_SITE_URL` base. |
| V6 Cryptography | yes (delegated) | Stripe HMAC webhook signature (existing); Supabase JWT/OTP (GoTrue) — never hand-rolled. |

### Known Threat Patterns for Next.js + Supabase + Stripe (this phase)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed success redirect marks paid | Spoofing/Tampering | Success page display-only; webhook sole paid writer (existing SC5/BOOK-05). |
| Tampered booking amount (underpay) | Tampering | Re-read `destinations.price_cents` server-side; never trust FormData amount. |
| Guest reads another guest's PII via the REST API | Information Disclosure | RLS `(select auth.jwt() ->> 'email') = guest_email` — data-layer boundary, not UI. |
| Driver reads guest PII pre-claim | Information Disclosure | No matching RLS policy for non-owning authenticated users → zero rows (Phase 5 hardens the masked pool). |
| Open redirect via magic-link `next` param | Tampering | Allowlist `next` to internal `^/status/<uuid>$`; default `/`; never forward verbatim. |
| Illegal lifecycle jump (e.g. requested→completed) by any writer | Tampering | BEFORE-UPDATE trigger raises on any non-mapped transition (D-08). |
| Magic link leaks → account takeover scope | Elevation | Magic link grants only the guest session (role `null`/guest), RLS-scoped to their own transfer; no admin/driver capability. |
| Stale cached status/PII via SW | Information Disclosure | NetworkFirst for status/pickup/track (add to `SENSITIVE_DOCUMENT`). |

## Sources

### Primary (HIGH confidence)
- This codebase — `supabase/migrations/0002_supply_tables.sql`, `0003_payments_spine.sql`, `platform/payments/checkout.ts`, `app/api/stripe/webhook/route.ts`, `app/pay/success/page.tsx`, `app/pay/start/route.ts`, `app/auth/confirm/route.ts`, `app/admin/drivers/actions.ts`, `platform/auth/role.ts`, `platform/supabase/{server,admin,client}.ts`, `proxy.ts`, `app/sw.ts`, `platform/ui/{StatusDot,TextField,Select,Button}.tsx`, `platform/money/commission.ts`, `platform/i18n/dictionary.ts` — verified patterns, versions (`package.json`).
- Supabase Docs — Row Level Security (`auth.uid()`, `auth.jwt()` helpers): https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Docs — JWT Claims Reference (email claim always present for email auth): https://supabase.com/docs/guides/auth/jwt-fields
- Supabase Docs — generateLink (admin) reference: https://supabase.com/docs/reference/javascript/auth-admin-generatelink
- PostgreSQL Docs — Trigger Functions (BEFORE UPDATE, RAISE EXCEPTION): https://www.postgresql.org/docs/current/plpgsql-trigger.html
- CLAUDE.md §"Verified Provider Facts" / "What NOT to Use" / "Integration Patterns" — Stripe/Supabase/Resend locked facts.

### Secondary (MEDIUM confidence)
- Supabase deprecated-RLS-features (auth.email() deprecated → auth.jwt() ->> 'email') — surfaced via search of the Supabase troubleshooting doc (the direct URL 404'd at fetch time; corroborated by the JWT Claims Reference and RLS docs which list only `auth.uid()`/`auth.jwt()`). Treated HIGH for "use auth.jwt()" given two corroborating official pages; the "deprecated" label itself is MEDIUM.
- Supabase RLS Performance & Best Practices (wrap auth.* in `(select …)` subquery for initPlan caching): https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- catjam.fi — PKCE-compatible generateLink (hashed_token + server-side verifyOtp): https://catjam.fi/articles/supabase-generatelink-fix

### Tertiary (LOW confidence)
- (none load-bearing — all critical claims cross-verified against official docs or this codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed/locked and version-pinned in package.json; no new installs.
- Architecture: HIGH — booking/checkout/webhook/magic-link/RLS/trigger patterns all derive from existing proven code or official docs.
- Pitfalls: HIGH — drawn from this repo's own 02-05/03-x decisions and the explicit 0002 "Phase 4 adds anon-read" note.
- The one correction (`auth.email()` → `auth.jwt() ->> 'email'`): HIGH on "use auth.jwt()"; the deprecation label MEDIUM.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable stack; Supabase RLS helper guidance is the only fast-moving item — re-confirm `auth.jwt()` form if planning slips past this window)
