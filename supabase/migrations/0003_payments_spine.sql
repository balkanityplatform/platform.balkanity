-- 0003_payments_spine.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- Authors the payments trust-spine schema the money path writes against:
--   1) public.wp_transfers     — the minimal money-spine table (D-03) the verified Stripe
--                                webhook flips to `paid`; metadata.transfer_id resolves to
--                                a real destination-backed row (BOOK-05).
--   2) public.webhook_events   — the platform-generic audit + idempotency log (HLTH-01)
--                                with a UNIQUE event_id (the insert-first replay authority).
-- Both tables are admin-read at the data layer and have NO write policy — every write goes
-- through the service-role client (which bypasses RLS), exactly as 0002 established. The
-- service-role webhook is the ONLY writer of `paid`.
--
-- Trust-boundary notes (threat model 03-02):
--   T-03-AC   RLS ENABLED on both tables with a single admin-read SELECT policy each and
--             NO INSERT/UPDATE/DELETE policy → anon/authenticated cannot write; only the
--             service-role webhook can (single-writer `paid`).
--   T-03-RP   webhook_events_event_id_key UNIQUE on event_id is the DB-level race-safe
--             idempotency authority the webhook's insert-first dedup relies on (SC3,
--             replay protection).
--   T-03-ENV  Balkanity-ref guardrail in this header (qyhdogajtmnvxphrslwm ONLY; never
--             Kalvia utyatpadtibqqswsfvtr); live apply is the Plan 05 BLOCKING, signed-off
--             task via the Supabase CLI/Management token — NOT MCP (MCP hits Kalvia).
--   T-03-FK   wp_transfers.destination_id FK on delete restrict + a real row (D-03) so the
--             `paid` UPDATE targets a real id; the webhook logs no_matching_transfer rather
--             than 500 when the row is absent (handled in Plan 04).
-- Seam note (PLAT-01): wp_transfers = module table → wp_ prefix; webhook_events =
--   platform-generic → UNPREFIXED.
--
-- NOTE: public.is_admin() is NOT redefined here — it already exists from 0002; the new
--   admin-read policies reuse it.

-- 1) wp_transfers — the minimal money-spine row (D-03). ONLY the columns the webhook
--    needs; Phase 4 ALTERs this to add PII + the full transfer lifecycle columns (D-04).
--    `status` is flipped to 'paid' ONLY by the signature-verified webhook (BOOK-05). Money
--    is integer EUR minor units end-to-end (D-01, no floats, no BGN layer). on delete
--    restrict on the destination FK backs metadata.transfer_id resolution (T-03-FK).
create table public.wp_transfers (
  id                         uuid primary key default gen_random_uuid(),
  destination_id             uuid not null references public.destinations(id) on delete restrict,
  status                     text not null default 'requested',          -- the `paid` writer's target (BOOK-05)
  amount_cents               integer not null check (amount_cents >= 0), -- EUR minor units (D-01)
  currency                   text not null default 'eur',                -- EUR only (D-01)
  fee_cents                  integer,                                    -- actual Stripe fee (D-05); null until the balance txn is available (Phase 8 backfill)
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  paid_at                    timestamptz,
  created_at                 timestamptz not null default now()
);

comment on table public.wp_transfers is
  'Minimal money-spine row (D-03). `status` is flipped to paid ONLY by the verified Stripe webhook (BOOK-05). Phase 4 ALTERs this to add guest PII + the full transfer lifecycle columns (D-04).';

-- 2) webhook_events — platform-generic audit + idempotency log (HLTH-01). The verified
--    event is recorded insert-first; outcome transitions received → processed /
--    duplicate_skipped / no_matching_transfer. payload is the verified event for audit.
create table public.webhook_events (
  id               uuid primary key default gen_random_uuid(),
  event_id         text not null,                       -- Stripe evt_… — the idempotency key
  type             text not null,                       -- e.g. checkout.session.completed
  signature_result text not null,                       -- e.g. valid
  outcome          text not null default 'received',    -- received → processed / duplicate_skipped / no_matching_transfer
  payload          jsonb,                               -- the verified event, for audit (discretion column)
  created_at       timestamptz not null default now()
);

comment on table public.webhook_events is
  'Audit + idempotency log for verified Stripe webhook events (HLTH-01). UNIQUE event_id is the insert-first race-safe replay authority (SC3).';

-- SC3 / T-03-RP: globally-unique event_id — the race-safe replay/idempotency authority
-- the webhook insert-first dedup relies on (mirrors 0002's destinations_slug_key pattern).
create unique index webhook_events_event_id_key on public.webhook_events (event_id);

-- 3) Enable Row Level Security on BOTH tables. With RLS on and only a SELECT policy, the
--    tables are deny-by-default for anon/authenticated writes (T-03-AC).
alter table public.wp_transfers   enable row level security;
alter table public.webhook_events enable row level security;

-- 4) Admin-read policy per table — one `for select to authenticated` policy gated on
--    public.is_admin() (reused from 0002, NOT redefined). NO INSERT/UPDATE/DELETE policy
--    is granted on either table — every write happens ONLY via the service-role client
--    (which bypasses RLS): the signature-verified webhook is the single writer of `paid`
--    (T-03-AC, the load-bearing "no write policy" lock from 0001/0002).
create policy "wp_transfers_admin_read" on public.wp_transfers
  for select to authenticated using (public.is_admin());

create policy "webhook_events_admin_read" on public.webhook_events
  for select to authenticated using (public.is_admin());
