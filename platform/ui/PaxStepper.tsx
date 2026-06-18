"use client";
// platform/ui/PaxStepper.tsx — integer number stepper primitive (D-03).
//
// A label + [−][value][+] control where every interactive button is a ≥44px square
// tap target (WCAG 2.5.5 / mobile PWA — same hit-target contract as TextField/Button).
// The value is controlled client-side and mirrored into a hidden <input name={name}>
// so the server action reads it from FormData (the same controlled-state + hidden-input
// convention as DestinationForm). Platform-generic and unprefixed.
//
// Used for passengers (min 1, max 8) and luggage (min 0, no max) on the booking form.
import { useState } from "react";

export type PaxStepperProps = {
  name: string;
  label: string;
  helpText?: string;
  min: number;
  max?: number;
  defaultValue?: number;
};

export function PaxStepper({
  name,
  label,
  helpText,
  min,
  max,
  defaultValue,
}: PaxStepperProps) {
  const [value, setValue] = useState<number>(defaultValue ?? min);

  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  const dec = () => setValue((v) => (v > min ? v - 1 : v));
  const inc = () => setValue((v) => (max === undefined || v < max ? v + 1 : v));

  // ≥44px square brand-styled tap target (mirrors TextField focus treatment).
  const btn =
    "flex h-[44px] w-[44px] items-center justify-center rounded-md border border-grey/40 text-[20px] font-semibold text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40";

  return (
    <div className="flex flex-col gap-[8px]">
      <label
        htmlFor={name}
        className="text-[14px] font-semibold leading-[1.4] text-slate"
      >
        {label}
      </label>
      <div className="flex items-center gap-[12px]">
        <button
          type="button"
          className={btn}
          onClick={dec}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span
          id={name}
          aria-live="polite"
          className="min-w-[2ch] text-center text-[16px] font-semibold text-slate"
        >
          {value}
        </span>
        <button
          type="button"
          className={btn}
          onClick={inc}
          disabled={atMax}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
        {helpText ? (
          <span className="text-[14px] leading-[1.4] text-grey">{helpText}</span>
        ) : null}
      </div>
      {/* The server action reads the value from FormData via this hidden input. */}
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}
