# Phase 9: Design System Foundation - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 8 (3 modified, 4 new, 1 new dev route)
**Analogs found:** 8 / 8 (every deliverable has a same-repo analog)

This is a presentation-only phase. All work lives in `app/globals.css`, `platform/ui/`, `platform/transfers/lifecycle.ts`, `platform/i18n/`, and a dev-only `app/` route. Every analog is in-repo — the planner should treat "consume, don't re-implement" / "Don't-Hand-Roll (T-04-02)" as the governing rule.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/globals.css` (modify) | config (design tokens) | transform (CSS-first `@theme`) | same file's existing `@theme` block | exact (extend self) |
| `platform/ui/StatusDot.tsx` (modify) | component | transform (state→view) | self + `Button.tsx` variant pattern | exact |
| `platform/ui/StatusDot.test.tsx` (modify) | test | — | self (existing test) | exact |
| `platform/transfers/lifecycle.ts` (modify) | utility (const/source-of-truth) | transform | self (`LIFECYCLE_ORDER`) | exact |
| `platform/ui/LifecycleStepper.tsx` (NEW) | component | transform (state→view) | `LifecycleTimeline.tsx` | role + flow match (vertical→horizontal) |
| `platform/ui/RouteMotif.tsx` (NEW) | component | transform (props→view) | `Button.tsx` / `Card.tsx` (prop conventions) + `transfers.svg` | role match |
| `app/dev/design-system/page.tsx` (NEW) | route/page | request-response (SSR) | `app/admin/page.tsx` | role match |
| `platform/i18n/en.ts` + `bg.ts` (modify) | config (dictionary) | — | existing dictionary entries | exact |

---

## Pattern Assignments

### `app/globals.css` (config, DS-01)

**Analog:** the existing `@theme` block in the same file (lines 7-18).

**Established convention — extend, never redefine, the primary:**
```css
@theme {
  --color-teal: #029b87; /* primary / actions / links / claimed */
  --color-teal2: #047982;
  --color-amber: #febe21;
  --color-coral: #e44b4b;
  --color-slate: #2f4858;
  --color-grey: #66676f;
  --color-white: #ffffff;
  --font-sans: var(--font-montserrat), "Montserrat", ui-sans-serif, system-ui, sans-serif;
}
```

**What to ADD inside the same `@theme` block (D-01):**
- `--radius-sm: 0.25rem;` `--radius: 0.5rem;` (DEFAULT 8px) `--radius-md: 0.75rem;` `--radius-lg: 1rem;` `--radius-xl: 1.5rem;` `--radius-full: 9999px;`
- spacing aliases: `--spacing-touch-target: 44px;` `--spacing-cta-height: 52px;` plus 8px-grid aliases (base 8, gutters 16/32). Tailwind v4 generates `rounded-*` / `p-*` / `gap-*` utilities from `--radius-*` / `--spacing-*` automatically.
- typography role tokens for the 4 roles (display/heading/body/label). Use `--text-*` (Tailwind v4 reads `--text-<name>` to generate `text-<name>` plus paired line-height) so surfaces write `text-heading` not `text-[24px]`.

**Constraints (verified against current file):** primary is already `#029b87`; **no `#00685a` present** (confirmed — none in file); **no `tailwind.config.js`** exists in repo — do not introduce one (locked, CLAUDE.md + ROADMAP DS-01). Montserrat already wired via `--font-sans`. Hex casing in-file is lowercase — match it.

---

### `platform/ui/StatusDot.tsx` (component, DS-02)

**Analog:** itself (full file, 52 lines) for the authoritative `TransferState` union + `STATE_META` map; **`Button.tsx` for the `variant`-prop pattern**.

**Existing map to keep as the single source (lines 21-33)** — note `cancelled: { colorClass: "bg-coral", ... }` is the line that changes to a hollow ring:
```typescript
const STATE_META: Record<TransferState, { colorClass: string; label: string }> = {
  requested: { colorClass: "bg-grey", label: "Requested" },
  paid:      { colorClass: "bg-teal2", label: "Paid" },
  claimed:   { colorClass: "bg-teal", label: "Claimed" },
  en_route:  { colorClass: "bg-amber", label: "En route" },
  arrived:   { colorClass: "bg-amber", label: "Arrived" },
  picked_up: { colorClass: "bg-teal", label: "Picked up" },
  completed: { colorClass: "bg-grey", label: "Completed" },
  cancelled: { colorClass: "bg-coral", label: "Cancelled" },
};
```

**Variant-prop pattern to copy from `Button.tsx` (lines 12-37)** — exported union type + `Record<Variant, string>` + defaulted prop:
```typescript
export type ButtonVariant = "primary" | "ghost";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; };
const VARIANTS: Record<ButtonVariant, string> = { primary: "bg-teal text-white", ghost: "..." };
export function Button({ variant = "primary", ... }) { ... }
```

**Apply to StatusDot:** add `variant?: "dot" | "pill"` defaulting to `"dot"` so all existing callers (`LifecycleTimeline`, every Phase 2-8 surface) stay unchanged.
- `"dot"`: keep the exact current render (lines 38-51): `inline-flex items-center gap-[4px]` + 10px `rounded-full` dot (`aria-hidden`, `data-testid="status-dot"`) + 14px/600 slate label.
- `"pill"`: solid filled badge (e.g. coral "Unclaimed").
- **cancelled treatment (D-04, the one behavioural change):** hollow coral ring — 2px stroke, transparent fill (`border-2 border-coral bg-transparent`) in BOTH variants. Keep the always-present worded label (WCAG 1.4.1).

**Preserve:** `data-testid="status-dot"` and `aria-hidden="true"` on the shape (the test queries them).

---

### `platform/ui/StatusDot.test.tsx` (test, D-12)

**Analog:** itself (full file, 46 lines). Reuse the `CASES` table + `it.each` structure.

```typescript
const CASES: Array<{ state: TransferState; label: string; colorClass: string }> = [ ... ];
describe("StatusDot", () => {
  it.each(CASES)("renders a non-empty text label for %s ...", ({ state, label }) => { ... });
  it.each(CASES)("maps %s to the correct token colour class", ({ state, colorClass }) => {
    const { container } = render(<StatusDot state={state} />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass(colorClass);
  });
});
```
**Extend:** add cases that render each variant (`variant="pill"`); assert the cancelled hollow-ring class (`border-coral`) instead of `bg-coral`; assert the label still renders in both variants. Imports: `@testing-library/react` + `vitest` (`describe/expect/it`).

---

### `platform/transfers/lifecycle.ts` (utility, D-06)

**Analog:** the existing `LIFECYCLE_ORDER` export (lines 50-58) in the same file.

```typescript
export const LIFECYCLE_ORDER: readonly TransferState[] = [
  "requested", "paid", "claimed", "en_route", "arrived", "picked_up", "completed",
];
```

**Add (do NOT modify `LIFECYCLE_ORDER` or `ALLOWED_TRANSITIONS`):** a new sibling export — 6 steps, starting at `paid`, dropping `requested`:
```typescript
export const STEPPER_ORDER: readonly TransferState[] = [
  "paid", "claimed", "en_route", "arrived", "picked_up", "completed",
];
```
Keep the file's documented rule: `cancelled` is excluded from any happy-path array (rendered as a distinct terminal treatment by the consumer). The state union stays imported from `StatusDot` — declare no local enum (Don't-Hand-Roll lock, file header lines 14-16). The stepper component must consume this const, never hand-roll its own array (D-06).

---

### `platform/ui/LifecycleStepper.tsx` (NEW component, DS-04)

**Analog:** `platform/ui/LifecycleTimeline.tsx` (full file, 68 lines). Reuse its consumption pattern exactly; build a horizontal renderer instead of the vertical `<ol>`.

**Consumption pattern to replicate (lines 16-33):**
```typescript
import { LIFECYCLE_ORDER } from "@/platform/transfers/lifecycle";
import { StatusDot, type TransferState } from "@/platform/ui/StatusDot";

function orderIndex(state: TransferState): number { return LIFECYCLE_ORDER.indexOf(state); }

export function LifecycleTimeline({ current }: { current: TransferState }) {
  const currentIdx = orderIndex(current);
  const isCancelled = current === "cancelled";
  // map → past / current / future classification:
  const isCurrent = !isCancelled && state === current;
  const isFuture  = isCancelled || (currentIdx >= 0 && idx > currentIdx);
  // aria-current={isCurrent ? "step" : undefined}
```

**For the stepper, change:**
- import `STEPPER_ORDER` (not `LIFECYCLE_ORDER`) and iterate it; prop `{ current: TransferState }`.
- horizontal layout (e.g. `flex items-center` row with connector segments), not the vertical `flex flex-col gap-[16px]` `<ol>`.
- step shape encodes state beyond colour (D-07): completed = teal circle + white check; active = amber solid circle; pending = grey `#66676F` outline ring (`border border-grey`). Keep a worded step label per step (WCAG 1.4.1) — derive labels from `StatusDot`'s `STATE_META`, do not hand-roll a label array.
- **cancelled (D-08):** mirror `LifecycleTimeline`'s terminal handling (lines 56-65) — render a distinct terminal banner/badge (`StatusDot` cancelled hollow-ring + "Cancelled") **instead of** the 6-step track; do not wedge cancelled into the horizontal row.

---

### `platform/ui/RouteMotif.tsx` (NEW component, DS-03)

**Analog:** `Button.tsx` / `Card.tsx` for prop + export conventions; `transfers.svg` for the brand midpoint mark.

**Prop/export convention (from `Card.tsx` lines 6-19):**
```typescript
export type CardProps = HTMLAttributes<HTMLDivElement>;
export function Card({ className = "", children, ...rest }: CardProps) {
  return <div className={`rounded-md border border-grey/30 bg-white p-[24px] ${className}`} {...rest}>{children}</div>;
}
```

**Apply to RouteMotif (D-09/D-10):**
- props: `start` and `end`, each `{ icon: ReactNode; label: string }`, defaulting to Plane → Building. Surfaces pass their own (e.g. "SOF Airport" → property name).
- layout: `start` icon+label … connector line … **fixed midpoint Transfer Badge** … `end` icon+label, midpoint auto-centered.
- **midpoint = the real committed brand mark only** — `platform/ui/pictograms/transfers.svg` (teal circle + white two-arrow exchange, viewBox `0 0 85.1 85`). NEVER re-draw the logo or invent an infinity loop (STATE.md ASSET guardrail). There is currently **no existing component that imports a pictogram** — RouteMotif is the first; reference it via `next/image` (`import Image from "next/image"`, as `app/admin/page.tsx` line 9 does) or an inline `<img src="/...">`. NOTE: the SVGs live under `platform/ui/pictograms/`, not `public/`. The planner must decide the serving path (either move/copy the asset to `public/brand/` for `next/image`, or import the SVG as a React component). Flag this as the one delivery detail RouteMotif must resolve.
- where no brand asset exists for an endpoint (Plane), a simple 1.5px-stroke line pictogram is permitted (D-10) — author inline, do not invent a "brand" mark.
- the endpoint `label` strings are user-facing → route through i18n (see Shared Patterns) when used by surfaces; the component itself takes labels as props (surface supplies the translated string).

---

### `app/dev/design-system/page.tsx` (NEW route, D-11)

**Analog:** `app/admin/page.tsx` (Server Component page) + `app/page.tsx` for route file conventions.

**Server-Component page shape to copy (`app/admin/page.tsx` lines 9-30):**
```typescript
import { getDict, getLang } from "@/platform/i18n/dictionary";
export default async function AdminPage() {
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  return ( /* JSX */ );
}
```

**Apply:** a throwaway dev-only page rendering every Phase 9 deliverable across states — `StatusDot` × 8 states × {dot, pill}, `LifecycleStepper` at each `STEPPER_ORDER` state + cancelled, a `RouteMotif` sample, token swatches, the type scale. NOT linked from any user-facing nav. Place under a dev path (`app/dev/design-system/`). Any visible label strings go through the dictionary (Shared Patterns). No auth gate is required (it's a non-prod showcase) but keep it off all nav. `app/dev/` does not exist yet — this creates it.

---

## Shared Patterns

### Single Source of Truth / Don't-Hand-Roll (T-04-02)
**Source:** `platform/ui/StatusDot.tsx` (state union + `STATE_META` colour/label map), `platform/transfers/lifecycle.ts` (`LIFECYCLE_ORDER` / new `STEPPER_ORDER`).
**Apply to:** `LifecycleStepper` (import `STEPPER_ORDER` + reuse `StatusDot`/`STATE_META`), `StatusDot` variants (one map, two renderers), the dev showcase. No component declares a local state enum, colour map, or order array.

### Status = colour PLUS worded label (WCAG 1.4.1)
**Source:** `platform/ui/StatusDot.tsx` lines 39-50 — dot is `aria-hidden`, the 14px/600 slate label always renders.
**Apply to:** both `StatusDot` variants (incl. cancelled hollow ring) and every `LifecycleStepper` step. Never colour/shape alone.

### i18n dictionary parity gate (tsc-enforced)
**Source:** `platform/i18n/en.ts` (`Dict = typeof en`, plain typed object) + `platform/i18n/dictionary.ts` (`getDict()` / `getLang()` server-side, cookie-bound). `bg.ts` must satisfy the exact `en` shape or `tsc` fails.
**Apply to:** any user-facing string introduced this phase (showcase labels) — add the key to BOTH `en.ts` and `bg.ts`. Component-internal `StatusDot`/stepper labels currently live in `STATE_META` (English-only today); the planner should decide whether Phase 9 routes those through the dictionary or leaves them as-is (existing `StatusDot` does not use the dictionary — leaving them is consistent with the current pattern; only NEW showcase chrome strings strictly need keys).

### Component file conventions
**Source:** `Button.tsx` / `Card.tsx` — top-of-file comment explaining the brand rule + requirement IDs; named `export function`; `export type ...Props`; `className = ""` passthrough merged last; arbitrary-value Tailwind classes are the current norm but Phase 9 NEW components should prefer the new named tokens (`text-heading`, `rounded-lg`, `gap-touch-target`) per D-02.

---

## No Analog Found

None. Every deliverable maps to an in-repo analog. The single un-precedented mechanic is **importing/serving a pictogram SVG inside a React component** (no existing component does this) — covered under `RouteMotif` above; the planner must pick the serving strategy (`public/` + `next/image`, or SVG-as-component).

## Metadata

**Analog search scope:** `app/`, `platform/ui/`, `platform/ui/pictograms/`, `platform/transfers/`, `platform/i18n/`
**Files scanned:** `globals.css`, `StatusDot.tsx`, `StatusDot.test.tsx`, `LifecycleTimeline.tsx`, `lifecycle.ts`, `Button.tsx`, `Card.tsx`, `transfers.svg`, `pictograms/README.md`, `app/page.tsx`, `app/admin/page.tsx`, `i18n/en.ts`, `i18n/dictionary.ts`
**Pattern extraction date:** 2026-06-20
