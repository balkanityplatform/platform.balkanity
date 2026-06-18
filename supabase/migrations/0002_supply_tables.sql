-- 0002_supply_tables.sql
-- FLAGGED / IRREVERSIBLE schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- Establishes the platform-generic supply hierarchy backing supply-side onboarding
-- (ONBD-01): companies → properties → destinations, plus driver_profiles. Each table
-- is admin-only at the data layer (ONBD-05 RLS half): RLS enabled with a single
-- admin-gated SELECT policy and NO anon/authenticated write policy — all writes go
-- through the service-role client in admin-gated server actions.
--
-- Trust-boundary notes (threat model 02-02):
--   T-02-EOP2  RLS ENABLED with an admin-read SELECT policy per table (exists-subquery
--              against app_users.role = 'admin'); non-admins denied at the DB layer.
--   T-02-EOP1  No INSERT/UPDATE/DELETE policy — writes happen only via the service-role
--              client (which bypasses RLS) inside admin-gated actions.
-- Seam note (PLAT-01): platform-generic supply tables — UNPREFIXED (module tables use
--   the wp_ prefix).

-- Reusable admin predicate. SECURITY DEFINER so the policy's exists-subquery reads
-- app_users without recursing through app_users' own RLS, and factored into one place
-- to avoid duplicating the role check across the four supply tables.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users a
    where a.id = (select auth.uid()) and a.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the current request belongs to an admin (app_users.role = admin). Used by the admin-read RLS policies on the supply tables (ONBD-05).';

-- 1) Companies — the referring short-term-rental company (top of the supply hierarchy).
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.companies is
  'Referring short-term-rental company. Top of the supply hierarchy (ONBD-01).';

-- 2) Properties — a property under a company. on delete restrict: a company with
--    properties cannot be hard-deleted (D-12 integrity backstop).
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete restrict,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.properties is
  'A property under a company. FK on delete restrict backs the deactivation order (D-12).';

-- 3) Destinations — a bookable airport→property transfer destination. on delete
--    restrict mirrors properties. Money is stored as integer EUR minor units (D-07);
--    commission is whole percent (D-05). slug is the /pickup resolution key (D-09).
create table public.destinations (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties(id) on delete restrict,
  slug           text not null,
  label          text not null,
  address        text,
  zone           text,
  airport        text,
  price_cents    integer not null check (price_cents >= 0),       -- EUR minor units (D-07)
  commission_pct integer not null check (commission_pct between 0 and 100), -- whole % (D-05)
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.destinations is
  'A bookable airport→property transfer destination. Money as integer EUR cents (D-07).';

-- D-09: globally-unique URL-safe slug — the authority for /pickup resolution.
create unique index destinations_slug_key on public.destinations (slug);

-- 4) Driver profile (D-02) — platform-generic, name + phone keyed to the auth user.
--    FK to auth.users on delete cascade (mirrors 0001's app_users PK pattern). The
--    driver auth account is created via the admin API (generateLink, Plan 05), NEVER a
--    direct auth.users INSERT — that skips auth.identities and breaks sign-in (0001).
create table public.driver_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  created_at timestamptz not null default now()
);

comment on table public.driver_profiles is
  'Driver display profile (name + phone) keyed to the auth user. Account is created via the admin API, never a direct auth.users INSERT (0001).';

-- 5) Enable Row Level Security on all four tables. With RLS on and only a SELECT
--    policy, the tables are deny-by-default for anon/authenticated writes (T-02-EOP1).
alter table public.companies       enable row level security;
alter table public.properties      enable row level security;
alter table public.destinations    enable row level security;
alter table public.driver_profiles enable row level security;

-- 6) Admin-read policy per table — one `for select to authenticated` policy gated on
--    public.is_admin(). NO INSERT/UPDATE/DELETE policy is granted on any table — writes
--    happen ONLY via the service-role client (which bypasses RLS) in admin-gated server
--    actions (mirror of 0001's load-bearing "no write policy" rule).
--    NOTE: Phase 4 will add a NARROW anon/guest SELECT policy for ACTIVE destination
--    slugs only (the /pickup public read path) — that is NOT added in this phase.
create policy "companies_admin_read" on public.companies
  for select to authenticated using (public.is_admin());

create policy "properties_admin_read" on public.properties
  for select to authenticated using (public.is_admin());

create policy "destinations_admin_read" on public.destinations
  for select to authenticated using (public.is_admin());

create policy "driver_profiles_admin_read" on public.driver_profiles
  for select to authenticated using (public.is_admin());
