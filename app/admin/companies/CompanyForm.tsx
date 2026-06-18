"use client";
// app/admin/companies/CompanyForm.tsx — create/edit company island (ONBD-01).
//
// Thin client island holding the useActionState interactivity for a single field
// (company name). Reused for BOTH create and edit: when `company` is provided it
// renders an edit form (hidden id + saveChanges CTA bound to updateCompany);
// otherwise a create form bound to createCompany. All copy is passed in from the
// server page (already dictionary-resolved → no flash). The coral error slot lives
// inside the shared TextField; a top-level generic save error renders below.
import { useActionState } from "react";
import { Button } from "@/platform/ui/Button";
import { TextField } from "@/platform/ui/TextField";
import {
  type CompanyActionState,
  createCompany,
  updateCompany,
} from "./actions";

const initialState: CompanyActionState = { status: "idle" };

export type CompanyFormCopy = {
  companyNameLabel: string;
  createCompanyCta: string;
  saveChangesCta: string;
  cancelCta: string;
  fieldRequired: string;
  saveFailed: string;
};

export function CompanyForm({
  company,
  copy,
  onDone,
}: {
  company?: { id: string; name: string };
  copy: CompanyFormCopy;
  onDone?: () => void;
}) {
  const isEdit = company !== undefined;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateCompany : createCompany,
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
      {isEdit ? <input type="hidden" name="id" value={company.id} /> : null}

      <TextField
        name="name"
        label={copy.companyNameLabel}
        defaultValue={company?.name ?? ""}
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
          {isEdit ? copy.saveChangesCta : copy.createCompanyCta}
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
