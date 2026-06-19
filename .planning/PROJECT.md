# Balkanity Platform — Welcome Pickup (v1)

## What This Is

The first module ("Welcome Pickup") of the Balkanity Platform — an installable PWA for a Bulgarian travel agency (balkanity.com). Short-term-rental property companies register destination addresses; guests open a per-destination link, fill a short form, and prepay an airport→property transfer; Balkanity drivers self-claim paid transfers from a shared pool (first to claim owns it) and fulfil them. The referring company earns a commission (recorded in v1, paid out later via Stripe Connect). Three actors, three UIs: Admin (desktop console), Driver (mobile PWA), Guest (mobile PWA).

## Core Value

A guest can prepay an airport transfer via a destination link, and a driver can reliably claim and fulfil it — with money only ever marked `paid` by a verified Stripe webhook, and zero double-claims under concurrency.

## Requirements

### Validated

- Claim-correctness **data layer** (CLAIM-02, CLAIM-03) — adversarially proven live in Phase 5: exactly one driver wins any claim under concurrency (atomic `claim_transfer` RPC), and full guest PII is invisible to non-claiming drivers in the API payload itself (masked `wp_pool` SECURITY DEFINER read + RLS, not UI masking). Evidence: `phases/05-claim-correctness/05-GATES-EVIDENCE.md`. The user-observable driver pool/claim UI atop this layer ships in Phase 6.

### Active

- [ ] Guest books + prepays an airport→property transfer via a per-destination slug link (email required, phone optional)
- [ ] `paid` is set ONLY by a verified Stripe webhook (signature-checked, idempotent on event id); client redirect never sets paid
- [ ] Guest tracks transfer status via a passwordless Supabase magic link
- [ ] Admin onboards companies / properties / destinations and sets price + commission per destination (no-code, through the UI)
- [ ] Admin invites drivers (contractor-only; no open signup)
- [ ] Drivers see a limited-detail claim pool (no PII / no exact address) and claim atomically (first-to-claim wins)
- [ ] Full guest PII unlocks only for the claiming driver and admin (enforced via RLS + field masking)
- [ ] Transfer advances through lifecycle: requested → paid → claimed → en_route → arrived → picked_up → completed (+ cancelled)
- [ ] In-app notification feed/bell (shared platform feature, primary for drivers)
- [ ] Transactional emails via Resend: guest confirmation (on paid), driver-assigned (on claimed), driver-arrived (on arrived), admin booking alert, driver invite
- [ ] Drivers get an opt-in daily digest instead of per-transfer email (stay under the 100/day cap)
- [ ] Platform Health: webhook_events log (idempotency + signature result + outcome), reconciliation (Stripe-paid but no transfer → flag), email-cap gauge, stuck-transfer alerts
- [ ] Admin operations: transfers list + detail (assign/reassign/cancel + manual Stripe refund)
- [ ] PWA shell (installable, offline-aware) with brand design tokens, Montserrat, EN/BG toggle

### Out of Scope

- Stripe Connect / commission payout — deferred to a later phase; v1 records commission but settles all funds to Balkanity via plain Checkout
- Auto-dispatch — v1 is self-claim only
- Flight tracking — not core to the pilot
- Property self-service portal — admin onboards on companies' behalf in v1
- SMS / WhatsApp — email only in v1
- Multi-language UI strings beyond an EN/BG toggle — no full i18n framework
- Any second platform module (tours, car rental, …) — Welcome Pickup only
- Automated / guest-facing refund flow — bookings are prepaid & non-refundable; admin issues manual Stripe refunds for exceptions
- Pricing engine — manual fixed price per destination

## Context

- **Platform-vs-module boundary is the highest-cost thing to get right.** Shared platform foundations (reused by future modules): users/auth & roles, companies & properties, payments (Checkout + webhook + refund hooks), notifications (in-app feed + Resend wrapper + send guardrails), Platform Health, design system (tokens/logo/pictograms), PWA shell. Welcome-Pickup-specific: booking form & destination/slug-link, transfer entity + lifecycle, driver claim pool + atomic claim, transfer views (pool, my run, transfer detail).
- **Atomic claim mechanic:** `UPDATE transfers SET status='claimed', driver_id=:id WHERE id=:id AND status='paid'` — the loser updates 0 rows and gets "already claimed". Concurrency-safe by construction, not by RLS alone.
- **Driver pre-claim visibility:** before claiming, drivers see date, arrival time, airport, destination zone/area (NOT exact address), fare, pax, luggage. Name, contact, exact address, flight no., and notes unlock only on claim.
- **Notifications budget:** ~4 guest/admin emails per transfer (confirmation + driver-assigned + driver-arrived + admin alert). Resend free tier daily cap is the real pilot constraint; drivers use in-app + digest to avoid blowing it. Guest status emails fire on `claimed` and `arrived` (not `en_route`).
- **Design system:** six brand colours + white, Montserrat only. Status is always a coloured dot + text label (never colour alone). ≥44px hit targets, 52px primary CTAs. Warm light surfaces, slate console. Real logo assets (Mockups/assets/mark-white.png, mark-teal.png) and real plane/route pictograms from Balkanity Branding/ — never re-draw the logo or invent icons. Interactive HTML/CSS prototypes exist in Mockups/design/ (admin, guest, guest status, driver, index.html) — rebuild as Next.js + Tailwind.
- **Brand tokens:** `--teal #029B87` (primary/actions/links/claimed), `--teal2 #047982` (secondary/avatars), `--amber #FEBE21` (in-progress/en_route/attention/live), `--coral #E44B4B` (alerts/unclaimed/cancelled/destructive/errors), `--slate #2F4858` (headings/text/dark surfaces/sidebar), `--grey #66676F` (muted/completed), `--white #FFFFFF`. Montserrat 400/500/600/700/800.
- **Companion docs:** PRD.md (EN) and PRD-BG.md (BG) and Mockups/ are referenced in the brief but are NOT yet present in the repo — add them if available so planning can ingest them.
- **VERIFY before relying (do not assume):** Stripe BG/EUR pricing (EEA 1.5%+€0.26, non-EEA/intl 3.25%+€0.26, UK 2.5%+€0.26, +2% conversion; refunds don't return the original fee); Resend caps (100/day, 3000/month, 1 verified domain); Supabase free tier (~500MB DB, 500k edge invocations/mo, projects pause after 7 days inactivity — add keep-alive; confirm pg_cron/scheduled-functions for the reconciliation sweep); Vercel Hobby cron (~once/day, imprecise — prefer Supabase scheduling for the 15–30 min reconciliation sweep, Vercel cron only as a daily backstop); Next.js PWA tooling (service worker / install / offline shell) on current Next + Vercel.

## Constraints

- **Tech stack**: Next.js (App Router) + React + Tailwind, deployed on Vercel (Hobby tier), built as a PWA — chosen stack, locked.
- **Backend**: Supabase — Postgres + Auth + RLS + Storage + Edge Functions — locked.
- **Payments**: Stripe Checkout via code-created Checkout Sessions (NOT dashboard Payment Links). Stripe Connect (Express) deferred — locked.
- **Email**: Resend free tier (100/day cap is the binding constraint) — locked.
- **Infrastructure (Balkanity ONLY)**: Supabase ref `qyhdogajtmnvxphrslwm` (https://qyhdogajtmnvxphrslwm.supabase.co); Vercel project `balkanity_platform_project` (team `balkanity-platform-s-projects`). NEVER target the Kalvia project (ref `utyatpadtibqqswsfvtr`). If any tool reports Kalvia, STOP and switch to Balkanity.
- **Security**: never hardcode/commit secrets; never expose service-role or Stripe secret keys to the client; never set `paid` outside the verified webhook handler; never expose guest PII to unclaimed drivers.
- **Review gates**: flag schema / auth / RLS / payment changes for review before applying (treat schema as flagged/irreversible — sign-off before the first migration).
- **Pilot target**: 1 company + 3 properties; ~10 completed transfers end-to-end with real money. Definition of done: 0 double-claims under concurrency; 100% of `paid` from verified webhooks; reconciliation catches a deliberately-dropped webhook.
- **Philosophy**: favour the simplest thing that works; call out gold-plating; state assumptions and ask before committing on risky areas (schema/auth/RLS/payments).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build as first module of a multi-module platform; keep platform/module boundary clean | Future modules (tours, car rental) reuse shared foundations; boundary mistakes are the most expensive to fix later | — Pending |
| `paid` set only by verified Stripe webhook (idempotent, signature-checked) | Client redirects are spoofable; money state must be authoritative | — Pending |
| Driver self-claim via atomic conditional UPDATE | Guarantees first-to-claim wins with zero double-claims under concurrency without locks | — Pending |
| Commission recorded in v1, paid out later via Connect | De-risks the pilot; plain Checkout settles all funds to Balkanity now, Connect added when ready | — Pending |
| PII masking enforced at RLS/query layer, not just UI | UI-only masking leaks data via API; RLS is the real boundary | — Pending |
| Guest magic-link status (passwordless); guestless checkout | Lowest-friction booking; email is the only hard requirement | — Pending |
| Drivers: in-app feed + opt-in daily digest instead of per-transfer email | Keeps the pilot under the Resend 100/day free-tier cap | — Pending |
| Manual pricing per destination (no pricing engine) | Simplest thing that works for the pilot | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-19 after Phase 5 (claim-correctness) completion*
