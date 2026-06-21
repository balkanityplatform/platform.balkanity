---
status: testing
phase: 11-driver-pwa-rebuild
source: [11-VERIFICATION.md]
started: 2026-06-22T01:25:00Z
updated: 2026-06-22T01:25:00Z
---

## Current Test

number: 1
name: Bottom nav active-tab highlighting across driver routes
expected: |
  DriverBottomNav renders Available / My Trips / Profile with active-tab teal
  highlighting via usePathname(); switching tabs updates the active indicator
  immediately without a page reload.
awaiting: user response

## Tests

### 1. Bottom nav active-tab highlighting
expected: Navigate to /driver as an authenticated driver; bottom nav shows Available / My Trips / Profile with Available highlighted teal; tapping My Trips switches the active tab to teal without a page reload (and /driver/run/[id] keeps My Trips lit).
result: [pending]

### 2. Claim cards render with zero pre-claim PII
expected: On /driver (Available), each claim card shows arrival date/time, coral "Unclaimed" pill, RouteMotif (airport → zone), a flight/fare/pax/luggage meta row, and a 52px teal "Claim transfer" button — with NO guest name, phone, address, or notes visible.
result: [pending]

### 3. Claim win / already-claimed / error paths (concurrency)
expected: Tapping "Claim transfer" → win navigates to /driver/run/[id]; a loss (already claimed, tested with two browser sessions) shows a neutral non-error toast and the card disappears; other failure shows a coral error toast; no double-submit on terminal state.
result: [pending]

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
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
