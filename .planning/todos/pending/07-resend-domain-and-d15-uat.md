---
status: pending
created: 2026-06-20
resolves_phase: "07"
tags: [phase-7, live-ops, resend, uat, blocker]
---

# Phase 7 completion blockers — Resend domain + D-15 live UAT

Phase 7 code (Plans 01–05) is complete and the unit suite is green; migration 0007 is applied LIVE to Balkanity. Two operator-dependent gates remain before Phase 7 can pass verification:

1. **Verify `send.balkanity.com` in Resend** + confirm `RESEND_API_KEY` is server-only in Vercel production. (Operator lacked DNS access on 2026-06-20.)
   - DNS records (copy verbatim from Resend dashboard): MX on host `send` → `feedback-smtp.<region>.amazonses.com` pri 10; SPF TXT on `send` → `v=spf1 include:amazonses.com ~all`; DKIM TXT on `resend._domainkey`.
   - Target verified sender: `noreply@send.balkanity.com`.
2. **Run the D-15 live-delivery + end-to-end fan-out UAT** on `balkanityplatformproject.vercel.app` once the sender is verified (booking/claim/arrived/invite emails + bell behaviors). Record evidence in `.planning/phases/07-notifications/07-GATES-EVIDENCE.md`.

When both are done, re-run `/gsd:execute-phase 7` to close 07-06 and complete phase verification.
