---
phase: 10-guest-ui-rebuild
plan: 03
type: execute
wave: 2
depends_on: ["10-01"]
files_modified:
  - app/status/[id]/page.tsx
autonomous: true
requirements: [GUI-03]
must_haves:
  truths:
    - "The magic-link status page renders as the Transfer Pass (header band + RouteMotif airport->property + real truncated transfer id) and reflects the live transfer lifecycle state via the shared horizontal LifecycleStepper"
    - "The status page renders LifecycleStepper, NOT the old vertical LifecycleTimeline (which stays in the repo untouched, D-04)"
    - "The magic-link anon RLS read + auth.getUser() authorization, the session-expired no-leak fallback, the post-claim driver reveal (first name + phone plain text), and the paid-guarded receipt block are all preserved unchanged"
    - "The receipt 'Paid €X on <date>' line is emitted only when the transfer is genuinely paid"
  artifacts:
    - path: "app/status/[id]/page.tsx"
      provides: "Status page rebuilt as the Transfer Pass with the horizontal stepper"
      contains: "LifecycleStepper"
  key_links:
    - from: "app/status/[id]/page.tsx"
      to: "platform/ui/LifecycleStepper.tsx"
      via: "<LifecycleStepper current={status} /> replacing LifecycleTimeline"
      pattern: "LifecycleStepper"
    - from: "app/status/[id]/page.tsx"
      to: "app/(guest)/_pass/TransferPass.tsx"
      via: "pass composition (header + RouteMotif + real truncated id)"
      pattern: "TransferPass|PassHeader"
---

<objective>
Rebuild the magic-link guest status page `/status/[id]` as the boarding-pass "Transfer Pass" and swap its lifecycle visualization from the old vertical `LifecycleTimeline` to the shared horizontal `LifecycleStepper` (DS-04) — with ZERO change to the RLS read path, the authorization gate, the driver-reveal boundary, or the receipt logic.

This satisfies GUI-03: the status page renders as the pass and reflects the live lifecycle state via the shared stepper. The page composes (UI-SPEC Decision 4): pass header (band + RouteMotif airport->property + the REAL truncated transfer id) -> horizontal LifecycleStepper -> driver reveal -> receipt block. All omitted mockup features (live GPS map, ETA, vehicle, call/chat, "View Travel Vouchers", admin nav shells) stay omitted.

Purpose: The status page is the guest's live window into their transfer. It must read as the same pass identity as booking, with the lifecycle shown horizontally per the design contract, while preserving the exact PII boundary that protects the guest.

Output: A rebuilt `app/status/[id]/page.tsx`. The old `platform/ui/LifecycleTimeline.tsx` is left untouched (D-04) — do NOT delete it or its tests.
</objective>

<phase_goal>
**As a** guest with a magic link, **I want to** track my transfer's live lifecycle on a branded "Transfer Pass" status page, **so that** I always know where my booking stands and who my driver is once claimed.
</phase_goal>

<execution_context>
@/Users/balkanitytours/GitHub/platform.balkanity/.claude/gsd-core/workflows/execute-plan.md
@/Users/balkanitytours/GitHub/platform.balkanity/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/10-guest-ui-rebuild/10-UI-SPEC.md
@.planning/phases/10-guest-ui-rebuild/10-PATTERNS.md
@.planning/phases/10-guest-ui-rebuild/10-1-pass-foundation-PLAN.md
@.planning/phases/10-guest-ui-rebuild/10-01-SUMMARY.md
</context>

<artifacts_this_phase_produces>
No new shared symbols — this plan COMPOSES the Plan 10-1 artifacts (`TransferPass`, `PassHeader`, `DetailsGrid` if used for the trip block, the line icons) and the Phase 9 `LifecycleStepper` / `RouteMotif` / `StatusDot`. It consumes the new `passEyebrow` + `passRefLabel` keys (from 10-1). It swaps one import (`LifecycleTimeline` -> `LifecycleStepper`).
</artifacts_this_phase_produces>

<tasks>

<task type="auto">
  <name>Task 1: Swap the lifecycle visualization to the horizontal LifecycleStepper</name>
  <files>app/status/[id]/page.tsx</files>
  <read_first>
    - app/status/[id]/page.tsx (line 29 the `LifecycleTimeline` import; line 199 `<LifecycleTimeline current={status} />`; line 122 `const status = row.status as TransferState`)
    - platform/ui/LifecycleStepper.tsx (the WHOLE file — same `{ current }: { current: TransferState }` prop as LifecycleTimeline; STEPPER_ORDER-driven; cancelled short-circuits; derives labels from stateLabel())
    - platform/ui/LifecycleTimeline.tsx (DO NOT modify — confirm the prop shape matches so the swap is drop-in; D-04 leaves it untouched)
    - 10-PATTERNS.md "app/status/[id]/page.tsx (MODIFY)" -> "The swap" block (remove the import line + usage; keep LifecycleTimeline.tsx in repo)
    - 10-UI-SPEC.md Decision 4 (horizontal LifecycleStepper, NOT the vertical mockup stepper)
  </read_first>
  <action>
    Replace the import on line 29 (`import { LifecycleTimeline } from "@/platform/ui/LifecycleTimeline";`) with `import { LifecycleStepper } from "@/platform/ui/LifecycleStepper";`, and replace the usage on line ~199 (`<LifecycleTimeline current={status} />`) with `<LifecycleStepper current={status} />` (same `current={status as TransferState}` prop — drop-in). Keep the surrounding `<section>` + `statusTimelineHeading` heading. Do NOT touch `platform/ui/LifecycleTimeline.tsx` or its tests (D-04 — dead-but-harmless). This is the one functional swap allowed in this phase.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "LifecycleStepper" app/status/[id]/page.tsx` >= 2 (import + usage)
    - `grep -c "LifecycleTimeline" app/status/[id]/page.tsx` == 0 (old component no longer referenced by the status page)
    - `platform/ui/LifecycleTimeline.tsx` is unchanged: `git diff --quiet platform/ui/LifecycleTimeline.tsx` (exit 0) and the file still exists
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>/status renders the horizontal LifecycleStepper driven by `current={status}`; LifecycleTimeline.tsx remains untouched in the repo.</done>
</task>

<task type="auto">
  <name>Task 2: Compose the status page as the Transfer Pass (header band + RouteMotif + real truncated id), preserving the RLS/PII/receipt logic verbatim</name>
  <files>app/status/[id]/page.tsx</files>
  <read_first>
    - app/status/[id]/page.tsx (the WHOLE file — KEEP VERBATIM: the cookie-bound anon `createClient()` + `auth.getUser()` lines 96-101 NEVER getSession; the `ExpiredState` no-leak fallback lines 70-89, 103-120; the service-role NON-PII destination read lines 123-139; the driver-reveal gate `CLAIMED_OR_LATER` + narrow service-role {name,phone} read lines 141-158; `isPaid` derivation line 160; the receipt block paid-guard lines 202-225; the driver block + pre-claim note lines 227-244; runtime="nodejs" line 33; the fill()/fmtDate/fmtTime helpers lines 47-67. RESTYLE: the header/trip block lines 162-192)
    - app/(guest)/_pass/TransferPass.tsx, PassHeader.tsx, DetailsGrid.tsx, icons.tsx (the 10-1 pieces; read the SUMMARY for prop shapes)
    - platform/ui/RouteMotif.tsx (PassHeader composes it with airport->zone labels)
    - platform/ui/Card.tsx (the trip/receipt/driver blocks stay Card-grouped)
    - 10-PATTERNS.md "app/status/[id]/page.tsx (MODIFY)" -> "Restyle" paragraph (wrap header/trip in TransferPass/PassHeader; real truncated id = first 8 chars of the UUID uppercased via passRefLabel; keep `gap-[48px]` rhythm); status-page caption/value pattern lines 216-220
    - 10-UI-SPEC.md Decision 1 (real truncated transfer ID, NO fake ref, NO barcode), Decision 4 (drop extras), Component Inventory "Status pass" row (line 146)
  </read_first>
  <action>
    Wrap the header + trip-summary region (currently the bare `<h1>` line 164 + the trip `Card` lines 168-192) in the Transfer Pass composition while KEEPING EVERY data/authorization line verbatim:
    - Compute the real truncated id: `const shortId = id.slice(0, 8).toUpperCase();` and pass `refLabel={fill(t.passRefLabel, { shortId })}` to `PassHeader` (status page SHOWS the ref — unlike /pickup which omits it). NEVER an invented "BK-2941-X" and NO barcode (Decision 1).
    - `<TransferPass header={<PassHeader eyebrow={t.passEyebrow} refLabel={…} startLabel={airport} endLabel={zone} … />}>` with RouteMotif airport->zone (reuse the already-read `airport`/`zone` from the service-role destination read — do NOT add a new read).
    - Inside the pass body, render the existing trip summary (you may use `DetailsGrid` for the date/flight/pax fields OR keep the existing Card key/value lines restyled — your discretion per CONTEXT). Then the `<section>` with the `LifecycleStepper` (from Task 1). Then the receipt `Card` (paid-guarded, lines 202-225, unchanged logic) and the driver `Card` (post-claim reveal, lines 227-244, unchanged logic).
    Keep the `<main className="mx-auto flex max-w-[480px] flex-col gap-[48px] px-[16px] py-[48px]">` shell. Do NOT add a map, ETA, vehicle, call/chat affordance, voucher CTA, or any admin nav shell (Decision 4). Do NOT change the receipt's `isPaid` guard — the "Paid €X" line stays inside the `isPaid` branch.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - The pass is composed: `grep -cE "TransferPass|PassHeader" app/status/[id]/page.tsx` >= 2
    - The REAL truncated id is used (no fake ref / barcode): `grep -c "passRefLabel" app/status/[id]/page.tsx` >= 1 AND `grep -iE "BK-2941|928374|barcode|<canvas" app/status/[id]/page.tsx` returns nothing AND a `.slice(0, 8)` (or equivalent truncation) on the id is present
    - The RLS/authorization path is intact: `grep -c "auth.getUser()" app/status/[id]/page.tsx` >= 1 AND `grep -c "getSession" app/status/[id]/page.tsx` == 0 (never getSession) AND `grep -c "createClient()" app/status/[id]/page.tsx` >= 1 (cookie-bound anon read kept)
    - The driver-reveal gate is intact: `grep -c "CLAIMED_OR_LATER" app/status/[id]/page.tsx` >= 1 and the narrow `driver_profiles` `{name, phone}` service-role read remains (`grep -c "driver_profiles" app/status/[id]/page.tsx` >= 1)
    - The receipt paid-guard is intact: the `statusReceiptPaidLine` render stays inside the `isPaid` branch — `grep -c "isPaid" app/status/[id]/page.tsx` >= 1
    - No new destination read added: there is still exactly one `.from("destinations")` call (`grep -c '.from("destinations")' app/status/[id]/page.tsx` == 1)
    - No omitted feature reintroduced: `grep -iE "live tracking|estimated arrival|call|chat|voucher|map" app/status/[id]/page.tsx` returns nothing (case-insensitive; allow none of these affordances)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>/status renders as the Transfer Pass with a real truncated id + RouteMotif + horizontal stepper, while the anon-RLS read, getUser() authorization, no-leak expired fallback, driver-reveal boundary, and paid-guarded receipt are all preserved verbatim; no omitted mockup feature reappears.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| guest magic-link session -> /status server page | The cookie-bound anon client + RLS guest-self-read is the authorization gate; auth.getUser() revalidates the JWT |
| status page -> driver_profiles | Post-claim narrow service-role {name,phone} read, gated on the already-RLS-authorized owning transfer row |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-07 | Information disclosure | Re-exposing guest PII pre-claim, or driver PII to a non-owning guest | mitigate | The `CLAIMED_OR_LATER` driver-reveal gate + the narrow {name,phone} read gated on the RLS-authorized row are kept verbatim; the restyle only wraps presentation. Acceptance grep asserts both remain |
| T-10-08 | Spoofing | Trusting the cookie without revalidation (getSession) | mitigate | `auth.getUser()` is kept as the authorization call; acceptance grep asserts `getSession` count == 0 |
| T-10-09 | Information disclosure | Leaking whether a transfer id exists via the status page | mitigate | The `ExpiredState` neutral no-leak fallback (no row / no session -> same neutral state) is kept verbatim |
| T-10-10 | Spoofing | Showing a faked/authoritative reference id | mitigate | Only the REAL truncated id (first 8 chars of the row's UUID) is shown; no invented "BK-2941-X", no barcode (Decision 1) |
| T-10-SC | Tampering | npm/pip/cargo installs | mitigate | This plan installs NO packages; all imports are existing in-repo modules. No package-legitimacy checkpoint required |
</threat_model>

<verification>
- `npx tsc --noEmit` passes.
- The existing guest status e2e still passes (presentation-only guarantee): `npx playwright test tests/e2e/guest-status.spec.ts --list` collects; the runnable `status-dot` assertion stays green (StatusDot renders inside LifecycleStepper steps — `data-testid="status-dot"` still present via the cancelled terminal / dot semantics, and the live magic-link assertions remain `test.fixme` as before). No RLS/auth/receipt change means the gated assertions are unaffected.
- `platform/ui/LifecycleTimeline.tsx` and its tests are unchanged (`git diff --quiet`).
- No new `@theme` tokens; no `#00685a`, Material Symbols, barcode, map, ETA, vehicle, call/chat, or voucher affordance on the page.
</verification>

<success_criteria>
- GUI-03: /status renders as the pass and reflects the live lifecycle state via the shared horizontal LifecycleStepper (DS-04), not the vertical timeline.
- The pass shows the REAL truncated transfer id (no fake ref, no barcode) and RouteMotif airport->property.
- The magic-link anon RLS read, getUser() authorization, no-leak expired fallback, post-claim driver reveal (first name + phone plain text, no call/chat), and paid-guarded receipt are all preserved verbatim.
- LifecycleTimeline.tsx left untouched; no omitted mockup feature reintroduced.
</success_criteria>

<output>
Create `.planning/phases/10-guest-ui-rebuild/10-03-SUMMARY.md` when done.
</output>
