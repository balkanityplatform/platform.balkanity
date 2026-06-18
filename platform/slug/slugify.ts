// platform/slug/slugify.ts — URL-safe slug primitives (ONBD-03, D-08).
//
// Pure, dependency-free string transforms shared by the destinations server
// action (Plan 04) and the admin form island. Hand-rolled per CLAUDE.md
// "simplest thing that works" — no slug library.
//
// IMPORTANT (Pitfall 2): `normalize("NFKD")` strips Latin diacritics but does NOT
// transliterate Cyrillic, so a fully-Cyrillic label slugifies to "". Callers must
// route the empty result through `nextSlugCandidate`, which falls back to "dest"
// so the editable slug field (D-08) lets the admin type a clean Latin slug.

/**
 * Convert an admin-typed label into a URL-safe slug.
 *
 * NFKD-normalises, strips combining marks, lower-cases, replaces every run of
 * non `[a-z0-9]` characters with a single hyphen, trims leading/trailing
 * hyphens, collapses repeated hyphens, and caps the length at 80 chars.
 * Returns "" for inputs with no Latin alphanumerics (e.g. Cyrillic-only labels).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-url-safe → hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-") // collapse runs
    .slice(0, 80);
}

/**
 * The nth slug candidate for the collision-suffix strategy.
 *
 * `n === 1` returns the base unchanged; `n > 1` appends `-n`. An empty base
 * falls back to "dest" so a Cyrillic-empty slug still yields a usable link
 * (Pitfall 2). The DB unique constraint remains the race-safe authority; this
 * helper only produces the next candidate the server action probes.
 */
export function nextSlugCandidate(base: string, n: number): string {
  const safeBase = base || "dest";
  return n <= 1 ? safeBase : `${safeBase}-${n}`;
}
