# Phase 7: Notifications - Research

**Researched:** 2026-06-19
**Domain:** Transactional email (Resend) + in-app notification feed under a hard daily cap, wired onto existing lifecycle seams
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**In-app feed/bell (NOTF-01)**
- **D-01:** Bell shown to **Drivers AND Admin** in v1 (not guests — the guest status page already shows their single transfer's state).
- **D-02:** Driver in-app events: (a) a new paid transfer enters the claimable pool; (b) the driver's own claimed run is reassigned/released/cancelled by admin. NOT a generic admin→driver message channel.
- **D-03:** Admin in-app events: (a) a new paid booking (mirrors NOTF-03 email); (b) the cap-near alarm (D-11). Stuck/needs-attention alerts stay Phase 8.
- **D-04:** Live update = **poll on focus + light interval (~30–60s)**, matching Phase 6's pool-refresh approach. **NOT Supabase Realtime.** (Realtime is a documented later upgrade.)
- **D-05:** Read model: per-user unread count badge on the bell; opening the feed/item marks read; a "mark all read" action. Read state persisted per-user in the notifications table.

**Driver daily digest (NOTF-05)**
- **D-06:** Digest content = a morning snapshot of the currently-claimable pool (same masked fields as the Phase 5 `wp_pool`: date, arrival time, airport, destination zone, flight no., fare, pax, luggage; NEVER guest PII) PLUS the driver's own upcoming claimed runs for that day.
- **D-07:** Off by default — opt-in (protects the cap; respects inbox preference).
- **D-08:** Per-driver toggle + time-of-day picker (self-chosen send hour). Stored as a driver preference. **The time-based trigger that fires due digests rides on the Supabase cron infrastructure that lands in Phase 8** — Phase 7 builds the digest builder, the preference setting/UI, and an invokable "send due digests" function; Phase 8 schedules it.

**Email cap guardrail (NOTF-06)**
- **D-09:** Two priority tiers. CRITICAL (always send): guest booking confirmation + driver invite. BEST-EFFORT (dropped near cap): admin booking alert + driver digest (both have in-app fallbacks). Guest "driver assigned"/"arrived" rank just under critical (best-effort-high; may be modeled as a 3rd implicit tier if cleaner, but the user chose the simpler 2-tier framing).
- **D-10:** Soft block best-effort at ~90/100 daily sends; keep sending critical emails above the threshold; record skipped sends. Threshold in an env/config constant.
- **D-11:** Cap-near alarm = admin **in-app notification only, NO extra email** (the bell costs zero against the cap). Phase 8 adds the visual gauge on top of the same `email_log`.
- **D-12:** A best-effort email dropped at the cap is logged in `email_log` with a `skipped_cap` outcome and NOT auto-retried. No next-day queue.

**Email delivery & invite (NOTF-04 + delivery reality)**
- **D-13:** Verify a sending subdomain — `send.balkanity.com` — in Resend and send from `noreply@send.balkanity.com`. Requires a manual DNS step by the user. Current test sender (`onboarding@resend.dev`) only delivers to `balkanityplatform@gmail.com`.
- **D-14:** Driver invite goes email-only — remove the inline copy-paste link reveal. NOTE: drops the manual fallback; paired with D-15's verified-delivery gate.
- **D-15:** Real delivery is a phase-completion gate — phase not "done" until verified emails actually send to real recipients. CAVEAT: automated unit tests MUST still mock the Resend client; the gate applies to phase completion / UAT, not to the test suite.
- **D-16:** Guest "driver assigned" email carries driver first name + phone (revealed only to the paying guest, post-assignment). "Driver arrived" email is a simple heads-up, no extra info.
- **D-17:** Email language: guest emails honor the booking language (EN/BG), falling back to EN if not persisted; admin alerts and driver invites in EN. Researcher to confirm whether per-booking locale is stored on `wp_transfers`; if not, persisting it is a small add. **→ RESEARCH FINDING: NOT persisted. Persisting it is a small additive change (see Runtime State Inventory + Architecture Pattern 6).**

### Claude's Discretion
- The exact `notifications` table shape, the `email_log` schema, and the per-driver digest-preference storage (new columns vs a small preferences table) — researcher/planner decide, consistent with existing migration/RLS conventions (writes via service-role only; RLS SELECT policies; no client write policy).
- Email template authoring approach (plain HTML strings vs `react-email`) — CLAUDE.md lists `react-email` as optional; pick what matches the existing `confirmation-email.ts` style.
- Polling cadence exact value and whether the admin bell reuses the driver bell component.

### Deferred Ideas (OUT OF SCOPE)
- **Supabase Realtime for the bell** — instant push instead of polling. Revisit post-pilot (D-04).
- **Guest in-app bell / generic admin→driver messaging** — out of v1 NOTF scope.
- **Visual email-cap gauge, stuck-transfer alerts, reconciliation sweep, keep-alive, digest cron trigger** — Phase 8 (Platform Health).
- **Next-day queue for cap-dropped emails** — rejected for v1 (staleness risk).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | Per-user in-app notification feed/bell (shared platform feature; primary channel for drivers) | New polymorphic `notifications` table (Pattern 1) + per-user read state (D-05) + poll-on-focus bell client island reusing the Phase 6 `PoolView` poll pattern (Pattern 2). |
| NOTF-02 | Guest "driver assigned" email on `claimed`; "driver arrived" email on `arrived` (none on `en_route`) | Hook points: `claimed` in `claim_transfer` RPC consumer / `assign` action (Pattern 4); `arrived` in `app/driver/actions.ts advanceStatus` (Pattern 4). Driver name+phone read for the assigned email (D-16). |
| NOTF-03 | Admin booking alert email on new paid booking | Hook point: webhook `paid` transition (`app/api/stripe/webhook/route.ts` ~L183–201) — best-effort tier (Pattern 4, D-09). Mirrors the admin in-app notification (D-03). |
| NOTF-04 (un-stub) | Driver invite email (was inline copy-paste link) | `app/admin/drivers/actions.ts` already builds `action_link`; route it into `sendEmail()` (critical tier) and remove the inline reveal (D-14, Pattern 5). |
| NOTF-05 | Opt-in driver daily digest at a self-chosen time | Digest builder reads masked `wp_pool` fields + the driver's own claimed runs (D-06); per-driver preference (toggle + hour) storage; an invokable "send due digests" function. Cron trigger = Phase 8 (D-08, seam flagged). |
| NOTF-06 | Send-guardrail + `email_log` tracking volume + cap alarm | `sendEmail()` wrapper: `email_log` idempotency guard, ≤5 req/s, ~90/day soft-block on best-effort, cap-near admin in-app alarm (Pattern 3, D-09/10/11/12). |
</phase_requirements>

## Summary

Phase 7 is overwhelmingly a **wiring + two-new-tables phase, not a research-heavy domain phase**. Every lifecycle event the notifications hang off already exists and is exercised by green tests; the locked stack (Resend `^6`, Supabase service-role writes, `getDict()` i18n, the Phase 6 poll-on-focus pattern) is already in the repo. The work is: (1) author migration `0007` adding a polymorphic `notifications` table, an `email_log` table, and digest-preference storage, all following the established RLS-SELECT-only / service-role-write / no-client-write-policy convention; (2) build a single `sendEmail()` wrapper that is the only place `resend.emails.send` is ever called, fronted by an `email_log` idempotency check, a ≤5 req/s limiter, and the ~90/100 best-effort soft-cap; (3) un-stub the two existing seams (guest confirmation, driver invite) WITHOUT changing their signatures; (4) fire emails + in-app notifications off the existing `paid` / `claimed` / `arrived` / admin-ops transitions in log-and-continue blocks that never affect the money-bearing write; (5) build the digest content builder + opt-in preference UI + an invokable "send due digests" function (the cron trigger is Phase 8).

Two findings the planner must act on. **First, the ROADMAP/CONTEXT conflict is real and resolved in favour of CONTEXT:** ROADMAP success criterion #1 says the bell updates "live via Realtime," but CONTEXT D-04 deliberately chose polling-on-focus. CONTEXT (the discuss-phase output) is authoritative — **plan for polling, treat Realtime as a documented deferred upgrade.** The polymorphic-`entity_type`/`entity_id` and "no `transfer_id` column on shared tables" parts of SC#1 still stand and are honored. **Second, per-booking locale is NOT persisted** (`grep` of all six migrations confirms no `locale`/`lang`/`language` column on `wp_transfers`; `getDict()` reads a request cookie that does not exist on the webhook path). To honor D-17, add a NULL-able `locale` column to `wp_transfers` in `0007` and capture `getLang()` at booking time in `createBooking`.

**Primary recommendation:** Author migration `0007_notifications.sql` (notifications + email_log + a `locale` column on wp_transfers + digest-preference storage), build one server-only `platform/notifications/send-email.ts` wrapper that is the single Resend call-site with the cap/idempotency/rate-limit guard, keep email templates as plain HTML strings via the existing `getDict()` token-interpolation pattern (match `confirmation-email.ts`, do NOT add react-email), fire all sends/notifications in log-and-continue blocks off existing transitions, and gate phase completion on a verified `send.balkanity.com` subdomain while mocking Resend in every unit test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| In-app notification storage + read state | Database / Storage | API/Backend | Polymorphic `notifications` table with RLS SELECT (per-recipient) + service-role inserts; same convention as every other table. |
| Bell unread count + feed render + poll | Frontend Server (RSC read) + Client (poll island) | — | RSC reads the recipient's own notifications via caller-auth RLS; a client island polls on focus/interval (D-04) — identical to Phase 6 `PoolView`. |
| Email send + cap guard + idempotency | API/Backend (server-only) | Database (`email_log`) | Resend secret is server-only; the cap/idempotency state lives in `email_log` queried via the service-role client. |
| Email template rendering (HTML + copy) | API/Backend (server-only) | — | `getDict()` runs server-side; templates are plain strings interpolated server-side (no client flash, matches existing). |
| Lifecycle → notification/email fan-out | API/Backend (existing server actions + webhook route) | — | Hangs off the EXISTING `paid`/`claimed`/`arrived`/admin-ops transitions; never a new write path, never a second `paid` writer. |
| Digest content assembly | API/Backend (server-only) | Database (masked `wp_pool` + claimed runs) | Reuses the Phase 5 masked pool fields; never reads guest PII into the digest. |
| Digest time-trigger | OUT OF SCOPE → Phase 8 (Supabase cron) | — | Phase 7 ships an INVOKABLE "send due digests" function; Phase 8 schedules it via pg_cron + pg_net. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `^6` (latest `6.14.0`) | Node SDK: `resend.emails.send` + native idempotency key | `[VERIFIED: npm registry]` latest 6.14.0, empty postinstall. CLAUDE.md locks Resend at `^6.12`; `6.14.0` is within `^6` and compatible. Official, named in the locked stack. |
| `@supabase/supabase-js` (service-role) | `^2.108` (installed) | `email_log` + `notifications` inserts; daily-count query | `[VERIFIED: codebase]` already the service-role write client (`platform/supabase/admin.ts`). |
| `@supabase/ssr` (caller-auth) | `^0.12` (installed) | RSC reads the recipient's own notifications under RLS | `[VERIFIED: codebase]` `platform/supabase/server.ts`. |
| `zod` | `^4.4` (installed) | Validate the digest-preference form input + any new server-action input | `[VERIFIED: codebase]` already the trust-boundary validator across the repo. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `getDict()` / `platform/i18n/dictionary` | in-repo | EN/BG email + bell copy via token interpolation | `[VERIFIED: codebase]` extend `en.ts`/`bg.ts` with new keys behind the existing `tsc` Dict-parity gate. **CAVEAT: `getDict()` reads a request cookie — unusable on the webhook path; see Pattern 6 for the locale-by-argument fix.** |
| existing `PoolView` poll pattern | in-repo | The bell's poll-on-focus + interval refresh (D-04) | `[VERIFIED: codebase]` `app/driver/PoolView.tsx` L101–112 — copy the `focus` + `visibilitychange` + `setInterval` shape. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain HTML string templates | `react-email` / `@react-email/components` | CLAUDE.md lists react-email as **optional**. The existing `confirmation-email.ts` builds HTML strings via `fill()` token interpolation. **Recommendation: stay with plain HTML strings** — matches the established style, adds zero deps, and 6 short transactional templates do not justify a render pipeline. |
| Resend native `idempotencyKey` (2nd arg) | Hand-rolled email_log-only dedup | Use BOTH: `email_log` is the app-level idempotency authority (queried before send + records outcome) AND pass Resend's `idempotencyKey` as defense-in-depth (24h dedup window at Resend). |
| `notifications` table with per-user read state | Separate `notification_reads` join table | For a 2-actor (driver+admin), low-volume pilot, a single `notifications` table with a per-row `recipient_id` + `read_at` column is simpler and sufficient (D-05). A join table is over-engineering here. |
| Supabase Realtime for the bell | Poll on focus + interval | **D-04 locks polling.** Realtime is a deferred post-pilot upgrade. Do NOT reintroduce it (overrides ROADMAP SC#1's "via Realtime" wording). |

**Installation:**
```bash
npm install resend
```
(`resend` is the only new dependency. `^6` resolves to `6.14.0`.)

**Version verification:** `npm view resend version` → `6.14.0` `[VERIFIED: npm registry]`. `npm view resend scripts.postinstall` → empty (no postinstall script) `[VERIFIED: npm registry]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `resend` | npm | 3+ yrs (mature) | millions/wk | github.com/resend/resend-node | unavailable | Approved — official SDK, named in CLAUDE.md locked stack, empty postinstall verified |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck could not be installed in this environment. Per protocol, `resend` would normally be tagged `[ASSUMED]`. However, it is the officially-documented SDK explicitly locked in CLAUDE.md's verified provider table, exists at `6.14.0` on the npm registry with an empty postinstall script, and resolves to the official `github.com/resend/resend-node` repo. The planner SHOULD still gate the `npm install resend` step behind a `checkpoint:human-verify` task per the degradation rule, but the risk here is minimal.*

## Architecture Patterns

### System Architecture Diagram

```
LIFECYCLE EVENTS (all pre-existing, unchanged signatures)
│
├─ webhook paid transition ───────────────┐   (app/api/stripe/webhook/route.ts ~L183-201)
│    [single paid writer — NEVER touched]  │
│                                          ▼
│                            ┌─────────────────────────────┐
├─ claimed (claim RPC /      │  log-and-continue fan-out    │
│   assign action) ─────────▶│  (try/catch — a send/notify  │
│                            │   failure NEVER changes the  │
├─ arrived (advanceStatus) ─▶│   money/lifecycle write)     │
│                            └──────────┬──────────┬────────┘
├─ admin assign/reassign/               │          │
│   release/cancel ─────────────────────┤          │
│                                       ▼          ▼
│                          ┌────────────────┐  ┌──────────────────────────┐
└─ driver invite (admin) ─▶│ notifications  │  │ sendEmail() wrapper       │
                           │  INSERT        │  │ (platform/notifications/  │
                           │ (service-role) │  │  send-email.ts)           │
                           └───────┬────────┘  │  1. email_log dedup check │
                                   │           │  2. tier? (D-09)          │
                                   │           │  3. ≤90/day soft-cap on   │
                                   │           │     best-effort (D-10)    │
                                   │           │  4. resend.emails.send    │
                                   │           │     (+ idempotencyKey)    │
                                   │           │  5. email_log INSERT      │
                                   │           │     (success/fail/        │
                                   │           │      skipped_cap)         │
                                   │           │  6. cap-near → admin       │
                                   │           │     in-app notify (D-11)  │
                                   │           └───────────┬──────────────┘
                                   │                       │
   ┌───────────────────────────────┘                       │ (Resend HTTP, ≤5 req/s)
   ▼                                                        ▼
BELL (RSC read of own rows via RLS                    RESEND  → noreply@send.balkanity.com
+ client poll-on-focus island, D-04)                   (verified subdomain, D-13)
   • unread count badge                                   → guest / admin / driver inboxes
   • mark read on open / mark-all-read

DIGEST (NOTF-05): builder reads masked wp_pool fields + driver's own claimed runs
→ "send due digests" INVOKABLE function (best-effort tier through sendEmail)
→ TIME TRIGGER = Phase 8 Supabase cron (SEAM — not built here)
```

### Recommended Project Structure
```
platform/notifications/
├── send-email.ts          # server-only — THE single resend.emails.send call-site + cap/idempotency/rate guard
├── notify.ts              # server-only — insertNotification(recipientId, type, entityType, entityId, …)
├── templates.ts           # plain-HTML template builders keyed by getDict() (locale-by-argument)
├── digest.ts              # buildDigest(driverId) + sendDueDigests() (invokable; cron = Phase 8)
└── *.test.ts              # Resend client MOCKED (D-15 caveat)

platform/transfers/
└── confirmation-email.ts  # EXISTING — un-stub body only; signature sendBookingConfirmation(transferId, guestEmail) UNCHANGED

app/(driver|admin)/        # bell client island + RSC feed read; admin bell may reuse the driver bell component (discretion)
supabase/migrations/
└── 0007_notifications.sql # notifications + email_log + wp_transfers.locale + digest prefs (FLAGGED — sign-off before apply)
```

### Pattern 1: Polymorphic `notifications` table (NOTF-01, D-01/D-02/D-03/D-05)

**What:** A single shared table holding per-recipient notifications, keyed polymorphically (`entity_type` + `entity_id`) so it never carries a module-specific `transfer_id` column (ROADMAP SC#1 "no `transfer_id` column on shared tables" — this part of SC#1 stands).
**When to use:** Every in-app notification (driver pool/ownership-change events, admin booking alert, admin cap-near alarm).

**Recommended shape (planner to finalize; follows the 0003/0004/0005 conventions exactly):**
```sql
-- platform-generic table → UNPREFIXED (PLAT-01 seam rule; cf. webhook_events).
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type         text not null,            -- e.g. 'new_paid_pool' | 'run_reassigned' | 'run_released'
                                          --      | 'run_cancelled' | 'new_paid_booking' | 'email_cap_near'
  entity_type  text,                     -- polymorphic: e.g. 'transfer' (NO transfer_id column, SC#1)
  entity_id    uuid,                     -- the referenced row id (nullable for non-entity alarms)
  title        text not null,            -- pre-rendered EN/BG copy (or copy key — discretion)
  body         text,
  read_at      timestamptz,              -- per-user read state (D-05); NULL = unread
  created_at   timestamptz not null default now()
);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;

-- RLS: a user reads ONLY their own notifications (caller-auth). Mirrors wp_transfers_guest_self_read.
create policy "notifications_own_read" on public.notifications
  for select to authenticated using ( (select auth.uid()) = recipient_id );

-- NO INSERT policy → inserts are service-role only (the established no-write-policy lock).
-- "mark read" is the ONE exception: a narrow self-UPDATE policy scoped to own rows, OR
-- (preferred, consistent with the rest of the repo) a gated service-role markRead action.
```
**Decision for the planner:** "mark read" / "mark all read" (D-05) is a write. The repo's invariant is *no client write policy; writes via gated service-role action*. **Recommendation: implement `markRead`/`markAllRead` as gated service-role server actions** (caller-auth identity check `recipient_id === auth.uid()`, then service-role UPDATE) — exactly mirroring the `advanceStatus` two-part gate in `app/driver/actions.ts`. Do NOT add a client UPDATE RLS policy (keeps the no-write-policy lock intact).

### Pattern 2: Bell = RSC read + poll-on-focus client island (NOTF-01, D-04)

**What:** The bell's unread count + feed is read in an RSC via the caller-auth client (RLS scopes to own rows); a client island polls on `focus` + `visibilitychange` + a ~30–60s interval (D-04) and re-fetches via a thin server action — copy the EXISTING `PoolView` mechanism verbatim.
**When to use:** The driver bell and the admin bell. The admin bell MAY reuse the driver bell component (discretion) — recommended, since the read shape is identical.
**Example (the proven poll shape to copy):**
```typescript
// Source: app/driver/PoolView.tsx (in-repo, GREEN) — D-04 poll-on-focus pattern
const POLL_INTERVAL_MS = 30_000; // ~30-60s per D-04
useEffect(() => {
  const onFocus = () => pollRef.current();
  const onVisible = () => pollRef.current();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);
  const id = setInterval(() => pollRef.current(), POLL_INTERVAL_MS);
  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(id);
  };
}, []);
```
The refetch server action mirrors `refetchPool` in `app/driver/actions.ts`: caller-auth client, RLS-scoped read of `notifications` where `recipient_id = auth.uid()`.

### Pattern 3: `sendEmail()` — the single Resend call-site with cap/idempotency guard (NOTF-06, D-09/10/11/12)

**What:** One server-only function is the ONLY place `resend.emails.send` is ever called. It enforces idempotency, the priority tier, the ≤90/100 soft cap, the ≤5 req/s limit, and records every outcome.
**When to use:** Every email in the system routes through it. Templates/hook-points call `sendEmail(...)`; they never touch the Resend client directly.
**Example (recommended shape):**
```typescript
// platform/notifications/send-email.ts
import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/platform/supabase/admin";

const SOFT_CAP = Number(process.env.EMAIL_SOFT_CAP ?? 90);   // D-10 — env/config constant
const SENDER = "noreply@send.balkanity.com";                  // D-13

type Tier = "critical" | "best_effort";

export async function sendEmail(opts: {
  to: string; subject: string; html: string;
  tier: Tier;
  idempotencyKey: string;       // e.g. `confirm:${transferId}` | `assigned:${transferId}`
}): Promise<{ outcome: "sent" | "skipped_cap" | "duplicate" | "failed" }> {
  const admin = createAdminClient();

  // 1. IDEMPOTENCY (D-12 / webhook-retry safety): have we already logged this key with a terminal outcome?
  const { data: existing } = await admin
    .from("email_log").select("id,outcome").eq("idempotency_key", opts.idempotencyKey).maybeSingle();
  if (existing && existing.outcome === "sent") return { outcome: "duplicate" };

  // 2. DAILY COUNT for the soft cap (today's sends with outcome='sent').
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("email_log").select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString()).eq("outcome", "sent");

  // 3. SOFT-CAP (D-10): block BEST-EFFORT at >= SOFT_CAP; CRITICAL always sends.
  if (opts.tier === "best_effort" && (count ?? 0) >= SOFT_CAP) {
    await admin.from("email_log").insert({
      idempotency_key: opts.idempotencyKey, recipient: opts.to, tier: opts.tier, outcome: "skipped_cap",
    });
    return { outcome: "skipped_cap" };   // NOT retried (D-12); in-app feed still carries the info
  }

  // 4. SEND (≤5 req/s — see Pitfall 3 for the rate-limit note). Resend native idempotency = defense in depth.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send(
      { from: SENDER, to: opts.to, subject: opts.subject, html: opts.html },
      { idempotencyKey: opts.idempotencyKey },  // Source: resend.com/docs — 2nd-arg idempotencyKey
    );
    const outcome = error ? "failed" : "sent";
    await admin.from("email_log").insert({
      idempotency_key: opts.idempotencyKey, recipient: opts.to, tier: opts.tier, outcome,
    });
    return { outcome };
  } catch {
    await admin.from("email_log").insert({
      idempotency_key: opts.idempotencyKey, recipient: opts.to, tier: opts.tier, outcome: "failed",
    });
    return { outcome: "failed" };
  }
}
```
Cap-near alarm (D-11): when `count` crosses a threshold (e.g. ≥ SOFT_CAP−N), insert an admin `email_cap_near` notification (free against the cap) — do NOT send an email.

**`email_log` shape (planner to finalize):**
```sql
create table public.email_log (
  id              uuid primary key default gen_random_uuid(),
  idempotency_key text not null,                 -- e.g. 'confirm:<transferId>' — the dedup authority
  recipient       text not null,
  tier            text not null,                 -- 'critical' | 'best_effort'
  outcome         text not null,                 -- 'sent' | 'failed' | 'skipped_cap'
  created_at      timestamptz not null default now()
);
create unique index email_log_idempotency_key_key on public.email_log (idempotency_key);  -- race-safe dedup (cf. webhook_events)
create index email_log_created_at_idx on public.email_log (created_at);                    -- daily-count query
alter table public.email_log enable row level security;
create policy "email_log_admin_read" on public.email_log
  for select to authenticated using (public.is_admin());   -- admin-read only; Phase 8 gauge reads this
-- NO write policy → service-role only.
```
Note the UNIQUE index on `idempotency_key` mirrors `webhook_events.event_id` — it is the race-safe replay authority so a webhook retry firing the confirmation twice produces exactly one send.

### Pattern 4: Lifecycle fan-out in log-and-continue blocks (NOTF-02/03, D-02/D-03)

**What:** Each notification/email fires off an EXISTING transition, wrapped in `try/catch` so a send/insert failure NEVER changes the money-bearing or lifecycle write's HTTP status or rolls it back. This is exactly the pattern the webhook already uses for the confirmation stub.
**When to use:** Every hook point.
**Example (the established pattern, already in the webhook):**
```typescript
// Source: app/api/stripe/webhook/route.ts L194-201 (in-repo) — log-and-continue around the send
const guestEmail = paidRows[0]?.guest_email ?? null;
if (guestEmail) {
  try {
    await sendBookingConfirmation(transferId, guestEmail);   // un-stubbed body now calls sendEmail()
  } catch (err) {
    console.error("[BOOK-06] confirmation send failed (continuing)", err);
  }
}
```

**Hook-point table (grounded in real file locations read this session):**

| Transition | File / location | Email (tier) | In-app notification |
|------------|-----------------|--------------|---------------------|
| `paid` | `app/api/stripe/webhook/route.ts` ~L183–201 (after `outcome:'processed'`) | guest confirmation (CRITICAL, un-stub); **admin booking alert (BEST-EFFORT, D-09)** | admin `new_paid_booking` (D-03); driver `new_paid_pool` to all drivers (D-02) |
| `claimed` (driver self-claim) | `claim_transfer` RPC consumer — `platform/transfers/claim.ts` / `app/driver/actions.ts claimAction` | guest **"driver assigned"** (best-effort-high; name+phone, D-16) | the pool item the driver claimed disappears for others on next poll (no explicit notify needed) |
| `claimed` (admin assign) | `app/admin/transfers/actions.ts assign` (L106) | guest **"driver assigned"** (D-16) | driver `run_assigned` to the assigned driver (D-02) |
| `arrived` | `app/driver/actions.ts advanceStatus` (resolves `arrived` via `ALLOWED_TRANSITIONS`) | guest **"driver arrived"** (simple heads-up, no extra info, D-16) | — |
| admin `reassign` | `app/admin/transfers/actions.ts reassign` (L157) | — | driver `run_reassigned` to the affected driver(s) (D-02) |
| admin `release` | `app/admin/transfers/actions.ts release` (L208) | — | driver `run_released` to the previously-claiming driver (D-02); `new_paid_pool` to all drivers (re-enters pool) |
| admin `cancel` | `app/admin/transfers/actions.ts cancel` (L260) | — | driver `run_cancelled` if it had a driver (D-02) |
| driver invite | `app/admin/drivers/actions.ts inviteDriver` (L138) | driver **invite** (CRITICAL); remove inline `actionLink` reveal (D-14) | — |
| cap-near crossed | inside `sendEmail()` (Pattern 3) | — | admin `email_cap_near` (D-11, no email) |

**`claimed`-by-self note:** the winning driver gets the full row from the claim RPC's `RETURNING *`; the guest "driver assigned" email needs the driver's first name + phone. The driver self-claim path (`claimTransfer`) runs on the caller-auth client; to read driver_profiles name+phone for the email, do it server-side with the service-role client in the action AFTER a successful claim (a narrow `{name, phone}` read — the same reverse-reveal join Phase 4 used for the status page; see STATE.md "narrow service-role {name,phone} read"). Keep it in `app/driver/actions.ts` (the action), NOT inside the thin `claimTransfer` wrapper, so `claim.ts` stays a pure pass-through.

### Pattern 5: Un-stubbing the seams WITHOUT changing signatures (NOTF-04 + BOOK-06)

**What:** Replace only the *body* of the two stubs; the call-sites never change.
**`sendBookingConfirmation(transferId, guestEmail)`** — `platform/transfers/confirmation-email.ts`:
- Keep the signature and the `generateLink` magic-link build verbatim.
- Replace the `console.info("[BOOK-06 stub] …")` block (L86–89) with `await sendEmail({ to: guestEmail, subject, html, tier: "critical", idempotencyKey: \`confirm:${transferId}\` })`.
- **The module MUST still contain NO `status: 'paid'` literal** — `platform/transfers/confirmation.test.ts` (L102–111) and `platform/payments/single-writer.test.ts` grep for it. `sendEmail()` does only `email_log` inserts + the Resend call — zero `wp_transfers` writes. Keep both tests green.
- **D-17 locale:** this is fired from the webhook (no request cookie). Read the persisted `wp_transfers.locale` (new column) and pass it into the template builder by argument — see Pattern 6.

**Driver invite** — `app/admin/drivers/actions.ts inviteDriver`:
- `generateLink({type:'invite'})` already returns `data.properties.action_link` (L138).
- Replace the `return { status: "ok", actionLink: … }` reveal with: `await sendEmail({ to: parsed.data.email, subject, html: inviteHtml(actionLink), tier: "critical", idempotencyKey: \`invite:${userId}\` })`, then `return { status: "ok" }` (drop `actionLink` from `InviteDriverState`, D-14).
- Invite copy is **EN** (D-17). Update `DriversView` to stop showing the copy-paste link.

### Pattern 6: Email language by persisted locale (D-17)

**What:** `getDict()` reads a `lang` request cookie — it works inside guest/admin server actions that have the request context, but **NOT inside the webhook** (no cookie there) and not for a digest fired by a future cron. The robust fix is to persist the guest's locale at booking and pass it explicitly.
**Recommendation:**
1. Add `locale text` (NULL-able, default NULL) to `wp_transfers` in `0007`.
2. In `createBooking` (`app/pickup/[slug]/actions.ts`), capture `const lang = await getLang();` and write it into the insert (`locale: lang`).
3. Add a locale-parameterized dictionary accessor (e.g. `getDictFor(lang: Lang)` returning `lang === 'bg' ? bg : en`) so email templates resolve copy by argument, not by cookie. Guest emails: `getDictFor(transfer.locale ?? 'en')` (fallback EN). Admin alerts + driver invites: `getDictFor('en')` (D-17).
4. This is a small additive migration column + a one-line booking change + a tiny i18n accessor — no behavior change to existing rows (NULL locale → EN fallback).

### Anti-Patterns to Avoid
- **Reintroducing Supabase Realtime for the bell.** D-04 locks polling; ROADMAP SC#1's "via Realtime" wording is superseded by CONTEXT. (Pitfall 1.)
- **A second `paid` writer.** Notifications/emails hang off existing transitions only. `sendEmail()` and `confirmation-email.ts` perform ZERO `wp_transfers` writes. (single-writer.test.ts.)
- **Calling `resend.emails.send` anywhere except `sendEmail()`.** Any other call-site bypasses the cap/idempotency guard. Consider a grep-gate test (mirror single-writer.test.ts) asserting the only `resend.emails.send` call lives in `platform/notifications/send-email.ts`.
- **A client-write RLS policy on `notifications`.** Mark-read is a gated service-role action; the no-write-policy lock holds.
- **Letting a send failure roll back the money/lifecycle write.** Every fan-out is log-and-continue.
- **Putting a `transfer_id` column on the shared `notifications`/`email_log` tables.** Use polymorphic `entity_type`/`entity_id` (SC#1, PLAT-01 platform/module seam).
- **A `transfer_id` or module-specific column leaking into the platform-generic tables** — they are UNPREFIXED platform tables (like `webhook_events`); keep them module-agnostic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email send + retries + DKIM/SPF | Custom SMTP / nodemailer | `resend.emails.send` (locked stack) | Deliverability, idempotency, signed sending all handled by Resend. |
| Email dedup against webhook retries | Ad-hoc in-memory flag | `email_log` UNIQUE `idempotency_key` + Resend native `idempotencyKey` | Survives process restarts and concurrent retries; race-safe via the DB UNIQUE index (cf. `webhook_events.event_id`). |
| Per-event push to the bell | Realtime/websocket layer | Poll-on-focus (D-04) reusing `PoolView` pattern | ~10-transfer pilot; D-04 locked; reconnection/PWA edge cases not worth it. |
| Magic-link / invite link generation | Custom token signing | `auth.admin.generateLink` (already in both stubs) | Already built; Phase 7 only routes the link into an email. |
| Daily count for the cap | Counter row you increment | `count` query on `email_log` with a `created_at >= todayUTC` filter | Single source of truth; Phase 8 gauge reads the same table; no drift. |

**Key insight:** Almost nothing here is novel. The single genuinely new primitive is the `sendEmail()` cap/idempotency wrapper; everything else is composing patterns already proven green in Phases 3–6.

## Runtime State Inventory

> This phase adds two tables, one column, and a Resend sending domain. It is additive, not a rename — but it has live-config + provider-state items the planner must sequence.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **No per-booking `locale` stored** on `wp_transfers` (verified by grep of all 6 migrations — no `locale`/`lang`/`language` column). New `notifications` + `email_log` tables do not yet exist. | **Data migration:** `0007` ADD `wp_transfers.locale text` (NULL-able, existing rows → NULL → EN fallback). **Code edit:** `createBooking` writes `getLang()` into new rows. No backfill needed (NULL = EN). |
| Live service config | **Resend sending identity is currently the test sender `onboarding@resend.dev`** (delivers ONLY to `balkanityplatform@gmail.com` — STATE.md handoff). The `send.balkanity.com` subdomain is NOT yet verified in Resend; DNS records NOT yet added by the user. | **Manual (user) + checkpoint:** add Resend-specified DNS records to `balkanity.com` DNS (MX `send`, SPF TXT `send`, DKIM TXT `resend._domainkey`), verify in the Resend dashboard. This is the D-15 phase-completion gate. See Environment Availability. |
| OS-registered state | None. No cron/scheduler registered for the digest in Phase 7 (the time trigger is Phase 8). | None — verified: the digest is an INVOKABLE function only; Phase 8 registers the Supabase cron. |
| Secrets/env vars | `RESEND_API_KEY` must be set server-only on Vercel (never `NEXT_PUBLIC_`). A `EMAIL_SOFT_CAP` config constant (default 90, D-10). SECURITY TODO from STATE.md: `SUPABASE_ACCESS_TOKEN` rotation + DB password reset (independent of this phase but tracked). | **Checkpoint:** confirm `RESEND_API_KEY` set in Vercel prod env (server-only). Add `EMAIL_SOFT_CAP` (optional; defaults in code). |
| Build artifacts / installed packages | `resend` is NOT yet in `node_modules` / `package.json` (verified: not installed; deps list has no `resend`). | **Code edit:** `npm install resend` (gate behind checkpoint per legitimacy protocol). |

**The canonical question — after every file is updated, what runtime systems still have stale state?** The Resend dashboard sending-domain verification (live provider config, not in git) and the Vercel `RESEND_API_KEY` env var are the two runtime states that a code-only change does NOT cover. Both are checkpoints, and the verified domain is the D-15 completion gate.

## Common Pitfalls

### Pitfall 1: Reintroducing Realtime against the locked polling decision
**What goes wrong:** ROADMAP SC#1 literally says "updating live via Realtime"; a planner/executor reading only the ROADMAP wires a Supabase Realtime channel.
**Why it happens:** Two upstream docs disagree; the ROADMAP predates the discuss-phase decision.
**How to avoid:** CONTEXT D-04 (discuss-phase output) is authoritative and overrides the ROADMAP wording. Plan polling-on-focus + interval (reuse `PoolView`). Treat Realtime as a documented deferred upgrade. The OTHER parts of SC#1 (polymorphic `entity_type`/`entity_id`, no `transfer_id` column) still hold.
**Warning signs:** any `supabase.channel(...)`, `.on('postgres_changes', …)`, or `@supabase/realtime-js` import appearing in a plan.

### Pitfall 2: `getDict()` returns EN inside the webhook (locale lost)
**What goes wrong:** Guest confirmation always sends in EN even for a BG booking, because `getDict()` reads a `lang` cookie that doesn't exist on the webhook request.
**Why it happens:** `getDict()`/`getLang()` (`platform/i18n/dictionary.ts`) are cookie-bound; the webhook has no user request cookie.
**How to avoid:** Persist `locale` on `wp_transfers` at booking (Pattern 6) and resolve email copy by argument (`getDictFor(lang)`), not by cookie. Fallback EN when NULL.
**Warning signs:** any email template calling `getDict()` from a webhook- or cron-invoked path.

### Pitfall 3: Resend 5 req/s rate limit under a burst
**What goes wrong:** A `paid` transition can fire guest confirmation + admin alert + driver pool notifications near-simultaneously; the digest builder fans out to many drivers. Exceeding 5 req/s returns 429.
**Why it happens:** Resend caps all accounts at 5 requests/second (CLAUDE.md verified fact).
**How to avoid:** In-app notifications are DB inserts (not Resend calls) — they don't count. Only actual emails count. For the per-transfer fan-out the email volume is tiny (≤3 emails). For the digest's multi-driver fan-out, sequence sends with a small delay (e.g. ~250ms between sends) or a simple in-function throttle so you stay ≤5 req/s. Pilot has ~3 drivers, so this is a low risk but should be coded defensively in `sendDueDigests`.
**Warning signs:** `Promise.all` over many `sendEmail` calls without throttling.

### Pitfall 4: A webhook retry double-sends the confirmation
**What goes wrong:** Stripe retries the verified event (or two events race); the confirmation sends twice.
**Why it happens:** The webhook's `webhook_events` insert-first dedup protects the `paid` WRITE, but the email send is in a separate log-and-continue block.
**How to avoid:** `sendEmail()` checks `email_log` by `idempotency_key` (`confirm:<transferId>`) before sending and the `email_log.idempotency_key` UNIQUE index is the race-safe backstop; also pass Resend's native `idempotencyKey`. Three layers.
**Warning signs:** no idempotency-key check in `sendEmail`; `email_log` missing the UNIQUE index.

### Pitfall 5: Driver phone leaked to the wrong recipient in the "assigned" email
**What goes wrong:** The "driver assigned" email reveals driver phone (D-16) — if the recipient resolution is wrong, PII goes to the wrong party.
**Why it happens:** Reading driver_profiles for the email is a service-role read (bypasses RLS); a mistaken `to:` or template binding leaks.
**How to avoid:** The `to:` is ALWAYS the transfer's `guest_email` (server-read from the row), the driver name+phone are interpolated into the body. The guest paid and is the only legitimate recipient (this is the established post-claim reveal boundary). Do the narrow `{name, phone}` read server-side, never expose it to any other channel.
**Warning signs:** driver phone appearing in any admin/driver-facing template or in-app notification.

## Code Examples

### Resend send with idempotency key (the only sanctioned shape)
```typescript
// Source: resend.com/docs (verified this session) — idempotencyKey is the SECOND arg, not a header
const { data, error } = await resend.emails.send(
  { from: "noreply@send.balkanity.com", to: guestEmail, subject, html },
  { idempotencyKey: `confirm:${transferId}` },
);
```

### Daily-count query for the soft cap (today's successful sends, UTC)
```typescript
// Source: pattern derived from supabase-js count head query (in-repo conventions)
const since = new Date(); since.setUTCHours(0, 0, 0, 0);
const { count } = await admin
  .from("email_log")
  .select("id", { count: "exact", head: true })
  .gte("created_at", since.toISOString())
  .eq("outcome", "sent");
```

### Service-role insert of an in-app notification (no client write policy)
```typescript
// platform/notifications/notify.ts — service-role insert (mirrors every other write in the repo)
await createAdminClient().from("notifications").insert({
  recipient_id: driverId,
  type: "new_paid_pool",
  entity_type: "transfer",
  entity_id: transferId,
  title: copy.notifNewPoolTitle,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `onboarding@resend.dev` test sender (delivers only to one inbox) | Verified `send.balkanity.com` subdomain, `noreply@send.balkanity.com` | This phase (D-13) | Real recipients receive mail; D-15 completion gate. |
| Inline copy-paste invite link reveal (Phase 2 stub) | Email-only invite via `sendEmail` | This phase (D-14) | Manual fallback dropped → paired with the verified-delivery gate. |
| Confirmation `console.info` stub (Phase 4) | `sendEmail` with `email_log` idempotency guard | This phase | Real confirmation email; idempotent vs webhook retries. |
| Resend idempotency via HTTP header | SDK 2nd-arg `idempotencyKey` option | resend-node ≥4.x | Use the SDK option, not a manual header. `[CITED: resend.com/docs]` |

**Deprecated/outdated:**
- Resend HTTP `Idempotency-Key` header by hand — the Node SDK exposes it as the `idempotencyKey` option in the second argument. `[CITED: resend.com/docs]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact Resend DNS record values for `send.balkanity.com` (MX `feedback-smtp.<region>.amazonses.com` pri 10; SPF `v=spf1 include:amazonses.com ~all`; DKIM `resend._domainkey`) are region-dependent and shown per-domain in the Resend dashboard. | Environment Availability | Low — the dashboard shows the exact records when the domain is added; the user copies them verbatim. Do not hardcode region/values. |
| A2 | Resend free tier allows **1 verified domain** (CLAUDE.md MEDIUM; official quota page did not state the count). | Environment Availability | Medium — if more than 1 is needed it would block; but the pilot needs only `send.balkanity.com`. Verify in dashboard (STATE.md already flags this). |
| A3 | `resend@^6` (`6.14.0`) is API-compatible with CLAUDE.md's pinned `^6.12`; the `emails.send` + `idempotencyKey` 2nd-arg shape is stable across `6.x`. | Standard Stack | Low — same major; verified the send signature against current docs. Pin `^6` and lockfile will resolve `6.14.0`. |
| A4 | slopcheck verdict for `resend` (tool unavailable this session). | Package Legitimacy Audit | Low — official SDK in the locked stack, empty postinstall, official repo. Planner gates the install behind a checkpoint regardless. |

## Open Questions (RESOLVED)

> All three questions are resolved by the Phase 7 plans (see 07-01…07-06). Markers inline below.

1. **Mark-read write mechanism: gated service-role action vs narrow self-UPDATE RLS policy** — **RESOLVED:** gated service-role `markRead`/`markAllRead` action (07-02/07-03), preserving the no-write-policy lock.
   - What we know: the repo invariant is "no client write policy; writes via gated service-role action" (Phases 1–6). `advanceStatus` is the exact precedent.
   - What's unclear: whether the planner prefers a one-off narrow self-UPDATE RLS policy on `notifications.read_at` (would be the first write policy in the repo) — REVIEW-GATED if chosen.
   - Recommendation: **gated service-role `markRead`/`markAllRead` action** (preserves the no-write-policy lock; no schema review needed beyond the table itself).

2. **Admin booking-alert recipient(s)** — **RESOLVED:** query `app_users` where `role='admin'` for alert recipients (07-04), forward-compatible with more admins.

3. **Whether to add a grep-gate test for the single Resend call-site** — **RESOLVED:** yes; `single-sender.test.ts` Wave-0 spec asserts `resend.emails.send` appears ONLY in `platform/notifications/send-email.ts` (07-01).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `resend` npm package | All emails | ✗ (not installed) | target `^6` → 6.14.0 | none — `npm install resend` (checkpoint) |
| `RESEND_API_KEY` (Vercel prod, server-only) | `sendEmail()` | ✗ to verify | — | none — set in Vercel env (checkpoint) |
| Verified `send.balkanity.com` subdomain in Resend | Real delivery (D-13/D-15 gate) | ✗ (currently `onboarding@resend.dev` test sender) | — | none — manual DNS step by user + dashboard verify (the completion gate) |
| Supabase service-role client | `email_log` + `notifications` inserts | ✓ | `^2.108` | — |
| `@supabase/ssr` caller-auth client | RLS-scoped bell read | ✓ | `^0.12` | — |
| Balkanity Supabase project (ref `qyhdogajtmnvxphrslwm`) | migration `0007` apply | ✓ (via Management API, never MCP/Kalvia) | hosted | — |

**Missing dependencies with no fallback (block phase completion):**
- Verified `send.balkanity.com` subdomain — the D-15 completion gate. DNS records (per the Resend dashboard for this domain): an MX record on host `send` (value `feedback-smtp.<region>.amazonses.com`, priority 10), an SPF TXT on host `send` (`v=spf1 include:amazonses.com ~all`), and a DKIM TXT on host `resend._domainkey`. Exact values are shown per-domain in the dashboard — copy verbatim. `[CITED: resend.com/docs/dashboard/domains]`
- `RESEND_API_KEY` set server-only in Vercel prod.
- `resend` package installed.

**Missing dependencies with fallback:**
- None. (Unit tests mock the Resend client per D-15, so the test suite runs without any live Resend dependency.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` (jsdom) + Playwright `^1.61` (chromium) — `[VERIFIED: codebase]` |
| Config file | `vitest.config.*` (Wave-0 baseline from Phase 1) + `playwright.config.*` |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npx vitest run` (+ `npx playwright test` for e2e) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-06 | `sendEmail` skips best-effort at ≥ SOFT_CAP, still sends critical | unit (Resend mocked) | `npx vitest run platform/notifications/send-email.test.ts` | ❌ Wave 0 |
| NOTF-06 | `sendEmail` is idempotent on `idempotency_key` (no double-send on webhook retry) | unit (Resend mocked) | `npx vitest run platform/notifications/send-email.test.ts` | ❌ Wave 0 |
| NOTF-06 | `resend.emails.send` appears ONLY in `send-email.ts` (cap-bypass guard) | source grep gate | `npx vitest run platform/notifications/single-sender.test.ts` | ❌ Wave 0 (recommended) |
| BOOK-06 | `confirmation-email.ts` still writes NO `status:'paid'` after un-stub | source grep gate | `npx vitest run platform/transfers/confirmation.test.ts` | ✅ (keep green) |
| BOOK-05 | single `paid` writer set unchanged after Phase 7 | source grep gate | `npx vitest run platform/payments/single-writer.test.ts` | ✅ (keep green) |
| NOTF-01 | bell read returns ONLY the caller's own notifications (RLS) | integration (caller-auth) | `npx vitest run platform/notifications/notifications-rls.test.ts` | ❌ Wave 0 |
| NOTF-02 | `arrived` fires the guest "arrived" email; `en_route` fires NONE | unit (Resend mocked) | `npx vitest run app/driver/advance.notify.test.ts` | ❌ Wave 0 |
| NOTF-02/D-16 | "driver assigned" email body carries driver first name + phone; `to` = guest_email | unit (Resend mocked) | `npx vitest run platform/notifications/assigned-email.test.ts` | ❌ Wave 0 |
| NOTF-05 | digest builder includes masked pool fields + own claimed runs, ZERO guest PII keys | unit | `npx vitest run platform/notifications/digest.test.ts` | ❌ Wave 0 |
| D-17 | guest email resolves BG copy from persisted `locale`; admin/invite = EN | unit | `npx vitest run platform/notifications/locale.test.ts` | ❌ Wave 0 |
| NOTF-04 | invite path calls `sendEmail` (critical) and no longer returns `actionLink` | unit (Resend mocked) | `npx vitest run app/admin/drivers/invite.notify.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched-path>` + the two grep gates (`confirmation.test.ts`, `single-writer.test.ts`) — they are cheap and protect the money lock.
- **Per wave merge:** `npx vitest run` (full unit suite).
- **Phase gate:** full unit suite green + the D-15 live-delivery UAT (real email to a real inbox from the verified subdomain) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `platform/notifications/send-email.test.ts` — cap soft-block + idempotency (Resend MOCKED) — NOTF-06
- [ ] `platform/notifications/single-sender.test.ts` — grep gate: only one Resend call-site (recommended)
- [ ] `platform/notifications/notifications-rls.test.ts` — own-rows-only read — NOTF-01
- [ ] `platform/notifications/assigned-email.test.ts` — name+phone in body, guest-only recipient — NOTF-02/D-16
- [ ] `platform/notifications/digest.test.ts` — masked fields + own runs, zero PII — NOTF-05
- [ ] `platform/notifications/locale.test.ts` — D-17 locale resolution
- [ ] `app/driver/advance.notify.test.ts` — arrived emails / en_route silent — NOTF-02
- [ ] `app/admin/drivers/invite.notify.test.ts` — invite via sendEmail, no inline reveal — NOTF-04
- [ ] Framework install: `npm install resend` (Resend MOCKED in all tests per D-15)

## Security Domain

> `security_enforcement` config key not located in `.planning/config.json` scope this session; treated as enabled. Phase touches PII reveal (driver phone to guest), service-role writes, and a new external send provider.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; magic-link/invite generation reused unchanged. |
| V3 Session Management | no | No session changes. |
| V4 Access Control | yes | `notifications` RLS = own-rows-only read; mark-read is a gated service-role action (caller `auth.uid() === recipient_id`); `email_log` admin-read only. No client write policy. |
| V5 Input Validation | yes | zod on the digest-preference form input; the invite/booking inputs already zod-validated. |
| V6 Cryptography | no | No new crypto; Resend handles DKIM signing. Never hand-roll. |
| V7 Error/Logging | yes | Log-and-continue must not leak PII into logs; `console.error` on send failure logs the error, not the recipient PII body. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Driver phone PII to wrong recipient in "assigned" email | Information Disclosure | `to:` is ALWAYS the row's `guest_email` (server-read); narrow service-role `{name,phone}` read; never to any other channel (Pitfall 5). |
| Cap-bypass via a rogue `resend.emails.send` call-site | Denial of Service (cap exhaustion) | All sends route through `sendEmail()`; grep-gate test asserts the single call-site. |
| Webhook-retry double-send | Tampering / duplication | `email_log` UNIQUE `idempotency_key` + check-before-send + Resend native `idempotencyKey` (Pitfall 4). |
| Client tampering with notification read state / inserting fake notifications | Tampering / Spoofing | No client write RLS policy; inserts + mark-read are service-role-only behind a caller-identity gate. |
| Service-role key / Resend key leaking to client | Information Disclosure | `import "server-only"` first line in `send-email.ts`/`notify.ts`; `RESEND_API_KEY` never `NEXT_PUBLIC_` (build-fail guard, PLAT-05). |
| Second `paid` writer sneaking in via the email path | Tampering (money) | `sendEmail`/`confirmation-email.ts` perform ZERO `wp_transfers` writes; single-writer.test.ts grep gate stays green. |

## Sources

### Primary (HIGH confidence)
- In-repo source (read this session): `app/api/stripe/webhook/route.ts`, `platform/transfers/confirmation-email.ts`, `platform/transfers/confirmation.test.ts`, `platform/payments/single-writer.test.ts`, `app/admin/drivers/actions.ts`, `app/admin/transfers/actions.ts`, `app/driver/actions.ts`, `app/driver/PoolView.tsx`, `app/driver/page.tsx`, `app/pickup/[slug]/actions.ts`, `platform/transfers/claim.ts`, `platform/i18n/dictionary.ts`, `platform/i18n/en.ts`, `platform/supabase/admin.ts`, migrations `0003`–`0006`, `package.json` — HIGH
- npm registry (`npm view resend version` → 6.14.0; `scripts.postinstall` → empty) — HIGH
- CLAUDE.md verified provider table (Resend 100/day, 3000/mo, 5 req/s, ~90/day guardrail; subdomain pattern) — HIGH

### Secondary (MEDIUM confidence)
- resend.com/docs/api-reference/emails/send-email — `emails.send` payload fields + idempotency support — HIGH-MEDIUM
- resend.com/docs (idempotency-keys) — `idempotencyKey` is the SDK 2nd-arg option — MEDIUM
- resend.com/docs/dashboard/domains — subdomain recommendation + DNS record types (MX `send`, SPF TXT `send`, DKIM `resend._domainkey`) — MEDIUM (exact values are region/domain-specific, shown in dashboard)

### Tertiary (LOW confidence)
- Resend free-tier verified-domain count = 1 (corroborated in CLAUDE.md as MEDIUM; official quota page did not state it) — LOW, flag for dashboard verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single new dep (`resend`), version verified on registry, everything else already installed and green.
- Architecture: HIGH — all hook points read directly from real source files; patterns are direct copies of proven Phase 3–6 conventions.
- Pitfalls: HIGH — the locale-cookie and Realtime-conflict pitfalls were confirmed against actual code/docs, not assumed.
- Delivery/DNS specifics: MEDIUM — exact DNS values are shown per-domain in the Resend dashboard; verified-domain count is MEDIUM.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable stack; Resend SDK `6.x` and the in-repo seams are unlikely to shift in 30 days)
