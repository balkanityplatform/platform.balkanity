---
status: testing
phase: 11-driver-pwa-rebuild
source: [11-VERIFICATION.md]
started: 2026-06-22T01:25:00Z
updated: 2026-06-22T02:05:00Z
---

## Current Test

number: 4
name: My Trips trip cards (status colors, ordering, no earnings/ratings)
expected: |
  /driver/run shows trip cards with arrival date/time, per-row real StatusDot
  (teal=Claimed, amber=En route, grey=Completed), RouteMotif, pax/luggage meta,
  teal details link, inline advance CTA; arrival_at ASC order; completed-today
  partition correct; no earnings or ratings anywhere.
awaiting: user response

## Tests

### 1. Bottom nav active-tab highlighting
expected: Navigate to /driver as an authenticated driver; bottom nav shows Available / My Trips / Profile with Available highlighted teal; tapping My Trips switches the active tab to teal without a page reload (and /driver/run/[id] keeps My Trips lit).
result: issue
reported: "Active-tab highlighting works (Available lit teal), but nav placement should change: we need it as a top nav. Tabs centered in the top header (between logo and Alerts/EN-BG) on desktop/wide screens with the bottom bar hidden; keep the existing bottom nav on mobile/phones for thumb reach. Responsive split."
severity: minor

### 2. Claim cards render with zero pre-claim PII
expected: On /driver (Available), each claim card shows arrival date/time, coral "Unclaimed" pill, RouteMotif (airport → zone), a flight/fare/pax/luggage meta row, and a 52px teal "Claim transfer" button — with NO guest name, phone, address, or notes visible.
result: pass

### 3. Claim win / already-claimed / error paths (concurrency)
expected: Tapping "Claim transfer" → win navigates to /driver/run/[id]; a loss (already claimed, tested with two browser sessions) shows a neutral non-error toast and the card disappears; other failure shows a coral error toast; no double-submit on terminal state.
result: pass
reason: Win path verified live (claim → navigated to /driver/run/[id]). Loss path (already-claimed neutral toast) deferred to the automated concurrency suite — atomic claim_transfer RPC + advance.ownership tests.

### 4. My Trips trip cards (status colors, ordering, no earnings/ratings)
expected: /driver/run shows trip cards with arrival date/time, per-row real StatusDot (teal=Claimed, amber=En route, grey=Completed), RouteMotif, pax/luggage meta, teal details link, inline advance CTA; arrival_at ASC order; completed-today partition correct; no earnings or ratings anywhere.
result: [pending]

### 5. En-route trip detail: horizontal stepper + Confirm Arrival
expected: /driver/run/[id] for an en_route claim shows the horizontal LifecycleStepper (not a vertical timeline), all fact labels in the current language (EN/BG), and a "Confirm arrival" CTA that advances the transfer to arrived on tap (via existing advanceStatus).
result: [pending]

### 6. Profile: identity, digest, language, sign-out
expected: /driver/settings shows an initials chip with the driver's name/email, the DigestPreferenceCard (toggle + hour selector working unchanged), a LanguageToggle settings row, and a Sign out button; tapping Sign out clears the Supabase session and redirects to /sign-in.
result: [pending]

### 7. EN↔BG language switch across all 14 new keys
expected: Toggling language on any driver page switches all nav labels, badge text, CTA labels, and fact captions to Bulgarian (navAvailable/navMyTrips/navProfile → Свободни/Моите пътувания/Профил; driverConfirmArrivalCta → Потвърди пристигане) and back to English with full parity.
result: [pending]

## Summary

total: 7
passed: 2
issues: 1
pending: 4
skipped: 0
blocked: 0

## Gaps

- truth: "Driver primary nav (Available / My Trips / Profile) placement matches intended layout"
  status: failed
  reason: "User reported: nav highlighting works but placement should be a top nav — tabs centered in the top header (between logo and Alerts/EN-BG) on desktop/wide screens with the bottom bar hidden; keep the existing bottom nav on mobile/phones. Responsive split."
  severity: minor
  test: 1
  root_cause: "Design choice — phase built bottom-nav-only per UI-SPEC; user wanted responsive top nav on desktop."
  status_resolution: "FIXED — commit aeca5a8. Extracted shared ./tabs builder; added DriverTopNav (centered in header, md+ only); DriverBottomNav now md:hidden; layout drops reserved bottom padding on md+. Awaiting re-verification on deployed desktop."
  artifacts:
    - path: "app/driver/_nav/DriverTopNav.tsx"
      issue: "new desktop top nav"
    - path: "app/driver/_nav/DriverBottomNav.tsx"
      issue: "md:hidden + shared tabs builder"
    - path: "app/driver/_nav/tabs.ts"
      issue: "new shared tab source of truth"
    - path: "app/driver/layout.tsx"
      issue: "mount DriverTopNav centered; md:pb-0"
  missing: []
  debug_session: ""
