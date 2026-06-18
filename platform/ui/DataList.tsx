// platform/ui/DataList.tsx — responsive entity list primitive (PLAT-03).
//
// Presentational list of supply entities (companies/properties/destinations).
// Each row renders a primary name, an active/inactive indicator (a grey/teal dot
// + "Active"/"Inactive" label — colour is never the sole signal, WCAG 1.4.1), and
// a slot for per-row actions (Edit / Deactivate). The active indicator reuses the
// StatusDot brand-token pattern (grey dot for inactive, teal for active) rather
// than re-drawing it inline.
import type { ReactNode } from "react";

export type DataListItem = {
  // Stable React key + identity.
  id: string;
  // Primary label shown for the row.
  name: string;
  // Lifecycle flag — drives the dot colour + status label.
  active: boolean;
  // Per-row action controls (e.g. Edit / Deactivate buttons).
  actions?: ReactNode;
};

export type DataListProps = {
  items: DataListItem[];
  // Dictionary-keyed status labels (PLAT-04 — no hard-coded JSX strings).
  activeLabel: string;
  inactiveLabel: string;
};

export function DataList({ items, activeLabel, inactiveLabel }: DataListProps) {
  return (
    <ul className="flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex min-h-[56px] flex-col gap-[8px] px-[16px] py-[12px] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-[12px]">
            <span className="text-[16px] font-semibold leading-[1.4] text-slate">
              {item.name}
            </span>
            <span className="inline-flex items-center gap-[4px]">
              {/* Coloured dot — never the sole signal; the label always renders. */}
              <span
                data-testid="status-dot"
                aria-hidden="true"
                className={`inline-block h-[10px] w-[10px] rounded-full ${
                  item.active ? "bg-teal" : "bg-grey"
                }`}
              />
              <span className="text-[14px] font-semibold leading-[1.4] text-slate">
                {item.active ? activeLabel : inactiveLabel}
              </span>
            </span>
          </div>
          {item.actions ? (
            <div className="flex items-center gap-[8px]">{item.actions}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
