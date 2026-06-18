## Open Questions (RESOLVED)

1. **Checkout-session trigger surface this phase (server action vs route handler vs throwaway script)?**
   - What we know: CONTEXT permits minimal/test surfaces; Phase 4 owns the real booking form that calls it.
   - What's unclear: whether to build the create-session helper as a reusable `platform/payments/checkout.ts` (recommended, since Phase 4 will consume it) plus a thin test trigger, or an inline throwaway.
   - Recommendation: build `platform/payments/checkout.ts` (reusable, platform-generic) + a minimal trigger; Phase 4 then just wires the form to it. Higher reuse, low extra cost.
   - **RESOLVED:** A reusable `platform/payments/checkout.ts` helper (`createCheckoutSession`, built in Plan 03-03) plus a minimal admin/test-gated trigger at `app/pay/start/route.ts` (Plan 03-04); Phase 4 consumes the helper directly via the booking form. The throwaway-script option was rejected for zero reuse.

2. **Does TS accept the `apiVersion: '2026-05-27.dahlia'` literal against stripe-node 22.2.1 typings?**
   - What we know: CLAUDE.md asserts v22 supports the dahlia line; `2026-05-27.dahlia` is the latest API version.
   - What's unclear: exact literal-type match in the installed `.d.ts` (occasionally the typings lag by a patch).
   - Recommendation: a planner-time `tsc` check after install; if the literal is rejected, pin to the exact version the typings expose (and record it) rather than `as any`-casting.
   - **RESOLVED:** Pinned in `platform/payments/stripe.ts` (Plan 03-03) with a `tsc --noEmit` / typecheck acceptance criterion at planning time; no `as any` cast permitted. If the literal is rejected by the installed typings at execution, the executor pins to the exact version the `.d.ts` exposes and records the substitution in the plan SUMMARY (per Plan 03-03), never casting around it.

3. **`payment_intent_data.metadata.transfer_id` in addition to session `metadata`?**
   - What we know: both are available; the webhook can read either.
   - Recommendation: set `metadata.transfer_id` on the session (read directly off `checkout.session.completed`) AND mirror onto `payment_intent_data.metadata` so the id is also recoverable from PaymentIntent-centric reconciliation in Phase 8. Cheap belt-and-braces.
   - **RESOLVED:** Yes — belt-and-braces for Phase 8 reconciliation. The `createCheckoutSession` helper (Plan 03-03) sets BOTH `metadata.transfer_id` (read directly off `checkout.session.completed` in the webhook) AND `payment_intent_data.metadata.transfer_id` (so the id is recoverable from PaymentIntent-centric reconciliation in Phase 8). Already reflected in the Plan 03-03 checkout.ts action.
