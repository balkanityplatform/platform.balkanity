// platform/ui/Button.tsx — primary brand CTA (PLAT-03, locked).
//
// Fixed 52px height (brand) with a ≥44px hit target (WCAG 2.5.5 / mobile PWA).
// A thin wrapper over a native <button> so it accepts all standard button props
// (type, disabled, formAction, onClick, …).
//
// Variants (02-02): the `primary` variant is the locked teal CTA (D-08, unchanged);
// `ghost` is an outline-slate secondary used for Edit / Cancel actions (UI-SPEC).
// Both keep the 52px / ≥44px geometry so the brand hit-target contract holds.
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

// Shared geometry: h-[52px] is the locked CTA height; min-h-[44px] guarantees the
// hit target even if a consumer overrides height. px-[24px] = lg spacing.
const BASE =
  "inline-flex h-[52px] min-h-[44px] items-center justify-center rounded-md px-[24px] text-[16px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  // Locked teal CTA (unchanged from the original Button).
  primary: "bg-teal text-white",
  // Outline-slate secondary for Edit / Cancel.
  ghost: "border border-slate/40 bg-white text-slate",
};

export function Button({
  className = "",
  variant = "primary",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
