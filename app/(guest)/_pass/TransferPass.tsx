// app/(guest)/_pass/TransferPass.tsx — shared boarding-pass shell (Phase 10,
// UI-SPEC Decision 1, CONTEXT D-03). Surface-local presentational piece consumed
// by BOTH /pickup and /status — it lives UNDER the guest routes, never in
// platform/ui/.
//
// Pure layout, NO data: a className-passthrough wrapper mirroring Card's pattern.
// Renders a `header` slot (the teal band area), a perforated 2px dashed divider
// flanked by two page-background circular notch cutouts as PURE decoration, then
// a `children` body slot. Boarding-pass feel via rounded-lg + the Phase 9 ambient
// shadow (0 4px 12px rgba(47,72,88,0.08)) over a 1px grey/20 border — NO new
// @theme token (Phase 10 adds zero). Decision 1 drops the scannable-stripe
// graphic and the fake digit string entirely — this shell carries neither.
import type { ReactNode } from "react";

export type TransferPassProps = {
  /** The teal header-band slot (typically a <PassHeader />). */
  header: ReactNode;
  /** The pass body slot (details grid, form, receipt, etc.). */
  children: ReactNode;
  className?: string;
};

export function TransferPass({
  header,
  children,
  className = "",
}: TransferPassProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-grey/20 bg-white shadow-[0_4px_12px_rgba(47,72,88,0.08)] ${className}`}
    >
      {/* Teal header band slot. */}
      {header}

      {/* Perforated divider: a 2px dashed line (brand grey ~30%) flanked by two
          page-background circular notch cutouts. Pure decoration, hidden from a11y. */}
      <div className="relative h-0" aria-hidden="true">
        <div className="absolute inset-x-[20px] top-1/2 -translate-y-1/2 border-t-2 border-dashed border-grey/30" />
        <div className="absolute left-[-10px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#f7f8f9]" />
        <div className="absolute right-[-10px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#f7f8f9]" />
      </div>

      {/* Pass body slot. */}
      <div className="flex flex-col gap-[24px] p-[24px]">{children}</div>
    </div>
  );
}
