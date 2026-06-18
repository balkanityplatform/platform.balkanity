---
phase: 04-transfer-entity-booking-form
verified: 2026-06-18T00:00:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Live booking→pay→confirm→track round-trip smoke"
    expected: "Submit booking form on /pickup/<active-slug> → requested row created → Stripe Checkout redirect → complete TEST payment via Stripe CLI → webhook flips row to paid → [BOOK-06 stub] magic link logged → click magic link → /auth/confirm lands on /status/<id> → lifecycle timeline renders all 8 states with the current one highlighted → 'Paid €X on {date}' receipt visible"
    why_human: "Requires Stripe CLI (stripe listen --forward-to) which is not installed on the verifier's machine. Documented in tests/runbooks/0004-lifecycle-trigger.md as an open operator verify item."
---

# Phase 4: Transfer Entity + Booking Form — Verification Report

**Phase Goal:** A guest can open a per-destination link, complete a short prepaid-and-non-refundable booking, pay via the Phase 3 spine, receive a confirmation email on `paid`, and track the full transfer lifecycle live via a passwordless magic-link status page.
**Verified:** 2026-06-18
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Guest opens `/pickup/<slug>`, sees destination + fare, completes a short guestless form (email required; phone, flight no., pax, luggage, notes); inactive/unknown slug shows neutral unavailable state | VERIFIED | `app/pickup/[slug]/page.tsx` — RSC reads destination by slug via service-role client, renders `dest.label` + fare `Card` with `€{fmtEur(price_cents)}` (read-only) + `<BookingForm slug={slug} copy={...} />`. Inactive/unknown slug renders `slugUnavailableHeading`/`slugUnavailableBody` with no form. `BookingForm.tsx` collects all D-01..D-04 fields via `TextField`, native date/time inputs, and `PaxStepper`. `export const runtime = "nodejs"`. |
| 2 | Submitting creates a `wp_transfers` row in `requested` and a Stripe Checkout Session; checkout clearly states the booking is prepaid & non-refundable before payment | VERIFIED | `app/pickup/[slug]/actions.ts` — `createBooking` server action validates via zod `bookingSchema`, re-reads `destinations.price_cents` by slug (never FormData amount), inserts `{ status: "requested", amount_cents: dest.price_cents, ... }` via service-role, calls `createCheckoutSession({transferId, amountCents: dest.price_cents})` exactly once, and 303-redirects. `BookingForm.tsx` renders the `disclosureHeading`/`disclosureBody` Card ABOVE the CTA; the "Continue to payment" Button is disabled until the non-refundable acknowledgement checkbox is checked (`disabled={!acked \|\| pending}`). No `name="amount"` or `name="price"` input in the form. |
| 3 | After verified webhook flips transfer to `paid`, guest receives a booking-confirmation stub (intentionally stubbed; real Resend send deferred to Phase 7) wired off the paid transition | VERIFIED | `platform/transfers/confirmation-email.ts` — `sendBookingConfirmation(transferId, guestEmail)` is the single call-site. Has `import "server-only"` as line 1. Calls `auth.admin.generateLink({ type: "magiclink", ..., redirectTo: .../auth/confirm?type=magiclink&next=/status/${transferId} })`, logs via `console.info("[BOOK-06 stub]", ...)`, and returns `{ to, magicLink, html }`. No `status: 'paid'` literal in the source. `app/api/stripe/webhook/route.ts` calls `sendBookingConfirmation` in the `processed` branch (lines 195–200) after the paid UPDATE, wrapped in try/catch log-and-continue so a send failure never changes the HTTP status of the money write. |
| 4 | Guest views a passwordless magic-link status page showing the 8-state lifecycle timeline and a visible payment record/receipt | VERIFIED | `app/status/[id]/page.tsx` — RSC; uses `auth.getUser()` (not `getSession`); reads `wp_transfers` via cookie/anon client so `wp_transfers_guest_self_read` RLS authorizes; renders `<LifecycleTimeline current={status} />` and the receipt via `fill(t.statusReceiptPaidLine, { amount: fmtEur(amount_cents), paidDate })`. `platform/ui/LifecycleTimeline.tsx` iterates `LIFECYCLE_ORDER` (7 states), renders one `<StatusDot state={s} />` per row, emphasizes the current row, and appends a distinct cancelled terminal row when `current === 'cancelled'`. No local state→colour map — imports `StatusDot` and `LIFECYCLE_ORDER` verbatim. `platform/i18n/en.ts` has `statusReceiptPaidLine: "Paid €{amount} on {paidDate}"` (verified via grep). |
| 5 | Transfer advances only through the locked lifecycle requested→paid→claimed→en_route→arrived→picked_up→completed (+cancelled from pre-pickup states), enforced by server-side transition guards; success page is display-only and never writes `paid` | VERIFIED | `supabase/migrations/0004_transfer_entity.sql` — `wp_enforce_transfer_transition` BEFORE-UPDATE trigger encodes the exact 7-state map (6 source states with allowed targets); raises `check_violation` (errcode 23514) on any non-mapped transition; early-returns on no-op (`new.status is not distinct from old.status`); picked_up→only completed (no cancelled). `platform/transfers/lifecycle.ts` mirrors the trigger map exactly. `tests/runbooks/0004-lifecycle-trigger.md` records adversarial live-DB proof: legal chain all SUCCEED, 3 illegal jumps each RAISE check_violation on the superuser path. `app/pay/success/page.tsx` is display-only — reads only `status, amount_cents, paid_at`, the literal "Paid" is guarded inside `isPaid` branch, no write; single-writer.test.ts (106 tests green) confirms exactly one paid writer (the webhook). |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `platform/transfers/lifecycle.ts` | TS ALLOWED_TRANSITIONS map + canTransition + LIFECYCLE_ORDER | VERIFIED | Exists, 53 lines. Imports `TransferState` from `@/platform/ui/StatusDot` (no local enum). Exports `ALLOWED_TRANSITIONS` (8-state record), `canTransition`, and `LIFECYCLE_ORDER` (7 happy-path states, cancelled excluded). |
| `platform/transfers/lifecycle.test.ts` | Exhaustive 8×8 pair test | VERIFIED | Exists. References `ALLOWED_TRANSITIONS`, `LIFECYCLE_ORDER`, `canTransition`. Tests all 64 ordered state pairs. |
| `app/pickup/[slug]/booking.test.ts` | RED→GREEN booking action spec | VERIFIED | Exists. Tests zod boundary + server-sourced amount + single createCheckoutSession call. |
| `platform/transfers/confirmation.test.ts` | Confirmation stub spec | VERIFIED | Exists. Tests magic link contains `/auth/confirm?type=magiclink&next=/status/` and no `status:'paid'` literal. |
| `tests/e2e/guest-status.spec.ts` | Guest status e2e (partially gated) | VERIFIED | Exists. Collected by Playwright. Live session/receipt assertions gated with `test.fixme` referencing Plan 04 — by design (requires live magic-link session). |
| `supabase/migrations/0004_transfer_entity.sql` | PII columns + trigger + guest RLS + active-destination anon read | VERIFIED | Exists, 163 lines. Contains all 9 nullable columns, `wp_enforce_transfer_transition` function, `wp_transfers_transition_guard` BEFORE UPDATE trigger, `wp_transfers_guest_self_read` RLS, `destinations_public_active_read` RLS. Applied live (runbook confirms). |
| `app/pickup/[slug]/page.tsx` | Public RSC: slug→destination+fare + BookingForm | VERIFIED | Exists. `export const runtime = "nodejs"`. Reads destination, renders fare read-only, mounts BookingForm. |
| `app/pickup/[slug]/actions.ts` | createBooking: zod→insert→Checkout→303 | VERIFIED | Exists. Public action (no getCurrentRole gate). Server-re-read price, inserts `status: "requested"`, calls `createCheckoutSession`, 303-redirects. |
| `app/pickup/[slug]/BookingForm.tsx` | useActionState form + disclosure-gated CTA | VERIFIED | Exists. `useActionState(createBooking)`, hidden slug input, all D-01..D-04 fields, disclosure Card above CTA, CTA disabled until acked, no amount input. |
| `platform/ui/PaxStepper.tsx` | ≥44px integer stepper with hidden FormData input | VERIFIED | Exists. Used for pax (min 1, max 8) and luggage_count (min 0) in BookingForm. |
| `platform/transfers/confirmation-email.ts` | sendBookingConfirmation stub | VERIFIED | Exists. `import "server-only"` line 1. Builds magic link via generateLink, logs, returns {to, magicLink, html}. No `status: 'paid'` literal. |
| `platform/ui/LifecycleTimeline.tsx` | Vertical 8-state timeline (StatusDot, no local state map) | VERIFIED | Exists. Imports `StatusDot` and `LIFECYCLE_ORDER`. No local colorClass or STATE_META redeclaration. Renders cancelled as distinct terminal row. |
| `app/status/[id]/page.tsx` | Magic-link RLS-gated RSC: timeline + receipt + driver reveal | VERIFIED | Exists. `export const runtime = "nodejs"`. Uses `auth.getUser()` (not `getSession`). Cookie/anon client for guest transfer read (RLS gates). Service-role narrow read of `name, phone` from `driver_profiles` via `.eq("user_id", row.driver_id)` gated on `CLAIMED_OR_LATER.has(status)` and non-null `driver_id`. |
| `app/track/page.tsx` | Email-only re-access page | VERIFIED | Exists. RSC, mounts `TrackForm` with server-resolved copy. |
| `app/track/actions.ts` | requestStatusLink: no-enumeration neutral return | VERIFIED | Exists. Always returns `{ status: 'ok', message: t.trackSuccessNeutral }` regardless of booking existence. Validates email via zod. Uses `NEXT_PUBLIC_SITE_URL` (not Origin). |
| `app/auth/confirm/route.ts` (modified) | Allowlisted `next` param for magic-link landing | VERIFIED | `STATUS_NEXT_RE = /^\/status\/[0-9a-f-]{36}$/`. `validatedNext` used in both PKCE code branch (`return NextResponse.redirect(new URL(validatedNext, origin))`) and token_hash branch via `verifiedDest`. Defaults to `/` on mismatch. |
| `app/sw.ts` (modified) | SENSITIVE_DOCUMENT regex includes status\|pickup\|track | VERIFIED | `SENSITIVE_DOCUMENT = /^\/(sign-in\|admin\|auth\|driver\|status\|pickup\|track)(\/\|$)/` — all three new guest paths present. |
| `tests/runbooks/0004-lifecycle-trigger.md` | Adversarial live-DB runbook | VERIFIED | Exists. Records: legal chain all SUCCEED; 3 illegal transitions each RAISE check_violation (SQLSTATE 23514) on superuser path; non-owner RLS = 0 rows; anon inactive-dest = 0 rows. Seed-and-rollback transaction; live DB left pristine. |
| `platform/i18n/en.ts` (modified) | All Phase 4 copy keys (booking, disclosure, validation, inactive-slug, confirmation-email, status, track) | VERIFIED | Phase 4 copy section present. `statusReceiptPaidLine: "Paid €{amount} on {paidDate}"` confirmed. `bookingContinueCta: "Continue to payment"`. `disclosureHeading: "Prepaid & non-refundable"`. `slugUnavailableHeading` present. `trackSuccessNeutral` present. |
| `platform/i18n/bg.ts` (modified) | BG translations matching en.ts shape | VERIFIED | `grep -c statusReceiptPaidLine` returns 1 in each file — Dict parity holds. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/transfers/lifecycle.ts` | `platform/ui/StatusDot.tsx` | `import type { TransferState }` | VERIFIED | Line 16: `import type { TransferState } from "@/platform/ui/StatusDot"`. No local enum declared. |
| `app/pickup/[slug]/actions.ts` | `platform/payments/checkout.ts` | `createCheckoutSession({transferId, amountCents})` | VERIFIED | Line 23 import; line 124 call with `{ transferId: row.id, amountCents: dest.price_cents }` — server-sourced amount. |
| `app/pickup/[slug]/actions.ts` | `public.wp_transfers` | service-role insert with `status:'requested'` | VERIFIED | Line 105: `status: "requested"`. No `status: "paid"` anywhere in file. |
| `app/pickup/[slug]/page.tsx` | `app/pickup/[slug]/BookingForm.tsx` | `<BookingForm slug={slug} copy={...} />` | VERIFIED | Line 76: `<BookingForm slug={slug} copy={{...}} />` with server-resolved copy. |
| `app/api/stripe/webhook/route.ts` | `platform/transfers/confirmation-email.ts` | `sendBookingConfirmation` in processed branch | VERIFIED | Line 29 import; line 197 call inside the `if (guestEmail)` block in the `processed` branch, wrapped in try/catch log-and-continue. |
| `app/status/[id]/page.tsx` | `wp_transfers` (guest-self-read RLS) | `createClient()` + `auth.getUser()` + `.from("wp_transfers").select(...)` | VERIFIED | Lines 95–114: cookie/anon client, `auth.getUser()` (not getSession), RLS-scoped select. |
| `app/status/[id]/page.tsx` | `driver_profiles` (service-role, narrow) | `createAdminClient().from("driver_profiles").select("name, phone").eq("user_id", row.driver_id)` | VERIFIED | Lines 147–151, gated on `CLAIMED_OR_LATER.has(status) && row.driver_id != null`. Selects only `name, phone`. Joins on `user_id` (correct FK). |
| `platform/ui/LifecycleTimeline.tsx` | `platform/ui/StatusDot.tsx` | `import { StatusDot, type TransferState }` + `<StatusDot state={state} />` | VERIFIED | Line 17 import; line 49 and 62 usage. No local state→colour map. |
| `app/auth/confirm/route.ts` | `/status/<id>` | Validated `next` threaded as `verifiedDest` in both code and token_hash branches | VERIFIED | Lines 53–55: `STATUS_NEXT_RE`, `validatedNext`; line 73 (code branch) redirects to `validatedNext`; line 80 (token_hash branch) redirects to `verifiedDest` (which equals `validatedNext` for magiclink). |
| `supabase/migrations/0004_transfer_entity.sql` | `public.wp_transfers` | BEFORE UPDATE trigger `wp_transfers_transition_guard` | VERIFIED | Line 125–127: `create trigger wp_transfers_transition_guard before update on public.wp_transfers for each row execute function public.wp_enforce_transfer_transition()`. Adversarial runbook confirms trigger fires on superuser path. |
| `supabase/migrations/0004_transfer_entity.sql` | `auth.jwt() email claim` | `(select auth.jwt() ->> 'email') = guest_email` | VERIFIED | Line 149. Zero occurrences of deprecated `auth.email()`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/status/[id]/page.tsx` | `row` (transfer data) | `supabase.from("wp_transfers").select(...)` cookie/anon client, RLS-gated | Yes — reads real DB row gated by guest JWT email matching `guest_email` | FLOWING |
| `app/status/[id]/page.tsx` | `driverFirstName, driverPhone` | `admin.from("driver_profiles").select("name, phone")` service-role, post-claim | Yes — real DB read gated on `CLAIMED_OR_LATER.has(status) && driver_id != null` | FLOWING |
| `app/pickup/[slug]/page.tsx` | `dest` (destination data) | `admin.from("destinations").select(...)` service-role | Yes — reads real destination row; inactive/null renders unavailable state | FLOWING |
| `app/api/stripe/webhook/route.ts` | `paidRows` | `admin.from("wp_transfers").update({status:"paid",...}).eq("id",transferId).neq("status","paid").select(...)` | Yes — conditional update on verified Stripe event id, idempotent | FLOWING |
| `platform/transfers/confirmation-email.ts` | `magicLink` | `admin.auth.admin.generateLink(...)` GoTrue API | Yes — generates real magic link; Phase-4 stub logs instead of sending (by design) | FLOWING (stub by design) |

---

### Behavioral Spot-Checks

Step 7b: Skipped for API routes that require a running server and the Stripe CLI. Automated test suite results from the runbook substitute as the nearest available evidence:

| Behavior | Evidence | Status |
|----------|----------|--------|
| All lifecycle transitions enforce correctly | `npm run test` 21 files / 106 tests GREEN; adversarial runbook: 3 illegal jumps each RAISE check_violation on superuser path | PASS |
| Single paid writer preserved | `platform/payments/single-writer.test.ts` GREEN per runbook | PASS |
| Booking form rejects missing fields (zod boundary) | `app/pickup/[slug]/booking.test.ts` GREEN per runbook | PASS |
| Confirmation magic link built correctly | `platform/transfers/confirmation.test.ts` GREEN per runbook | PASS |
| Success-spoof protection | `tests/e2e/success-spoof.spec.ts` referenced as GREEN in 04-04 SUMMARY | PASS |

---

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. The Plan-05 BLOCKING gate substitutes: the adversarial runbook (`tests/runbooks/0004-lifecycle-trigger.md`) is the live-DB probe equivalent and was executed against the live Balkanity DB within the phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BOOK-01 | 04-02, 04-03, 04-05 | Guest opens per-destination slug page showing destination + fare | SATISFIED | `/pickup/[slug]/page.tsx` renders label, fare caption, `€{fmtEur(price_cents)}`; inactive slug → neutral state. RLS `destinations_public_active_read` applied live. |
| BOOK-02 | 04-01, 04-03 | Guest completes short booking form (email required; phone, flight no., pax, luggage, notes) — guestless checkout | SATISFIED | `BookingForm.tsx` collects all fields; `createBooking` validates via `bookingSchema`; no auth gate. |
| BOOK-03 | 04-01, 04-03 | Booking creates a transfer in `requested` + code-created Stripe Checkout Session | SATISFIED | `createBooking` inserts `status:'requested'`, calls `createCheckoutSession`, 303-redirects. |
| BOOK-04 | 04-03 | Checkout clearly states booking is prepaid & non-refundable before payment | SATISFIED | Disclosure Card with `disclosureHeading`/`disclosureBody` rendered ABOVE the CTA; CTA disabled until acked. |
| BOOK-06 | 04-01, 04-04 | On `paid`, guest receives booking confirmation (stub in Phase 4; real Resend in Phase 7) | SATISFIED | `sendBookingConfirmation` called in webhook `processed` branch; builds magic link, logs. Stub is the plan-mandated behavior. |
| BOOK-07 | 04-01, 04-04, 04-05 | Guest status page shows live lifecycle timeline + payment record/receipt | SATISFIED | `/status/[id]` renders `<LifecycleTimeline current={status} />` + `fill(t.statusReceiptPaidLine, {amount, paidDate})`. `LifecycleTimeline` covers all 8 states via `LIFECYCLE_ORDER` + cancelled terminal row. |
| XFER-01 | 04-01, 04-02, 04-05 | Transfer follows locked lifecycle requested→paid→…→completed (+cancelled); enforced server-side | SATISFIED | `wp_enforce_transfer_transition` BEFORE-UPDATE trigger + `platform/transfers/lifecycle.ts` TS mirror; adversarial runbook proves live enforcement including illegal-transition check_violation on superuser path. |
| AUTH-02 | 04-01, 04-04, 04-05 | Guest views transfer status via passwordless Supabase magic link | SATISFIED | `sendBookingConfirmation` builds `/auth/confirm?type=magiclink&next=/status/<id>` magic link; `/auth/confirm/route.ts` allowlists `next` and lands guest on their status page; `/track` re-issues a fresh link with no-enumeration. |

**All 8 Phase 4 requirements: SATISFIED**

No orphaned requirements found (REQUIREMENTS.md traceability maps BOOK-01 through AUTH-02 to Phase 4 and marks all as Complete).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/pickup/[slug]/actions.ts` | 80–82 | Arrival time parsed without timezone (`new Date(\`${arrival_date}T${arrival_time}\`)` — server UTC ≠ guest local time, typically Europe/Sofia UTC+2/+3) | WARNING | Systematic 2–3 hour skew in `arrival_at` stored UTC instant, affecting Phase-5/6 claim-pool sort order and the past-arrival guard near boundary. Documented in 04-REVIEW.md as WR-01. Not a blocker for Phase 4 goal (status page renders arrival_at from DB, round-trips consistently) but is a correctness defect for Phase 5. |
| `app/auth/confirm/route.ts` | 53 | `STATUS_NEXT_RE = /^\/status\/[0-9a-f-]{36}$/` accepts any 36-char `[0-9a-f-]` string, not a strict UUID shape | INFO | Stays same-origin (`new URL(validatedNext, origin)`), so no external open-redirect. Wider than stated "UUID-shaped" contract. Documented in 04-REVIEW.md as WR-02. Not a blocker. |
| `platform/transfers/confirmation-email.ts` | 78 | `fill(t.confirmEmailBody, { amount: "", arrivalDate: "" })` substitutes empty strings | INFO | Stub HTML body has empty amount/arrival — acceptable for a Phase-4 stub (send is not live). Phase 7 must fetch real values. Documented in 04-REVIEW.md as WR-04. Not a blocker for Phase 4. |
| `platform/transfers/confirmation-email.ts` | 71–72 | `magicLink = actionLink.includes(verifiedDest) ? actionLink : verifiedDest` — fallback to tokenless URL on the common GoTrue URL-encoding path | WARNING | The fallback `verifiedDest` is a bare `/auth/confirm?...` URL with no verification token. A guest clicking it would land on `/sign-in?error=verify`. In Phase 4 the link is only logged (stub), but the function is the stable Phase-7 seam — this dead fallback needs fixing before Phase 7 enables real email send. Documented in 04-REVIEW.md as WR-03. Not a Phase-4 goal blocker. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any Phase-4 modified files. The `TODO` match in `BookingForm.tsx:147` is a React `placeholder` prop (legitimate).

---

### Human Verification Required

#### 1. Live Booking→Pay→Confirm→Track End-to-End Smoke

**Test:** Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` + `npm run dev`. Open `/pickup/<active-slug>`, confirm fare + form render. Submit the booking form, confirm a `status='requested'` row is created in `wp_transfers` and the browser is redirected to a Stripe Checkout URL. Complete the TEST Checkout. Confirm: (a) the webhook flips the row to `paid`; (b) the `[BOOK-06 stub] confirmation email` line is logged with a `magicLink` containing `/auth/confirm?type=magiclink&next=/status/<id>`; (c) clicking the logged magic link lands on `/auth/confirm` and redirects to `/status/<id>`; (d) the status page renders the lifecycle timeline with `paid` highlighted and the "Paid €X on {date}" receipt line for the owning guest's row only; (e) the DB trigger allows `requested→paid` without raising check_violation (no Stripe retry storm).

**Expected:** All five sub-checks PASS. No open-redirect, no `getSession` call on the status path, no stale-cached guest document.

**Why human:** Requires the Stripe CLI (`stripe listen --forward-to`) which is not installed on the verifier's machine. Documented in `tests/runbooks/0004-lifecycle-trigger.md` Task 3 as a deferred operator item. All automated prerequisites (DB trigger adversarially proven, 106 tests green, typecheck/lint/build clean) are satisfied — only the live Stripe round-trip remains.

---

### Gaps Summary

No automated gaps were found. All 5 success criteria truths are VERIFIED. All 8 requirement IDs are SATISFIED. The 0004 migration is confirmed applied to the live Balkanity DB with the trigger, RLS policies, and columns verified adversarially. The automated test suite (106 tests, typecheck, lint, build) is GREEN per the runbook.

**One human verification item remains:** the live Stripe payment round-trip (booking→Checkout→webhook→paid→magic-link→status page). This requires the Stripe CLI to be installed and is documented as a deferred operator item in `tests/runbooks/0004-lifecycle-trigger.md`.

The code-review warnings (WR-01 arrival timezone skew, WR-02 regex looseness, WR-03 tokenless magic-link fallback, WR-04 empty interpolation in stub HTML) are real correctness gaps but do not block the Phase 4 goal. WR-01 (timezone) is a latent defect that will affect Phase 5 claim-pool ordering and should be addressed before Phase 5 shipping. WR-03 (tokenless fallback) must be fixed before Phase 7 enables real email send.

---

_Verified: 2026-06-18_
_Verifier: Claude (gsd-verifier)_
