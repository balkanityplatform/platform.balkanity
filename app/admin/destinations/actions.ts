"use server";
// app/admin/destinations/actions.ts — Destinations CRUD mutations (ONBD-03/04).
//
// Mirrors app/admin/properties/actions.ts. Every mutation crosses an untrusted
// FormData → server boundary, so each one:
//   1. RE-GATES the caller with getCurrentRole() !== "admin" (threat T-02-EOP4) —
//      the service-role client below BYPASSES RLS, so this in-action role check is
//      the only authorization gate on writes.
//   2. Validates input with a zod schema at the trust boundary (threat T-02-TMP5 /
//      T-02-TMP6 / T-02-V5c): property_id uuid, non-empty label, a URL-safe slug
//      (^[a-z0-9-]+$ → slugInvalid; also re-slugified server-side and rejected if
//      empty), integer price_cents >= 0, and a whole-percent commission 0–100
//      (commissionRange). Generic, dictionary-keyed errors only; no provider leak.
//   3. Writes via createAdminClient() (service-role) because the supply tables have
//      NO anon/authenticated write policy (migration 0002).
//
// Slug uniqueness (D-09): the DB `destinations_slug_key` unique index is the race-safe
// authority. On create we probe the nextSlugCandidate suffix chain off the slugify()
// base, but ALWAYS catch Postgres `23505` → slugTaken (the index wins under concurrency).
// deactivateDestination just sets active=false (destinations are leaves — no child
// check; an inactive destination stops resolving its /pickup link, D-11). deleteDestination
// hard-deletes (no transfers exist until Phase 4; the future wp_transfers FK on delete
// restrict is the Phase-4 backstop).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict } from "@/platform/i18n/dictionary";
import { nextSlugCandidate, slugify } from "@/platform/slug/slugify";
import { createAdminClient } from "@/platform/supabase/admin";

export type DestinationActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

// Postgres unique-violation (the destinations_slug_key index) — the authority on
// slug collisions under concurrency (D-09).
const UNIQUE_VIOLATION = "23505";
const SLUG_RE = /^[a-z0-9-]+$/;

// A destination: property_id (parent FK) + label + URL-safe slug + optional address/
// zone/airport text + integer price_cents + whole-percent commission 0–100.
const createSchema = z.object({
  property_id: z.string().uuid(),
  label: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  address: z.string().trim().optional(),
  zone: z.string().trim().optional(),
  airport: z.string().trim().optional(),
  price_cents: z.number().int().min(0),
  commission_pct: z.number().int().min(0).max(100),
});

// Edit keeps the parent fixed (mirrors updateProperty — the FK is set once at create).
const updateSchema = z.object({
  label: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  address: z.string().trim().optional(),
  zone: z.string().trim().optional(),
  airport: z.string().trim().optional(),
  price_cents: z.number().int().min(0),
  commission_pct: z.number().int().min(0).max(100),
});

// Parse the EUR price string into integer cents; NaN/empty → null (rejected upstream).
function eurToCents(raw: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Parse the whole-percent commission; non-integer/empty → null (rejected upstream).
function toInt(raw: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

export async function createDestination(
  _prev: DestinationActionState,
  formData: FormData,
): Promise<DestinationActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const priceCents = eurToCents(formData.get("price"));
  const pct = toInt(formData.get("commission_pct"));

  const parsed = createSchema.safeParse({
    property_id: formData.get("property_id"),
    label: formData.get("label"),
    slug: formData.get("slug"),
    address: formData.get("address") || undefined,
    zone: formData.get("zone") || undefined,
    airport: formData.get("airport") || undefined,
    price_cents: priceCents,
    commission_pct: pct,
  });
  if (!parsed.success) {
    // Differentiate the most actionable boundary errors; everything else is generic.
    const issues = parsed.error.issues;
    if (issues.some((i) => i.path[0] === "slug")) {
      return { status: "error", message: t.slugInvalid };
    }
    if (issues.some((i) => i.path[0] === "commission_pct")) {
      return { status: "error", message: t.commissionRange };
    }
    return { status: "error", message: t.fieldRequired };
  }

  // Server-side normalisation guard: if the admin-typed slug is non-URL-safe once
  // re-slugified (e.g. a Cyrillic-only label slugged to ""), reject (Pitfall 2).
  const base = slugify(parsed.data.slug);
  if (!base) {
    return { status: "error", message: t.slugInvalid };
  }

  const admin = createAdminClient();

  // Probe the nextSlugCandidate suffix chain off the slugify() base; the DB unique
  // index is the race-safe authority (catch 23505 → slugTaken). A small bound keeps
  // the optimistic probe from looping; the catch handles the true collision.
  let lastError: { code?: string } | null = null;
  for (let n = 1; n <= 50; n += 1) {
    const candidate = n === 1 ? parsed.data.slug : nextSlugCandidate(base, n);
    const { error } = await admin.from("destinations").insert({
      property_id: parsed.data.property_id,
      label: parsed.data.label,
      slug: candidate,
      address: parsed.data.address ?? null,
      zone: parsed.data.zone ?? null,
      airport: parsed.data.airport ?? null,
      price_cents: parsed.data.price_cents,
      commission_pct: parsed.data.commission_pct,
      active: true,
    });

    if (!error) {
      revalidatePath("/admin/destinations");
      return { status: "success" };
    }

    lastError = error as { code?: string };
    // Only a unique-slug violation is retryable with the next candidate; any other
    // error is a generic save failure (no provider detail leaked).
    if (lastError.code !== UNIQUE_VIOLATION) {
      return { status: "error", message: t.saveFailed };
    }
    // The admin-typed slug (n === 1) collided → tell them; auto-suffix only when the
    // base itself is what we're iterating.
    if (n === 1) {
      // fall through to try suffixed candidates from the slugify base
      continue;
    }
  }

  // Exhausted the candidate window on repeated 23505 → the typed link is taken.
  return { status: "error", message: t.slugTaken };
}

export async function updateDestination(
  _prev: DestinationActionState,
  formData: FormData,
): Promise<DestinationActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const priceCents = eurToCents(formData.get("price"));
  const pct = toInt(formData.get("commission_pct"));

  const parsed = updateSchema.safeParse({
    label: formData.get("label"),
    slug: formData.get("slug"),
    address: formData.get("address") || undefined,
    zone: formData.get("zone") || undefined,
    airport: formData.get("airport") || undefined,
    price_cents: priceCents,
    commission_pct: pct,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues;
    if (issues.some((i) => i.path[0] === "slug")) {
      return { status: "error", message: t.slugInvalid };
    }
    if (issues.some((i) => i.path[0] === "commission_pct")) {
      return { status: "error", message: t.commissionRange };
    }
    return { status: "error", message: t.fieldRequired };
  }

  if (!slugify(parsed.data.slug)) {
    return { status: "error", message: t.slugInvalid };
  }

  const admin = createAdminClient();

  // Read the stored slug so we can skip the uniqueness check when it's unchanged.
  const { data: existing, error: readError } = await admin
    .from("destinations")
    .select("slug")
    .eq("id", id)
    .single();
  if (readError || !existing) {
    return { status: "error", message: t.saveFailed };
  }

  const { error } = await admin
    .from("destinations")
    .update({
      label: parsed.data.label,
      slug: parsed.data.slug,
      address: parsed.data.address ?? null,
      zone: parsed.data.zone ?? null,
      airport: parsed.data.airport ?? null,
      price_cents: parsed.data.price_cents,
      commission_pct: parsed.data.commission_pct,
    })
    .eq("id", id);

  if (error) {
    // A changed-slug collision surfaces as the unique-index violation (D-09 authority).
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return { status: "error", message: t.slugTaken };
    }
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/destinations");
  return { status: "success" };
}

export async function deactivateDestination(
  _prev: DestinationActionState,
  formData: FormData,
): Promise<DestinationActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // Destinations are leaves — no child check (D-11). An inactive destination simply
  // stops resolving its /pickup link (Phase 4 reads active=true).
  const { error } = await admin
    .from("destinations")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/destinations");
  return { status: "success" };
}

export async function deleteDestination(
  _prev: DestinationActionState,
  formData: FormData,
): Promise<DestinationActionState> {
  const t = await getDict();

  if ((await getCurrentRole()) !== "admin") {
    return { status: "error", message: t.saveFailed };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: t.saveFailed };
  }

  const admin = createAdminClient();

  // Hard delete — no transfers exist until Phase 4. The future wp_transfers FK
  // `on delete restrict` is the Phase-4 integrity backstop.
  const { error } = await admin.from("destinations").delete().eq("id", id);

  if (error) {
    return { status: "error", message: t.saveFailed };
  }

  revalidatePath("/admin/destinations");
  return { status: "success" };
}
