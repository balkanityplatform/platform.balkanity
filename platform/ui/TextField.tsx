// platform/ui/TextField.tsx — label + input + inline error primitive (PLAT-03).
//
// Lifts the locked field markup from app/sign-in/SignInForm.tsx (label →
// h-[52px] input → coral error slot) into a reusable primitive so every Phase 2
// form (companies/properties/destinations/drivers) shares one field contract.
// The input is ≥44px (h-[52px], UI-SPEC line 60). A thin wrapper over a native
// <input> so it accepts all standard input props (name, type, required, …).
import type { InputHTMLAttributes } from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  // The visible label. Required so the control is always labelled (a11y).
  label: string;
  // Inline, dictionary-keyed error message (coral). Omit when there is no error.
  error?: string;
};

export function TextField({
  id,
  label,
  error,
  className = "",
  ...rest
}: TextFieldProps) {
  // Fall back to `name` for the htmlFor/id link when no explicit id is given.
  const fieldId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-[8px]">
      <label
        htmlFor={fieldId}
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {label}
      </label>
      <input
        id={fieldId}
        // Same locked field geometry as the sign-in input (≥44px hit target).
        className={`h-[52px] rounded-md border border-grey/40 px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${className}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}
