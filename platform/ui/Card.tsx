// platform/ui/Card.tsx — neutral container primitive (PLAT-03).
//
// A className-passthrough container: white surface, rounded, subtle border + pad.
// Groups a form or a list section on the slate console. A thin wrapper over a
// native <div> so it accepts all standard div props.
import type { HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-md border border-grey/30 bg-white p-[24px] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
