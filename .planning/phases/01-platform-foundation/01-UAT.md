---
status: testing
phase: 01-platform-foundation
source: [01-VERIFICATION.md]
started: 2026-06-17
updated: 2026-06-17
---

## Current Test

number: 1
name: Deploy to the Balkanity Vercel project
expected: |
  The four env vars are set in balkanity_platform_project (team balkanity-platform-s-projects;
  NOT Kalvia), the app deploys, and the production URL is reachable. SUPABASE_URL and
  SUPABASE_SERVICE_ROLE_KEY are server-only (never NEXT_PUBLIC_).
awaiting: user response

## Tests

### 1. Deploy to the Balkanity Vercel project
expected: Env vars set in balkanity_platform_project (confirmed NOT Kalvia ref utyatpadtibqqswsfvtr): NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public); SUPABASE_SERVICE_ROLE_KEY (server-only — never NEXT_PUBLIC_); and NEXT_PUBLIC_SITE_URL set to the production URL (required by the WR-04 fix — the magic-link email redirect is derived from it; without it the deployed magic link will not land on /auth/confirm). Note: a separate SUPABASE_URL is no longer needed — the service-role client now reads NEXT_PUBLIC_SUPABASE_URL (CR-01 fix). Deployed, production URL captured and reachable.
result: [pending]

### 2. Mobile PWA install + offline fallback
expected: On a real mobile device, open the deployed URL → Add to Home Screen → launch → standalone shell shows the real Balkanity mark and teal (#029B87) theme. Toggle airplane mode → navigate → branded "You're offline" page appears; the signed-in shell is NOT served stale.
result: [pending]

### 3. End-to-end magic-link walkthrough on the deployed URL
expected: Submit the seeded admin email (admin@balkanity.com) on /sign-in → receive the magic-link email → click it → land authenticated on /admin (role resolves to admin).
result: [pending]

### 4. Supabase Auth magic-link email template
expected: In the Balkanity Supabase dashboard (Authentication → Email Templates → Magic Link), the confirmation URL is set to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` so the emitted link hits the app's /auth/confirm verifyOtp route.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
