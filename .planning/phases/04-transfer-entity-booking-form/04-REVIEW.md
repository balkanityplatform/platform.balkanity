---
phase: 04-transfer-entity-booking-form
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - platform/transfers/lifecycle.ts
  - platform/transfers/confirmation-email.ts
  - platform/i18n/en.ts
  - platform/i18n/bg.ts
  - supabase/migrations/0004_transfer_entity.sql
  - app/pickup/[slug]/page.tsx
  - app/pickup/[slug]/BookingForm.tsx
  - app/pickup/[slug]/actions.ts
  - platform/ui/PaxStepper.tsx
  - platform/ui/LifecycleTimeline.tsx
  - app/status/[id]/page.tsx
  - app/track/page.tsx
  - app/track/actions.ts
  - app/track/TrackForm.tsx
  - app/auth/confirm/route.ts
  - app/api/stripe/webhook/route.ts
  - app/pay/success/page.tsx
  - app/sw.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the Phase 4 guest booking + payment + transfer-tracking slice. The project-critical
money/PII invariants hold up under adversarial reading:

- **Single-writer `paid` gate**: verified. The webhook (`app/api/stripe/webhook/route.ts`) is the
  only `status: "paid"` writer; `/pay/success` and the booking action both read-only / write only
  `requested`.
- **Raw-body webhook**: verified. `await req.text()` first, `constructEvent`, `runtime = "nodejs"`,
  no `.json(` token.
- **PII boundary**: the status page uses the cookie-bound anon client + `auth.getUser()` (not
  `getSession()`); the guest-self-read RLS policy is the gate; the driver reveal is correctly
  fenced behind the already-RLS-authorized owning row.
- **Server-trusted amount**: the booking action re-reads `price_cents` by slug and never parses an
  amount from FormData.
- **Open-redirect guard**: `/auth/confirm` allowlists `next` to a UUID-shaped `/status/<id>` path.
- **Migration trigger**: the 0004 trigger transition table matches `lifecycle.ts` `ALLOWED_TRANSITIONS`
  exactly; all new columns are nullable with no default.

No BLOCKERs were found. However, several correctness and robustness defects warrant fixing before
this ships, the most material being a timezone bug in arrival-time parsing that corrupts the stored
arrival instant (and thus the future claim-pool sort), and an open-redirect regex that is wider than
intended.

## Warnings

### WR-01: Arrival time parsed in server-local timezone, corrupting the stored UTC instant

**File:** `app/pickup/[slug]/actions.ts:80-82`
**Issue:** `new Date(\`${arrival_date}T${arrival_time}\`)` has no timezone offset, so it is parsed in
the **runtime's local timezone**. On Vercel that is UTC. A Bulgarian guest (UTC+3 in summer) who
enters an arrival of `14:30` produces the instant `14:30Z`, which is `17:30` local — a 3-hour error
baked into `arrival_at` via `.toISOString()`. Two concrete consequences:

1. The Phase-5/6 claim pool sorts open transfers on `arrival_at` (`wp_transfers_arrival_at_idx`,
   migration 0004 line 68). A systematically-skewed instant mis-orders the pool.
2. The past-arrival guard `arrivalAt.getTime() < Date.now()` (line 81) compares a wrong instant
   against real UTC `now`, so bookings near the boundary are accepted/rejected incorrectly.

The status page (`fmtDate`/`fmtTime`) re-renders with no `timeZone` option, so it also formats in
the server's UTC — the display *looks* self-consistent, which hides the bug, but the persisted
instant is still wrong relative to the real world.

**Fix:** Capture the guest's timezone (or destination timezone) and construct the instant explicitly.
For a single-country pilot (Bulgaria, `Europe/Sofia`), interpret the local wall-clock against that
fixed zone, and format the same way:
```ts
// Treat the form's date+time as Europe/Sofia wall-clock, not server-local.
// Either compute the offset for that date or store the wall-clock components
// plus the destination's IANA zone and convert at the trust boundary.
const arrivalAt = zonedTimeToUtc(`${arrival_date}T${arrival_time}`, "Europe/Sofia");
```
And on the status page pass `{ timeZone: "Europe/Sofia" }` to `toLocaleDateString`/`toLocaleTimeString`.

### WR-02: Open-redirect allowlist regex is wider than a UUID and accepts malformed ids

**File:** `app/auth/confirm/route.ts:53`
**Issue:** `const STATUS_NEXT_RE = /^\/status\/[0-9a-f-]{36}$/;` matches any 36-character string drawn
from `[0-9a-f-]` — e.g. `/status/------------------------------------` (36 hyphens) or
`/status/00000000000000000000000000000000----` all pass. It does not enforce the UUID
`8-4-4-4-12` hyphen positions. While this stays same-origin (the redirect target is built via
`new URL(validatedNext, origin)`, so it cannot become an external open redirect), it does forward
malformed paths and is looser than the stated "UUID-shaped" contract — a latent correctness gap and
a weaker guard than the same repo already uses for transfer ids in `platform/payments/checkout.ts`
(`UUID_SHAPE`).
**Fix:** Use the explicit UUID shape already established in the codebase:
```ts
const STATUS_NEXT_RE =
  /^\/status\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

### WR-03: Confirmation email returns a tokenless, non-functional magic link on the common path

**File:** `platform/transfers/confirmation-email.ts:71-72`
**Issue:** `const magicLink = actionLink.includes(verifiedDest) ? actionLink : verifiedDest;`.
GoTrue URL-encodes the `redirect_to` inside `action_link`, so `action_link` will essentially never
contain the raw `verifiedDest` (which includes `?type=...&next=/status/...`) verbatim. The condition
therefore falls through to `verifiedDest` — a bare `/auth/confirm?...` URL with **no verification
token**. A guest clicking that link lands on `/auth/confirm` with neither `code` nor `token_hash`
and is bounced to `/sign-in?error=verify` (see `app/auth/confirm/route.ts:84-85`). In Phase 4 the
link is only logged, but the HTML body emitted at line 79 embeds this dead link, and the function is
the "stable seam" Phase 7 builds on — shipping a fallback that is known-broken invites a Phase-7
regression.
**Fix:** Use `action_link` directly (it already carries the token and its own encoded `redirect_to`),
or build the clickable link from `hashed_token` + the canonical template. Do not fall back to a
tokenless `verifiedDest` as a "magic link":
```ts
const magicLink = data?.properties?.action_link ?? "";
if (!magicLink) { /* log-and-continue; do not emit a dead CTA */ }
```

### WR-04: Confirmation email body interpolates empty {amount} and {arrivalDate}

**File:** `platform/transfers/confirmation-email.ts:78`
**Issue:** `fill(t.confirmEmailBody, { amount: "", arrivalDate: "" })` substitutes empty strings, so
the rendered copy reads "We've received your payment of € for your transfer on ." — broken,
amount-less confirmation text. `sendBookingConfirmation(transferId, guestEmail)` already has the
`transferId`; it does not fetch the amount/arrival to fill the template. Even as a Phase-4 stub the
returned `html` is shipped-quality copy that will be wrong, and the signature is frozen as the
Phase-7 seam, so the missing data fetch will have to be retrofitted.
**Fix:** Read `amount_cents`/`arrival_at` for the transfer (service-role) and pass real values, or
remove the tokens from the body until Phase 7 wires the real template. Do not interpolate empty
strings into guest-facing copy.

### WR-05: Booking insert and Checkout-session creation are not transactional — orphaned `requested` rows on Stripe failure

**File:** `app/pickup/[slug]/actions.ts:101-131`
**Issue:** The action inserts a `requested` `wp_transfers` row (line 101) and *then* calls
`createCheckoutSession` (line 124). If `createCheckoutSession` throws or returns `null` (Stripe down,
key misconfig), the inserted row is left orphaned in `requested` with full guest PII and no payment
session — the action returns `bookingFailed` but the row persists. Over the pilot this accumulates
abandoned PII rows that reconciliation (Phase 8) must distinguish from genuinely-abandoned checkouts.
**Fix:** Create the Checkout Session first (it does not need the row id beyond a generated transfer
id) or delete/mark the row on checkout failure. At minimum, on the `!checkoutUrl` branch delete the
just-inserted row so a Stripe failure does not leave dangling guest PII:
```ts
if (!checkoutUrl) {
  await admin.from("wp_transfers").delete().eq("id", row.id);
  return { status: "error", message: t.bookingFailed };
}
```
(Note: a thrown error from `createCheckoutSession` is not caught at all here — it will surface as an
unhandled server-action error rather than the friendly `bookingFailed`.)

### WR-06: Booking form's required `flight_no` / arrival fields surface no per-field error; arrival-past + phone errors fall into the generic slot incorrectly

**File:** `app/pickup/[slug]/BookingForm.tsx:69-81` and `app/pickup/[slug]/actions.ts:55-63`
**Issue:** The client maps server errors by exact string equality. The action only ever emits four
messages: `bookingInvalidEmail`, `bookingPassengersRange`, `bookingFieldRequired`, and
`bookingArrivalPast`. But:

- The form declares `copy.invalidPhone` and `copy.arrivalPast` and wires `phoneError`/`formError`
  branches (lines 71, 74-81), yet the action **never returns `bookingInvalidPhone`** (the zod schema
  validates phone only as `min(1)`, line 40 of actions.ts) — so the "valid phone incl. country code"
  copy is dead, and a malformed phone passes validation entirely. The disclosure copy promises
  validation the server does not perform.
- `bookingArrivalPast` is returned by the action but is NOT one of the strings the client special-cases
  for a field slot; it correctly falls into `formError` (generic), which is acceptable, but combined
  with the above the inline-error UX is inconsistent with the declared copy contract.

**Fix:** Either add real phone validation to `bookingSchema` (e.g. an E.164-ish regex) and return
`bookingInvalidPhone` on that issue, or remove the unused `invalidPhone`/`phoneError` wiring so the
form does not advertise validation that never fires.

## Info

### IN-01: Dead/oversized terminal-state branch comment vs. trigger no-op interaction

**File:** `supabase/migrations/0004_transfer_entity.sql:96-114`
**Issue:** The trigger's `is not distinct from` no-op short-circuit (line 96) means a same-status
update always passes, which is correct, but note that an update that sets `status` to a *new*
terminal value from another terminal value (e.g. `completed` → `cancelled`) is correctly rejected by
the `if not (...)` block. This is fine; flagged only to confirm the terminal-state handling is by
omission (no allowed pair) rather than an explicit guard — intentional and correct, but worth a one-line
comment for the next reader.
**Fix:** Optional: add an explicit comment that terminal states are enforced by absence from the map.

### IN-02: `validatedNext` vs `verifiedDest` duplication in the PKCE branch

**File:** `app/auth/confirm/route.ts:60-73`
**Issue:** The PKCE `code` branch redirects to `validatedNext` (line 73) while the token_hash branch
redirects to `verifiedDest` (line 80). For recovery/invite links arriving on the PKCE path,
`verifiedDest` would be `/set-password` but the code branch ignores it and uses `validatedNext`
(`/` unless a status path). The inline comment acknowledges this is "safe either way," and for the
guest magiclink path it is correct, but the asymmetry is a readability trap.
**Fix:** Consider redirecting the PKCE branch to `verifiedDest` as well for symmetry, or document
why the code flow never carries recovery/invite semantics.

### IN-03: `fill()` helper duplicated across three files

**File:** `platform/transfers/confirmation-email.ts:32-34`, `app/pickup/[slug]/page.tsx:27-29`,
`app/status/[id]/page.tsx:46-48`
**Issue:** The identical `fill(template, vars)` token-interpolation helper is copy-pasted in three
modules.
**Fix:** Extract to a shared `platform/i18n` util (e.g. `interpolate`) to keep the token-replacement
behavior consistent as templates evolve.

### IN-04: `driverPhone`/`driverFirstName` can render an empty-segment driver line

**File:** `app/status/[id]/page.tsx:154-156, 231-237`
**Issue:** If `driver_profiles.phone` is null (the column is nullable, migration 0002 line 92), the
status driver line renders `{driverFirstName} · ` with a trailing separator and empty phone. Cosmetic.
**Fix:** Conditionally drop the `· {driverPhone}` segment when phone is empty, or guarantee phone at
the driver-onboarding boundary.

### IN-05: `bookingBackCta` copy is passed to the form but never rendered

**File:** `app/pickup/[slug]/BookingForm.tsx` (copy prop `backCta`) / `app/pickup/[slug]/page.tsx:91`
**Issue:** `backCta` is threaded through `BookingFormCopy` and the page passes `t.bookingBackCta`, but
the form renders no Back control. Dead copy/prop.
**Fix:** Remove `backCta` from `BookingFormCopy` and the page wiring, or render the intended Back
affordance.

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
