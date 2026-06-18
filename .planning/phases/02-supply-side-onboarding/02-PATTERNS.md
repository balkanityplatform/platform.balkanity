# Phase 2: Supply-Side Onboarding - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 22 new + 2 modified
**Analogs found:** 22 / 22 (all new files have a strong in-repo analog)

> Every new file in this phase copies an existing Phase 1 pattern. There is **one genuinely new call** in the codebase: `admin.auth.admin.generateLink({type:'invite'})` (driver invite) — everything else is wiring of established primitives. Be concrete: copy from the cited file + line range.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0002_supply_tables.sql` | migration | CRUD (schema + RLS) | `supabase/migrations/0001_app_users_and_roles.sql` | exact |
| `app/admin/companies/page.tsx` | route (RSC) | request-response (read) | `app/admin/page.tsx` + `app/sign-in/page.tsx` | exact |
| `app/admin/companies/CompanyForm.tsx` | component (client island) | request-response | `app/sign-in/SignInForm.tsx` | exact |
| `app/admin/companies/actions.ts` | server action | CRUD (write) | `app/set-password/actions.ts` + `app/forgot-password/actions.ts` | role-match |
| `app/admin/properties/page.tsx` | route (RSC) | request-response (read) | `app/admin/page.tsx` | exact |
| `app/admin/properties/PropertyForm.tsx` | component (client island) | request-response | `app/sign-in/SignInForm.tsx` | exact |
| `app/admin/properties/actions.ts` | server action | CRUD (write) | `app/set-password/actions.ts` | role-match |
| `app/admin/destinations/page.tsx` | route (RSC) | request-response (read) | `app/admin/page.tsx` | exact |
| `app/admin/destinations/DestinationForm.tsx` | component (client island) | request-response + live calc | `app/sign-in/SignInForm.tsx` | role-match |
| `app/admin/destinations/actions.ts` | server action | CRUD (write) + slug uniqueness | `app/set-password/actions.ts` | role-match |
| `app/admin/drivers/page.tsx` | route (RSC) | request-response (read) | `app/admin/page.tsx` | exact |
| `app/admin/drivers/InviteDriverForm.tsx` | component (client island) | request-response (reveals link) | `app/forgot-password/ForgotPasswordForm.tsx` | exact |
| `app/admin/drivers/actions.ts` | server action | event-driven (invite) + write | `app/forgot-password/actions.ts` (redirect base) + NEW `generateLink` | partial (new primitive) |
| `platform/slug/slugify.ts` | utility | transform | none (pure fn; RESEARCH Pattern 3) | no analog |
| `platform/money/commission.ts` | utility | transform | none (pure fn; RESEARCH Pattern 4) | no analog |
| `platform/ui/TextField.tsx` | component (primitive) | — | `app/sign-in/SignInForm.tsx` (input markup) + `Button.tsx` (wrapper shape) | role-match |
| `platform/ui/Select.tsx` | component (primitive) | — | `Button.tsx` (native-element wrapper) | role-match |
| `platform/ui/Toggle.tsx` | component (primitive) | — | `Button.tsx` (native-element wrapper) | role-match |
| `platform/ui/Card.tsx` | component (primitive) | — | `Button.tsx` (className passthrough wrapper) | role-match |
| `platform/ui/DataList.tsx` | component (primitive) | — | `StatusDot.tsx` (presentational, brand tokens) | role-match |
| `platform/i18n/en.ts` (MODIFY) | config (dictionary) | — | `platform/i18n/en.ts` (extend in place) | exact |
| `platform/i18n/bg.ts` (MODIFY) | config (dictionary) | — | `platform/i18n/en.ts` (parity shape) | exact |
| `Button.tsx` (MODIFY — add `variant`) | component (primitive) | — | `platform/ui/Button.tsx` | exact |

---

## Pattern Assignments

### `supabase/migrations/0002_supply_tables.sql` (migration, CRUD)

**Analog:** `supabase/migrations/0001_app_users_and_roles.sql`

**Header convention** (0001 lines 1-13) — copy verbatim, bump number, keep the FLAGGED + Balkanity-ref-ONLY + PLAT-01 UNPREFIXED seam notes:
```sql
-- 0001_app_users_and_roles.sql
-- FLAGGED / IRREVERSIBLE first schema migration — requires human sign-off before apply.
-- Target: Balkanity Supabase project ref qyhdogajtmnvxphrslwm ONLY. NEVER Kalvia (utyatpadtibqqswsfvtr).
-- Seam note (PLAT-01): platform-wide table — UNPREFIXED (module tables use the wp_ prefix).
```

**RLS-enable + deny-by-default + admin-gated SELECT** (0001 lines 34-46). 0001 uses a *self-read* policy (`auth.uid() = id`); Phase 2 tables instead gate on the admin role via an `exists` subquery against `app_users` (RESEARCH Code Examples lines 432-435). Mirror the structure exactly: `enable row level security` then a single `for select to authenticated` policy, **no INSERT/UPDATE/DELETE policy** (0001 lines 39-41 comment is the load-bearing rule):
```sql
alter table public.app_users enable row level security;

create policy "app_users_self_read"
  on public.app_users
  for select
  to authenticated
  using ((select auth.uid()) = id);
-- No INSERT/UPDATE/DELETE policy is granted — writes happen only via the
-- service-role client (which bypasses RLS) ...
```
Phase 2 admin-read shape (from RESEARCH lines 432-435):
```sql
create policy "companies_admin_read" on public.companies for select to authenticated
  using (exists (select 1 from public.app_users a
                 where a.id = (select auth.uid()) and a.role = 'admin'));
```

**Unique index** (0001 line 32 `app_users_email_lower_key`) — model the globally-unique slug index (D-09) on this:
```sql
create unique index app_users_email_lower_key on public.app_users (lower(email));
```

**`driver_profiles` FK to auth.users** — 0001 lines 20-25 establish `references auth.users(id) on delete cascade`; reuse that exact pattern for the driver profile PK. Note the 0001 seed comment (lines 48-57): NEVER direct-`INSERT` into `auth.users` — the driver auth user is created via the admin API (`generateLink`), then the profile row links by `user_id`.

> Table definitions, FK `on delete restrict` on companies→properties→destinations, integer-cents columns, and the `commission_pct` check are spelled out in RESEARCH Code Examples lines 379-438 — copy those.

---

### `app/admin/companies/page.tsx` (RSC route, read) — template for properties/destinations/drivers pages

**Analog:** `app/admin/page.tsx` (admin gate + slate chrome) + `app/sign-in/page.tsx` (dict resolution + island handoff)

**Admin gate** (`app/admin/page.tsx` lines 15-20) — copy verbatim at the top of every Phase 2 admin page:
```typescript
const role = await getCurrentRole();
if (role !== "admin") {
  redirect("/sign-in");
}
```

**No-flash dict + island handoff** (`app/sign-in/page.tsx` lines 13-14, 35-42) — resolve copy server-side, pass into the client island as a `copy={{...}}` prop bag:
```typescript
const [t, lang] = await Promise.all([getDict(), getLang()]);
// ...
<SignInForm copy={{ emailLabel: t.emailLabel, ... }} />
```

**Anon cookie-bound read** (RESEARCH Pattern 2 lines 256-264; uses `platform/supabase/server.ts`) — reads go through the anon client so the admin-read RLS policy is exercised (defence-in-depth), NOT the admin client:
```typescript
import { createClient } from "@/platform/supabase/server";
const supabase = await createClient();
const { data: companies } = await supabase.from("companies").select("id,name,active").order("name");
```

**Slate console chrome** (`app/admin/page.tsx` lines 25-40) — reuse the `bg-slate` header + white logo chip + `LanguageToggle` for console pages.

---

### `app/admin/companies/CompanyForm.tsx` (client island) — template for all forms

**Analog:** `app/sign-in/SignInForm.tsx` (useActionState + input markup + error slot)

**Island shape** (`SignInForm.tsx` lines 1-25): `"use client"`, `useActionState(action, initialState)`, typed `Copy` prop bag, `initialState = { status: "idle" }`.

**Input + label + focus markup** (`SignInForm.tsx` lines 28-56) — this exact Tailwind string is the field contract; lift it into the new `TextField` primitive:
```typescript
<label htmlFor="email" className="text-[14px] font-semibold leading-[1.4] text-slate">{copy.emailLabel}</label>
<input id="email" name="email" type="email" required
  className="h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal" />
```

**Error slot** (`SignInForm.tsx` lines 58-63) — dictionary-keyed `role="alert"` coral message:
```typescript
{state.status === "error" ? (
  <p role="alert" className="text-[14px] leading-[1.4] text-coral">{state.message}</p>
) : null}
```

**Submit button** (`SignInForm.tsx` lines 65-67) — `<Button type="submit" disabled={pending}>`.

---

### `app/admin/companies/actions.ts` (server action, CRUD write) — template for properties/destinations writes

**Analog:** `app/set-password/actions.ts` (server-side re-gate + generic dict errors + redirect-outside-try) and `app/forgot-password/actions.ts` (trusted redirect base)

**`"use server"` + typed state** (`set-password/actions.ts` lines 1, 15-18):
```typescript
"use server";
export type SetPasswordState = { status: "idle" | "error"; message?: string };
```

**Server-side admin re-gate** — `set-password/actions.ts` lines 45-51 re-validate via `auth.getUser()`; Phase 2 writes re-gate via `getCurrentRole()` (RESEARCH Pattern 1 line 211) since service-role bypasses RLS and there is no anon write policy:
```typescript
if ((await getCurrentRole()) !== "admin") return { status: "error", message: t.saveFailed };
```

**Service-role write** — use `createAdminClient()` (`platform/supabase/admin.ts` lines 21-32, `import "server-only"`), NOT the anon client, for inserts/updates/soft-deactivate (RESEARCH Architecture line 79):
```typescript
const admin = createAdminClient();
await admin.from("companies").insert({ name, active: true });
```

**Generic dict-keyed errors + redirect outside try** (`set-password/actions.ts` lines 53-61) — never leak provider detail; `redirect()` runs after awaits, outside any try/catch.

**Lifecycle gate (D-12)** — enforce "no active children" in the action (count active children → return `t.deactivateCompanyBlocked`), backed by FK `on delete restrict` (RESEARCH Pitfall 5 lines 368-370). No UI-only gating.

---

### `app/admin/destinations/DestinationForm.tsx` (client island + live "you keep" calc)

**Analog:** `app/sign-in/SignInForm.tsx` (island base) + NEW client-side recompute

Same island shape as CompanyForm. Two phase-specific additions, both **client-only display** (do not persist derived values):
- **Slug auto-fill (D-08):** typing the label live-fills the editable slug field via `slugify()` from `platform/slug/slugify.ts`; format/unique error shows inline on blur/save (UI-SPEC line 149).
- **"You keep" panel (D-06):** on price/pct change, recompute three lines via `commissionCents` / `netCents` / `estStripeFeeCents` from `platform/money/commission.ts`; render with copy keys `youKeepCommissionLine` / `youKeepNetLine` / `youKeepFeeNote` (UI-SPEC lines 137-139). EUR display, integer cents storage (D-07).

The slug-edit coral warning (D-10) uses copy key `slugEditWarning` (UI-SPEC line 140), shown before save in the edit path.

---

### `app/admin/destinations/actions.ts` (server action, slug uniqueness)

**Analog:** `app/admin/companies/actions.ts` (above) + RESEARCH Pattern 3 (lines 273-291)

Same admin re-gate + service-role write. Adds: server-side `slugify()` + collision-suffix retry (`uniqueSlug`), with the **DB unique index as the authority** — catch Postgres `23505` and return `t.slugTaken` (RESEARCH lines 283-291). Commission `0–100` check returns `t.commissionRange`.

---

### `app/admin/drivers/InviteDriverForm.tsx` (client island, reveals link)

**Analog:** `app/forgot-password/ForgotPasswordForm.tsx` (the success-branch-replaces-form pattern)

`ForgotPasswordForm.tsx` lines 24-31 render a `role="status"` success branch instead of the form. The invite form does the same but, on `status: "ok"`, renders the returned `actionLink` inline with a copy button + delivery note (`inviteLinkDeliveryNote`, UI-SPEC line 141) instead of sending email (D-03/D-04). Fields: email + name + phone (D-02).

---

### `app/admin/drivers/actions.ts` (server action, driver invite — THE new primitive)

**Analog:** `app/forgot-password/actions.ts` (trusted redirect base) + NEW `generateLink`. Full reference: RESEARCH Pattern 1 lines 199-247.

**Trusted redirect base** (`forgot-password/actions.ts` lines 31-32, 38-40) — reuse `NEXT_PUBLIC_SITE_URL` as the redirect base pointing at the existing `/auth/confirm` route (WR-04: never trust `Origin` for the link base). forgot-password already proves `/auth/confirm?type=recovery`; the invite uses `?type=invite` (already allowlisted in `app/auth/confirm/route.ts` lines 39-51):
```typescript
const base = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${base}/auth/confirm?type=recovery` });
```

**The NEW call** (RESEARCH Pattern 1 lines 222-245) — `generateLink({type:'invite'})` creates the auth user AND returns `data.properties.action_link` **without sending email**; then service-role insert of `app_users(role:'driver')` + `driver_profiles(name,phone)`; return `actionLink` for manual copy. The `/auth/confirm` → `/set-password` downstream is already built and already allowlists `type=invite` (confirm route lines 39-51, 62-67).

> No analog for `generateLink` exists in-repo. Verified against installed `@supabase/auth-js` types (RESEARCH Sources line 570). Handle re-invite of an existing email (Pitfall 4): block with `t.driverAlreadyInvited` or `upsert` on `app_users`.

---

### `platform/ui/{TextField,Select,Toggle,Card,DataList}.tsx` (new primitives)

**Analog:** `platform/ui/Button.tsx` (native-element wrapper, className passthrough) + `platform/ui/StatusDot.tsx` (presentational, brand-token classes)

**Wrapper shape** (`Button.tsx` lines 7-22) — typed `HTMLAttributes` extension, `className = ""` merge, `{...rest}` spread:
```typescript
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
export function Button({ className = "", children, ...rest }: ButtonProps) {
  return <button className={`... ${className}`} {...rest}>{children}</button>;
}
```
`TextField` lifts the input markup from `SignInForm.tsx` lines 28-56 (label + `h-[52px]` input + inline error slot). All controls ≥44px (UI-SPEC line 60). `DataList` follows `StatusDot.tsx` (lines 35-52): presentational, brand-token classes, reuse `StatusDot` itself for the active/inactive indicator.

---

### `Button.tsx` (MODIFY — add `variant`)

**Analog:** `platform/ui/Button.tsx` itself. D-08 deferred the secondary variant; this phase needs ghost/outline-slate for Edit/Cancel (UI-SPEC line 42). Add a `variant?: "primary" | "ghost"` prop rather than a new component; default stays the locked 52px teal CTA (lines 11-22 unchanged for `primary`).

---

### `platform/i18n/{en,bg}.ts` (MODIFY — add console + form copy)

**Analog:** `platform/i18n/en.ts` (lines 7-36) — extend the `en` object in place; `Dict = typeof en` (line 36) auto-propagates the shape, and `bg.ts` must add the same keys or `tsc` fails (the parity gate). Add every key from the UI-SPEC Copywriting Contract (UI-SPEC lines 117-147): CTAs, empty states, the four errors (`fieldRequired`, `slugTaken`, `slugInvalid`, `commissionRange`, `saveFailed`), the three "you keep" lines, `slugEditWarning`, `inviteLinkDeliveryNote`, the deactivate/delete confirmations, and `deactivateCompanyBlocked` / `deactivatePropertyBlocked`. Never hard-code strings in JSX (PLAT-04).

---

## Shared Patterns

### Admin route gating
**Source:** `app/admin/page.tsx` lines 15-20 (uses `platform/auth/role.ts` `getCurrentRole()`)
**Apply to:** every `app/admin/**/page.tsx` (server-side, before render) AND re-gate at the top of every write `actions.ts` (service-role bypasses RLS).
```typescript
const role = await getCurrentRole();
if (role !== "admin") redirect("/sign-in");
```

### Service-role write boundary
**Source:** `platform/supabase/admin.ts` lines 1, 21-32 (`import "server-only"` build guard)
**Apply to:** all `actions.ts` writes (inserts/updates/soft-deactivate + invite auth-user creation). Reads use the anon `platform/supabase/server.ts` client instead. Never import `createAdminClient` from a `"use client"` file (Pitfall 6).

### No-flash dictionary resolution
**Source:** `app/sign-in/page.tsx` lines 13-14 + `platform/i18n/dictionary.ts` lines 20-22
**Apply to:** every RSC page — `await getDict()` server-side, pass copy into the client island as a `copy={{...}}` prop bag. No hard-coded JSX strings (PLAT-04).

### Generic, dictionary-keyed errors (no enumeration / no provider leak)
**Source:** `app/sign-in/actions.ts` lines 36-48 + `app/set-password/actions.ts` lines 55-58
**Apply to:** all server actions, especially driver re-invite (account-enumeration defense, Security Domain V7). Never branch error copy on which field/credential failed.

### Server-action redirect control flow
**Source:** `app/set-password/actions.ts` lines 60-61 (and comment lines 8-9)
**Apply to:** any action that redirects — `redirect()` runs after all awaits, outside try/catch, so `NEXT_REDIRECT` isn't swallowed.

### Trusted redirect base for auth links
**Source:** `app/forgot-password/actions.ts` lines 31-32 + `app/auth/confirm/route.ts` lines 39-51 (type allowlist)
**Apply to:** driver invite `redirectTo` — `NEXT_PUBLIC_SITE_URL` + `/auth/confirm?type=invite`; never the `Origin` header (WR-04). Requires the Supabase Redirect URLs allowlist entry (RESEARCH Pitfall 1 — a deploy checkpoint, not code).

---

## No Analog Found

Pure functions with no in-repo precedent — planner uses RESEARCH patterns (verbatim code given there):

| File | Role | Data Flow | Reason | Reference |
|------|------|-----------|--------|-----------|
| `platform/slug/slugify.ts` | utility | transform | First slug logic in repo; ~15-line hand-rolled NFKD-strip, no new dep | RESEARCH Pattern 3 lines 273-282; Cyrillic-empty fallback Pitfall 2 |
| `platform/money/commission.ts` | utility | transform | First money math in repo; integer-cents `commissionCents`/`netCents`/`estStripeFeeCents`/`fmtEur` | RESEARCH Pattern 4 lines 296-310 (EEA 1.5% + €0.25 per CLAUDE.md) |

Both ship with co-located Vitest tests (Wave 0 gaps, RESEARCH lines 515-517, 531-532). Test framework analogs already exist: `platform/auth/role.test.ts`, `platform/ui/StatusDot.test.tsx`, `platform/i18n/dictionary.test.ts`.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `platform/{auth,supabase,ui,i18n,slug,money}/`, `app/{admin,sign-in,set-password,forgot-password,auth}/`
**Files scanned:** 14 existing source files read in full
**Pattern extraction date:** 2026-06-18
