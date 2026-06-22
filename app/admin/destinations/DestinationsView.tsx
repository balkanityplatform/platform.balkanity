"use client";
// app/admin/destinations/DestinationsView.tsx — Destinations console view (ONBD-03/04).
//
// Mirrors app/admin/properties/PropertiesView.tsx: the create form (with a parent-property
// Select + slug + pricing), the DataList of destinations (each row: label + slug + parent
// property/company + price + active/inactive StatusDot + Edit / Deactivate ghost actions),
// and the empty state. Editing a row swaps its controls for an inline DestinationForm bound
// to updateDestination. Deactivation posts to the deactivateDestination action (destinations
// are leaves — D-11: an inactive destination simply stops resolving its /pickup link).
// All copy is passed in from the server page (dictionary-resolved → no flash, PLAT-04).
//
// The slate console chrome (sidebar + top bar + bell + LanguageToggle) is owned by
// app/admin/layout.tsx (Plan 01) — this view renders NO <header> of its own.
import { useActionState, useState } from "react";
import { fmtEur } from "@/platform/money/commission";
import { Button } from "@/platform/ui/Button";
import { DataList } from "@/platform/ui/DataList";
import { type DestinationActionState, deactivateDestination } from "./actions";
import { CopyBookingLink } from "./CopyBookingLink";
import { DestinationForm, type DestinationFormCopy } from "./DestinationForm";

type Destination = {
  id: string;
  slug: string;
  label: string;
  active: boolean;
  priceCents: number;
  commissionPct: number;
  propertyId: string;
  propertyName: string;
  companyName: string;
};

const deactivateInitial: DestinationActionState = { status: "idle" };

// Inline deactivate control — its own useActionState so the (prev, formData) action
// signature works inside a <form action={...}> and a generic error renders next to it.
function DeactivateButton({ id, label }: { id: string; label: string }) {
  const [state, formAction, pending] = useActionState(
    deactivateDestination,
    deactivateInitial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[4px]">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" disabled={pending}>
        {label}
      </Button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export type DestinationsViewCopy = DestinationFormCopy & {
  destinationsTitle: string;
  destinationsEmptyHeading: string;
  destinationsEmptyBody: string;
  editCta: string;
  deactivateConfirmCta: string;
  activeLabel: string;
  inactiveLabel: string;
  copyBookingLinkCta: string;
  bookingLinkCopiedLabel: string;
};

export function DestinationsView({
  destinations,
  properties,
  copy,
}: {
  destinations: Destination[];
  properties: { id: string; name: string }[];
  copy: DestinationsViewCopy;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const formCopy: DestinationFormCopy = {
    destinationLabelLabel: copy.destinationLabelLabel,
    slugLabel: copy.slugLabel,
    addressLabel: copy.addressLabel,
    zoneLabel: copy.zoneLabel,
    airportLabel: copy.airportLabel,
    priceLabel: copy.priceLabel,
    commissionPctLabel: copy.commissionPctLabel,
    propertyNameLabel: copy.propertyNameLabel,
    saveDestinationCta: copy.saveDestinationCta,
    saveChangesCta: copy.saveChangesCta,
    cancelCta: copy.cancelCta,
    fieldRequired: copy.fieldRequired,
    saveFailed: copy.saveFailed,
    slugInvalid: copy.slugInvalid,
    slugTaken: copy.slugTaken,
    commissionRange: copy.commissionRange,
    slugEditWarning: copy.slugEditWarning,
    youKeepCommissionLine: copy.youKeepCommissionLine,
    youKeepNetLine: copy.youKeepNetLine,
    youKeepFeeNote: copy.youKeepFeeNote,
  };

  const items = destinations.map((d) => {
    // Surface slug + parent property/company + price beside the label so the
    // three-level hierarchy and the bookable link are legible in the single-label row.
    const parent = d.companyName
      ? `${d.propertyName} — ${d.companyName}`
      : d.propertyName;
    // For active rows the full public booking URL is shown by CopyBookingLink in the
    // actions slot, so the bare relative `/<slug>` token would be redundant/misleading —
    // drop it there. Inactive rows keep it as the only slug reference (no live link, D-11).
    const meta = [d.active ? null : `/${d.slug}`, parent, `€${fmtEur(d.priceCents)}`]
      .filter(Boolean)
      .join(" · ");
    return {
      id: d.id,
      name: `${d.label} · ${meta}`,
      active: d.active,
      actions:
        editingId === d.id ? (
          <DestinationForm
            destination={{
              id: d.id,
              slug: d.slug,
              label: d.label,
              priceCents: d.priceCents,
              commissionPct: d.commissionPct,
            }}
            properties={properties}
            copy={formCopy}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <div className="flex items-center gap-[8px]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditingId(d.id)}
            >
              {copy.editCta}
            </Button>
            {d.active ? (
              <DeactivateButton id={d.id} label={copy.deactivateConfirmCta} />
            ) : null}
          </div>
        ),
      // Active rows only: the full public booking URL + Copy button on its own
      // full-width line (D-11 — inactive destinations stop resolving /pickup, so
      // no live link). Hidden while editing so the row isn't doubled up.
      subRow:
        d.active && editingId !== d.id ? (
          <CopyBookingLink
            slug={d.slug}
            copyCta={copy.copyBookingLinkCta}
            copiedLabel={copy.bookingLinkCopiedLabel}
          />
        ) : undefined,
    };
  });

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-[32px] px-[24px] py-[48px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {copy.destinationsTitle}
        </h1>

        {/* Create form — available whenever there is at least one active property to
            nest under (a destination is always created under a property). */}
        {properties.length > 0 ? (
          <DestinationForm properties={properties} copy={formCopy} />
        ) : null}

        {destinations.length === 0 ? (
          <div className="flex flex-col gap-[8px]">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
              {copy.destinationsEmptyHeading}
            </h2>
            <p className="text-[16px] leading-[1.5] text-grey">
              {copy.destinationsEmptyBody}
            </p>
          </div>
        ) : (
          <DataList
            items={items}
            activeLabel={copy.activeLabel}
            inactiveLabel={copy.inactiveLabel}
          />
        )}
    </section>
  );
}
