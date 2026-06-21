// app/(guest)/_pass/DetailsGrid.tsx — 2-col real-fields-only details grid for the
// Transfer Pass (Phase 10, UI-SPEC Decision 3). Surface-local presentational
// piece; lives UNDER the guest routes, never in platform/ui/.
//
// Renders EXACTLY four cells — Date, Flight No., Guests, Time (Decision 3, which
// removed the invented estimated-pickup field). Each cell = a Label caption
// (14px/600, UPPERCASE
// permitted) with its line pictogram + a Body value (16px). Receives an `items`
// array of { caption, value, icon } where captions/values are resolved by the
// server page and icons are supplied from ./icons. An empty-string value renders
// gracefully (no crash). Copy is props-only — this piece never resolves the
// dictionary itself (S1).
import type { ReactNode } from "react";

export type DetailsGridItem = {
  /** Already-translated caption (e.g. passDate). UPPERCASE is a styling treatment. */
  caption: string;
  /** Server-resolved value; empty string renders gracefully. */
  value: string;
  /** Line pictogram supplied by the page from ./icons. */
  icon: ReactNode;
};

export type DetailsGridProps = {
  items: DetailsGridItem[];
  className?: string;
};

export function DetailsGrid({ items, className = "" }: DetailsGridProps) {
  return (
    <dl className={`grid grid-cols-2 gap-[16px] ${className}`}>
      {items.map((item) => (
        <div key={item.caption} className="flex flex-col gap-[4px]">
          <dt className="flex items-center gap-[4px] text-label font-semibold uppercase tracking-[0.04em] text-grey">
            <span className="text-grey">{item.icon}</span>
            {item.caption}
          </dt>
          <dd className="text-body text-slate">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
