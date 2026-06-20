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

## Code-review warnings still open (07-REVIEW.md) — fold into gap-closure

CR-01 (digest pool 0-rows) and CR-02 (assigned-email key collision) were fixed (commits `ff100e5`, `a3cdf55`). The following advisory warnings/info remain and should be addressed alongside the UAT work (or via `/gsd-plan-phase 7 --gaps`):

- **WR-01** — digest `digest_send_hour` (documented *local*) compared against `getUTCHours()`; ~2–3h skew for the BG pilot. Decide UTC-vs-local and make the column comment, UI label, and comparison agree.
- **WR-02** — soft-cap daily count is a read-then-act race (acceptable headroom for the ~10-transfer pilot; document or make atomic).
- **WR-03** — a prior `skipped_cap`/`failed` `email_log` row with the same idempotency_key poisons the later `sent` insert (UNIQUE violation discarded → no audit row, undercount). Upsert-by-key or inspect the insert error.
- **WR-04** — `cancel` lacks the status guard + row-count check its sibling lifecycle actions have.
- **WR-06** — `firstName` returns "" for a whitespace-only name (dead `?? name` fallback).
- **WR-07** — `DigestPreferenceCard` never client-validates enabled+hour pairing (UX only).
- 4 INFO items — see `.planning/phases/07-notifications/07-REVIEW.md`.
