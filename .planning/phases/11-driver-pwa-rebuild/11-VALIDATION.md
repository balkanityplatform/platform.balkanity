---
phase: 11
slug: driver-pwa-rebuild
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-22
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Presentation-only rebuild: the validation guarantee is that the **existing** behavioural tests stay green (D-06 — no new component tests). Populated from 11-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) — established Phase 1 baseline (Playwright/chromium also present) |
| **Config file** | Vitest config in repo root / package scripts (Phase 1 Wave 0) |
| **Quick run command** | `npx vitest run app/driver` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds (driver subset ~5s; full suite + tsc ~30s) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run app/driver && npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite + tsc green; all four named driver tests green (D-06); visual UAT of the four driver screens vs mockups
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-* | 01 | 1 | DUI-02 | — | N/A (chrome/i18n only) | type + visual | `npx tsc --noEmit` (BG key parity); visual nav active-state | ✅ | ⬜ pending |
| 11-02-* | 02 | 2 | DUI-01, DUI-05 | T-11-04 (PII leak) | Pool renders only masked `wp_pool()` columns; zero guest-PII keys pre-claim; claim via atomic `claim_transfer` RPC | source-grep + existing unit | `npx vitest run app/driver`; grep `PoolView`/`wp_pool` shows no PII keys | ✅ | ⬜ pending |
| 11-03-* | 03 | 2 | DUI-03 | — | N/A | unit (existing source-grep) | `npx vitest run app/driver/run/RunView.test.tsx` (arrival_at ASC + "Completed today" literals) | ✅ MUST stay green | ⬜ pending |
| 11-04-* | 04 | 2 | DUI-04 | — | Advance is legal-edge-only, ownership-gated, idempotent (reuses `advanceStatus`) | unit (existing) | `npx vitest run app/driver/advance.lifecycle.test.ts app/driver/advance.ownership.test.ts app/driver/advance.notify.test.ts` | ✅ MUST stay green | ⬜ pending |
| 11-05-* | 05 | 2 | DUI-02 | T-11-14 (`@supabase/ssr` only) | Sign-out is auth/session-only `signOutAction`; no schema/RLS change | type + visual | `npx tsc --noEmit`; visual profile screen | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None new — D-06 mandates relying on existing tests + visual review; NO new component tests are required. The presentation-only guarantee IS the four existing behavioural driver tests staying green (`RunView.test.tsx`, `advance.lifecycle.test.ts`, `advance.ownership.test.ts`, `advance.notify.test.ts`).
- Confirm the existing Vitest config picks up `app/driver/**` (it already runs the named tests today).

*Existing infrastructure covers all phase requirements; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pool renders zero guest-PII keys pre-claim | DUI-01 | Structural (masked RPC); D-06 forbids new component tests | Source review: grep `PoolView`/`wp_pool` shows only the 9 masked columns, no name/phone/email; visual review vs mockup |
| Bottom nav present, active tab highlighted | DUI-02 | Visual; D-06 forbids new component tests | Eyeball Available/My Trips/Profile tabs vs mockup; verify `usePathname()` active-state highlight |
| Four driver screens match mockup identity | DUI-01..05 | Visual UAT | Compare Available, My Trips, Trip Detail, Profile against UI-SPEC mockups before `/gsd-verify-work` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or rely on existing-test gate (D-06)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan carries `tsc`/`vitest`)
- [x] Wave 0 covers all MISSING references (none new — existing tests are the gate)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-22
