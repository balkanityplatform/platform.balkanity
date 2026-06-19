# Phase 7: Notifications - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the lifecycle events the platform already emits into actual notifications, across two channels — an **in-app feed/bell** and **Resend transactional email** — under the Resend 100/day cap. This phase wires real sends into seams that earlier phases deliberately stubbed; it does NOT add new lifecycle events, new actors, or new business logic.

Delivers: **NOTF-01** (per-user in-app feed/bell), **NOTF-02** (guest "driver assigned" on `claimed` + "driver arrived" on `arrived`), **NOTF-03** (admin booking alert on new paid booking), **NOTF-05** (opt-in driver daily digest at a self-chosen time), **NOTF-06** (send-guardrail + `email_log` with cap alarm). It also un-stubs the already-built sends: the **guest booking-confirmation email** (BOOK-06 seam) and the **driver invite email** (NOTF-04, previously a manual copy-paste link).

**Out of scope (belongs to Phase 8 — Platform Health):** the reconciliation sweep, the visual email-cap *gauge*, stuck-transfer *alerts*, the keep-alive, and the **Supabase cron** that time-triggers the digest. Phase 7 builds the digest *content + opt-in preference + an invokable send*; the scheduled trigger that fires it is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### In-app feed/bell (NOTF-01)
- **D-01:** The bell is shown to **Drivers AND Admin** in v1 (not guests — the guest status page already shows their single transfer's state). NOTF-01 names drivers the primary channel; admin gets a bell as a queue-at-a-glance beyond email.
- **D-02:** **Driver** in-app events: (a) a new paid transfer enters the claimable pool, and (b) the driver's own claimed run is **reassigned / released / cancelled** by admin. (Covers "new work" + "changes to my owned work".) NOT a generic admin→driver message channel (that would be scope creep — no such requirement in v1).
- **D-03:** **Admin** in-app events: (a) a new paid booking (mirrors the NOTF-03 email), and (b) the **cap-near alarm** (see D-11). Stuck/needs-attention *alerts* stay Phase 8 (Phase 6 only highlights stuck rows in the list UI).
- **D-04:** **Live update = poll on focus + light interval** (~30–60s), matching Phase 6's pool-refresh approach. NOT Supabase Realtime — a realtime channel + reconnection + PWA/offline edge cases is more than a ~10-transfer pilot needs. (Realtime is a documented later upgrade; see Deferred.)
- **D-05:** **Read model:** per-user unread count badge on the bell; opening the feed/item marks read; a "mark all read" action. Read state persisted per-user in the notifications table.

### Driver daily digest (NOTF-05)
- **D-06:** Digest content = a **morning snapshot of the currently-claimable pool** (using the same masked fields as the Phase 5 `wp_pool` view — date, arrival time, airport, destination zone, flight no., fare, pax, luggage; NEVER guest PII) **plus the driver's own upcoming claimed runs for that day**.
- **D-07:** **Off by default — opt-in** (NOTF-05 wording; protects the cap; respects driver inbox preference).
- **D-08:** Per-driver **toggle + time-of-day picker** (the driver's self-chosen send hour). Stored as a driver preference. **The time-based trigger that fires due digests rides on the Supabase cron infrastructure that lands in Phase 8** — Phase 7 builds the digest builder, the preference setting/UI, and an invokable "send due digests" function; Phase 8 schedules it. Flag this seam to the planner.

### Email cap guardrail (NOTF-06)
- **D-09:** **Two priority tiers.** CRITICAL (always send, never dropped): guest **booking confirmation** + driver **invite** — a guest paid and needs their tracking link; a driver cannot onboard without the invite. BEST-EFFORT (dropped near cap): **admin booking alert** + **driver digest** (both have in-app fallbacks). Guest "driver assigned"/"arrived" emails rank just under critical (send unless cap pressure forces otherwise — treat as best-effort-high; planner may model as a 3rd implicit tier if cleaner, but the user chose the simpler 2-tier framing).
- **D-10:** **Soft block best-effort at ~90/100 daily sends** (CLAUDE.md "~90/day short-circuit"); keep sending critical emails above the threshold; record skipped sends. Threshold in an env/config constant.
- **D-11:** **Cap-near alarm = admin in-app notification only, NO extra email** (the bell costs zero against the cap). Phase 8 adds the visual email-cap *gauge* on top of the same `email_log`.
- **D-12:** A best-effort email dropped at the cap is **logged in `email_log` with a `skipped_cap` outcome and NOT auto-retried** (the in-app feed still carries the info, so nothing is truly lost). No next-day queue.

### Email delivery & invite (NOTF-04 + delivery reality)
- **D-13:** **Verify a sending subdomain** — `send.balkanity.com` — in Resend and send from **`noreply@send.balkanity.com`**. Subdomain is the Resend-recommended pattern (isolates transactional reputation from the apex). **This requires a manual DNS step by the user** (add the records Resend specifies). The current test sender (`onboarding@resend.dev`) only delivers to `balkanityplatform@gmail.com`.
- **D-14:** **Driver invite goes email-only** — remove the inline copy-paste link reveal (D-03/D-04 from Phase 2 was a deliberate stub because send wasn't wired; Phase 7 un-stubs it). NOTE: this drops the manual fallback; pair with D-15's verified-delivery gate so we don't ship a path that can't deliver.
- **D-15:** **Real delivery is a phase-completion gate** — the phase is not "done" until verified emails actually send to real recipients. CAVEAT (does not contradict the gate): **automated unit tests MUST still mock the Resend client** so CI/local never depend on live sends; the gate applies to phase completion / UAT, not to the test suite.
- **D-16:** **Guest "driver assigned" email carries driver first name + phone** (phone is a required field precisely for airport coordination; revealed only to the paying guest, post-assignment). The "driver arrived" email is a simple heads-up, no extra info.
- **D-17:** **Email language:** guest emails honor the **booking language (EN/BG)** the guest used, falling back to EN if not persisted; **admin alerts and driver invites in EN**. Researcher to confirm whether per-booking locale is stored on `wp_transfers`; if not, persisting it is a small add.

### Claude's Discretion
- The exact `notifications` table shape, the `email_log` schema, and the per-driver digest-preference storage (new columns vs a small preferences table) — researcher/planner decide, consistent with existing migration/RLS conventions (writes via service-role only; RLS SELECT policies; no client write policy).
- Email template authoring approach (plain HTML strings vs `react-email`) — CLAUDE.md lists `react-email` as optional; pick what matches the existing `confirmation-email.ts` style.
- Polling cadence exact value and whether the admin bell reuses the driver bell component.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Money & send seams (do not break)
- `CLAUDE.md` — money single-writer lock (`paid` set ONLY in the verified webhook), Resend cap facts (100/day, 3000/mo, 5 req/s, ~90/day guardrail), "drivers use in-app feed + opt-in digest, NOT per-transfer email", Serwist PWA, `server-only` key boundary.
- `platform/transfers/confirmation-email.ts` — the **stable seam** Phase 7 un-stubs: signature `sendBookingConfirmation(transferId, guestEmail)` stays IDENTICAL; swap `console.info` reveal → `resend.emails.send` + an `email_log` idempotency guard. Contains ZERO `wp_transfers` writes and must NOT introduce a second `paid` writer.
- `platform/transfers/confirmation.test.ts` + `platform/payments/single-writer.test.ts` — assert no `status: 'paid'` literal in the confirmation module; keep green.
- `app/api/stripe/webhook/route.ts` — the SOLE `paid` writer; the confirmation email + admin booking-alert hang off its verified `paid` transition (lines ~189–192 note Phase 7 wiring). Do NOT add a paid writer.

### Lifecycle hook points
- `app/driver/actions.ts` — driver status-advance (`en_route`/`arrived`/`picked_up`/`completed`); the `arrived` transition fires the guest "driver arrived" email + drives in-app events.
- `app/driver/advance.lifecycle.test.ts`, `app/driver/advance.ownership.test.ts` — lifecycle/ownership contracts to preserve.
- Claim RPC / Phase 5 atomic claim (`supabase/migrations/0005_claim_correctness.sql`, `app/driver` claim path) — the `claimed` transition fires the guest "driver assigned" email.
- `app/admin/drivers/actions.ts` — the driver-invite mutation (NOTF-04); currently `generateLink({type:'invite'})` + inline reveal. Phase 7 sends the link by email and removes the inline reveal (D-14).
- `app/admin/transfers/[id]/` (TransferDetailView/actions) — admin assign/reassign/release/cancel are the events that produce driver in-app notifications (D-02).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — NOTF-01/02/03/05/06 (and NOTF-04 already "complete pending UAT, send wires here).
- `.planning/ROADMAP.md` §"Phase 7: Notifications" — phase goal + success criteria.
- `.planning/phases/05-claim-correctness/05-CONTEXT.md` — D-01 (`wp_pool` masked fields = the exact set the digest may show) and D-02 (flight no. is operational/non-PII).
- `.planning/phases/04-transfer-entity-booking-form/04-CONTEXT.md` — confirmation-email mechanic (generateLink magic link), guest-self-read RLS, `wp_transfers` columns, "send stubbed → Phase 7".

### Infra constraints
- `.planning/STATE.md` Handoff — Resend custom SMTP currently test sender (`onboarding@resend.dev`), only delivers to `balkanityplatform@gmail.com`; security TODO to rotate the `sbp_` token. Live URL + Balkanity-only infra (ref `qyhdogajtmnvxphrslwm`, NEVER Kalvia).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/transfers/confirmation-email.ts` — already builds the magic-link + HTML body via `getDict()` token interpolation; Phase 7 reuses this exact pattern for the new templates (assigned/arrived/admin-alert/invite/digest) and only adds the real `resend.emails.send` call + cap guard.
- `getDict()` / `platform/i18n/dictionary` — server-side EN/BG dictionary; extend with new email-copy keys (supports D-17 language choice).
- `createAdminClient()` (`platform/supabase/admin`) — service-role client already used for generateLink + service-role writes; the `email_log` writes and notification inserts go through it.
- Phase 6 pool-refresh / claim-feedback pattern — the model for the bell's poll-on-focus refresh (D-04).
- `generateLink({type:'invite'})` in `app/admin/drivers/actions.ts` — already produces the invite link; Phase 7 just routes it into an email (D-14).

### Established Patterns
- **Writes via service-role only; RLS tables carry SELECT policies, no client write policy** (Phases 1–4). New `notifications` + `email_log` tables follow this.
- **`server-only` boundary** — Resend key, service-role key stay server-side; never `NEXT_PUBLIC_`.
- **Single `paid` writer** — every email/notification hangs off existing transitions; no new `paid` write.
- Migration numbering continues from `0006_release_and_audit.sql` → Phase 7 migration is likely `0007`.

### Integration Points
- Webhook `paid` transition → guest booking confirmation (un-stub) + admin booking-alert email + admin in-app notification.
- `claimed` transition (claim RPC) → guest "driver assigned" email (name+phone) + (driver feed already had the pool item; claim removes it).
- `arrived` transition (`app/driver/actions.ts`) → guest "driver arrived" email.
- Admin assign/reassign/release/cancel → driver in-app notification (D-02).
- New paid transfer enters pool → driver in-app notification (D-02).
- Cap threshold crossed (send-guardrail) → admin in-app notification (D-11).
- Driver invite send (D-14); digest builder + invokable send (D-08, triggered by Phase 8 cron).

</code_context>

<specifics>
## Specific Ideas

- Sender identity: `noreply@send.balkanity.com` on a verified `send.balkanity.com` subdomain (D-13).
- Cap guardrail mirrors the CLAUDE.md "~90/day short-circuit"; alarm is free (in-app), not an email (D-11).
- "Driver assigned" email is the one place driver phone is revealed to the guest — deliberate, for airport coordination (D-16).

</specifics>

<deferred>
## Deferred Ideas

- **Supabase Realtime for the bell** — instant push instead of polling. Revisit post-pilot if poll latency feels slow (D-04).
- **Guest in-app bell / generic admin→driver messaging** — out of v1 NOTF scope.
- **Visual email-cap gauge, stuck-transfer alerts, reconciliation sweep, keep-alive, digest cron trigger** — Phase 8 (Platform Health).
- **Next-day queue for cap-dropped emails** — rejected for v1 (staleness risk); revisit if best-effort drops become common (D-12).

None of these block Phase 7.

</deferred>

---

*Phase: 7-Notifications*
*Context gathered: 2026-06-19*
