# Phase 1: Platform Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 1-Platform Foundation
**Areas discussed:** Admin sign-in & bootstrap, EN/BG language behavior, PWA identity & offline shell, Design system seed & assets

---

## Admin sign-in & bootstrap

### How should the admin sign in?
| Option | Description | Selected |
|--------|-------------|----------|
| Magic link (passwordless) | Supabase magic link — same passwordless mechanism as guest status / driver invites; one auth pattern, no passwords | ✓ |
| Email + password | Classic credentials for admin only; adds a second auth pattern | |
| Magic link + optional password | Magic link now, password later; more surface area | |

**User's choice:** Magic link (passwordless)

### How does the first admin account come to exist?
| Option | Description | Selected |
|--------|-------------|----------|
| Env allowlist of admin emails | ADMIN_EMAILS env auto-assigns admin role on first sign-in | |
| Seed migration / manual SQL | Migration/SQL inserts owner email + admin role; auditable in VCS | ✓ |
| First-user-is-admin | Whoever signs in first becomes admin; unsafe for real-money pilot | |

**User's choice:** Seed migration / manual SQL
**Notes:** Rides the flagged first-migration gate (`app_users` + roles) — sign-off required before applying.

### What does an unauthenticated `/` show, and where do signed-in users land?
| Option | Description | Selected |
|--------|-------------|----------|
| Role-based redirect; / → admin login | Signed-in users route by role; unauthenticated / → admin sign-in; guests/drivers enter elsewhere | ✓ |
| Neutral platform landing page | Branded splash + sign-in link; throwaway page real users never see | |
| / is the admin console directly | Simplest routing but couples root to admin | |

**User's choice:** Role-based redirect; / → admin login

---

## EN/BG language behavior

### Default language and per-surface behavior?
| Option | Description | Selected |
|--------|-------------|----------|
| EN default, BG toggle | English default for international guests; BG one tap away; single default everywhere | ✓ |
| Per-surface: EN guest, BG staff | Guest EN, admin/driver BG; two default rules | |
| Auto-detect from browser | Accept-Language detection; can guess wrong, complicates SSR/caching | |

**User's choice:** EN default, BG toggle

### Persistence and string structure?
| Option | Description | Selected |
|--------|-------------|----------|
| Cookie + JSON dictionaries | Cookie persistence (SSR-readable, no flash); typed en.ts/bg.ts dictionaries; no i18n library | ✓ |
| localStorage + JSON dictionaries | Client-only storage; flash-of-wrong-language risk; can't drive SSR strings | |
| URL-prefixed locale (/en, /bg) | Locale in path; SEO-friendly but doubles routes, heavier than needed | |

**User's choice:** Cookie + JSON dictionaries

---

## PWA identity & offline shell

### Offline experience in Phase 1?
| Option | Description | Selected |
|--------|-------------|----------|
| App shell + offline fallback page | Precache shell + branded offline page; auth/booking/claim stay NetworkFirst | ✓ |
| Shell only, no fallback page | Installs/opens but shows browser default offline error | |
| Shell + cached read of last page | Useful offline but invites stale-auth/status hazard (Pitfall 12) | |

**User's choice:** App shell + offline fallback page

### Installed PWA identity?
| Option | Description | Selected |
|--------|-------------|----------|
| "Balkanity", teal theme, standalone | Name "Balkanity"; --teal #029B87 theme/splash; display standalone | ✓ |
| "Welcome Pickup", teal theme | Names install after the module, not the platform | |
| Let me specify exact values | User provides precise values | |

**User's choice:** "Balkanity", teal theme, standalone

---

## Design system seed & assets

### How to handle the missing assets/Mockups/PRDs?
| Option | Description | Selected |
|--------|-------------|----------|
| I'll add them to the repo now | User commits real assets + Mockups + PRDs before planning | ✓ |
| Placeholder now, swap later | Temporary wordmark/icons; swap before pilot; SC5 not truly met until swap | |
| You generate stand-in assets | Claude creates on-brand SVG placeholders; not the real brand assets | |

**User's choice:** I'll add them to the repo now
**Notes:** Recorded as a planning precondition / blocker (D-09). Researcher and planner must confirm assets exist and capture final paths before relying on them.

### Which shared components should Phase 1 build?
| Option | Description | Selected |
|--------|-------------|----------|
| Minimal proof set | Tokens + Montserrat + StatusDot + 52px Button + EN/BG toggle control only | ✓ |
| Starter kit | Also inputs, Card, layout shells now; risks rework before real usage known | |
| Tokens only | Tokens + fonts + assets, no components; underdelivers vs Success Criterion 5 | |

**User's choice:** Minimal proof set

---

## Claude's Discretion

- Exact seam directory layout (`platform/` + `modules/welcome-pickup/` vs `src/...`)
- Server-side role storage/resolution mechanics
- Serwist precache manifest contents
- `middleware.ts` session-refresh implementation
- What the admin console renders post-login in Phase 1 (placeholder acceptable; onboarding is Phase 2)

## Deferred Ideas

- Optional admin password — rejected for v1 (magic link only)
- Per-surface language defaults (EN guest / BG staff) — single EN default chosen; revisit on pilot feedback
- Offline cached-read of last page — rejected (Pitfall 12)
- Broader component starter kit — built per-phase when first needed
- URL-prefixed locale (`/en`, `/bg`) — deferred, heavier than a v1 toggle needs
