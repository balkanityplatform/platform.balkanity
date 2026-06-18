// platform/ui/Select.tsx — label + native <select> primitive (PLAT-03).
//
// A thin wrapper over a native <select> (so it accepts all standard select props
// and remains keyboard/AT-native) styled to match the TextField field geometry
// (h-[52px] ≥44px hit target, UI-SPEC line 60). Used where a CRUD form needs a
// parent picker (e.g. choose a company for a property).
import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export function Select({
  id,
  label,
  error,
  className = "",
  children,
  ...rest
}: SelectProps) {
  const fieldId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-[8px]">
      <label
        htmlFor={fieldId}
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {label}
      </label>
      <select
        id={fieldId}
        className={`h-[52px] rounded-md border border-grey/40 bg-white px-[16px] text-[16px] text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${className}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p role="alert" className="text-[14px] leading-[1.4] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}
