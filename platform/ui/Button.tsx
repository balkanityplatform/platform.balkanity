// platform/ui/Button.tsx — primary brand CTA (PLAT-03, locked).
//
// Fixed 52px height (brand) with a ≥44px hit target (WCAG 2.5.5 / mobile PWA),
// teal fill + white text (accent in the 60/30/10 model). A thin wrapper over a
// native <button> so it accepts all standard button props (type, disabled,
// formAction, onClick, …). Variants/secondary styles are deferred (D-08).
import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      // h-[52px] is the locked CTA height; min-h-[44px] guarantees the hit
      // target even if a consumer overrides height. px-[24px] = lg spacing.
      className={`inline-flex h-[52px] min-h-[44px] items-center justify-center rounded-md bg-teal px-[24px] text-[16px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
