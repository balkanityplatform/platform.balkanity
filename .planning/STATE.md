---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 7 UI-SPEC approved
last_updated: "2026-06-19T15:22:17.564Z"
last_activity: 2026-06-19 -- Phase 07 planning complete
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 28
  completed_plans: 28
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-17)

**Core value:** A guest can prepay an airport transfer via a destination link, and a driver can reliably claim and fulfil it — with money only ever marked `paid` by a verified Stripe webhook, and zero double-claims under concurrency.
**Current focus:** Phase 06 — driver-admin-views

## Current Position

Phase: 06 (driver-admin-views) — EXECUTING
Plan: 5 of 5
Status: Implementation + automated verification complete (8/8 must-haves); 2 code-review blockers fixed; 5 UAT items pending — run /gsd-verify-work 6
Last activity: 2026-06-19 -- Phase 07 planning complete

Progress: [██████████] 100%

## Handoff (for a new session)

- Live: https://balkanityplatformproject.vercel.app (Vercel team balkanity-platform-s-projects, Git-integration deploy on push to main).
- Auth: email+password login; /sign-in, /forgot-password, /set-password, /auth/confirm. Test admin: balkanityplatform@gmail.com (Resend test sender only delivers here). Resend custom SMTP configured (test sender onboarding@resend.dev).
- Access via local creds (NOT MCP): Vercel CLI authed+linked; .env.local holds Supabase keys, DB URL, and the Management access token. See memory files.
- SECURITY TODO: rotate the sbp_ SUPABASE_ACCESS_TOKEN (pasted in chat) + remove from .env.local.

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 03 | 5 | - | - |
| 05 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 12 | 3 tasks | 16 files |
| Phase 01 P03 | 30min | 3 tasks | 10 files |
| Phase 01 P04 | 11min | 3 tasks | 20 files |
| Phase 02 P01 | 8 | 3 tasks | 9 files |
| Phase 02 P02 | 22min | 2 tasks | 8 files |
| Phase 02 P03 | 3min | 2 tasks | 5 files |
| Phase 02 P04 | 5min | 3 tasks | 7 files |
| Phase 02 P05 | continuation | 3 tasks | 6 files |
| Phase 03 P01 | 9min | 3 tasks tasks | 10 files files |
| Phase 03 P02 | 3min | 1 tasks | 1 files |
| Phase 03 P03 | 14min | 2 tasks | 4 files |
| Phase 03 P04 | 4 | 2 tasks | 4 files |
| Phase 04 P02 | 2min | 3 tasks | 1 files |
| Phase 04 P03 | 3min | 3 tasks | 4 files |
| Phase 04 P04 | 10m | 3 tasks | 10 files |
| Phase 05 P01 | 7min | 3 tasks | 5 files |
| Phase 05 P02 | 2 | 2 tasks | 2 files |
| Phase 05 P03 | 9min | 3 tasks | 4 files |
| Phase 06 P01 | 8min | 4 tasks | 13 files |
| Phase 06 P02 | 4min | 2 tasks tasks | 5 files files |
| Phase 06 P04 | 4min | 2 tasks | 5 files |
| Phase 06 P03 | 4min | 2 tasks tasks | 4 files files |
| Phase 06 P05 | 20min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8-phase strict dependency chain — seam/auth → onboarding → payments → transfer → claim → views → notifications → health
- [Roadmap]: Platform/module seam (PLAT-01) is non-deferrable, established in Phase 1
- [Roadmap]: `paid` written only by verified idempotent webhook (Phase 3); atomic claim + data-layer PII gating (Phase 5) — both with adversarial test gates
- [Phase ?]: [01-01]: One-way platform/modules seam enforced via ESLint no-restricted-imports flat-config (PLAT-01)
- [Phase ?]: [01-01]: Vitest (jsdom) + Playwright (chromium) Wave 0 test baseline established for all later plans
- [Phase ?]: 01-03: Authz via getCurrentRole() (auth.getUser → app_users.role); proxy.ts (Next 16) refreshes session with getClaims; never getSession for authz (SC-3)
- [Phase ?]: 01-03: Guest at / bounces to /sign-in (Phase 4 uses /pickup/<slug>); driver at / → /driver (reserved); Supabase magic-link email template must be {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
- [Phase 01]: Dict widens dictionary values to string (not as-const literals) so BG translations differ from EN while a missing key still fails tsc
- [Phase 01]: sign-in page is a Server Component shell + SignInForm client island so dictionary copy resolves server-side (no-flash SSR)
- [Phase ?]: [02-01]: Hand-rolled slugify (no lib); Cyrillic-only labels slugify to '' and fall back to 'dest' via nextSlugCandidate (D-08, Pitfall 2)
- [Phase ?]: [02-01]: Money as integer cents, round-half-up; commission/net/fee display-only and never persisted; Stripe fee is an estimate note (EEA 1.5% + EUR0.25, D-05/D-06/D-07)
- [Phase ?]: [02-01]: All Phase 2 UI-SPEC copy lives in en.ts/bg.ts behind the tsc Dict parity gate; zod ^4.4 made explicit dependency
- [Phase ?]: [02-02]: Supply schema live on Balkanity — companies/properties/destinations/driver_profiles UNPREFIXED + admin-only RLS (one SELECT policy each via is_admin() SECURITY DEFINER), no write policy; unique destinations_slug_key (D-09); applied via migration-repair of 0001 (empty remote history reconciled without DDL re-run)
- [Phase ?]: [02-02]: Companies CRUD pattern — RSC anon RLS read + service-role write behind getCurrentRole() re-gate (two gates); D-12 (no deactivate with active children) enforced in-action + FK on delete restrict backstop
- [Phase ?]: [02-03]: Properties slice — parent-company Select is create-only (updateProperty changes name only; parent FK fixed once created); parent name appended to DataList label (name — Company) rather than extending the shared single-label primitive
- [Phase ?]: [02-03]: Create form gated on >=1 active company (picker offers active companies only); deleteProperty reuses deactivatePropertyBlocked copy for non-childless rows with FK on delete restrict as the DB backstop (ONBD-02 complete)
- [Phase 02-04]: Destinations slug write path — server slugify() base + nextSlugCandidate probe; DB destinations_slug_key unique index is the race-safe authority (23505 → slugTaken, D-09); parent-property Select is create-only
- [Phase 02-04]: Live 'you keep' panel (D-06) is a display-only useMemo recompute from pure commission utils (never persisted); proven green by a fireEvent component test — no @testing-library/user-event dependency added
- [Phase 02-05]: Driver invite via auth.admin.generateLink({type:'invite'}) — creates the auth user + returns the set-password action_link with NO email (D-03, NOTF-04 stubbed → Phase 7); role='driver' written as the literal server-side (never from FormData, T-02-EOP5); invite is the only driver-account path (AUTH-03, no open signup)
- [Phase 02-05]: redirectTo = ${NEXT_PUBLIC_SITE_URL}/auth/confirm?type=invite (trusted constant, never Origin header — WR-04); URL must be in the Supabase Redirect-URLs allowlist or it silently falls back to Site URL (Pitfall 1) — applied on Balkanity (qyhdogajtmnvxphrslwm); single generic driverAlreadyInvited on re-invite (no enumeration, T-02-ID5)
- [Phase ?]: [03-01]: 7 Nyquist payment-contract scaffolds land RED first (single paid writer, nodejs+raw-body webhook, migration-0003 RLS/UNIQUE, EUR/integer checkout, real-fee, forged-400 + success-spoof); targets in Plans 02-05 turn them GREEN
- [Phase ?]: [03-01]: stripe@^22.2.1 installed (official SDK, empty postinstall, no @stripe/stripe-js); apiVersion '2026-05-27.dahlia' type-checks against v22 typings (no cast)
- [Phase ?]: [03-01]: checkout/fee contract tests use runtime-string dynamic import + typed cast so they tsc-clean before the impl exists while staying RED at runtime
- [Phase 03-02]: Migration 0003 authored — wp_transfers (minimal money-spine, D-03) + webhook_events (UNIQUE event_id idempotency, HLTH-01/SC3); both RLS admin-read/no-write reusing 0002 is_admin(); EUR/integer-cents; FILE ONLY, live apply deferred to Plan 05 (Balkanity ref qyhdogajtmnvxphrslwm, never Kalvia)
- [Phase 03-03]: Payments seam — stripe.ts is server-only (import "server-only" first line, build-fail key-leak guard) and pins apiVersion '2026-05-27.dahlia' (type-checks against stripe@22.2.1 directly, no cast)
- [Phase 03-03]: createCheckoutSession({transferId,amountCents}) follows the Plan-01 unit contract — integer unit_amount passed straight to Stripe (EUR, mode 'payment'), metadata.transfer_id mirrored onto payment_intent_data.metadata; success/cancel from trusted NEXT_PUBLIC_SITE_URL (never Origin, WR-04); DB row resolution/persistence deferred to the caller (no in-helper admin read)
- [Phase 03-03]: recordedFeeCents(pi) is the verbatim integer balance_transaction.fee (D-05 recorded truth), null-guarded on unexpanded/absent (Pitfall 5) — distinct from commission.ts estStripeFeeCents display estimate; no 'paid' writer introduced (single-writer gate stays RED until Plan 04 webhook)
- [Phase ?]: Webhook avoids NextResponse.json() (responses via JSON.stringify) so the contract gate's zero-dot-json rule passes while req.text() stays the only body read
- [Phase ?]: app/pay/start gated by NODE_ENV not production (404 in prod), enabling Plan 05 TEST-mode gates without an admin session (T-03-START)
- [Phase ?]: [04-02]: Migration 0004 authored (FILE ONLY, apply deferred to Plan 05) — wp_transfers ALTER adds NULL-able guest PII + lifecycle + driver_id scaffold (D-06); existing Phase-3 seed rows survive (additive, no NOT NULL/defaults)
- [Phase ?]: [04-02]: BEFORE-UPDATE trigger wp_enforce_transfer_transition encodes the full 8-state map mirroring platform/transfers/lifecycle.ts exactly; permits requested->paid (Pitfall 4); raises check_violation on illegal jumps; fires on service-role webhook (D-08, triggers not bypassed)
- [Phase ?]: [04-02]: RLS guest-self-read uses (select auth.jwt() ->> 'email') = guest_email (never deprecated email() helper); destinations_public_active_read (active=true, to anon) unblocks /pickup (BOOK-01); no-write-policy lock preserved
- [Phase ?]: Booking is a public server-action surface (no getCurrentRole gate); zod schema + server-re-read amount are the only gates (04-03)
- [Phase ?]: Server-trusted amount: createBooking re-reads destinations.price_cents by slug for both the row and the Checkout Session; the booking form submits no amount input (04-03, Pitfall 5)
- [Phase ?]: Status page reads the guest's own transfer via cookie/anon RLS + getUser; driver name+phone revealed post-claim via a narrow service-role {name,phone} read (driver_profiles join on user_id)
- [Phase ?]: Confirmation + /track re-access emails stubbed (generateLink magic link revealed/logged); Resend send deferred to Phase 7 — function signature is the stable seam
- [Phase ?]: [05-01]: Nyquist RED baseline for Phase 5 — source-level claim-schema contract + concurrency one-winner gate + non-claiming-driver zero-PII gate + shared service-role seed/caller-auth fixtures, all RED by design; migration 0005 is Plan 02, live apply Plan 03
- [Phase ?]: [05-01]: Two-identity test split — service-role confined to seed/teardown, caller-auth (anon key + driver JWT) is the only claim/read identity (D-04, T-05-03); claim-schema contract accepts security_invoker view OR SECURITY DEFINER pool read (Open Q1 -> Plan 02)
- [Phase ?]: Plan 05-02: masked pool wp_pool() implemented as a SECURITY DEFINER read (Open Q1 = option b), not a security_invoker view — base table stays 0-rows for non-claiming drivers (SC4)
- [Phase ?]: Plan 05-02: claim_transfer is a SECURITY DEFINER RPC deciding the race with ONE atomic conditional UPDATE; single driver-self RLS policy; migration 0005 authored NOT applied (live apply = Plan 03)
- [Phase ?]: [05-03]: Migration 0005 applied LIVE to Balkanity (qyhdogajtmnvxphrslwm) via Management API after approve-apply sign-off (Open-Q1 = SECURITY DEFINER masked read); both adversarial gates GREEN live (one winner under N=20xK=5; zero PII to non-claiming driver); single-writer intact; zero residue left on live DB
- [Phase ?]: [05-03]: wp_pool is a SECURITY DEFINER function (not a relation) consumed via .rpc('wp_pool'); PostgREST 42501 anon-deny confirms exposure with EXECUTE revoked from anon (D-06)
- [Phase ?]: [06-01]: claimed->paid is the ONLY new lifecycle edge (D-14 release, claimed-only); mirrored in lifecycle.ts + authored migration 0006; 8x8 pin-test GREEN
- [Phase ?]: [06-01]: Migration 0006 authored NOT applied (release trigger edge + last_action_* audit columns); live apply deferred to Plan 05 via Management API (never MCP/db push, Balkanity-only)
- [Phase ?]: [06-01]: single-writer gate widened to writers subset of {webhook, admin transfers actions} (D-15 release exception) — GREEN now, RED on any third paid writer
- [Phase ?]: [06-01]: 7 Wave-0 RED specs are source-level RED-by-absence (candidate-file grep); Plans 02-05 consume them as CLAIM-01/04/05/06 + OPS-01/03/04 gates
- [Phase ?]: [06-02]: Driver pool reads the masked wp_pool() RPC only (caller-auth); zero guest-PII keys on the pool path (CLAIM-01/CLAIM-03, Pitfall 11)
- [Phase ?]: [06-02]: claimAction is a thin caller-auth claimTransfer wrapper (never service-role, D-04); win -> /driver/run/<id> renders from the RPC's returned row (no follow-up PII fetch), lose -> neutral toast + card removal (D-03); no un-claim control (CLAIM-04)
- [Phase ?]: [06-02]: /driver pool DATA path forced NetworkFirst in app/sw.ts (non-document rule alongside the document rule) so live claim state is never SW-cached (Pitfall 4, T-06-STALE)
- [Phase ?]: Admin transfers list/detail read unmasked rows via wp_transfers_admin_read on the anon cookie-bound client (never service-role); needsAttention uses simple D-09 pilot constants; URL-searchParams drive server-side re-query (OPS-01/OPS-02).
- [Phase ?]: [06-03]: advanceStatus is a D-13 gated service-role driver write (role + driver_id===auth.uid() ownership + ALLOWED_TRANSITIONS next edge + .eq(status,current) optimistic guard) — NOT a new RLS write policy, NOT a client write (Pitfall 1)
- [Phase ?]: [06-03]: driver My run + detail read on the caller-auth client (claiming-driver RLS scopes rows to the owner); full PII legitimate only post-claim; completed drops to a Completed today partition; no un-claim control anywhere (CLAIM-04/05/06)
- [Phase ?]: [06-05]: Migration 0006 applied LIVE to Balkanity via Management API after 'approved' sign-off — claimed->paid release edge (D-14, claimed-only) + last_action_* audit columns (D-15); ref guardrail confirmed Kalvia absent; history row inserted in the same BEGIN..COMMIT txn; no-write-policy lock intact (only SELECT policies on wp_transfers)
- [Phase ?]: [06-05]: release is the ONE narrow gated status='paid' writer (D-15) guarded by .eq('status','claimed'); single-writer gate GREEN with exactly {webhook, admin transfers actions}; refund records last_action_* only and never sets paid (D-12); cancel never auto-refunds, only offers the refund shortcut (D-11); last_action_by is the acting admin's verified JWT uid

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- OPEN MANUAL UAT (02-05): signed-in production walkthrough of the driver invite — admin logs in → /admin/drivers → submit invite → confirm the revealed action_link contains /auth/confirm?type=invite and resolves to /set-password → set password → resolves to driver role. Proves AUTH-03 + NOTF-04 end-to-end; creates a real auth user. Code + project config (Redirect-URLs allowlist + NEXT_PUBLIC_SITE_URL) shipped; only the live walkthrough is outstanding.
- Open decision (before Phase 3): settlement currency EUR vs BGN (affects fee display; EUR 0.25 vs EUR 0.26 discrepancy).
- Open decision (before Phase 8 / go-live): Supabase Pro vs free + external keep-alive for the real-money pilot.
- Verify before relying: Resend verified-domain count (Phase 7), pg_cron ≥1.6.4 on Balkanity project (Phase 8).
- Companion docs PRD.md / PRD-BG.md referenced in PROJECT.md are not yet in the repo — ingest if available.
- Infra guardrail: all Supabase/Vercel work targets Balkanity only (ref `qyhdogajtmnvxphrslwm`), never Kalvia (`utyatpadtibqqswsfvtr`).
- Review gate standing: schema / auth / RLS / payment changes require sign-off before applying (Phases 1, 2, 3, 4, 5, 7, 8 all touch flagged areas).
- SECURITY: `.env.local.example` (tracked) verified CLEAN 2026-06-19 — all values are empty placeholders, no real secrets. (Prior concern resolved.) `.env.local` is gitignored. Remaining hygiene: `SUPABASE_ACCESS_TOKEN` rotated 2026-06-19 (old revoke is the user's action); DB password was exposed in chat via `SUPABASE_DB_URL` during Phase 06 UAT — reset before pilot.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Payouts | Stripe Connect commission payout (PAY-01/02) | v2 | Roadmap |
| Growth | Self-service portal, auto-dispatch, flight tracking, SMS/WhatsApp, second module (GROW-01..06) | v2 | Roadmap |

## Session Continuity

Last session: 2026-06-19T14:34:30.614Z
Stopped at: Phase 7 UI-SPEC approved
Resume file: .planning/phases/07-notifications/07-UI-SPEC.md
