# Phase 2: Supply-Side Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 2-Supply-Side Onboarding
**Areas discussed:** Driver invite flow, Pricing & commission, Slug behavior, Delete & lifecycle

---

## Driver Invite Flow

### Onboarding mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse admin set-password flow | Create auth user + `driver` app_users row + set-password link via existing flow | ✓ |
| Supabase inviteUserByEmail | Built-in admin invite API; different code path, trickier role timing | |
| Pre-create, driver self-sets later | Pre-create row + email allowlist self-signup | |

**User's choice:** Reuse admin set-password flow.

### Invite email
| Option | Description | Selected |
|--------|-------------|----------|
| Stub now, wire in Phase 7 | Generate link, no send; Resend wrapper in P7 | ✓ |
| Wire Resend now | Minimal send in P2; pulls notification infra forward | |

**User's choice:** Stub now, wire in Phase 7.

### Link delivery during pilot
| Option | Description | Selected |
|--------|-------------|----------|
| Show copyable link in console | Admin copies generated set-password link, sends manually | ✓ |
| Log link server-side only | Link only in server logs | |

**User's choice:** Show copyable link in console.

### Driver fields captured
| Option | Description | Selected |
|--------|-------------|----------|
| Email + name + phone | Capture name + phone now | ✓ |
| Email only | Minimal | |
| Email + name | Middle ground | |

**User's choice:** Email + name + phone.

---

## Pricing & Commission

### Commission model
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed amount per transfer | Flat money amount | |
| Percentage of price | % of destination price | ✓ |
| Admin picks per destination | Both fixed/% — doubles logic | |

**User's choice:** Percentage of price.

### "You keep" calculation
| Option | Description | Selected |
|--------|-------------|----------|
| Balkanity net before fees | price − commission | |
| Balkanity net after est. Stripe fee | price − commission − est fee | |
| Show both lines | commission + "you keep (before fees)" + est-fee note | ✓ |

**User's choice:** Show both lines.

### Currency
| Option | Description | Selected |
|--------|-------------|----------|
| EUR only | Matches EEA fee facts + euro adoption | ✓ |
| BGN only | Local but risks Phase 3 rework | |
| Defer — store minor units, label later | Currency-agnostic storage, label later | |

**User's choice:** EUR only (settlement currency still confirmed in Phase 3).

---

## Slug Behavior

### Slug source
| Option | Description | Selected |
|--------|-------------|----------|
| Auto from label, admin can override | Slugify label, editable field | ✓ |
| Admin types it manually | Always hand-entered | |
| Fully auto, not shown | Generated, never shown | |

**User's choice:** Auto from label, admin can override.

### Uniqueness scope
| Option | Description | Selected |
|--------|-------------|----------|
| Globally unique | One destination per slug platform-wide | ✓ |
| Unique per property | Needs property context in URL | |

**User's choice:** Globally unique.

### Editability
| Option | Description | Selected |
|--------|-------------|----------|
| Editable with a warning | Can change; UI warns links break | ✓ |
| Locked after creation | Immutable | |
| Editable until first booking | Locked once a transfer exists | |

**User's choice:** Editable with a warning.

---

## Delete & Lifecycle

### Removal model
| Option | Description | Selected |
|--------|-------------|----------|
| Deactivate only (soft) | active flag only, no hard delete | |
| Soft + hard-delete if unused | Deactivate; true delete only when no children/transfers | ✓ |
| Hard delete with cascade | Real cascading deletes | |

**User's choice:** Soft + hard-delete if unused.

### Cascade on parent deactivation
| Option | Description | Selected |
|--------|-------------|----------|
| Cascade-deactivate children | Parent off → children effectively off | |
| Block if active children exist | Refuse until children deactivated (bottom-up) | ✓ |
| Independent flags | Each level independent | |

**User's choice:** Block if active children exist.

---

## Claude's Discretion

- Console layout / information architecture for the company→property→destination hierarchy.
- Storage location for driver name/phone (extend `app_users` vs separate platform-generic profile table; no `wp_` prefix).
- Percentage rounding/precision + input validation specifics.
- Admin-only RLS policy shape (reuse Phase 1 pattern).
- Slugify implementation + collision-suffix strategy.

## Deferred Ideas

- Wired Resend invite email → Phase 7 (NOTF-04).
- Fixed-amount / hybrid commission models (% chosen for v1).
- "You keep" net-of-actual-fee (estimate note only in v1; precise accounting in Phase 3).
- Property/company self-service portal → v2 (GROW-01).
- Driver pool / my-run / driver self-edit of profile → Phase 6.
