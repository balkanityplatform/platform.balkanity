"use client";
// app/admin/destinations/DestinationForm.tsx — create/edit destination island (ONBD-03/04).
//
// Mirrors app/admin/properties/PropertyForm.tsx, adding the destination-specific fields:
//   - a parent-property Select (create only — the parent is fixed once created, D-08);
//   - an EDITABLE slug TextField that LIVE-fills from slugify(label) as the label changes
//     (D-08) and validates URL-safe on blur (slugInvalid). In EDIT mode the slug is left
//     untouched by the auto-fill (it already has a stored value); changing it surfaces the
//     coral "breaks shared links" warning (D-10);
//   - address / zone / airport text fields;
//   - a price (EUR-entered) + commission-% pair driving a LIVE "you keep" panel (D-06):
//     commission amount, net before fees, and the estimated Stripe-fee note — all derived
//     from the pure platform/money/commission utils, DISPLAY-ONLY, never persisted.
//
// On submit the EUR price is converted to integer cents (Math.round(price*100)) and the
// commission is sent as a whole percent. All copy is passed in from the server page
// (already dictionary-resolved → no flash). Server actions live in actions.ts (Task 2).
import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  commissionCents,
  estStripeFeeCents,
  fmtEur,
  netCents,
} from "@/platform/money/commission";
import { slugify } from "@/platform/slug/slugify";
import { Button } from "@/platform/ui/Button";
import { Select } from "@/platform/ui/Select";
import { TextField } from "@/platform/ui/TextField";
import {
  type DestinationActionState,
  createDestination,
  updateDestination,
} from "./actions";

const initialState: DestinationActionState = { status: "idle" };

const SLUG_RE = /^[a-z0-9-]+$/;

export type Destination = {
  id: string;
  slug: string;
  label: string;
  priceCents: number;
  commissionPct: number;
  address?: string;
  zone?: string;
  airport?: string;
};

export type DestinationFormCopy = {
  destinationLabelLabel: string;
  slugLabel: string;
  addressLabel: string;
  zoneLabel: string;
  airportLabel: string;
  priceLabel: string;
  commissionPctLabel: string;
  propertyNameLabel: string;
  saveDestinationCta: string;
  saveChangesCta: string;
  cancelCta: string;
  fieldRequired: string;
  saveFailed: string;
  slugInvalid: string;
  slugTaken: string;
  commissionRange: string;
  slugEditWarning: string;
  youKeepCommissionLine: string;
  youKeepNetLine: string;
  youKeepFeeNote: string;
};

// Interpolate the {pct}/{amount} tokens in a "you keep" copy line (UI-SPEC line 137-152).
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

export function DestinationForm({
  destination,
  properties,
  copy,
  onDone,
}: {
  destination?: Destination;
  // Eligible parent properties for the create picker.
  properties: { id: string; name: string }[];
  copy: DestinationFormCopy;
  onDone?: () => void;
}) {
  const isEdit = destination !== undefined;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateDestination : createDestination,
    initialState,
  );

  // Controlled label + slug: the slug LIVE-fills from the label until the admin edits
  // it (then it holds the typed value). In EDIT mode it starts from the stored slug.
  const [label, setLabel] = useState(destination?.label ?? "");
  const [slug, setSlug] = useState(destination?.slug ?? "");
  const [slugDirty, setSlugDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Live "you keep" inputs (EUR string + whole %).
  const [price, setPrice] = useState(
    destination ? fmtEur(destination.priceCents) : "",
  );
  const [pct, setPct] = useState(
    destination ? String(destination.commissionPct) : "",
  );

  const handleLabel = (value: string) => {
    setLabel(value);
    // Auto-fill the slug from the label only while the admin hasn't hand-edited it
    // (D-08). Once they type into the slug field, their value wins.
    if (!slugDirty) {
      setSlug(slugify(value));
    }
  };

  // The slug is "invalid" only once touched and non-empty-but-not-url-safe.
  const slugLooksInvalid =
    slugTouched && slug.length > 0 && !SLUG_RE.test(slug);

  // D-10: in EDIT mode, warn when the slug differs from the stored one.
  const showSlugWarning =
    isEdit && destination !== undefined && slug !== destination.slug;

  // Live "you keep" recompute (D-06) — display only, integer cents internally.
  const youKeep = useMemo(() => {
    const priceCents = Math.round((parseFloat(price) || 0) * 100);
    const pctNum = Number.parseInt(pct, 10);
    const safePct = Number.isFinite(pctNum) ? pctNum : 0;
    if (priceCents <= 0) return null;
    return {
      pct: String(safePct),
      commission: fmtEur(commissionCents(priceCents, safePct)),
      net: fmtEur(netCents(priceCents, safePct)),
      // estStripeFeeCents is referenced so the fee math stays wired (note copy is
      // static per UI-SPEC, but recompute keeps it alongside the live panel).
      fee: fmtEur(estStripeFeeCents(priceCents)),
    };
  }, [price, pct]);

  // A required-field error maps near the fields; the slug/commission/save errors are
  // dictionary-keyed and shown in the generic slot. Both come from the server action.
  const fieldError =
    state.status === "error" && state.message === copy.fieldRequired
      ? copy.fieldRequired
      : undefined;
  const slugServerError =
    state.status === "error" &&
    (state.message === copy.slugTaken || state.message === copy.slugInvalid)
      ? state.message
      : undefined;
  const formError =
    state.status === "error" &&
    state.message !== copy.fieldRequired &&
    state.message !== copy.slugTaken &&
    state.message !== copy.slugInvalid
      ? state.message
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      {isEdit ? <input type="hidden" name="id" value={destination.id} /> : null}

      {/* Parent-property picker — create only (the parent is fixed once created). */}
      {!isEdit ? (
        <Select
          name="property_id"
          label={copy.propertyNameLabel}
          required
          defaultValue=""
        >
          <option value="" disabled>
            {copy.propertyNameLabel}
          </option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      ) : null}

      <TextField
        name="label"
        label={copy.destinationLabelLabel}
        value={label}
        onChange={(e) => handleLabel(e.target.value)}
        required
        error={fieldError}
      />

      <TextField
        name="slug"
        label={copy.slugLabel}
        value={slug}
        onChange={(e) => {
          setSlugDirty(true);
          setSlug(e.target.value);
        }}
        onBlur={() => setSlugTouched(true)}
        required
        error={slugLooksInvalid ? copy.slugInvalid : slugServerError}
      />

      {/* D-10 — editing a slug breaks already-shared /pickup links. */}
      {showSlugWarning ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {copy.slugEditWarning}
        </p>
      ) : null}

      <TextField name="address" label={copy.addressLabel} defaultValue={destination?.address ?? ""} />
      <TextField name="zone" label={copy.zoneLabel} defaultValue={destination?.zone ?? ""} />
      <TextField name="airport" label={copy.airportLabel} defaultValue={destination?.airport ?? ""} />

      <TextField
        name="price"
        label={copy.priceLabel}
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />
      <TextField
        name="commission_pct"
        label={copy.commissionPctLabel}
        inputMode="numeric"
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        required
      />

      {/* "You keep" panel (D-06) — live recompute, display-only, never persisted. */}
      {youKeep ? (
        <div
          data-testid="you-keep-panel"
          className="flex flex-col gap-[4px] rounded-md border border-grey/30 bg-white p-[16px]"
        >
          <p data-testid="you-keep-commission" className="text-[14px] leading-[1.5] text-slate">
            {fill(copy.youKeepCommissionLine, {
              pct: youKeep.pct,
              amount: youKeep.commission,
            })}
          </p>
          <p
            data-testid="you-keep-net"
            className="text-[16px] font-semibold leading-[1.5] text-slate"
          >
            {fill(copy.youKeepNetLine, { amount: youKeep.net })}
          </p>
          <p data-testid="you-keep-fee-note" className="text-[14px] leading-[1.5] text-grey">
            {copy.youKeepFeeNote}
          </p>
        </div>
      ) : null}

      {formError ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-[8px]">
        <Button type="submit" disabled={pending}>
          {isEdit ? copy.saveChangesCta : copy.saveDestinationCta}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {copy.cancelCta}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
