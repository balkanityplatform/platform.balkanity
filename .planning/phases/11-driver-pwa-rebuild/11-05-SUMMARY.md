---
phase: 11-driver-pwa-rebuild
plan: 05
subsystem: ui
tags: [next-app-router, rsc, react, tailwind, auth, i18n]

# Dependency graph
requires:
  - phase: 11-driver-pwa-rebuild
    plan: 01
    provides: shared app/driver/layout.tsx chrome (slim header + bottom nav), driverSignOutCta EN/BG key, langToggle key
  - phase: 07-notifications
    provides: DigestPreferenceCard + saveDigestPreference gated digest-preference write (reused verbatim)
provides:
  - "signOutAction — new exported server action in app/driver/settings/actions.ts (supabase.auth.signOut() + redirect /sign-in); the lone new write of Phase 11 (D-05)"
  - "Rebuilt driver Profile RSC: identity header + restyled digest card + language settings row + sign-out button, all on existing data (D-03/D-04)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth/session-only server action: caller-auth @supabase/ssr client → supabase.auth.signOut() → redirect (no zod, no service-role, no schema/RLS)"
    - "Identity header from the preserved verified auth.getUser() session — initials chip (no avatar photo), email always present, driver_profiles.name optional (Discretion A1)"

key-files:
  created: []
  modified:
    - app/driver/settings/actions.ts
    - app/driver/settings/page.tsx

key-decisions:
  - "DigestPreferenceCard NOT edited — it already sits on the DS Card primitive (rounded-md border-grey/30 bg-white), which IS the new warm-light chrome; touching it would risk the NOTF-05 behaviour-verbatim guard for zero chrome gain"
  - "driver_profiles.name folded into the EXISTING narrow service-role digest read (added `name` to the same .select keyed to auth.uid()) rather than a second query — one round-trip, same row-scope gate"
  - "Sign-out uses Button variant=ghost (outline-slate) so it reads as a terminal/secondary action, not the teal primary CTA"

patterns-established:
  - "Driver Profile compose order (D-03): identity Card → DigestPreferenceCard → language-row Card → sign-out <form action={signOutAction}>"

requirements-completed: [DUI-02]

# Metrics
duration: 4min
completed: 2026-06-22
---

# Phase 11 Plan 05: Driver Profile Rebuild + Sign-out Summary

**The driver Profile tab now reads as a real settings surface — caller identity header, the restyled daily-digest card, a language-toggle row, and the phase's lone new affordance: a sign-out button wired to a session-only `signOutAction` (`supabase.auth.signOut()` + redirect to `/sign-in`).**

## Performance

- **Duration:** ~4 min
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- Added `signOutAction` — the only new write in Phase 11 (D-05): auth/session-only, standard `@supabase/ssr` `supabase.auth.signOut()` then `redirect("/sign-in")`; no payload, zod, service-role, or schema/RLS touched.
- Rebuilt `app/driver/settings/page.tsx` to compose top→bottom (D-03): identity header (initials chip + email, optional `driver_profiles.name`), the existing `DigestPreferenceCard`, a `LanguageToggle` settings row, and a sign-out `<form action={signOutAction}>`.
- Deleted the per-page `<header>` (chrome now lives in `app/driver/layout.tsx`, Plan 01) and kept the `getCurrentRole()` gate, `auth.getUser()`, and the narrow service-role digest read verbatim.
- No earnings, ratings, stats, or avatar upload — every element is backed by data we already have (D-04 truthfulness guard).

## Task Commits

1. **Task 1: Add signOutAction (session-only)** - `f9e780a` (feat)
2. **Task 2: Rebuild Profile page (identity + digest + language + sign-out)** - `0077e69` (feat)

## Files Created/Modified
- `app/driver/settings/actions.ts` (modified) - Added the exported `signOutAction`; imported `redirect` from `next/navigation`. `saveDigestPreference` left untouched.
- `app/driver/settings/page.tsx` (modified) - Rebuilt Profile RSC: identity Card (initials chip + email/name), `DigestPreferenceCard`, language-row Card, sign-out form. `<header>` removed; `name` folded into the existing narrow `driver_profiles` read; role gate + `auth.getUser()` + service-role read preserved verbatim.

## Decisions Made
- Did NOT edit `DigestPreferenceCard.tsx`: it already renders on the DS `Card` primitive (`rounded-md border border-grey/30 bg-white`), which is exactly the new warm-light chrome the plan specifies. A no-op chrome edit would only risk the NOTF-05 behaviour-verbatim guard. The plan's `files_modified` listed the file, but the analysis showed the restyle was already satisfied by Plan 01's DS migration — leaving it untouched is the safest path to the same visual outcome.
- Folded `driver_profiles.name` into the existing service-role digest `.select` (one query, same `auth.uid()` row-scope) rather than adding a second read.
- Sign-out uses `Button variant="ghost"` so it reads as a terminal/secondary control rather than competing with the teal primary CTA.

## Deviations from Plan
None affecting behaviour. The plan listed `DigestPreferenceCard.tsx` among modified files for a chrome restyle; it was left unmodified because the card already uses the correct DS `Card` chrome (documented under Decisions). All required outcomes (digest behaviour verbatim, new chrome) hold.

## Issues Encountered
None.

## Known Stubs
None — every Profile element is wired to real data (`auth.getUser()` identity, the narrow `driver_profiles` digest/name read, the live `LanguageToggle`, and the functional `signOutAction`).

## Threat Flags
None beyond the plan's `<threat_model>`. `signOutAction` is auth/session-only (T-11-14): standard `@supabase/ssr` sign-out via the caller-auth client, no schema/RLS/table/payload — it does not trip the schema/auth review gate beyond a normal sign-out. The identity header renders only the caller's OWN email/name from the verified session (T-11-15 accept). The digest read/write path is reused verbatim (T-11-16). No service-role client is exposed to a client component (T-11-17). No installs (T-11-SC).

## User Setup Required
None — no external service configuration. Functional UAT (end-of-phase): tap Sign out on the Profile tab → session cleared → land on `/sign-in`.

## Verification
- `npx tsc --noEmit` exits 0 (EN/BG `driverSignOutCta` parity).
- `npx vitest run app/driver` passes (4 files / 11 tests — digest/advance/claim behaviour untouched).
- Source assertions: identity from `auth.getUser()`; sign-out `<form action={signOutAction}>`; `LanguageToggle` row; `DigestPreferenceCard` still calls `saveDigestPreference`; no `earnings`/`rating`/`★`/avatar/file-input markup; no `<header>` block.

## Self-Check: PASSED
- FOUND: app/driver/settings/actions.ts (signOutAction)
- FOUND: app/driver/settings/page.tsx (rebuilt Profile)
- FOUND: commit f9e780a
- FOUND: commit 0077e69

---
*Phase: 11-driver-pwa-rebuild*
*Completed: 2026-06-22*
