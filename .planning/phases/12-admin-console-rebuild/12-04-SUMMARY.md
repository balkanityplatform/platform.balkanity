---
phase: 12-admin-console-rebuild
plan: 04
subsystem: ui
tags: [next-app-router, react, tailwind, admin-console, transfer-detail, lifecycle-stepper, ops, refund]

# Dependency graph
requires:
  - phase: 12-admin-console-rebuild
    plan: 01
    provides: "Shared admin slate-console shell (app/admin/layout.tsx) — sidebar + top bar + single bell + LanguageToggle; per-page surfaces drop their own <header>"
  - phase: 09-design-system
    provides: "LifecycleStepper (horizontal, DS-04) consumed verbatim to replace the vertical LifecycleTimeline; Button + TextField primitives"
provides:
  - "Restyled admin transfer detail (TransferDetailView) rendering the horizontal LifecycleStepper inside the shell, all five ops controls (assign/reassign/release/cancel/refund) preserved verbatim"
  - "DS-chrome RefundForm (full-amount pre-fill, required reason, always-shown fee disclosure) — never sets paid"
affects: [12-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detail surface renders inside the Phase-12 shell with NO own header (Plan-01 carry-forward); back affordance is a content-area link, not chrome"
    - "DS-04 stepper swap: LifecycleTimeline → LifecycleStepper current={status} (worded labels + cancelled terminal derived by the component, never hand-rolled)"
    - "Ops controls + RefundForm behaviour preserved verbatim under a visual-only restyle (presentation-only invariant, D-12)"

key-files:
  created: []
  modified:
    - app/admin/transfers/[id]/TransferDetailView.tsx
    - app/admin/transfers/[id]/RefundForm.tsx

key-decisions:
  - "Removed the page's own slate <header> (logo chip + LanguageToggle) — the shared admin shell owns chrome now; kept a teal content-area back link to /admin/transfers as the back affordance"
  - "Swapped vertical LifecycleTimeline → horizontal LifecycleStepper current={row.status} (DS-04); the stepper derives worded labels + the cancelled terminal itself — no hand-rolled labels"
  - "Restyled both dl fact grids as DS panels (rounded-md border bg-white p-[24px], 3-col on lg) and widened content column max-w-2xl → max-w-5xl; the Fact helper and all fact data preserved verbatim"
  - "RefundForm: visual-only chrome (card panel + slate/5 disclosure callout); refund action wiring, defaultValue={fullAmountEur}, required reason, always-shown refundFeeDisclosure, pending-disable guard all preserved verbatim — never sets paid (D-12)"

requirements-completed: [AUI-04]

# Metrics
duration: ~3min
completed: 2026-06-22
---

# Phase 12 Plan 04: Admin Transfer Detail Restyle Summary

**Restyled the admin transfer detail to the slate-console design system — swapped the vertical LifecycleTimeline for the horizontal LifecycleStepper (DS-04), dropped the page's own header into the shared shell, and kept all five ops controls plus the RefundForm behaving identically (refund never sets `paid`).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-22T19:46:23Z
- **Completed:** 2026-06-22T19:48:32Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- `TransferDetailView.tsx` now renders the horizontal `LifecycleStepper current={row.status}` (DS-04) in place of the vertical `LifecycleTimeline`; the stepper derives its worded labels + the `cancelled` terminal treatment itself (no hand-rolled labels). The unused `Image`/`LanguageToggle` imports were dropped with the header.
- The page's own slate `<header>` (logo chip + LanguageToggle) was removed — the Plan-01 shared admin shell owns the chrome now. A teal content-area "← Transfers" back link replaces it as the back affordance.
- Both `dl` fact grids restyled as DS panels (`rounded-md border border-grey/30 bg-white p-[24px]`, 3-col on `lg`), content column widened `max-w-2xl` → `max-w-5xl`. The `Fact` helper and every fact's data are preserved verbatim.
- All FIVE ops controls — `AssignForm`, the `ReasonDialog`-driven reassign/release/cancel, cancel's `cancelOfferRefundCta` shortcut (opens RefundForm, never auto-refunds — D-11), and the RefundForm panel — plus the `useActionState` pending-disable guard and the destructive=coral / positive=teal / 52px token split are preserved verbatim. The imported Server Actions and their authz are untouched.
- `RefundForm.tsx` got a light DS-chrome restyle (card panel + a `slate/5` disclosure callout). The `refund` action wiring, `defaultValue={fullAmountEur}` full-amount pre-fill (editable down), required reason field, the always-shown `refundFeeDisclosure`, the pending-disable guard, and the role="alert"/role="status" messages are all verbatim. It never sets `paid`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap LifecycleTimeline → LifecycleStepper + DS-restyle the detail (ops verbatim)** — `61218f8` (feat)
2. **Task 2: Light DS-chrome restyle of RefundForm (behaviour verbatim, never sets paid)** — `4504504` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `app/admin/transfers/[id]/TransferDetailView.tsx` — LifecycleTimeline→LifecycleStepper swap; own slate header removed (shell owns chrome) + content-area back link added; both dl grids restyled as DS panels, column widened to max-w-5xl; all five ops controls + dialogs + coral/teal/52px token split preserved verbatim; no paid writer. Exports `TransferDetailView`, `TransferDetail` (unchanged shapes).
- `app/admin/transfers/[id]/RefundForm.tsx` — light DS chrome (card panel + slate/5 disclosure callout); refund action wiring, full-amount pre-fill, required reason, always-shown fee disclosure preserved verbatim; never sets paid. Exports `RefundForm` (unchanged shape).

## Decisions Made
- Kept the `lang` prop and `copy.langToggle` field on the copy bag even though the LanguageToggle was removed — `lang` is still consumed by the `fmtDateTime` calls, and trimming the copy-bag type would be an unnecessary cross-cutting change for a presentation-only restyle.
- Used DS card panels (matching the Phase-9 `Card` chrome) for the two fact grids rather than leaving them as bare grids, to sit them cleanly inside the slate console while keeping the `Fact` helper untouched.

## Deviations from Plan

None - plan executed exactly as written. Both tasks restyled verbatim with no behaviour change.

## Verification Evidence
- `npx tsc --noEmit` exits 0 after both tasks.
- `npx eslint "app/admin/transfers/[id]"` exits 0 (one pre-existing `no-unused-vars` warning on `AssignForm`'s `copy` param at line 199 — present before this plan, out of scope per the scope boundary; warning only, not an error).
- `npm test -- --run app/admin/transfers/actions.test.ts` — 7/7 passing after each task (ops authz/behaviour unchanged).
- Grep gates green: `LifecycleStepper`>0 + `LifecycleTimeline`=0 (DS-04 swap complete); all five ops action names present; `cancelOfferRefundCta`>0 (cancel still offers refund, never auto-refunds); `bg-slate px-[24px]` header pattern=0 (own header removed); paid-write pattern=0 on BOTH files (single-writer preserved); `refundFeeDisclosure`>0 + `defaultValue={fullAmountEur}`>0 (RefundForm behaviour preserved).
- No file deletions; no untracked files left behind.

## Threat Model Compliance
- **T-12-12 (paid single-writer):** Grep gate confirms zero paid-write patterns on both modified files. Refund still records `last_action_*` only via the unchanged `refund` action. ✅
- **T-12-13 (ops EoP):** The five Server Actions + their `getCurrentRole()==='admin'` re-gate were NOT touched; `actions.test.ts` stays green. ✅
- **T-12-14 (cancel/refund audit):** Required reason note + never-auto-refund cancel (D-11) preserved verbatim. ✅
- **T-12-15 (stepper swap):** Accepted — the LifecycleStepper renders the row's real `status` (same data, display-only, no new data path). ✅

## Known Stubs
None — no stubs introduced. This is a presentation-only restyle over live ops wiring.

## User Setup Required
None — presentation-only; zero backend/schema/auth/RLS/payment changes.

## Next Phase Readiness
- Plan 05 (the remaining Wave-2 surface — settings hub + light restyle of drivers/companies/properties/destinations/health) is unblocked. The transfer detail now sits inside the shell with no own header, matching the consolidation pattern Plan 05's surfaces must follow (drop per-page `<header>`).
- Visual review (Phase 11 D-06) still pending for this surface: confirm the horizontal LifecycleStepper renders on the detail, all five ops controls work, the refund shows the fee disclosure + full-amount pre-fill, destructive controls are coral / positive teal / 52px, and the page sits inside the shell with no own header.

## Self-Check: PASSED

Both modified source files exist on disk; both task commits (`61218f8`, `4504504`) are present in git history.

---
*Phase: 12-admin-console-rebuild*
*Completed: 2026-06-22*
