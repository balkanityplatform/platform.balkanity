// app/(guest)/_pass/PassHeader.tsx — teal header band for the Transfer Pass
// (Phase 10, UI-SPEC Component Inventory line 140 + Decision 1). Surface-local
// presentational piece; lives UNDER the guest routes, never in platform/ui/.
//
// Renders a `bg-teal text-white` band with the `eyebrow` (Label role, UPPERCASE
// tracking treatment), an OPTIONAL `refLabel` (rendered only when truthy —
// omitted on /pickup pre-insert so no faked id ever shows, T-10-03), then the
// shared RouteMotif (airport → property). Takes already-translated strings as
// props (S1: presentational pieces never resolve the dictionary themselves). The brand
// Transfer Badge midpoint is served by RouteMotif itself — NEVER re-drawn here.
import { RouteMotif } from "@/platform/ui/RouteMotif";
import { BuildingIcon, PlaneIcon } from "./icons";

export type PassHeaderProps = {
  /** Already-translated "Transfer Pass" eyebrow (passEyebrow). */
  eyebrow: string;
  /** Optional already-translated ref line (passRefLabel filled). Omitted when falsy. */
  refLabel?: string;
  /** Already-translated departure (airport) label. */
  startLabel: string;
  /** Already-translated arrival (destination) label. */
  endLabel: string;
};

export function PassHeader({
  eyebrow,
  refLabel,
  startLabel,
  endLabel,
}: PassHeaderProps) {
  return (
    <div className="flex flex-col gap-[16px] bg-teal px-[24px] py-[24px] text-white">
      <div className="flex items-baseline justify-between gap-[8px]">
        <span className="text-label font-semibold uppercase tracking-[0.08em] text-white/90">
          {eyebrow}
        </span>
        {refLabel ? (
          <span className="text-label font-semibold uppercase tracking-[0.08em] text-white/80">
            {refLabel}
          </span>
        ) : null}
      </div>
      {/* RouteMotif renders Plane → brand badge → Building; endpoint labels are
          passed through from the server page (i18n stays in the surface). The
          icons are forced white to read on the teal band via the wrapping color. */}
      <div className="text-white">
        <RouteMotif
          start={{ icon: <PlaneIcon />, label: startLabel }}
          end={{ icon: <BuildingIcon />, label: endLabel }}
        />
      </div>
    </div>
  );
}
