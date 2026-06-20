# Phase 8: Platform Health - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the operational loop for the real-money pilot. This phase adds the health/observability layer on top of the already-built money + notification spines — it does NOT add new business logic, lifecycle states, or actors.

Delivers:
- **HLTH-02** — reconciliation sweep (Supabase pg_cron, every 15 min) that flags Stripe-paid payments with no matching paid transfer (catches a dropped webhook); Vercel cron is a daily backstop only.
- **HLTH-03** — email-cap gauge on the admin console showing usage against the Resend daily cap (reads `email_log`).
- **HLTH-04** — stuck-transfer alerts (paid-but-unclaimed within 12h of arrival).
- **HLTH-05** — keep-alive that prevents the Supabase free-tier project from pausing (which would silently stop pg_cron).
- **Digest cron trigger** — wire the Supabase pg_cron schedule that fires Phase 7's existing invokable `sendDueDigests()` at each driver's chosen `digest_send_hour` (the time trigger Phase 7 deliberately deferred here).

Out of scope: new lifecycle events/actors/business logic; auto-setting `paid` (the verified webhook remains the sole `paid` author); Phase 7's deferred Resend-domain verification + D-15 UAT (tracked separately).
</domain>

<decisions>
## Implementation Decisions

### Reconciliation sweep (HLTH-02)
- **D-01:** **Detect + alert only — never auto-remediate.** When the sweep finds a Stripe-paid payment with no matching paid transfer, it flags the discrepancy (admin in-app notification + a logged health/reconciliation row) for a human to investigate/replay. It MUST NOT set `paid` itself — the signature-verified Stripe webhook stays the sole `paid` author (CLAUDE.md money lock). This satisfies the pilot DoD ("reconciliation catches a deliberately-dropped webhook").
- **D-02:** **Cadence: every 15 minutes** via Supabase pg_cron + pg_net (catches a dropped webhook within ~15 min). Vercel Hobby cron is a daily backstop only (it is daily + hour-imprecise — cannot do the 15-min sweep).
- **D-03:** Detection compares Stripe-side paid events against the transfer ledger (source data: `webhook_events` from migration 0003 + `wp_transfers`). The exact query/lookback window is planner/researcher territory.

### Stuck-transfer alerts (HLTH-04)
- **D-04:** **Definition: a PAID transfer still unclaimed within 12 hours of the guest's arrival time.** (Single, clear condition for the pilot — not the broader multi-condition net.) The 12h lead time lets an admin chase a driver or assign manually.
- **D-05:** Stuck alerts are **admin in-app only** (not money-critical → no email; consistent with D-03/D-11 from Phase 7 — the bell costs nothing against the Resend cap).

### Email-cap gauge (HLTH-03)
- **D-06:** Lives on the **admin console**, reads the existing `email_log` (migration 0007) daily count. Visual/in-app only.
- **D-07:** **Warning threshold = ~90/day**, matching the existing send-guardrail soft cap exactly — one consistent threshold across the system (gauge turns amber/coral at the same point best-effort sends start dropping).

### Keep-alive (HLTH-05)
- **D-08:** **Stay on the Supabase FREE tier for the pilot + add a keep-alive.** Do NOT upgrade to Pro now. A lightweight keep-alive (a tiny scheduled pg_cron self-ping query and/or the Vercel daily backstop pinging the DB) prevents the 7-day inactivity pause that would silently stop pg_cron — which would otherwise kill the sweep, the stuck-check, and the digest trigger. Build the keep-alive regardless; the Pro-vs-free upgrade can be revisited at go-live.

### Health alert delivery (cross-cutting)
- **D-09:** **In-app for stuck + cap-near; in-app + admin EMAIL (critical tier) for reconciliation money discrepancies.** A dropped-webhook discrepancy means real money is unaccounted for — it should not wait for someone to open the console, so it also emails the admin via the single `sendEmail` call-site at the critical tier. Stuck/cap signals stay in-app to protect the Resend cap.

### Digest cron trigger (carried from Phase 7)
- **D-10:** Wire the Supabase pg_cron schedule that invokes Phase 7's existing `sendDueDigests()` (in `platform/notifications/digest.ts`) at each driver's self-chosen `digest_send_hour`. The cron must run at least hourly so any chosen hour fires. Phase 7 built the invokable + PII gate; Phase 8 only schedules it.

### Claude's Discretion
- The exact reconciliation/health-events log table shape (a new `health_events` / `reconciliation_log` table vs reusing `notifications`), the sweep's SQL + lookback window, the pg_cron↔Edge-Function vs pg_cron↔pg_net-to-route-handler invocation shape, and the precise keep-alive mechanism — researcher/planner decide, consistent with existing migration/RLS conventions (writes via service-role only; RLS SELECT policies; **no client write policy**; schema changes are FLAGGED/irreversible → sign-off before any migration, Balkanity ref `qyhdogajtmnvxphrslwm` only).

### Reviewed Todos (not folded)
- `07-resend-domain-and-d15-uat.md` — matched on generic keywords only; it is Phase 7's deferred completion (Resend domain verification + D-15 UAT), NOT Phase 8 scope. Left for the Phase 7 close-out.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Infrastructure facts (LOCKED — already verified)
- `CLAUDE.md` — Verified Provider Facts table: Supabase pg_cron + pg_net available on free tier (≤8 concurrent jobs, ≤10 min/job, sub-minute intervals OK); Vercel Hobby cron = 1/day + hour-imprecise (backstop only); free-tier 7-day inactivity pause + keep-alive pattern; Resend 100/day + ~90/day guardrail + 5 req/s; money single-writer lock (`paid` set ONLY in the verified webhook); `server-only` key boundary; never target Kalvia (`utyatpadtibqqswsfvtr`), Balkanity ref `qyhdogajtmnvxphrslwm` only.
- `CLAUDE.md` → "Integration Patterns §6 Reconciliation sweep — Supabase Cron (pg_cron + pg_net), NOT Vercel cron".

### Requirements
- `.planning/REQUIREMENTS.md` — HLTH-02, HLTH-03, HLTH-04, HLTH-05 (and HLTH-01 already complete in Phase 3).

### Upstream phase context + seams
- `.planning/phases/07-notifications/07-CONTEXT.md` — D-08 (digest cron trigger is Phase 8), D-11 (cap-near alarm = admin in-app, gauge built here on the same `email_log`), D-03 (admin in-app events), the explicit "Out of scope → Phase 8" list.
- `platform/notifications/digest.ts` — the `sendDueDigests()` invokable + the "PHASE 8 SEAM" header comment (cron trigger to wire); also the service-role/no-JWT PII gate the cron path relies on.
- `platform/notifications/send-email.ts` — the single Resend call-site + soft-cap (gauge reads the same `email_log`; the critical-tier reconciliation admin email routes through here).
- `supabase/migrations/0003_payments_spine.sql` — `webhook_events` + `wp_transfers` (the sweep's source data; HLTH-01 idempotency/outcome log).
- `supabase/migrations/0007_notifications.sql` — `email_log` (gauge source) + `notifications` (admin in-app alert sink) — already applied LIVE to Balkanity.
- `.planning/phases/05-claim-correctness/05-CONTEXT.md` — masked pool/PII conventions the digest cron honours.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/notifications/digest.ts` → `sendDueDigests()`: invokable, PII-gated, awaiting only the Phase 8 cron schedule (D-10).
- `platform/notifications/notify.ts` → `insertNotification` (service-role): the sink for admin in-app health alerts (stuck, cap-near, reconciliation).
- `platform/notifications/send-email.ts` → `sendEmail` (single call-site, critical/best_effort tiers): the path for the critical-tier reconciliation admin email (D-09).
- `email_log` (0007) + `webhook_events` (0003): the read sources for the gauge and the sweep — both already live on Balkanity.
- Admin console under `app/admin/` (`page.tsx`, role-gated via `is_admin`/`getCurrentRole`): where the email-cap gauge + stuck list/alerts surface.

### Established Patterns
- Schema is FLAGGED/irreversible → sign-off before any migration; apply LIVE to Balkanity via Supabase Management API `/database/query` (NOT MCP, NOT `supabase db push`); re-assert ref guardrail (Kalvia never).
- Service-role-only writes + RLS SELECT policies + NO client write policy (notifications/email_log already follow this; any new health table must too).
- pg_cron jobs invoke server logic via pg_net (HTTP) — mirror the CLAUDE.md §6 pattern.
- Prior live-apply runbooks: `.planning/phases/05-claim-correctness/05-GATES-EVIDENCE.md`, `.planning/phases/07-notifications/07-GATES-EVIDENCE.md`.

### Integration Points
- pg_cron → (pg_net) → a sweep/stuck/keep-alive entrypoint (Edge Function or route handler — planner decides).
- pg_cron → (pg_net) → `sendDueDigests()` entrypoint (hourly trigger, D-10).
- Reconciliation discrepancy → `insertNotification` (admin in-app) + `sendEmail` critical (admin email) (D-01, D-09).
- Email-cap gauge → reads `email_log` daily count → admin console widget (D-06/D-07).

</code_context>

<specifics>
## Specific Ideas

- Sweep cadence 15 min; stuck threshold 12h before arrival; gauge warning at ~90/day (all user-chosen, see decisions).
- Open infra item to verify during research: pg_cron version (≥1.6.4) actually available on the Balkanity project (noted in STATE).
</specifics>

<deferred>
## Deferred Ideas

- **Supabase Pro upgrade** — revisit at go-live; for the pilot, free + keep-alive (D-08).
- **Broader stuck-transfer conditions** (claimed-but-not-arrived past pickup, paid-but-no-driver-action for X hours) — pilot ships the single paid-but-unclaimed-near-arrival rule (D-04); additional conditions can be a later refinement.
- **Auto-remediation of dropped webhooks** (Stripe re-fetch + apply) — deliberately NOT built (D-01); could be a future hardening once the manual replay path is proven.

### Reviewed Todos (not folded)
- `07-resend-domain-and-d15-uat.md` — Phase 7 deferred completion (Resend domain + D-15 UAT), not Phase 8 scope.

</deferred>

---

*Phase: 8-platform-health*
*Context gathered: 2026-06-20*
