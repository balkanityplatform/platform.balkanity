"use client";
// app/admin/properties/PropertyForm.tsx — create/edit property island (ONBD-02).
//
// Mirrors app/admin/companies/CompanyForm.tsx, adding the parent-company Select
// (ONBD-02 — a property is always created under a company). Reused for BOTH create
// and edit: when `property` is provided it renders an edit form (hidden id + the
// company is fixed → no Select; saveChanges CTA bound to updateProperty); otherwise a
// create form bound to createProperty with the required company picker. All copy is
// passed in from the server page (already dictionary-resolved → no flash). The coral
// error slot lives inside the shared TextField; a top-level generic save error renders
// below.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { Select } from "@/platform/ui/Select";
import { TextField } from "@/platform/ui/TextField";
import {
  type PropertyActionState,
  createProperty,
  updateProperty,
} from "./actions";

const initialState: PropertyActionState = { status: "idle" };

export type PropertyFormCopy = {
  propertyNameLabel: string;
  companyNameLabel: string;
  addPropertyCta: string;
  saveChangesCta: string;
  cancelCta: string;
  fieldRequired: string;
  saveFailed: string;
};

export function PropertyForm({
  property,
  companies,
  copy,
  onDone,
}: {
  property?: { id: string; name: string };
  // Eligible parent companies for the create picker.
  companies: { id: string; name: string }[];
  copy: PropertyFormCopy;
  onDone?: () => void;
}) {
  const isEdit = property !== undefined;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateProperty : createProperty,
    initialState,
  );

  // A required-field error maps to the inline TextField error; any other error is
  // a generic save failure shown once below the field. Both are dictionary-keyed.
  const fieldError =
    state.status === "error" && state.message === copy.fieldRequired
      ? copy.fieldRequired
      : undefined;
  const formError =
    state.status === "error" && state.message !== copy.fieldRequired
      ? state.message
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-[16px]">
      {isEdit ? <input type="hidden" name="id" value={property.id} /> : null}

      {/* Parent-company picker — create only (the parent is fixed once created). */}
      {!isEdit ? (
        <Select name="company_id" label={copy.companyNameLabel} required defaultValue="">
          <option value="" disabled>
            {copy.companyNameLabel}
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : null}

      <TextField
        name="name"
        label={copy.propertyNameLabel}
        defaultValue={property?.name ?? ""}
        required
        error={fieldError}
      />

      {formError ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-[8px]">
        <Button type="submit" disabled={pending}>
          {isEdit ? copy.saveChangesCta : copy.addPropertyCta}
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
