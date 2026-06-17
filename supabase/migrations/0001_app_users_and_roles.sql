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

-- 6) Seed the first admin (D-02). The auth.users row is created idempotently here so the
--    FK is satisfiable without an out-of-band dashboard step; if the auth account already
--    exists (e.g. created via dashboard), the conflict is ignored and we reuse its id.
--    email_confirmed_at is set so the admin can request a magic link immediately.
with seed_admin as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@balkanity.com',
    '',                       -- no password; magic-link (passwordless) only (D-01)
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
  on conflict (email) do nothing
  returning id, email
)
insert into public.app_users (id, email, role)
select id, email, 'admin'::public.app_user_role
from seed_admin
-- Cover the case where the auth.users row already existed (ON CONFLICT skipped the insert):
-- fall back to looking the user up by email so the admin app_users row is still seeded.
union
select u.id, u.email, 'admin'::public.app_user_role
from auth.users u
where u.email = 'admin@balkanity.com'
on conflict (id) do nothing;
