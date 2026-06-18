"use client";
// app/admin/companies/CompaniesView.tsx — Companies console view (ONBD-01).
//
// Client view rendering the slate console chrome (reused from app/admin/page.tsx),
// the create form, the DataList of companies (each row: name + active/inactive
// StatusDot indicator via DataList + Edit / Deactivate ghost actions), and the
// empty state when there are zero companies. Editing a row swaps that row's
// controls for an inline CompanyForm bound to updateCompany. Deactivation posts to
// the deactivateCompany action (D-12 enforced server-side). All copy is passed in
// from the server page (dictionary-resolved → no flash, PLAT-04).
import Image from "next/image";
import { useActionState, useState } from "react";
import { Button } from "@/platform/ui/Button";
import { DataList } from "@/platform/ui/DataList";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import {
  type CompanyActionState,
  deactivateCompany,
} from "./actions";
import { CompanyForm } from "./CompanyForm";

type Company = { id: string; name: string; active: boolean };

const deactivateInitial: CompanyActionState = { status: "idle" };

// Inline deactivate control — its own useActionState so the (prev, formData)
// action signature works inside a <form action={...}> and a generic error
// (e.g. D-12 blocked) renders next to the row.
function DeactivateButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    deactivateCompany,
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

export type CompaniesViewCopy = {
  langToggle: string;
  companiesTitle: string;
  companiesEmptyHeading: string;
  companiesEmptyBody: string;
  companyNameLabel: string;
  createCompanyCta: string;
  saveChangesCta: string;
  cancelCta: string;
  editCta: string;
  deactivateConfirmCta: string;
  activeLabel: string;
  inactiveLabel: string;
  fieldRequired: string;
  saveFailed: string;
};

export function CompaniesView({
  companies,
  lang,
  copy,
}: {
  companies: Company[];
  lang: "en" | "bg";
  copy: CompaniesViewCopy;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const formCopy = {
    companyNameLabel: copy.companyNameLabel,
    createCompanyCta: copy.createCompanyCta,
    saveChangesCta: copy.saveChangesCta,
    cancelCta: copy.cancelCta,
    fieldRequired: copy.fieldRequired,
    saveFailed: copy.saveFailed,
  };

  const items = companies.map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    actions:
      editingId === c.id ? (
        <CompanyForm
          company={{ id: c.id, name: c.name }}
          copy={formCopy}
          onDone={() => setEditingId(null)}
        />
      ) : (
        <div className="flex items-center gap-[8px]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditingId(c.id)}
          >
            {copy.editCta}
          </Button>
          {c.active ? (
            <DeactivateButton id={c.id} label={copy.deactivateConfirmCta} />
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
          {copy.companiesTitle}
        </h1>

        {/* Create form — always available at the top of the page. */}
        <CompanyForm copy={formCopy} />

        {companies.length === 0 ? (
          <div className="flex flex-col gap-[8px]">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
              {copy.companiesEmptyHeading}
            </h2>
            <p className="text-[16px] leading-[1.5] text-grey">
              {copy.companiesEmptyBody}
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
