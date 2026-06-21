---
phase: 10-guest-ui-rebuild
plan: 04
type: execute
wave: 2
depends_on: ["10-01"]
files_modified:
  - app/pay/success/page.tsx
  - app/track/page.tsx
  - app/track/TrackForm.tsx
autonomous: true
requirements: [GUI-04]
must_haves:
  truths:
    - "/pay/success is restyled to the design system (Card + Display title + teal track link) and stays DISPLAY-ONLY — the literal 'Paid' line is emitted ONLY inside the real status === 'paid' branch (success-spoof gate preserved)"
    - "/track is restyled to the design system (48/52px field, teal CTA) with no behaviour change — the action still returns a neutral non-enumerating success"
    - "The whole guest journey (booking, status, success, cancel, track) now reads as one branded flow with no half-rebranded screens"
  artifacts:
    - path: "app/pay/success/page.tsx"
      provides: "Restyled display-only post-Checkout success page"
      contains: "isPaid"
    - path: "app/track/page.tsx"
      provides: "Restyled magic-link re-access entry page"
      contains: "getDict"
  key_links:
    - from: "app/pay/success/page.tsx"
      to: "status === 'paid' branch"
      via: "the 'Paid' literal stays inside isPaid (success-spoof gate)"
      pattern: "isPaid"
    - from: "app/track/TrackForm.tsx"
      to: "requestStatusLink"
      via: "useActionState(requestStatusLink) — unchanged neutral-success action"
      pattern: "requestStatusLink"
---

<objective>
Restyle the two remaining guest supporting screens — `/pay/success` and `/track` — to the design system so the entire guest journey reads as one branded flow (CONTEXT D-01: no half-rebranded screens). This is the lighter consistent restyle (no full pass skeuomorphism) — Card + Display title + design tokens.

Critically, this preserves the two non-negotiable invariants on these screens: the success page stays DISPLAY-ONLY with the "Paid" literal locked inside the real `status === "paid"` branch (success-spoof e2e gate), and /track keeps its neutral non-enumerating action behaviour. This completes GUI-04's "Stripe-secured flow" feel end-to-end without any payment-path change.

Output: Restyled `app/pay/success/page.tsx`, `app/track/page.tsx`, and `app/track/TrackForm.tsx`.
</objective>

<phase_goal>
**As a** guest finishing or recovering a booking, **I want to** see consistently branded confirmation and link-recovery screens, **so that** the whole journey feels like one trustworthy Balkanity product end-to-end.
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
</context>

<artifacts_this_phase_produces>
No new symbols — this plan only restyles existing screens using the @theme tokens, `Card`, `Button`, `TextField`, and (optionally) the `LockIcon` from `app/(guest)/_pass/icons.tsx`. It reuses all existing `paySuccess*` and `track*` copy keys verbatim (no new keys needed — the cancel keys were added in 10-1).
</artifacts_this_phase_produces>

<tasks>

<task type="auto">
  <name>Task 1: Restyle /pay/success (lighter DS treatment) — preserve the display-only spoof gate</name>
  <files>app/pay/success/page.tsx</files>
  <read_first>
    - app/pay/success/page.tsx (the WHOLE file — KEEP VERBATIM: the service-role display-only read lines 51-63; the `!transferId`/`status===null`/`isPaid`/unpaid branch structure lines 76-115; `runtime = "nodejs"` line 20; the CRITICAL spoof gate lines 84-99 where the "Paid"/`statusReceiptPaidLine` literal is emitted ONLY inside `isPaid`. Already uses `Card` + the teal link class lines 67-68, 71-118)
    - tests/e2e/success-spoof.spec.ts (the gate this must keep green: a direct `/pay/success?t=<id>` hit with no webhook must NOT render `/\bpaid\b/i` — so the "Paid" literal MUST stay inside the isPaid branch)
    - 10-PATTERNS.md "app/pay/success/page.tsx (MODIFY)" section (lighter consistent restyle, preserve spoof gate, reuse statusReceiptPaidLine/paySuccess* keys)
    - 10-UI-SPEC.md Component Inventory "Post-checkout pages" row (line 147 — success stays display-only)
    - app/(guest)/_pass/icons.tsx (optional LockIcon if adding a Stripe-trust touch to the confirming state)
  </read_first>
  <action>
    Apply the lighter design-system restyle (NO full pass skeuomorphism). Keep the existing `<main className="mx-auto flex max-w-[480px] flex-col gap-[32px] px-[16px] py-[48px]">` shell, the Display `<h1>`, and the `Card`. Upgrade to a confirmation-pass-lite treatment: you may tighten spacing, add a teal accent / optional `LockIcon` Stripe-trust touch to the paid/confirming state, and ensure all type uses the brand roles (Display/Heading/Body/Label) and brand tokens (text-slate/text-grey/text-teal). KEEP VERBATIM every branch and read: the service-role display-only read, `runtime = "nodejs"`, and — non-negotiable — the `statusReceiptPaidLine` "Paid €X" literal MUST remain inside the `isPaid` (`status === "paid"`) branch. Do NOT move the "Paid" literal into the neutral/confirming branch and do NOT add any write. Reuse `paySuccessTitle`/`paySuccessConfirming`/`paySuccessTrackCta`/`paySuccessTrackFallback`/`statusReceiptPaidLine`/`statusReceiptSubNote` verbatim.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - The spoof gate holds: the `statusReceiptPaidLine` (the "Paid €X" line) render appears ONLY within the `isPaid` branch — `grep -c "statusReceiptPaidLine" app/pay/success/page.tsx` >= 1 and `grep -c "isPaid" app/pay/success/page.tsx` >= 1; manual confirm the paid-line JSX is inside `isPaid ? (…)`
    - No write introduced: `grep -iE "\.update\(|\.insert\(|status: *['\"]paid" app/pay/success/page.tsx` returns nothing (display-only / single-writer preserved)
    - `grep -c 'runtime = "nodejs"' app/pay/success/page.tsx` == 1
    - Brand tokens used, mockup primary absent: `grep -c "00685a" app/pay/success/page.tsx` == 0
    - The success-spoof e2e still passes: `npx playwright test tests/e2e/success-spoof.spec.ts` is green (a no-webhook hit renders no `\bpaid\b`)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>/pay/success is restyled to the design system, stays display-only with the "Paid" literal locked inside the isPaid branch, and the success-spoof e2e stays green.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle /track + TrackForm (lightest DS treatment) — preserve the neutral non-enumerating action</name>
  <files>app/track/page.tsx, app/track/TrackForm.tsx</files>
  <read_first>
    - app/track/page.tsx (the WHOLE file — getDict() + flat `copy` prop into TrackForm lines 10-26; already on the `max-w-[480px]` shell + brand type)
    - app/track/TrackForm.tsx (the WHOLE file — `useActionState(requestStatusLink)` lines 19-23; the neutral-success-replaces-form pattern lines 25-32 — KEEP; TextField + Button already brand-styled)
    - platform/ui/TextField.tsx (already 52px + 2px teal focus + 14px/600 label) and platform/ui/Button.tsx (already teal 52px) — reuse as-is
    - 10-PATTERNS.md "app/track/page.tsx + TrackForm.tsx (MODIFY)" section (lightest restyle; keep getDict flat-copy prop + neutral-success + no-enumeration behaviour)
    - 10-UI-SPEC.md Component Inventory "Track entry" row (line 148 — restyle to DS, 48px field + teal CTA, no behaviour change)
  </read_first>
  <action>
    Apply the lightest design-system restyle: ensure the page chrome uses the brand type roles + tokens (it largely already does) and confirm the `TextField` (48/52px + teal focus) + `Button` (teal 52px) are consumed. KEEP VERBATIM: `getDict()` + the flat `copy` prop into `TrackForm`, the `useActionState(requestStatusLink)` call, the neutral-success-replaces-form branch (`state.status === "ok"`), and the no-account-enumeration behaviour. Make NO behavioural change — do not alter the action, the email field name/type, or the neutral-success copy. Any change is purely visual (spacing, optional heading/body tone alignment to Display/Body roles).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - The action is unchanged: `grep -c "requestStatusLink" app/track/TrackForm.tsx` >= 1 (useActionState still calls it)
    - The neutral-success branch is intact: `grep -c 'state.status === "ok"' app/track/TrackForm.tsx` >= 1 (form is replaced by the neutral success, no enumeration)
    - The email field is unchanged: `grep -c 'name="email"' app/track/TrackForm.tsx` == 1 and `grep -c 'type="email"' app/track/TrackForm.tsx` >= 1
    - Brand primitives consumed: `grep -c "TextField" app/track/TrackForm.tsx` >= 1 and `grep -c "Button" app/track/TrackForm.tsx` >= 1; no new form library: `grep -iE "react-hook-form|formik" app/track/TrackForm.tsx` returns nothing
    - getDict server resolution kept on the page: `grep -c "getDict" app/track/page.tsx` >= 1
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>/track and TrackForm are aligned to the design system with the getDict flat-copy prop, the requestStatusLink action, the neutral non-enumerating success, and the email field all unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| guest browser -> /pay/success | Spoofable post-Checkout redirect with untrusted `?t=<id>`; the page must stay display-only |
| guest browser -> /track action | Untrusted email input; the action must not reveal whether a booking exists (no enumeration) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-11 | Spoofing | A direct /pay/success hit (no webhook) rendering an authoritative "Paid" / writing paid | mitigate | The "Paid" literal stays inside the `status === "paid"` branch; no write on the path; the success-spoof e2e is run as an acceptance gate (single-writer + spoof gate preserved) |
| T-10-12 | Information disclosure | /track revealing whether an email has a booking (account enumeration) | mitigate | The neutral-success-replaces-form behaviour and the `requestStatusLink` action are kept verbatim; acceptance grep asserts the neutral `state.status === "ok"` branch remains |
| T-10-SC | Tampering | npm/pip/cargo installs | mitigate | This plan installs NO packages; all imports are existing in-repo modules. No package-legitimacy checkpoint required |
</threat_model>

<verification>
- `npx tsc --noEmit` passes.
- The success-spoof e2e (`npx playwright test tests/e2e/success-spoof.spec.ts`) is GREEN — the display-only / no-paid-write guarantee holds after the restyle.
- The remaining guest e2e suite still collects and passes (presentation-only guarantee) — /track behaviour is unchanged.
- No new `@theme` tokens; no `#00685a`; no write on either page.
</verification>

<success_criteria>
- GUI-04 (journey completeness): the whole guest flow (booking, status, success, cancel, track) reads as one branded design-system flow with no half-rebranded screens.
- /pay/success restyled, display-only, "Paid" literal locked inside the isPaid branch, success-spoof e2e green.
- /track + TrackForm restyled with the neutral non-enumerating action and email field unchanged.
- No backend/schema/auth/RLS/payment change; no new tokens.
</success_criteria>

<output>
Create `.planning/phases/10-guest-ui-rebuild/10-04-SUMMARY.md` when done.
</output>
