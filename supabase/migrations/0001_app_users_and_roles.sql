-- 0001_app_users_and_roles.sql
-- FLAGGED / IRREVERSIBLE first schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
--
-- Establishes the platform identity table backing role resolution (AUTH-01) and the
-- seed admin (D-02). Role storage is a Postgres ENUM (resolved decision: role-enum) so the
-- role is type-safe at the DB level and reflected in generated Supabase types.
--
-- Trust-boundary notes (threat model 01-02):
--   T-02-03  RLS is ENABLED with a self-read policy (auth.uid() = id); no anon/authed write path.
--   T-02-05  Exactly one admin is seeded here (admin@balkanity.com); open signup is blocked
--            later by signInWithOtp({ shouldCreateUser: false }) in plan 01-03.
-- Seam note (PLAT-01): platform-wide table — UNPREFIXED (module tables use the wp_ prefix).

-- 1) Role enum: exactly the three app roles, in {admin, driver, guest}.
create type public.app_user_role as enum ('admin', 'driver', 'guest');

-- 2) Identity table. id is both PK and FK to auth.users (1:1 with an auth account).
--    Deleting the auth user cascades to the app_users row.
create table public.app_users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        public.app_user_role not null,
  created_at  timestamptz not null default now()
);

comment on table public.app_users is
  'Platform identity + role for every actor (admin/driver/guest). One role per user (AUTH-01).';

-- 3) Enforce one app_users row per email (case-insensitive) — defence-in-depth against
--    duplicate identities even though id is the primary key.
create unique index app_users_email_lower_key on public.app_users (lower(email));

-- 4) Enable Row Level Security. With RLS on and no permissive policy, the table is
--    deny-by-default for the anon/authenticated roles (T-02-03).
alter table public.app_users enable row level security;

-- 5) Self-read policy: an authenticated user may read ONLY their own row.
--    This is the row that role resolution (plan 01-03, via auth.getUser()) reads.
--    No INSERT/UPDATE/DELETE policy is granted — writes happen only via the
--    service-role client (which bypasses RLS) in seed/admin paths.
create policy "app_users_self_read"
  on public.app_users
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- 6) Seed the first admin (D-02) from a PRE-EXISTING auth account.
--    DECISION (resolved): admin@balkanity.com is created first via the Supabase Auth
--    API / dashboard ("Add user") so it gets a proper auth.users + auth.identities
--    record — a direct auth.users INSERT here would skip auth.identities and break
--    magic-link OTP sign-in in plan 01-03. This migration therefore does NOT touch the
--    auth schema; it only links the app_users row to the existing auth user, by email.
--
--    REQUIRED ORDER: create the admin auth user BEFORE applying this migration.
--    The guard below RAISES if no admin row was seeded, so applying out of order
--    fails fast (AUTH-01: exactly one admin must exist) instead of silently seeding none.
insert into public.app_users (id, email, role)
select u.id, u.email, 'admin'::public.app_user_role
from auth.users u
where lower(u.email) = lower('admin@balkanity.com')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from public.app_users where role = 'admin'
  ) then
    raise exception
      'AUTH-01 seed guard: no admin row in app_users. Create the admin@balkanity.com auth user (Supabase Auth API / dashboard) BEFORE applying 0001, then re-run.';
  end if;
end $$;
