---
phase: 01-platform-foundation
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - app/admin/page.tsx
  - app/auth/confirm/route.ts
  - app/globals.css
  - app/layout.tsx
  - app/manifest.ts
  - app/page.tsx
  - app/sign-in/SignInForm.tsx
  - app/sign-in/actions.ts
  - app/sign-in/page.tsx
  - app/sw.ts
  - app/~offline/page.tsx
  - eslint.config.mjs
  - next.config.ts
  - platform/auth/role.test.ts
  - platform/auth/role.ts
  - platform/i18n/bg.ts
  - platform/i18n/dictionary.test.ts
  - platform/i18n/dictionary.ts
  - platform/i18n/en.ts
  - platform/i18n/lang.ts
  - platform/seam.test.ts
  - platform/supabase/admin.ts
  - platform/supabase/client.ts
  - platform/supabase/server.ts
  - platform/ui/Button.tsx
  - platform/ui/LanguageToggle.tsx
  - platform/ui/StatusDot.test.tsx
  - platform/ui/StatusDot.tsx
  - supabase/migrations/0001_app_users_and_roles.sql
  - tests/e2e/lang-toggle.spec.ts
  - tests/e2e/pwa.spec.ts
  - tests/e2e/sign-in.spec.ts
  - tests/e2e/smoke.spec.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 34 (plus `proxy.ts` and config files pulled in as cross-references; `proxy.ts` is in-scope for the auth boundary)
**Status:** issues_found

## Summary

This is the security-sensitive platform foundation: the three-way Supabase client split, server-side role resolution, the RLS migration, magic-link auth, and the PWA service worker. The architecture is sound and the security intent is well-documented. Several invariants are correctly implemented and verified:

- `getCurrentRole()` correctly uses `auth.getUser()` (JWT revalidation), not `getSession()` — the authz boundary holds.
- `admin.ts` has `import "server-only"` as its first line and reads the non-public `SUPABASE_SERVICE_ROLE_KEY` — the build-time guard against leaking the service-role key to the browser is correctly established.
- `.env.local` is gitignored and was never committed; only `.env.local.example` (empty values) is tracked.
- `proxy.ts` is the legitimate Next 16 rename of `middleware.ts` (confirmed: `PROXY_FILENAME = 'proxy'` exists in next@16.2.9, named `proxy` export accepted) — this is not a defect despite CLAUDE.md still saying `middleware.ts`.
- The SW NetworkFirst guard for `/sign-in|/admin|/auth` is registered before `defaultCache`.

However, there is a **Critical service-role-key configuration bug** (`admin.ts` reads `SUPABASE_URL`, which is the same value as the public URL and is documented as a separate server-only var — see CR-01), and several robustness gaps in the SW sensitive-route guard, the magic-link OTP handling, and the session-refresh mechanism.

## Critical Issues

### CR-01: `admin.ts` reads `SUPABASE_URL` but the rest of the stack uses `NEXT_PUBLIC_SUPABASE_URL` — silent service-role client failure / misconfiguration

**File:** `platform/supabase/admin.ts:16`
**Issue:** The admin (service-role) client reads `process.env.SUPABASE_URL!`, while `client.ts`, `server.ts`, and `proxy.ts` all read `process.env.NEXT_PUBLIC_SUPABASE_URL!`. The `.env.local.example` defines both `NEXT_PUBLIC_SUPABASE_URL` and a separate `SUPABASE_URL`, so the operator must duplicate the same project URL into two variables. The Supabase project URL is **not a secret** (it is already shipped to the browser as `NEXT_PUBLIC_SUPABASE_URL`), so there is no security reason to split it. The consequences of the split:

1. If `SUPABASE_URL` is left unset (easy to do — it is redundant), `process.env.SUPABASE_URL!` is `undefined`. The non-null assertion `!` silences the type error, and `createClient(undefined, key)` will throw or, worse, construct a client pointed at an invalid URL only at the first call — failing at runtime in a later phase (the Stripe webhook's `paid` write, per the file's own comment). This is exactly the money-authoritative path CLAUDE.md flags as must-not-break.
2. A split URL var is a foot-gun for the "never target Kalvia" infrastructure rule: two URL vars can drift to two different projects.

Because this module establishes the pattern for the only place `paid` is ever written (service-role bypass of RLS), a misconfigured/empty URL here is a latent data-integrity failure on the most safety-critical write path. Classifying as Critical on that basis (correctness of the service-role boundary), not a style nit.

**Fix:** Read the same URL var the rest of the stack uses, and only keep the *key* server-only:
```ts
return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,   // URL is not secret — single source of truth
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // the ONLY server-only secret here
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```
Then drop `SUPABASE_URL` from `.env.local.example` to remove the drift surface. If you intentionally want a separate server-only URL, add a startup assertion that it is set and equals the public URL, rather than relying on `!`.

## Warnings

### WR-01: `proxy.ts` uses `getClaims()` for session refresh, but CLAUDE.md and the canonical SSR middleware pattern require `getUser()` — refresh may not fire on the asymmetric-key path

**File:** `proxy.ts:40`
**Issue:** The proxy comment says it uses `getClaims()` "for the refresh path." Inspecting the installed `@supabase/auth-js` (2.108.x): `getClaims()` calls `getSession()` to obtain the token, then **verifies the JWT locally** when asymmetric signing keys + WebCrypto are available — it only falls back to a network `getUser()` call for symmetric (HS*) keys or when WebCrypto is unavailable. The whole point of calling `getUser()` in the Supabase SSR middleware is the server round-trip that reliably triggers token refresh and re-emits refreshed cookies through `setAll`. With local-only verification, an expiring session is less reliably refreshed at the request boundary, which can produce the "random logout" symptom the file's own comment warns about. CLAUDE.md is explicit: *"`middleware.ts` ... refreshes the session on every request (calls `supabase.auth.getUser()`)."*

**Fix:** Use `getUser()` in the proxy refresh (it both refreshes and revalidates), keeping no logic between `createServerClient` and the call:
```ts
// IMPORTANT: no code between createServerClient (above) and getUser (here).
await supabase.auth.getUser();
```
If `getClaims()` is a deliberate performance choice, document why with a citation that it triggers refresh, and verify against a `next start` run that an expired magic-link session is actually refreshed rather than dropped.

### WR-02: SW sensitive-route regex misses `/driver` and any future booking/claim/status routes — they can fall through to a cacheable strategy

**File:** `app/sw.ts:32`
**Issue:** `SENSITIVE_DOCUMENT = /^\/(sign-in|admin|auth)(\/|$)/`. The file's own header says the guard must cover "any future booking/claim/status route" and "a stale-cached signed-in shell or status page is a correctness/security hazard (T-05-01)." But `/driver` (the driver PWA shell — a signed-in surface that `app/page.tsx` already redirects to) is **not** in the regex. A driver navigation to `/driver` will fall through to `defaultCache`, which for documents is typically a `NetworkFirst`/`StaleWhileRevalidate`-style strategy that can serve a stale signed-in shell. This directly contradicts the stated D-06/Pitfall-12 invariant for a route that exists in routing today.

**Fix:** Include `driver` now (and treat the regex as the single allowlist the comment promises):
```ts
const SENSITIVE_DOCUMENT = /^\/(sign-in|admin|auth|driver)(\/|$)/;
```
Better: invert the rule — force NetworkFirst for *all* same-origin document navigations except the explicitly public ones (`/pickup/...` later), so a newly-added signed-in route is safe by default instead of requiring someone to remember to extend the regex.

### WR-03: `auth/confirm` passes unvalidated `type` straight into `verifyOtp`; missing-/wrong-type path is indistinguishable and the email is never bound

**File:** `app/auth/confirm/route.ts:18,22`
**Issue:** `type` is read from the query string and cast `as EmailOtpType` with no validation, then passed to `verifyOtp({ token_hash, type })`. Two robustness issues: (1) an attacker-supplied `type` (e.g. `recovery`, `invite`, `signup`) is forwarded verbatim — Supabase will reject mismatches, but the code is trusting client input at an auth trust boundary with no allowlist; (2) the canonical Supabase confirm handler verifies the token and then reads `getUser()`/binds the session — here success is inferred purely from `!error`, and there is no allowlist on `type` to ensure only `email`/`magiclink` are accepted for this admin-only flow.

**Fix:** Allowlist the expected OTP type(s) before calling `verifyOtp`:
```ts
const rawType = searchParams.get("type");
const type = (rawType === "email" || rawType === "magiclink")
  ? (rawType as EmailOtpType)
  : null;
if (token_hash && type) { /* ...verifyOtp... */ }
```

### WR-04: `sendMagicLink` builds `emailRedirectTo` from the request `origin` header with no allowlist — header-controlled redirect target in the auth email

**File:** `app/sign-in/actions.ts:34,41`
**Issue:** `origin = (await headers()).get("origin") ?? ""`. The `Origin` header is client-supplied. It is then used to construct `emailRedirectTo: \`${origin}/auth/confirm\``, i.e. the link embedded in the magic-link email. If the deployment ever sits behind a proxy/CDN that forwards a spoofable `Origin`, or an attacker can influence it, the magic link could point at an unexpected host. Also, when `origin` is empty the redirect becomes `\`/auth/confirm\`` (relative), which Supabase may reject — silently breaking sign-in. Auth redirect targets should be derived from a trusted, server-configured base URL, not a request header.

**Fix:** Use a configured site URL (Supabase also enforces a redirect allowlist server-side, but defense-in-depth here matters):
```ts
const base = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
if (!base) return { status: "error", message: t.signInError };
// options.emailRedirectTo = `${base}/auth/confirm`
```
Ensure the Supabase dashboard "Redirect URLs" allowlist is also pinned to the known hosts.

### WR-05: `getCurrentRole` collapses a DB/transport error into `null` (unauthenticated), masking failures as "signed out"

**File:** `platform/auth/role.ts:28`
**Issue:** `if (error || !data) return null;` treats a genuine query/transport error (e.g. transient DB outage, RLS misconfig, network blip) identically to "no row found." An authenticated admin hitting a transient error is silently treated as `null` and redirected to `/sign-in` (per `app/page.tsx`/`app/admin/page.tsx`). For an authorization primitive this is a fail-open-to-logout behavior that can mask real infrastructure problems and produce confusing "I keep getting logged out" reports. The "no row" case (legitimately `null`) should be distinguished from an unexpected error.

**Fix:** Distinguish the two: a missing row is `null`; a real error should at minimum be logged (and arguably throw so it surfaces, since the caller already only renders for `role === "admin"`):
```ts
const { data, error } = await supabase.from("app_users").select("role").eq("id", user.id).maybeSingle();
if (error && error.code !== "PGRST116") {
  console.error("role lookup failed", error);  // do not silently treat as logged-out
  // optionally: throw error;  // surfaces infra failure instead of a phantom logout
}
if (!data) return null;
return (data.role as AppRole) ?? null;
```
(Using `maybeSingle()` also avoids `single()` erroring on zero rows.)

### WR-06: `app/page.tsx` switch relies on `redirect()` throwing; the `case` fall-through is correct only by accident and has no `break`/return discipline

**File:** `app/page.tsx:17-27`
**Issue:** Each `case` calls `redirect()` and the next line is another `case` label with no `break`/`return`. This works **only** because `next/navigation`'s `redirect()` throws a special `NEXT_REDIRECT` error, so control never falls through. If `redirect` is ever swapped for a non-throwing variant, wrapped in a try/catch, or someone adds a log line after a `case`, the absence of `break` becomes silent fall-through to the wrong role's redirect — a role-routing bug. This is fragile for the security-relevant root router. (Same latent pattern, lower stakes, in `app/admin/page.tsx:18-20`, which is fine because it returns via the single `redirect`.)

**Fix:** Make control flow explicit so it does not depend on `redirect()`'s throwing behavior:
```ts
switch (role) {
  case "admin":  redirect("/admin");  break;
  case "driver": redirect("/driver"); break;
  case "guest":  redirect("/sign-in"); break;
  default:       redirect("/sign-in");
}
```
or assign the target to a const and `redirect(target)` once.

## Info

### IN-01: `app/page.tsx` redirects `driver` to `/driver`, a route that does not exist yet (documented 404)

**File:** `app/page.tsx:21`
**Issue:** The header comment acknowledges `/driver` "may 404 until Phase 2." A seeded driver signing in via `/` would hit a 404 rather than a graceful surface. Acceptable per D-03, but worth tracking so it is not forgotten when Phase 2 lands.
**Fix:** Add a Phase-2 TODO or a temporary friendly placeholder; no action required in Phase 1.

### IN-02: `revalidatePath("/", "layout")` in `setLang` revalidates the entire app tree on every language toggle

**File:** `platform/i18n/lang.ts:24`
**Issue:** Revalidating the root layout busts the cache for the whole route tree on a low-stakes UI-preference change. Correct for no-flash, but heavy. Out of v1 perf scope; noting for awareness.
**Fix:** No change required for the pilot; revisit if cache churn becomes an issue.

### IN-03: Migration `0001` is non-transactional and non-idempotent on the `create type` / `create table` statements

**File:** `supabase/migrations/0001_app_users_and_roles.sql:16,20`
**Issue:** `create type` and `create table` are not wrapped in `begin/commit` and use no `if not exists`. A partial/re-run apply (e.g. the seed guard `raise exception` fires after the table is created) leaves the type+table present, so a re-run fails at `create type ... already exists` rather than resuming cleanly. The migration is correct on a clean first apply (its intended use), but the seed-guard-raises-then-fix-then-rerun loop the comments describe will trip on the non-idempotent DDL.
**Fix:** Wrap in a transaction, or add `create type ... ` guarded by a `do $$ ... if not exists (select from pg_type ...) ... $$` block and `create table if not exists`. Given schema is flagged/irreversible and applied once with sign-off, low priority — but the comments invite a re-run, so align the SQL with that.

### IN-04: `lang` cookie is `httpOnly: false` by design — confirm no auth value ever rides this cookie

**File:** `platform/i18n/lang.ts:18`
**Issue:** Intentional (T-04-04, documented: low-trust UI preference, must be server-readable, value normalized to the `en|bg` union). No defect — flagging only so future changes never overload this cookie with anything trust-bearing.
**Fix:** None; keep the normalization (`next === "bg" ? "bg" : "en"`) as the invariant.

### IN-05: PWA SW offline test is structurally skip-by-default under `next dev`, so the Pitfall-12 "no stale signed-in shell" guarantee is never asserted in CI

**File:** `tests/e2e/pwa.spec.ts:45-82`
**Issue:** The most security-relevant SW behavior (offline navigation serves `/~offline`, never a stale signed-in shell) is gated behind `test.skip(!registered, ...)` and the Playwright `webServer` runs `next dev`, where Serwist disables the SW. So in normal CI this assertion always skips — the guard in `app/sw.ts` (WR-02) has no automated coverage. This is a test-reliability gap on a security invariant, hence in-scope.
**Fix:** Add a CI job (or a second Playwright project) that runs against `next build && next start` so the SW path is actually exercised, at least for the auth/admin NetworkFirst behavior.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
