"use client";
// app/admin/properties/PropertiesView.tsx — Properties console view (ONBD-02).
//
// Mirrors app/admin/companies/CompaniesView.tsx: slate console chrome (reused from
// app/admin/page.tsx), the create form (with a parent-company Select), the DataList of
// properties (each row: name + parent company + active/inactive StatusDot + Edit /
// Deactivate ghost actions), and the empty state. Editing a row swaps its controls for
// an inline PropertyForm bound to updateProperty. Deactivation posts to the
// deactivateProperty action (D-12 enforced server-side). All copy is passed in from the
// server page (dictionary-resolved → no flash, PLAT-04).
import Image from "next/image";
import { useActionState, useState } from "react";
import { Button } from "@/platform/ui/Button";
import { DataList } from "@/platform/ui/DataList";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { type PropertyActionState, deactivateProperty } from "./actions";
import { PropertyForm } from "./PropertyForm";

type Property = {
  id: string;
  name: string;
  active: boolean;
  companyId: string;
  companyName: string;
};

const deactivateInitial: PropertyActionState = { status: "idle" };

// Inline deactivate control — its own useActionState so the (prev, formData) action
// signature works inside a <form action={...}> and a generic error (e.g. D-12 blocked)
// renders next to the row.
function DeactivateButton({ id, label }: { id: string; label: string }) {
  const [state, formAction, pending] = useActionState(
    deactivateProperty,
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

export type PropertiesViewCopy = {
  langToggle: string;
  propertiesTitle: string;
  propertiesEmptyHeading: string;
  propertiesEmptyBody: string;
  propertyNameLabel: string;
  companyNameLabel: string;
  addPropertyCta: string;
  saveChangesCta: string;
  cancelCta: string;
  editCta: string;
  deactivateConfirmCta: string;
  activeLabel: string;
  inactiveLabel: string;
  fieldRequired: string;
  saveFailed: string;
};

export function PropertiesView({
  properties,
  companies,
  lang,
  copy,
}: {
  properties: Property[];
  companies: { id: string; name: string }[];
  lang: "en" | "bg";
  copy: PropertiesViewCopy;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const formCopy = {
    propertyNameLabel: copy.propertyNameLabel,
    companyNameLabel: copy.companyNameLabel,
    addPropertyCta: copy.addPropertyCta,
    saveChangesCta: copy.saveChangesCta,
    cancelCta: copy.cancelCta,
    fieldRequired: copy.fieldRequired,
    saveFailed: copy.saveFailed,
  };

  const items = properties.map((p) => ({
    id: p.id,
    // The DataList renders a single primary label; surface the parent company beside
    // the property name so the hierarchy is legible (— Company).
    name: p.companyName ? `${p.name} — ${p.companyName}` : p.name,
    active: p.active,
    actions:
      editingId === p.id ? (
        <PropertyForm
          property={{ id: p.id, name: p.name }}
          companies={companies}
          copy={formCopy}
          onDone={() => setEditingId(null)}
        />
      ) : (
        <div className="flex items-center gap-[8px]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditingId(p.id)}
          >
            {copy.editCta}
          </Button>
          {p.active ? (
            <DeactivateButton id={p.id} label={copy.deactivateConfirmCta} />
          ) : null}
        </div>
      ),
  }));

  return (
    <main className="min-h-dvh bg-white">
      {/* Slate console chrome (reused from app/admin/page.tsx). */}
      <header className="flex items-center justify-between bg-slate px-[24px] py-[16px]">
        <span className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px]">
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </span>
        <LanguageToggle current={lang} label={copy.langToggle} className="text-white" />
      </header>

      <section className="mx-auto flex max-w-2xl flex-col gap-[32px] px-[24px] py-[48px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {copy.propertiesTitle}
        </h1>

        {/* Create form — available whenever there is at least one company to nest
            under (a property is always created under a parent company). */}
        {companies.length > 0 ? (
          <PropertyForm companies={companies} copy={formCopy} />
        ) : null}

        {properties.length === 0 ? (
          <div className="flex flex-col gap-[8px]">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
              {copy.propertiesEmptyHeading}
            </h2>
            <p className="text-[16px] leading-[1.5] text-grey">
              {copy.propertiesEmptyBody}
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
    </main>
  );
}
