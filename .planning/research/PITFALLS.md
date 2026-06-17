# Pitfalls Research

**Domain:** Prepaid airport-transfer marketplace PWA (Next.js/Vercel + Supabase + Stripe Checkout + Resend), self-claim driver dispatch, real-money pilot
**Researched:** 2026-06-17
**Confidence:** HIGH (Stripe webhook/refund behavior, Supabase pause + pg_cron, Resend caps, Postgres atomic UPDATE all verified against official docs / current 2026 sources; Next PWA gotchas MEDIUM)

This document is opinionated and scoped to THIS stack and THIS definition of done: **0 double-claims under concurrency, 100% of `paid` set only by verified webhooks, reconciliation catches a deliberately-dropped webhook.** Generic web-security advice is omitted; everything below is a way this specific pilot can lose money, leak PII, or silently die.

---

## Critical Pitfalls

### Pitfall 1: Setting `paid` on the client redirect (success URL) instead of the webhook

**What goes wrong:**
After Stripe Checkout, the customer is redirected to `success_url?session_id=...`. The tempting shortcut is to read that on the client/server-action and flip the transfer to `paid`. The redirect is spoofable (anyone can hit the success URL with a guessed/known session id), happens before funds are actually captured in edge cases, and **does not fire at all** if the customer closes the tab after paying. Result: transfers marked paid that weren't, or paid transfers never marked paid → a driver claims an unpaid run, or a real payment never enters the pool.

**Why it happens:**
The redirect is the visible, easy signal; the webhook requires extra infrastructure (endpoint, signature secret, idempotency table) and feels like duplicate work. Many tutorials still show "read session on success page" patterns.

**How to avoid:**
- `paid` is set in exactly ONE place: the verified `checkout.session.completed` webhook handler, gated on `session.payment_status === 'paid'`. This is a locked constraint in PROJECT.md — enforce it as a code-review gate and ideally a DB-level guard (e.g. a trigger/policy that only the service-role webhook path can transition `requested → paid`).
- The success page is display-only: it shows "Thanks, confirming your payment…" and polls/subscribes to the transfer row. It NEVER writes payment state. If `paid` hasn't arrived yet, show a pending state.
- Grep guard: no `UPDATE ... status = 'paid'` anywhere except the webhook module.

**Warning signs:**
Any `paid` write reachable from a route handler tied to `success_url`; a `session_id` query param being trusted; transfers flipping to paid in local dev without the Stripe CLI forwarding webhooks.

**Phase to address:** Payments/Checkout phase (the phase that introduces the Checkout Session + webhook). Verify in the same phase as part of the "100% paid from webhook" DoD.

---

### Pitfall 2: Webhook handler not verifying the Stripe signature (or verifying against a mangled body)

**What goes wrong:**
Either the handler trusts the POST body without `stripe.webhooks.constructEvent(...)`, or it verifies but the framework already parsed/re-serialized the body so the signature check fails (and gets disabled "to make it work"). Without verification, anyone who learns the endpoint URL can POST a fake `checkout.session.completed` and mint a paid transfer for free.

**Why it happens:**
In Next.js App Router, the default expectation is JSON parsing. Stripe signature verification requires the **raw** request body. Devs call `await req.json()` (or a middleware does), which corrupts the bytes Stripe signed over → verification fails → frustrated dev removes the check.

**How to avoid:**
- Read the raw body with `await req.text()` in the route handler and pass that exact string to `constructEvent(rawBody, sig, endpointSecret)`. Never `req.json()` before verifying.
- Store the webhook signing secret (`whsec_...`) in Supabase Edge Function secrets / Vercel env — never in client bundle, never committed.
- Return 400 on signature failure; return 2xx only after the event is durably recorded.
- Decide where the handler lives: a **Supabase Edge Function** is the cleaner home (keeps the service-role write path off Vercel and out of the client tier) — but a Vercel route handler also works if raw-body handling is correct. Pick one and document it.

**Warning signs:**
`req.json()` in the webhook file; signature verification wrapped in try/catch that swallows and proceeds; "it works locally but not in prod" (often a body-parsing/proxy difference).

**Phase to address:** Payments/Checkout phase. Test by sending an unsigned/forged POST and asserting 400 + no state change.

---

### Pitfall 3: Non-idempotent webhook handler double-processes retried events

**What goes wrong:**
Stripe guarantees **at-least-once** delivery and retries with backoff for up to ~72h. The same `evt_...` can arrive multiple times, sometimes concurrently. A naive handler re-runs fulfillment each time: duplicate confirmation emails (burning the Resend 100/day cap), duplicate notification rows, or — worse if refund/Connect logic is added later — duplicate financial actions.

**Why it happens:**
"It worked when I tested once" — retries and concurrent redelivery only show up under real traffic or when the handler is briefly slow/erroring and Stripe retries.

**How to avoid:**
- A `webhook_events` table keyed on Stripe `event.id` with a **UNIQUE/PRIMARY KEY** constraint (this is already in the Active requirements — make it the actual dedup mechanism, not just a log). Insert the event id first; if the insert violates the unique constraint, short-circuit and return 200. Record signature result + outcome per the brief.
- Make the downstream effects idempotent too: setting `paid` is naturally idempotent if guarded (`WHERE status='requested'`); email sends should check an `email_log` before sending (see Pitfall 9).
- Do the insert-and-dedup inside a transaction with the state change so a crash mid-handler doesn't leave "logged but not applied" or "applied but not logged."

**Warning signs:**
No unique constraint on the event-id column; emails arriving in duplicate; reconciliation/health showing the same event id processed twice; handler that does work before recording the event.

**Phase to address:** Payments/Checkout phase + Platform Health phase (the `webhook_events` log is a shared platform foundation). Verify by replaying the same event id twice and asserting one effect.

---

### Pitfall 4: Double-claim via read-then-write instead of an atomic conditional UPDATE

**What goes wrong:**
Two drivers tap "Claim" on the same paid transfer within milliseconds. The code does `SELECT status` → sees `paid` → `UPDATE SET driver_id=...`. Both reads see `paid`, both writes succeed, last writer wins, two drivers believe they own the run. This directly violates the "0 double-claims" DoD.

**Why it happens:**
Read-then-write feels natural and reads fine in a single-user test. The race only manifests under concurrency, which manual testing rarely reproduces. RLS is mistaken for a concurrency control (it is not — see Pitfall 6).

**How to avoid:**
- Use the single atomic statement already specified in PROJECT.md:
  `UPDATE transfers SET status='claimed', driver_id=:driver, claimed_at=now() WHERE id=:id AND status='paid'` and branch on **rows affected**. 1 row = you won; 0 rows = already claimed/not claimable. Under Postgres default READ COMMITTED isolation this is atomic by construction: the second writer blocks on the row lock, then re-evaluates the `WHERE` against the committed `status='claimed'`, matches nothing, and affects 0 rows. (Verified: this is the documented READ-COMMITTED behavior for conditional updates.)
- Expose this as an RPC / single statement; do NOT split it into select + update in application code, and do NOT wrap it in a "check then act" guard.
- Use `RETURNING` to get the row back in the winning case for the UI/notification in the same round-trip.

**Warning signs:**
Any `SELECT ... status` immediately before the claim UPDATE; claim logic that branches on application-side state rather than `rowCount`/`RETURNING`; an ORM "find then save" pattern on the claim path.

**Phase to address:** Driver claim phase. **Verify with an actual concurrency test** (fire N simultaneous claims at one transfer, assert exactly one wins, N-1 get "already claimed") — this is a literal DoD line item, so make it an automated test.

---

### Pitfall 5: PII leaks through the API/anon key despite UI masking ("UI-only masking")

**What goes wrong:**
The pool UI hides name/exact-address/flight/contact, but the underlying query (or a PostgREST/anon-key call from devtools) returns the full row. An unclaimed driver — or anyone with the anon key, which ships to the browser — opens the network tab and reads every guest's address, phone, and flight number. The masking was cosmetic.

**Why it happens:**
Masking is implemented in React components, not at the data boundary. Devs assume "the driver can't see the field because the component doesn't render it," forgetting the JSON payload still contains it. The Supabase anon key is public by design, so RLS — not obscurity — is the only real boundary.

**How to avoid:**
- Enforce visibility at the **data layer**, not the component. Two robust options:
  1. **Column-restricted views/RPC:** the pre-claim pool reads from a view exposing only date, arrival time, airport, destination zone, fare, pax, luggage — never the PII columns. Full detail comes from a separate RPC/view that RLS restricts to the claiming driver + admin.
  2. **RLS policies on the base table** that gate PII columns by `driver_id = auth.uid()` (claimed-by-me) OR admin role. Note plain row-level RLS gates *rows*, not *columns*; for column-level masking prefer the view/RPC approach or a security-definer function returning only allowed fields.
- Treat the pre-claim pool and the claimed detail as **two distinct read paths** with different shapes, so it's structurally impossible for the pool query to return PII.
- Test by calling the pool endpoint directly with a non-claiming driver's JWT and asserting the payload has no PII keys.

**Warning signs:**
`SELECT *` on the transfers table for the pool; the same query/endpoint serving both pool and detail views; masking logic only in `.tsx`; PII fields present in a network response a driver shouldn't see.

**Phase to address:** Schema + RLS phase (define the boundary), Driver pool phase (consume the restricted view). Flag for review — RLS is a locked review-gate area.

---

### Pitfall 6: Assuming RLS is sufficient for claim safety / treating RLS as concurrency control

**What goes wrong:**
RLS is relied on to "make sure only one driver claims." RLS controls *who can read/write which rows*, not *who wins a race*. Two drivers who both satisfy the RLS write policy can both pass the policy check and still double-write if the statement isn't atomic. Conversely, an over-broad RLS write policy can let a driver claim a transfer already claimed by someone else if the WHERE guard is missing.

**Why it happens:**
RLS and concurrency are conflated because both are "database-level safety." They solve orthogonal problems.

**How to avoid:**
- Keep the two concerns separate and layered: **RLS** answers "may this driver attempt a claim at all" (authenticated, role=driver, transfer is in the pool); **the atomic `WHERE status='paid'` UPDATE** (Pitfall 4) answers "who actually gets it." Both must be present.
- The RLS write policy should still scope the update narrowly (a driver may only set `driver_id` to themselves), but never lean on it for mutual exclusion.

**Warning signs:**
Claim correctness justified solely by "RLS handles it"; no `status='paid'` predicate in the claim UPDATE; concurrency test absent because "RLS prevents it."

**Phase to address:** Schema + RLS phase and Driver claim phase together.

---

### Pitfall 7: Service-role key (or Stripe secret key) reaching the client bundle

**What goes wrong:**
The Supabase service-role key bypasses ALL RLS; the Stripe secret key can move money. If either is imported into client-reachable code (a component, a `NEXT_PUBLIC_` env var, or a shared module pulled into the client graph), it ships in the JS bundle and any visitor can read all PII, mark transfers paid, or issue refunds.

**Why it happens:**
Next.js makes it easy to accidentally import a server util into a client component; env naming mistakes (`NEXT_PUBLIC_` prefix on a secret); "temporary" use of service-role to bypass an RLS error during dev that never gets removed.

**How to avoid:**
- Service-role and Stripe secret keys live ONLY in server-only code: Supabase Edge Functions and/or Next server actions/route handlers marked `server-only`. Add the `server-only` package import to those modules so a client import fails the build.
- NEVER prefix a secret with `NEXT_PUBLIC_`. Audit env usage in CI.
- The browser uses only the anon/publishable key + RLS. The webhook and admin-privileged writes use service-role on the server.
- If an RLS policy is "fixed" by switching to service-role, that's a red flag — fix the policy instead.

**Warning signs:**
`SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` referenced in a `'use client'` file or without `server-only`; `NEXT_PUBLIC_` on anything secret; service-role client constructed in shared/util code imported broadly.

**Phase to address:** Foundation/auth phase (establish the server/client key boundary once, as a shared platform foundation). Re-verify in Payments and Admin phases.

---

### Pitfall 8: Supabase free-tier 7-day inactivity pause kills the pilot mid-run

**What goes wrong:**
Free Supabase projects pause after **7 days of database inactivity** (tracked against actual DB queries, not dashboard visits or API noise). A paused project takes ~30s to wake and, more importantly, **pg_cron jobs don't run while paused** — so the reconciliation sweep stops, a dropped webhook goes uncaught, and a real guest's paid transfer never surfaces. For a low-volume 10-transfer pilot, week-long quiet gaps are entirely plausible.

**Why it happens:**
Low pilot traffic + the metric being DB activity specifically. Teams assume "we logged into the dashboard, it's active" — it isn't.

**How to avoid:**
- Add a **keep-alive** that issues a trivial DB query on a schedule independent of user traffic (e.g. a GitHub Actions cron hitting a lightweight endpoint that touches the DB, or a small scheduled write). This is explicitly called out in PROJECT.md VERIFY — implement it, don't just note it.
- Note the dependency loop: pg_cron itself can't keep the project alive if no external pings arrive, since a paused project's cron doesn't fire. The keep-alive must come from OUTSIDE Supabase (GitHub Actions / Vercel cron / uptime pinger).
- For a real-money pilot, seriously weigh upgrading to Supabase Pro for the pilot window — pause risk on live payments is a poor trade for the cost. Document the decision.

**Warning signs:**
Reconciliation sweep silently stopped; dashboard shows "paused"; first request after a quiet weekend is slow; no external pinger configured.

**Phase to address:** Infrastructure/Platform Health phase. Verify by leaving the project idle past a weekend in staging and confirming it stayed up.

---

### Pitfall 9: Resend 100/day cap exhaustion via per-transfer email fan-out

**What goes wrong:**
The cap that actually bites is **100 emails/day** (the 3000/month is rarely the limiter — bursty days hit the daily cap first, confirmed as the #1 reason teams leave the free tier). The brief budgets ~4 guest/admin emails per transfer (confirmation + driver-assigned + driver-arrived + admin alert). Add per-transfer driver emails and a busy day blows the cap; once exhausted, the **guest payment-confirmation email silently fails** — a real customer pays and hears nothing.

**Why it happens:**
Emails are added incrementally per feature; nobody sums the per-transfer fan-out against 100/day. Webhook retries (Pitfall 3) can multiply sends. Failures are swallowed.

**How to avoid:**
- Drivers get **in-app notifications + an opt-in daily digest**, NOT per-transfer email — already a locked decision; enforce it (no per-transfer driver email path exists).
- Guest status emails fire only on `claimed` and `arrived` (NOT `en_route`) — already decided; keep it.
- Implement an **`email_log`** and an **email-cap gauge** (both in Active requirements). Check the log before sending (also serves idempotency from Pitfall 3) and surface a health alarm at ~80% of daily cap.
- Verify the sending **domain** in Resend (one verified domain on free tier) so confirmations don't land in spam — deliverability failure looks identical to "email didn't send" from the guest's side.
- Treat the guest payment confirmation as the highest-priority email; never let lower-priority sends (admin alerts) exhaust the budget ahead of it. Consider prioritizing/ordering sends.

**Warning signs:**
Any per-transfer driver email; no email_log; sends with no success/failure recording; Resend 429s in logs; cap gauge absent; unverified domain.

**Phase to address:** Notifications phase (shared platform foundation: Resend wrapper + send guardrails + email_log) and Platform Health phase (cap gauge/alarm).

---

### Pitfall 10: Reconciliation sweep that isn't actually reliable (the DoD's third leg)

**What goes wrong:**
The DoD requires reconciliation to catch a **deliberately-dropped webhook** (Stripe shows paid, but no transfer reached `paid`). If the sweep runs on an unreliable schedule, queries Stripe wrong, or only checks one direction, the dropped payment is never caught — failing the DoD and, in production, stranding a paying guest.

**Why it happens:**
Scheduling is harder than it looks on this stack: **Vercel Hobby cron runs ~once/day and is imprecise** (PROJECT.md VERIFY), too coarse for a 15–30 min sweep. pg_cron on Supabase is the right tool but needs Postgres ≥ v15.6.1.122 / pg_cron ≥ 1.6.4 for reliability + auto-revive, and won't run while the project is paused (Pitfall 8).

**How to avoid:**
- Run the sweep via **Supabase pg_cron + pg_net → Edge Function** every 15–30 min (the recommended Supabase scheduling path); use Vercel Hobby cron only as a once/day backstop, never the primary.
- Make the sweep bidirectional and idempotent: list recent Stripe `checkout.session.completed` / paid sessions, match each to a transfer; **flag any Stripe-paid session with no corresponding `paid` transfer** (the dropped-webhook case) AND optionally any `paid` transfer with no Stripe record. Recovery action: re-apply the paid transition idempotently (reuse the same event-id dedup so it can't double-process).
- Upgrade Postgres to get pg_cron ≥ 1.6.4. Keep each job < 10 min and < 8 concurrent jobs (Supabase guidance).
- **Test the DoD directly:** intentionally drop/ignore one webhook in staging and assert the sweep flags + heals it.

**Warning signs:**
Sweep scheduled only on Vercel cron; one-directional check; sweep not idempotent (re-marks/re-emails on every run); Postgres below the recommended version; no test that deliberately drops a webhook.

**Phase to address:** Platform Health phase. This is a DoD line item — make the dropped-webhook test a gate.

---

### Pitfall 11: Refund issued without accounting for the retained processing fee (pilot economics)

**What goes wrong:**
Admin issues a manual full Stripe refund for an exception. Stripe **does not return the original processing fee** on refunds (verified, current 2026 — payment-processing, Connect, and currency-conversion fees are retained by card networks/banks). For BG/EUR that's EEA 1.5%+€0.26 (or non-EEA 3.25%+€0.26, +2% conversion) gone per refunded transfer. If the pilot assumes refunds are cost-neutral, each exception quietly loses money, and the books won't reconcile.

**Why it happens:**
"Full refund" intuitively sounds like "everything back." The fee retention is a Stripe/card-network policy that's easy to miss until the payout statement doesn't match.

**How to avoid:**
- Bake the fee model into pricing/records from the start: the recorded transfer economics should treat the processing fee as sunk on any refund. Surface "this refund will not recover the ~€X processing fee" in the admin refund UI so it's a conscious decision.
- Because bookings are prepaid & non-refundable by policy (admin-only exception refunds), keep refund volume low by design — don't build a guest-facing refund flow (out of scope, correctly).
- VERIFY exact current BG/EUR Stripe rates before the pilot (PROJECT.md flags this) and record the fee per transaction for reconciliation.

**Warning signs:**
Refund UI implies full recovery; commission/economics math assumes fee return; payout totals don't match expected after a refund.

**Phase to address:** Payments phase (Checkout fee recording) + Admin operations phase (refund UI). MEDIUM-HIGH given real money.

---

### Pitfall 12: PWA service worker serving stale auth/state or caching dynamic data

**What goes wrong:**
A service worker (next-pwa/Serwist) caches the app shell — and, if misconfigured, caches authenticated HTML or API responses. A driver sees a stale claim pool (a transfer they think is open is already claimed → frustrating "already claimed" on tap, or worse a stale "you own this"), or the start URL serves a logged-in shell to a logged-out user (or vice versa). Money/claim state must never be read from a stale cache.

**Why it happens:**
Default precaching strategies are tuned for static content. App Router adds its own caching layers that interact subtly with the SW. The start URL renders differently per auth state but is cached as one document.

**How to avoid:**
- Cache only the **static shell** (assets, fonts/Montserrat, logo/pictograms, offline fallback). Use **NetworkFirst** (or no SW caching) for all dynamic/auth/data requests — claim pool, transfer status, anything money/PII related must hit the network.
- If caching the start URL, set `dynamicStartUrl: true` so logged-in vs logged-out HTML isn't cross-served.
- Drive live claim/status off Supabase Realtime or short polling, not the SW cache, so the pool reflects truth.
- Version/bust the SW on deploy so stale chunks don't linger; test an update path (new deploy → client picks it up).
- VERIFY current Next + Vercel PWA tooling (PROJECT.md flag) — choose Serwist or next-pwa deliberately for current Next App Router.

**Warning signs:**
Drivers report seeing claimed transfers as open; auth state "sticks" after logout; data not updating until hard refresh; SW caching `/api` or RSC payloads.

**Phase to address:** PWA shell phase (define caching strategy as a shared foundation), re-checked in Driver pool phase.

---

### Pitfall 13: Module code leaking into shared platform foundations (boundary erosion)

**What goes wrong:**
Welcome-Pickup-specific concepts (transfer, claim, airport, slug link) leak into the shared foundations (users/auth, companies/properties, payments, notifications, Platform Health, design system, PWA shell). The second module (tours, car rental) then can't reuse the foundation without dragging transfer-specific assumptions, making it expensive to build — which PROJECT.md flags as **the highest-cost mistake to get right.**

**Why it happens:**
It's faster, in the moment, to put a `transfer_id` column on a shared notification table or hardcode "transfer" copy into the notification wrapper than to model a generic entity reference. Single-module tunnel vision.

**How to avoid:**
- Keep a hard list (already in PROJECT.md Context) of platform vs module concerns and review every shared-table/shared-component change against it. Flag schema changes for review (locked gate).
- Shared abstractions stay generic: notifications reference a polymorphic `(entity_type, entity_id)` rather than `transfer_id`; payments expose generic Checkout/webhook/refund hooks, not transfer-aware ones; the notification/email wrapper takes templates, not transfer-specific logic.
- Module-specific logic (claim pool, lifecycle, slug link) lives in clearly module-scoped code, not in foundation modules.
- Litmus test for any shared file: "Would a car-rental module need to change this to reuse it?" If yes, it's leaking.

**Warning signs:**
`transfer`-named columns/types in foundation tables; "transfer"/"pickup" strings in the generic notification/email wrapper; foundation code importing module code; the design system referencing transfer-specific components.

**Phase to address:** Every phase that touches a shared foundation — especially Foundation/auth, Payments, Notifications, Platform Health, Design system, PWA shell. Make boundary review a standing checklist item.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Set `paid` on success redirect | One less moving part to build | Spoofable payments / missed payments; fails DoD | **Never** |
| Read-then-write claim | Familiar ORM pattern | Double-claims under concurrency; fails DoD | **Never** |
| UI-only PII masking | Ships the pool view fast | Full PII leaks via anon-key API | **Never** |
| Service-role to "fix" an RLS error | Unblocks dev immediately | RLS bypass ships; total PII/payment exposure | **Never** (fix the policy) |
| Vercel Hobby cron for reconciliation | No pg_cron setup | ~daily, imprecise → dropped webhook uncaught; fails DoD | Only as a daily backstop behind pg_cron |
| Skip email_log / cap gauge | Faster notifications phase | Silent guest-confirmation failures at cap; dup emails on retries | Never for the guest confirmation path |
| Stay on Supabase free tier for the pilot | Zero cost | 7-day pause stops reconciliation on live money | MVP-only with an external keep-alive; consider Pro for the live pilot |
| `transfer_id` on shared tables | Quick to wire | Second module expensive (the #1 flagged cost) | Never on foundation tables — use polymorphic ref |
| Cache dynamic data in the service worker | Snappy offline feel | Stale claim/auth/money state | Never for claim/status/PII; shell-only caching OK |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Checkout | Trust `success_url`/`session_id` to mark paid | Mark paid only in verified `checkout.session.completed` webhook, gated on `payment_status==='paid'` |
| Stripe webhook | `req.json()` before verifying → signature fails → check disabled | `req.text()` raw body → `constructEvent(raw, sig, whsec)`; 400 on failure |
| Stripe webhook | Reprocessing retried/duplicate events | Unique constraint on `event.id` in `webhook_events`; insert-first, short-circuit on conflict |
| Stripe refunds | Assume full refund returns the fee | Fee is retained; record fee, surface non-recovery in admin UI |
| Supabase RLS | Anon key + RLS treated as "private" but query returns PII columns | Restricted view/RPC per audience; PII only on claimed-driver/admin path |
| Supabase free tier | Assume dashboard activity prevents pause | External keep-alive touching the DB; pause = no cron |
| Supabase pg_cron | Old Postgres/pg_cron, unreliable jobs | Upgrade to pg_cron ≥1.6.4; jobs <10min, <8 concurrent; pg_net→Edge Function |
| Resend | Per-transfer email fan-out blows 100/day; sends unlogged | Drivers in-app+digest; email_log + cap gauge; verified domain; check log before send |
| Next.js PWA | SW caches auth HTML / dynamic data | Shell-only precache + NetworkFirst for dynamic; `dynamicStartUrl: true` |
| Vercel cron | Used as primary reconciliation scheduler | pg_cron primary (15–30 min); Vercel cron daily backstop only |

## Performance Traps

These matter little at 10 transfers but are cheap to get right now and expensive to retrofit.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling claim pool too aggressively | Many DB reads, Realtime/edge-invocation burn | Use Supabase Realtime subscription or modest poll interval | When driver count grows / free-tier invocation cap |
| Webhook handler doing slow work inline (emails, etc.) before 200 | Stripe retries → duplicate processing | Record event fast, return 2xx, do side-effects idempotently | Under retry storms even at low volume |
| `SELECT *` on transfers everywhere | PII over-fetch, larger payloads | Column-scoped views per audience | Immediately a security issue; perf later |
| Reconciliation scanning all Stripe history each run | Slow sweep, may exceed 10-min cron limit | Window the query to recent sessions | As transaction count grows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service-role / Stripe secret key in client bundle or `NEXT_PUBLIC_` | Total RLS bypass; anyone marks paid / reads all PII / refunds | `server-only` modules; never `NEXT_PUBLIC_` secrets; CI env audit |
| Webhook without signature verification | Forged "paid" events mint free transfers | `constructEvent` on raw body; 400 on failure |
| UI-only PII masking | Unclaimed drivers / anyone with anon key read guest address, phone, flight | Enforce at view/RPC/RLS data layer, not components |
| Exact address/flight/contact exposed pre-claim | Stalking/privacy harm; trust loss | Pool view exposes zone/area only; PII unlocks on claim to claiming driver + admin |
| RLS write policy too broad on claim | Driver overwrites another's claim | Narrow policy (set own driver_id only) + atomic `WHERE status='paid'` |
| Magic-link guest status leaking another guest's transfer | Cross-guest PII exposure | Scope status reads to the authenticated guest identity, not a guessable id |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Already claimed" shown as an error after a stale pool | Driver feels the app is broken | Treat 0-rows claim as a normal outcome; refresh pool gracefully, friendly message |
| Success page that just says "paid" before webhook lands | Guest sees "paid" then a contradicting pending state | Display-only "confirming payment…" that resolves when the row flips |
| Status conveyed by colour alone | Colour-blind users miss state | Coloured dot + text label always (already a brand rule) |
| Email confirmation silently not sent (cap/spam) | Guest pays, hears nothing, distrusts | email_log + cap gauge + verified domain; admin visibility |
| Install prompt fired too early / on every visit | Annoyance, dismissals | Defer `beforeinstallprompt`, show contextually |

## "Looks Done But Isn't" Checklist

- [ ] **Mark-as-paid:** Often only the webhook handler exists — verify NO other code path writes `paid`, and the success page is display-only.
- [ ] **Webhook idempotency:** Often "logged" but not deduped — verify a UNIQUE constraint on `event.id` and that replaying the same event causes exactly one effect.
- [ ] **Signature verification:** Often present but on a parsed body — verify raw `req.text()` and that a forged POST returns 400 with no state change.
- [ ] **Atomic claim:** Often a single-user happy path — verify a concurrency test (N simultaneous claims → exactly one winner).
- [ ] **PII boundary:** Often masked in UI only — verify the pool endpoint payload contains zero PII when called with a non-claiming driver's JWT.
- [ ] **Reconciliation:** Often "implemented" but never adversarially tested — verify it catches a deliberately-dropped webhook and heals idempotently.
- [ ] **Supabase pause:** Often unaddressed — verify an external keep-alive and that the project survived an idle weekend.
- [ ] **Resend cap:** Often no guardrail — verify email_log, cap gauge/alarm, and verified sending domain; confirm drivers have no per-transfer email path.
- [ ] **Key hygiene:** Verify service-role/Stripe secret keys are absent from the client bundle (grep build output / `server-only` enforced).
- [ ] **PWA freshness:** Verify a new deploy is picked up and that claim/status data is never served stale from the SW.
- [ ] **Refund economics:** Verify the processing fee is recorded as non-recoverable and surfaced in the admin refund UI.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dropped webhook (paid in Stripe, no transfer) | LOW (if reconciliation exists) | Reconciliation sweep flags + re-applies paid idempotently; if not, manual: find Stripe session, replay event, set paid via guarded path |
| Double-claim shipped | MEDIUM | Hotfix to the atomic UPDATE; admin reassigns the affected run; add concurrency test to prevent regression |
| PII leak via API | HIGH | Rotate anon key if needed, replace `SELECT *`/UI-masking with restricted views/RLS, audit access logs, assess disclosure obligations |
| Service-role key leaked to client | HIGH | Rotate the key immediately in Supabase, redeploy, audit for misuse, add `server-only` + CI guard |
| Resend cap exhausted | MEDIUM | Prioritize guest confirmations; move drivers to digest; add cap gauge; if recurring, upgrade plan; manually resend missed confirmations |
| Supabase project paused mid-pilot | MEDIUM | Resume (~30s), run reconciliation immediately to heal anything missed during downtime, add external keep-alive / move to Pro |
| Refund fee not accounted | LOW | Adjust economics records; update admin UI to show non-recovery; reconcile payouts |
| Boundary erosion discovered late | HIGH | Refactor shared tables to polymorphic refs / extract module logic — costly once data exists; cheaper if caught at review |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `paid` on redirect, not webhook | Payments/Checkout | Forge success URL → no paid write; success page is display-only |
| Missing/incorrect signature verification | Payments/Checkout | Forged unsigned POST → 400, no state change |
| Non-idempotent webhook | Payments/Checkout + Platform Health | Replay same event id → one effect; UNIQUE constraint exists |
| Double-claim (read-then-write) | Driver claim | Concurrency test: N claims → 1 winner, N−1 "already claimed" |
| PII leak via API (UI-only mask) | Schema+RLS / Driver pool | Pool endpoint with non-claiming JWT → no PII in payload |
| RLS assumed sufficient for claim | Schema+RLS + Driver claim | Claim correctness proven by atomic UPDATE + concurrency test, not RLS |
| Service-role/secret key to client | Foundation/auth | Build output grep; `server-only` enforced; no `NEXT_PUBLIC_` secrets |
| Supabase 7-day pause | Infrastructure/Platform Health | Idle-weekend test stays up; external keep-alive configured |
| Resend cap exhaustion | Notifications + Platform Health | email_log present; cap gauge alarms; no per-transfer driver email; verified domain |
| Unreliable reconciliation | Platform Health | Deliberately drop a webhook → sweep flags + heals idempotently |
| Refund fee not accounted | Payments + Admin ops | Admin refund UI shows non-recoverable fee; fee recorded per txn |
| PWA stale auth/data caching | PWA shell / Driver pool | New deploy picked up; claim/status never stale from SW |
| Module/platform boundary erosion | Every shared-foundation phase | "Would a 2nd module change this?" review; no `transfer_*` in foundation tables |

## Sources

- Stripe — Fulfill orders / Checkout fulfillment (use `payment_status`, handle multiple/concurrent calls): https://docs.stripe.com/checkout/fulfillment
- Stripe — Receive events in your webhook endpoint (at-least-once delivery, retries ~72h, idempotency via event id): https://docs.stripe.com/webhooks
- Stripe — Webhook signature verification (raw body, `constructEvent`): https://docs.stripe.com/webhooks/signature
- Stripe — Refunds (processing/Connect/conversion fees not returned): https://docs.stripe.com/refunds and https://support.stripe.com/questions/understanding-fees-for-refunded-payments
- Stripe webhook best practices 2026 (raw body, dedup on event id, fast 200 + background): https://hookray.com/blog/stripe-webhook-best-practices-2026 ; https://www.hooklistener.com/learn/stripe-webhook-security-guide
- Next.js App Router Stripe webhook signature (use `req.text()`): https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f
- PostgreSQL concurrency — conditional UPDATE under READ COMMITTED returns 0 rows for the loser (atomic claim): https://www.postgresql.org/files/developer/concurrency.pdf ; https://github.com/evanj/postgres_test_and_set
- Supabase free-tier 7-day pause (tracked on DB activity; ~30s resume): https://www.itpathsolutions.com/supabase-free-tier-limits ; keep-alive via external cron: https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel
- Supabase pg_cron + pg_net to schedule Edge Functions; upgrade to pg_cron ≥1.6.4, <10min/job, <8 concurrent: https://supabase.com/docs/guides/functions/schedule-functions ; https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz
- Resend free tier (100/day, 3000/month, 1 verified domain; daily cap is the binding limit): https://automationatlas.io/answers/resend-free-tier-explained-2026/ ; https://tiergauge.com/tools/resend/
- Next.js PWA caching gotchas (stale data, `dynamicStartUrl`, NetworkFirst for dynamic): https://github.com/vercel/next.js/discussions/82498 ; https://ducanh-next-pwa.vercel.app/docs/next-pwa/configuring
- Project brief: .planning/PROJECT.md (constraints, security rules, VERIFY list, definition of done)

---
*Pitfalls research for: prepaid airport-transfer marketplace PWA (Next.js/Vercel + Supabase + Stripe + Resend), real-money pilot*
*Researched: 2026-06-17*
