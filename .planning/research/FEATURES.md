# Feature Research

**Domain:** Prepaid airport-transfer booking + self-claim driver dispatch (3-actor PWA: Admin desktop console, Driver mobile, Guest mobile)
**Researched:** 2026-06-17
**Confidence:** MEDIUM-HIGH (booking/email/notification patterns are well-established and corroborated across sources; self-claim driver-pool norms are MEDIUM — fewer public sources, validated against Dispatch/Para/Roadie/Curri courier models)

## Scope Discipline Note

The v1 feature set in PROJECT.md is already strong and largely correct. This research **validates** it against comparable products, surfaces a small set of **omitted table-stakes** the pilot genuinely needs, and confirms the **anti-features** to avoid. Everything here respects the locked Out of Scope list (no Connect payout, no auto-dispatch, no flight tracking, no property self-service portal, no SMS/WhatsApp, no second module, no pricing engine, no guest-facing refund flow). Nothing below recommends adding any of those.

---

## Feature Landscape

### Table Stakes (Users Expect These)

#### GUEST (mobile PWA — booking + status tracking)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-destination slug link → short booking form (email required, phone optional) | Already in scope; matches booking-link norm (Calendly/upvio style: link carries context, minimal form) | MEDIUM | The slug must pre-fill destination + price so the guest never picks an address. Validate slug → destination → active price server-side. |
| Instant confirmation email within minutes of `paid` | Universal expectation. Sources: confirmation must "follow straight after booking" — delay erodes trust | LOW | In scope. Fire on verified webhook only, never client redirect. Include reservation details, fare paid, date/time, airport, destination. |
| Clear visual status timeline (paid → claimed → en_route → arrived → picked_up → completed) | Booking products universally show a step/progress timeline; guests want to know "where is my ride" | MEDIUM | Status = coloured dot + text label (brand rule, never colour alone). Map lifecycle states to plain-language guest labels (e.g. `claimed` → "Driver assigned", `en_route` → "Driver on the way"). |
| Passwordless magic-link status page | In scope. Lowest-friction; guestless checkout means no password to remember | MEDIUM | Supabase magic link. Magic link should land directly on the transfer status page, not a generic dashboard. |
| **Booking receipt / payment record on the status page** *(potential gap)* | Real-money prepay → guests expect proof of payment they can reference, especially for a non-refundable booking | LOW | See "Omitted Table-Stakes" below. Can be the confirmation email itself + a visible "Paid €X on {date}" line on the status page; no separate PDF needed for a 10-transfer pilot. |
| **Upfront non-refundable disclosure at checkout** *(potential gap)* | FTC/EU plain-language law + dispute prevention. "Terms shown before booking, not hidden in fine print" | LOW | See "Omitted Table-Stakes". A single checkbox/line near the CTA: "This booking is prepaid and non-refundable." Cheap insurance against chargebacks in a real-money pilot. |
| Driver name + contact visible to guest after `claimed` | Guests expect to know/reach the assigned driver (airport transfer norm: "driver's contact information" in confirmation) | LOW | Mirror of the driver's PII unlock. Show driver first name + a contact method on the status page once claimed. |

#### DRIVER (mobile PWA — claim pool + run fulfilment)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Limited-detail claim pool (date, arrival time, airport, destination zone, fare, pax, luggage — NO PII/exact address) | In scope. Matches Dispatch model: "see what you'll make and where before you claim" but privacy-masked | MEDIUM | Pre-claim disclosure must be enough to decide (earnings + rough location + timing) without leaking PII. RLS-enforced, not UI-only. |
| Atomic first-to-claim with graceful "already claimed" loss | In scope. Concurrency correctness is the pilot's definition-of-done | MEDIUM | Conditional UPDATE; loser gets clear "This transfer was just claimed by someone else" message, pool refreshes. |
| Full PII unlock on claim (name, contact, exact address, flight no., notes) | In scope. Driver can't fulfil without it | LOW | Unlocks at RLS layer for claiming driver + admin only. |
| "My run" / my active claims list | In scope (transfer views). Driver with multiple active claims needs a single list of what they own | MEDIUM | See run-ordering note below — sort by arrival time ascending so the next pickup is on top. |
| Per-transfer status advancement controls (claimed → en_route → arrived → picked_up → completed) | In scope. Driver drives the lifecycle forward | LOW-MEDIUM | Big 52px CTAs (brand rule), one primary action per state. Make state transitions one-tap and forward-only in the happy path. |
| In-app notification feed/bell as primary channel | In scope. Drivers are on email-budget; in-app is their main signal | MEDIUM | New-transfer-available + you-lost-a-claim + admin reassigned-from-you should all surface in-app. |
| **Run ordering by pickup/arrival time** *(potential gap, low cost)* | With multiple active claims allowed, an unordered list is a fulfilment hazard — driver could miss the next pickup | LOW | See "Omitted Table-Stakes". Just sort "My run" by arrival time ascending + show a clear "next" indicator. |

#### ADMIN (desktop console — onboarding + operations + health)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| No-code onboarding: companies / properties / destinations + price + commission per destination | In scope. Admin is the only one who can create supply in v1 (no property portal) | MEDIUM | CRUD forms in the slate console. Commission is recorded only (no payout). |
| Driver invite (contractor-only, no open signup) | In scope. Closed pool is a deliberate trust boundary | LOW-MEDIUM | Invite → magic link / set-up flow. |
| Transfers list + detail with filters by status | In scope. Operational nerve centre | MEDIUM | Filter by lifecycle state; surface stuck/unclaimed prominently (coral). |
| Manual assign / reassign / cancel | In scope. Self-claim needs a human override for no-shows / driver drop-out | MEDIUM | Reassign should notify both old + new driver (in-app at least). |
| Manual Stripe refund (admin-initiated exceptions only) | In scope. The only refund path — no guest-facing flow | LOW-MEDIUM | Honesty: Stripe doesn't return the original processing fee on refund (per PROJECT.md verify-list) — surface this to admin so refunds are an informed decision. |
| Platform Health: webhook_events log, reconciliation sweep, email-cap gauge, stuck-transfer alerts | In scope. This is what makes the money-correctness DoD provable | HIGH | Reconciliation (Stripe-paid but no transfer → flag) is the single most important safety feature; it's how the deliberately-dropped-webhook test passes. |
| Admin booking alert on new paid transfer | In scope. Operator situational awareness | LOW | One of the ~4 emails/transfer budget. |

#### CROSS-CUTTING / PLATFORM

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PWA shell (installable, offline-aware), Montserrat, EN/BG toggle | In scope. Drivers especially benefit from install + offline-tolerant shell | MEDIUM-HIGH | Verify Next.js PWA tooling on current Next + Vercel (PROJECT.md verify-list). Offline-aware ≠ offline-first; cache the shell, show a "reconnecting" state. |
| `paid` set only by verified, idempotent, signature-checked webhook | In scope. Core money-correctness invariant | MEDIUM | Idempotent on Stripe event id. |
| RLS + field masking for PII boundary | In scope. The real privacy boundary | HIGH | Test that the API (not just UI) refuses PII to unclaimed drivers. |

### Differentiators (Competitive Advantage — nice, optional for pilot)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Driver opt-in daily digest instead of per-transfer email | Keeps under Resend 100/day cap AND is genuinely good driver UX (less inbox spam, one morning summary) | MEDIUM | In scope. This is both a constraint-workaround and a real differentiator — sources confirm digests reduce notification fatigue. Keep it opt-in. |
| Guest live "driver on the way" status (en_route → arrived) without email | Reassurance at the highest-anxiety moment (airport pickup) via the in-app/magic-link page, not email | LOW | Already implied: status page reflects en_route even though no email fires for it. Lean into the status page as the live-tracking surface. |
| Destination zone/area shown pre-claim (not exact address) | Lets drivers self-select by geography while preserving privacy — the elegant core of the self-claim model | MEDIUM | In scope. This is the product's signature mechanic; make the zone meaningful (named area, not just lat/long). |
| Reconciliation "deliberately-dropped-webhook" provability | Operator confidence that no paid booking is ever lost — rare in small operations, a real trust differentiator | HIGH | In scope under Platform Health. |
| Bilingual EN/BG toggle (guest + driver facing) | Mixed BG-local drivers + international guests; lightweight toggle covers it | LOW-MEDIUM | In scope. Toggle only, not full i18n framework (correctly out of scope). |

### Anti-Features (Commonly Requested, Often Problematic — DELIBERATELY NOT BUILDING)

These align with PROJECT.md Out of Scope. Listed so the roadmap actively resists them.

| Feature | Why Requested | Why Problematic (for this pilot) | Alternative |
|---------|---------------|----------------------------------|-------------|
| Guest-facing self-service cancellation/refund | Feels customer-friendly | Bookings are prepaid & non-refundable by design; a self-refund flow invites abuse and contradicts the model. Refund logic + fee-handling is real engineering | Clear upfront "non-refundable" disclosure + admin-issued manual refund for genuine exceptions only |
| Auto-dispatch / driver assignment algorithm | "Smarter" than self-claim | Adds matching logic, fairness rules, fallback chains, timeouts — large surface for a 10-transfer pilot. Self-claim is concurrency-safe by construction | Self-claim pool with atomic UPDATE (in scope) |
| Flight tracking / dynamic pickup-time adjustment | Airport transfers "should" track flights | External API dependency, edge cases (delays/diversions), not core to validating the booking+claim loop | Guest enters arrival time; driver sees it. Add later if pilot demands. |
| Driver un-claim / give-back | "Drivers should be able to drop a job" | Re-opens concurrency + fairness questions; encourages cherry-picking churn; undermines first-to-claim commitment | No un-claim (per scope). Admin reassign covers genuine drop-out. |
| SMS / WhatsApp notifications | "Most reliable for travel-day" | Adds a paid channel + provider integration + opt-in/compliance; email + in-app is enough for a pilot | Email (transactional) + in-app feed; status page as live surface |
| Property self-service onboarding portal | Scales supply without admin | A whole second auth/role/UI surface; unnecessary at 1 company / 3 properties | Admin onboards on companies' behalf (in scope) |
| Pricing engine / dynamic fares | Revenue optimisation | Premature; manual fixed price per destination is correct for validating the loop | Manual price per destination (in scope) |
| Per-transfer driver email (instead of digest) | "Drivers want instant email" | Blows the Resend 100/day cap immediately at any real volume | In-app feed (instant) + opt-in daily digest (in scope) |
| Guest accounts / login / saved bookings | "Standard for booking apps" | Guestless checkout is a deliberate friction-reduction; accounts add auth surface for a one-shot transaction | Magic-link status tracking (in scope) |
| Multi-stop / multi-vehicle bookings | Common in transfer software | The pilot is single airport→property; multi-stop is a different product | Single-leg transfer only |

---

## Feature Dependencies

```
[Stripe Checkout session creation]
    └──requires──> [Destination + price + slug] (admin onboarding)

[paid status] (verified webhook)
    └──requires──> [webhook_events log + idempotency]
    └──triggers──> [guest confirmation email]
    └──triggers──> [admin booking alert]
    └──gates──────> [transfer appears in claim pool]   (only paid transfers are claimable)

[Atomic claim] (claimed status)
    └──requires──> [transfer is paid]
    └──triggers──> [PII unlock for claiming driver]   (RLS + field masking)
    └──triggers──> [driver-assigned email to guest]
    └──triggers──> [transfer moves from pool to "My run"]

[Driver-arrived email to guest]
    └──requires──> [arrived status transition by driver]

[My run ordering]
    └──requires──> [multiple active claims allowed] + [arrival time field]

[Magic-link status page]
    └──requires──> [guest email] + [Supabase auth magic link]
    └──reflects───> [full lifecycle incl. en_route]   (even states with no email)

[Reconciliation sweep]
    └──requires──> [webhook_events log] + [scheduled function]
    └──conflicts-with──> [Vercel Hobby cron precision]  (prefer Supabase scheduling per PROJECT.md)

[RLS PII boundary] ──enhances──> [claim pool] (makes pre-claim masking real, not cosmetic)
```

### Dependency Notes

- **Claim pool requires paid:** Only verified-paid transfers should ever be claimable; an unpaid transfer in the pool risks a driver fulfilling unpaid work. The pool query filters on `status='paid'`.
- **PII unlock requires claim:** The unlock is the reward/consequence of claiming and must be enforced at RLS, so it depends on the claim transition committing first.
- **My-run ordering requires arrival-time field + multiple-claims:** Ordering only matters because multiple active claims are allowed; it's cheap but depends on a sortable arrival timestamp existing on the transfer.
- **Reconciliation conflicts with Vercel Hobby cron precision:** The 15–30 min sweep needs reliable scheduling; PROJECT.md already flags preferring Supabase scheduling with Vercel cron as a daily backstop. Roadmap should schedule the sweep on Supabase, verify pg_cron availability.
- **Status page reflects states that emit no email:** `en_route` has no email by design; the magic-link page is the only place the guest sees it. So the status page is load-bearing for guest reassurance — don't treat it as secondary.

---

## MVP Definition

### Launch With (v1 — the pilot)

This is essentially the PROJECT.md Active list, reordered by dependency, plus the small omitted table-stakes.

- [ ] Admin onboarding (company/property/destination + price + commission) — supply must exist before anything books
- [ ] Slug-link booking form + Stripe Checkout session — the entry point
- [ ] Verified idempotent webhook sets `paid` + webhook_events log — money correctness, non-negotiable
- [ ] Guest confirmation email + admin booking alert on paid — table-stakes trust
- [ ] **Upfront non-refundable disclosure at checkout** — cheap chargeback insurance (omitted gap)
- [ ] **Payment record visible on guest status page / receipt in confirmation email** — real-money proof (omitted gap)
- [ ] Magic-link guest status page with full lifecycle timeline — table-stakes tracking
- [ ] Driver invite (closed pool) — supply side of fulfilment
- [ ] Limited-detail claim pool + atomic first-to-claim + "already claimed" loss UX — signature mechanic + DoD
- [ ] PII unlock on claim via RLS + field masking — privacy boundary, DoD
- [ ] Driver "My run" list **sorted by arrival time** + per-state advancement controls — fulfilment (ordering = omitted gap)
- [ ] driver-assigned + driver-arrived guest emails — table-stakes status comms
- [ ] In-app notification feed/bell (driver-primary) — primary driver channel
- [ ] Opt-in daily driver digest — Resend-cap survival
- [ ] Admin transfers list/detail + assign/reassign/cancel + manual Stripe refund — operations
- [ ] Platform Health: reconciliation sweep + email-cap gauge + stuck-transfer alerts — provable correctness (DoD)
- [ ] PWA shell + brand tokens + Montserrat + EN/BG toggle — delivery surface

### Add After Validation (v1.x — once the loop is proven)

- [ ] Driver-arrived push (PWA web push) to replace/augment email — trigger: pilot shows email latency hurts travel-day UX
- [ ] Guest 24h-before reminder email — trigger: longer booking lead-times appear (sources cite this as standard, but a pilot booking close to travel may not need it; it also costs against the 100/day cap)
- [ ] Richer pre-claim zone info (map snippet of area) — trigger: drivers want better geography signal before claiming
- [ ] Downloadable PDF receipt / VAT-style invoice — trigger: business/company guests request formal receipts

### Future Consideration (v2+ — explicitly deferred per Out of Scope)

- [ ] Stripe Connect commission payout — already deferred; commission only recorded in v1
- [ ] Flight tracking + dynamic pickup time — deferred
- [ ] Property self-service portal — deferred
- [ ] SMS/WhatsApp channel — deferred
- [ ] Auto-dispatch — deferred (self-claim is the v1 model)
- [ ] Second platform module (tours, car rental) — deferred; platform boundary built to enable it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Verified webhook → paid + webhook_events log | HIGH | MEDIUM | P1 |
| Atomic claim + "already claimed" UX | HIGH | MEDIUM | P1 |
| PII masking via RLS | HIGH | HIGH | P1 |
| Slug-link booking + Checkout | HIGH | MEDIUM | P1 |
| Magic-link status page + timeline | HIGH | MEDIUM | P1 |
| Admin onboarding CRUD | HIGH | MEDIUM | P1 |
| Reconciliation sweep | HIGH | HIGH | P1 |
| Guest confirmation + driver-assigned/arrived emails | HIGH | LOW | P1 |
| In-app feed + driver digest | HIGH | MEDIUM | P1 |
| Admin transfers ops (assign/reassign/cancel/refund) | HIGH | MEDIUM | P1 |
| Non-refundable disclosure at checkout | MEDIUM | LOW | P1 (gap) |
| Payment record on status page / receipt | MEDIUM | LOW | P1 (gap) |
| My-run ordering by arrival time | MEDIUM | LOW | P1 (gap) |
| PWA shell + EN/BG toggle | MEDIUM | MEDIUM-HIGH | P2 |
| 24h-before reminder email | MEDIUM | LOW | P3 (cap-sensitive) |
| Web push (replace driver-arrived email) | MEDIUM | MEDIUM | P3 |
| PDF receipt | LOW | MEDIUM | P3 |

## Competitor Feature Analysis

| Feature | Comparable products | Our Approach |
|---------|---------------------|--------------|
| Pre-claim earnings/location visibility | Dispatch: "see pay + destination before claiming"; Para: all info in "Works" tab ahead of time | Same transparency, but **privacy-masked**: zone not address, no PII until claim — stricter than typical couriers because of EEA PII sensitivity |
| First-come job claiming | Dispatch / Roadie / Para: self-select, first-come | Atomic conditional UPDATE → concurrency-safe by construction; no un-claim (stronger commitment than gig courier norms) |
| Booking confirmation timing | Airport-transfer norm: confirmation within minutes incl. driver contact | Confirmation on verified webhook only; driver contact appears on status page after claim |
| Status updates | Transfer norm: 24h reminder + "driver en route" message | Status page reflects all states live; emails only on claimed + arrived (cap discipline); en_route is page-only |
| Cancellation policy | Booking.com/hotels: upfront plain-language non-refundable disclosure, empathy in messaging | Upfront non-refundable line at checkout + admin-only manual refunds |
| Notification volume control | Courier/notification platforms: batch high-volume events into digests | Opt-in daily driver digest + in-app feed; ~4 emails/transfer for guest/admin |

## Sources

- [Airport Transfer Booking: Timeline and Best Practices](https://www.philadelphialimoservice.net/blog/faqs/airport-transfer-booking-timeline-and-best-practices/) — confirmation timing, en-route updates, driver contact in confirmation
- [10 Booking Confirmation Email Examples (upvio)](https://upvio.com/blog/online-scheduling/10-booking-confirmation-email-examples) — confirmation content/structure
- [Booking Confirmation Email Tips (Mailchimp)](https://mailchimp.com/resources/booking-confirmation-email/) — speed, mobile-friendly, searchable subject
- [Managing cancellations (Booking.com Partners)](https://partner.booking.com/en-us/solutions/advice/managing-cancellations) — non-refundable messaging, empathy, upfront disclosure
- [Hotel Cancellation Policy guide (Prostay)](https://www.prostay.com/blog/hotel-cancellation-policy/) — plain-language upfront terms, FTC/EU disclosure
- [The Dispatch Difference: Driver App](https://www.dispatchit.com/blog/the-dispatch-difference-the-driver-app) — pre-claim pay/destination visibility, self-select model
- [ParaWorks courier driver jobs](https://www.withpara.com/courier-driver-jobs) — claim-before-accept info disclosure
- [Best Practices for PII Security in Delivery (GreatHorn)](https://www.greathorn.com/blog/best-practices-for-securing-pii-in-ecommerce-and-delivery-services/) — delivery PII risk (DoorDash breach), access minimisation
- [Transactional Notifications (NN/g)](https://www.nngroup.com/articles/transactional-notifications/) — which events warrant which channel
- [Transactional vs Product vs Marketing Notifications (Courier)](https://www.courier.com/blog/transactional-product-and-marketing-notifications-what-are-the-differences) — channel selection + batching/digest
- [Notification system design + batching (Medium)](https://medium.com/@bangermadhur/design-a-notification-system-a-complete-system-design-guide-3b20d49298de) — digest/batching to control volume
- [Multi-driver route scheduling (Upper)](https://www.upperinc.com/features/route-scheduling/) — driver day/list views, ordering multiple pickups

---
*Feature research for: prepaid airport-transfer booking + self-claim driver dispatch PWA (Balkanity Welcome Pickup v1)*
*Researched: 2026-06-17*
