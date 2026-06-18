// platform/ui/Toggle.tsx — active/inactive control primitive (PLAT-03).
//
// A labelled native checkbox used as the active/inactive control on supply
// entities. Native <input type="checkbox"> keeps the control keyboard- and
// AT-accessible by construction; the wrapping label gives a ≥44px hit target
// (UI-SPEC line 60). A thin wrapper that accepts all standard checkbox props.
import type { InputHTMLAttributes } from "react";

export type ToggleProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
};

export function Toggle({ id, label, className = "", ...rest }: ToggleProps) {
  const fieldId = id ?? rest.name;

  return (
    <label
      htmlFor={fieldId}
      className="inline-flex min-h-[44px] cursor-pointer items-center gap-[8px] text-[14px] font-semibold leading-[1.4] text-slate"
    >
      <input
        id={fieldId}
        type="checkbox"
        className={`h-[20px] w-[20px] accent-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${className}`}
        {...rest}
      />
      {label}
    </label>
  );
}
