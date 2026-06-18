# Phase 4: Transfer Entity + Booking Form - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A guest opens a per-destination link `/pickup/<slug>`, sees the destination + fare, completes a **short guestless booking form**, pays through the **Phase 3 Stripe spine** (code-created Checkout Session), receives a **booking confirmation email on `paid`** (stubbed wrapper this phase, fully wired in Phase 7), and tracks the **full transfer lifecycle** on a **passwordless magic-link status page**. Delivers BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-06, BOOK-07, XFER-01, AUTH-02.

**In scope:**
- The `/pickup/<slug>` public booking page (destination + fare display, slug resolution).
- The guestless booking form + server-side zod validation at the trust boundary.
- **Migration `0004`** (FLAGGED / irreversible — sign-off before apply): ALTERs the existing minimal `wp_transfers` (created in 0003) to add guest PII + the full lifecycle columns; adds the lifecycle DB transition-guard trigger; adds the guest-self-read RLS policy.
- Booking → `requested` row + code-created Checkout Session (reusing `platform/payments/checkout.ts`).
- Prepaid-&-non-refundable disclosure before payment (BOOK-04).
- The complete 8-state lifecycle state machine + DB-level transition guards (XFER-01, SC5).
- The passwordless guest status page (Supabase magic-link session, RLS-gated): live lifecycle timeline (StatusDot) + payment receipt + post-claim driver name/phone.
- A "track my booking" re-access page (re-request magic link by email).
- The booking confirmation email generated this phase but **send is stubbed** (Phase 7 wires Resend).

**Out of scope (later phases):**
- Masked pool view + atomic claim RPC + claiming-driver PII RLS (Phase 5).
- Driver "My run" / status-advance UI + admin transfers list/detail/assign/refund (Phase 6).
- Resend email send wiring + email_log + cap guardrail (Phase 7).
- Reconciliation sweep / abandoned-`requested` cleanup / keep-alive (Phase 8).
- **Flight tracking** (auto-derive arrival time from a flight number) — deferred to its own future phase (see Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Booking form fields
- **D-01:** Scheduling is captured as a **manual arrival date + manual arrival time** plus a **required flight number** (the field guests think in). No flight-tracking dependency in v1 — the stored arrival timestamp is what the Phase 5/6 claim pool sorts on (CLAIM-06) and what drivers use for pickup timing.
- **D-02:** **Required fields:** email, phone, guest name, passenger count, flight number, arrival date, arrival time. **Optional fields:** luggage (bag count), notes. (This makes **phone required** — a deliberate change from PROJECT.md's "phone optional", chosen for driver coordination.)
- **D-03:** Passengers = an integer **number stepper (1–8)**; luggage = an integer **number of bags** (optional). Pax is required; luggage optional.
- **D-04:** **Guest name is required.** It is claim-gated PII (revealed only to the claiming driver + admin, and to the guest themselves) — driver greets/identifies on it.

### Status-page access (AUTH-02 — flagged auth)
- **D-05:** Guest reaches their status page via a **Supabase magic-link session**. The confirmation email carries a magic link; clicking it establishes a guest auth session. The status page reads the transfer **at the data layer via RLS** — a new policy `auth.email() = wp_transfers.guest_email` — keeping PII gating consistent with Phase 5 (RLS is the real boundary), not service-role-by-token. **Migration `0004` adds this guest-self-read RLS policy.**
- **D-06:** **Driver first name + phone are shown to the guest on the status page only after `claimed`** (a small, deliberate reverse-PII reveal so the guest can coordinate pickup). Before claim, no driver identity.
- **D-07:** **Re-access by email** — a "track my booking" page where the guest enters their email and gets a fresh magic link / re-sent status link. Self-service, no admin involvement.

### Lifecycle enforcement (XFER-01 / SC5 — flagged schema)
- **D-08:** The lifecycle transition guards are **DB-level**: a Postgres **BEFORE-UPDATE trigger** (in migration `0004`) validates every old→new `status` transition against the allowed-transition map, regardless of which client writes (webhook, future claim RPC, admin/driver actions). This is the authority — consistent with the project's "enforce at the data layer" ethos and the adversarial-gate pattern. (A thin app-layer guard for friendly errors is allowed but the trigger is the hard backstop.)
- **D-09:** Phase 4 defines the **complete 8-state machine now** (all of `requested → paid → claimed → en_route → arrived → picked_up → completed` + `cancelled`), even though Phase 4 itself only drives `requested → paid`. Phases 5/6 call into the already-whole, adversarially-testable machine rather than extending it piecemeal.
- **D-10:** **Cancellation is admin-only**, allowed only from **non-terminal pre-pickup states** (`requested`, `paid`, `claimed`, `en_route`, `arrived`) — never from `picked_up` or `completed`. Pairs with the manual-refund flow built in Phase 6. (The transition map encodes this; the admin cancel *UI* lands in Phase 6, but the map permits the transitions now.)

### Claude's Discretion
- **Status-page liveness:** default to **fetch-fresh on load with NetworkFirst** (never served stale from the SW cache — roadmap lock). Supabase Realtime subscription is optional and only if the pilot needs truly-live updates; a light poll is an acceptable middle ground. Planner/researcher territory.
- **Confirmation-email mechanic:** generate the status-page magic link via `auth.admin.generateLink({ type: 'magiclink' })` and carry it inside the (Phase-4-stubbed) confirmation email — mirroring the Phase 2 driver-invite `generateLink` pattern (02-05). In Phase 4 the send is stubbed (revealed inline / logged, as the invite link was); Phase 7 wires the real Resend send.
- **Guest role resolution:** ensure the guest magic-link auth account resolves to the `guest` role (default / no `app_users` row) and never collides with admin/driver `getCurrentRole()` — verify against the 01-03 role layer.
- Inactive-slug handling on `/pickup/<slug>` (slug exists but `active=false`), abandoned/unpaid `requested`-row handling (cleanup is Phase 8), exact form layout/microcopy, and the receipt format ("Paid EUR X on {date}") beyond the SC4 requirement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 4: Transfer Entity + Booking Form" — goal, the 5 success criteria, and the REVIEW/SIGN-OFF note (wp_transfers ALTER is flagged/irreversible)
- `.planning/REQUIREMENTS.md` — **BOOK-01..04, BOOK-06, BOOK-07** (booking + payment + confirmation + status page), **XFER-01** (locked lifecycle), **AUTH-02** (passwordless magic-link guest status)
- `.planning/PROJECT.md` — core value, pre-claim vs post-claim PII visibility rules, design system + brand tokens, locked constraints

### Payments spine (Phase 3 — reuse, do not rebuild)
- `supabase/migrations/0003_payments_spine.sql` — the **existing** minimal `wp_transfers` columns + `webhook_events`; Phase 4 ALTERs `wp_transfers` (migration `0004`), it does NOT create it (Phase 3 D-04)
- `platform/payments/checkout.ts` — `createCheckoutSession({ transferId, amountCents })`; reuse verbatim for BOOK-03
- `platform/payments/stripe.ts` — server-only Stripe client (apiVersion `2026-05-27.dahlia`)
- `app/api/stripe/webhook/route.ts` — the SINGLE `paid` writer; Phase 4's confirmation email fires off the verified `paid` transition (do not add a second paid writer)
- `app/pay/start/route.ts` — the minimal test-only checkout trigger Phase 4 **replaces** with the real form-driven flow; `app/pay/success/page.tsx` + `app/pay/cancel/page.tsx` (success page is display-only, never writes `paid` — SC5)
- `.planning/phases/03-payments-trust-spine/03-CONTEXT.md` — D-01 (EUR/integer cents), D-04 (Phase 4 ALTERs the table), D-05 (recorded fee)

### Design system, schema & i18n patterns (reuse)
- `platform/ui/StatusDot.tsx` — the `TransferState` 8-state union + brand colour/label map; the status timeline consumes this (SC4)
- `platform/ui/` — `Button` (52px CTA), `TextField`, `Select`, `Card`, `Toggle`, `DataList` primitives
- `platform/i18n/en.ts` + `platform/i18n/bg.ts` + `platform/i18n/dictionary.ts` — all new booking/status copy must land in both behind the `tsc` Dict parity gate (Phase 1/2 pattern)
- `supabase/migrations/0002_supply_tables.sql` — `destinations` columns (slug, label, zone, airport, `price_cents`, `commission_pct`, `active`) the `/pickup/<slug>` page reads; admin-only RLS + `is_admin()` + service-role-write pattern to mirror for migration `0004`

### Provider facts
- `CLAUDE.md` §"Verified Provider Facts" / §"What NOT to Use" / §"Integration Patterns" — Stripe EEA fee 1.5%+€0.25, server-redirect Checkout, never set `paid` from success_url/client, `@supabase/ssr` magic-link session (`getAll/setAll`, `auth.getUser()` not `getSession()`), NetworkFirst for booking/status data (never SW-cached)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/payments/checkout.ts` — `createCheckoutSession()` already builds the EUR/integer-cents, `metadata.transfer_id`-bound Session with trusted success/cancel URLs. The booking form's server action calls this directly after inserting the `requested` row.
- `platform/payments/stripe.ts` / `app/api/stripe/webhook/route.ts` — the webhook is the sole `paid` writer; the confirmation email hangs off its verified `paid` transition. No new paid writer.
- `platform/ui/StatusDot.tsx` — the lifecycle union + colour/label map; status timeline reuses it (only "proven visually in Phase 1, consumed fully from Phase 4" per its own header comment).
- `platform/ui/` primitives (`Button` 52px CTA, `TextField`, `Select`, `Card`, `Toggle`, `DataList`) + `platform/ui/pictograms/` (plane/route).
- `platform/supabase/{admin,server,client}.ts` — three-way client split; service-role for writes, anon/RLS for the guest status read.
- 02-05 `auth.admin.generateLink` pattern — the template for generating the guest status magic link carried in the (stubbed) confirmation email.

### Established Patterns
- **Writes via service-role only; RLS tables carry SELECT policies and NO write policy** (Phases 1/2/3). Migration `0004` follows this — except it ADDS a guest-self-read SELECT policy (`auth.email() = guest_email`) alongside the existing admin-read.
- **Schema migrations are FLAGGED → human sign-off before apply**; applied to Balkanity `qyhdogajtmnvxphrslwm` via Supabase CLI/Management token (NOT MCP — MCP hits Kalvia). `0004` is next.
- **Money is integer EUR minor units end-to-end** (no floats, no BGN). `amount_cents` on `wp_transfers` comes from `destinations.price_cents`.
- **All UI copy in en.ts/bg.ts behind the tsc Dict parity gate.**
- **Trusted `NEXT_PUBLIC_SITE_URL`** for any constructed URL (magic-link redirect, Checkout URLs) — never the request Origin header (WR-04 lock).
- **`auth.getUser()` for authz, never `getSession()`** (01-03 lock); `proxy.ts` refreshes the session.

### Integration Points
- New `app/pickup/[slug]/` route (public) — destination/fare display + booking form; resolves slug against `destinations` (anon/RLS read, `active=true`).
- New booking server action — zod-validates the form, inserts the `requested` `wp_transfers` row (service-role), then calls `createCheckoutSession()` and 303-redirects to the hosted Checkout URL.
- New `app/status/` (or `/pickup/<slug>/status`) guest status route — Supabase magic-link session + RLS read of the guest's transfer; StatusDot timeline + receipt + post-claim driver name/phone.
- New "track my booking" page — email → fresh magic link.
- Migration `0004` — ALTER `wp_transfers` (PII columns: name, email, phone, flight no., notes, pax, luggage, exact address linkage; lifecycle columns: arrival date/time, claimed/driver fields scaffold) + lifecycle BEFORE-UPDATE trigger + guest-self-read RLS policy.
- New env: none required for Phase 4 beyond existing Stripe/Supabase keys (confirmation email send is stubbed → Phase 7).

</code_context>

<specifics>
## Specific Ideas

- The status page must show a **visible payment record/receipt** ("Paid EUR X on {date}") as proof of prepay (SC4) and a **lifecycle timeline with a coloured dot + label for every state incl. `en_route`** (StatusDot — colour is never the sole signal).
- Checkout must **clearly state the booking is prepaid & non-refundable BEFORE payment** (BOOK-04) — surfaced on the form/confirm step, not just buried in terms.
- The **success page is display-only and never writes `paid`** (SC5) — the verified webhook remains the only paid writer.
- Flight number is **required** because it's the field guests naturally have for an airport pickup; it becomes driver metadata (and the anchor for the future flight-tracking phase).

</specifics>

<deferred>
## Deferred Ideas

- **Flight tracking** — auto-derive arrival time from a flight number (real-time delay-aware pickup). Promote **GROW-03** from the v2 backlog to a **dedicated roadmap phase**, built after the pilot proves out. It needs a paid flight API (AviationStack / FlightAware AeroAPI / FlightStats), a polling/refresh strategy, delay-handling UX, and a lookup-failure fallback — its own vertical, net-new scope, and gold-plating for a ~10-transfer pilot. Phase 4 ships manual arrival date/time so the pilot is not blocked. *(Action: add to ROADMAP backlog via `/gsd-phase` or `/gsd-capture`.)*

</deferred>

---

*Phase: 4-Transfer Entity + Booking Form*
*Context gathered: 2026-06-18*
