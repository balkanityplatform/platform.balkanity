"use client";
// app/admin/destinations/CopyBookingLink.tsx — surface-local Copy-booking-link control.
//
// Presentation-only (v1.1): the destination `slug` already lives on the row. This shows
// the FULL public booking URL (origin + /pickup/<slug>) and a Copy button, removing the
// manual, error-prone step of an operator reconstructing the link by hand to send to a
// property company. Rendered for ACTIVE rows only (D-11: an inactive destination stops
// resolving its /pickup link, so there is no live link to copy).
//
// The absolute origin is derived client-side post-mount (window.location.origin) so the
// Vercel domain is NEVER hardcoded and SSR never touches `window`. Until the origin
// resolves the row shows the relative /pickup/<slug> path (never blank). All copy flows
// in as props from the dictionary-resolved server page (no hardcoded English).
import { useEffect, useRef, useState } from "react";
import { Button } from "@/platform/ui/Button";

export function CopyBookingLink({
  slug,
  copyCta,
  copiedLabel,
}: {
  slug: string;
  copyCta: string;
  copiedLabel: string;
}) {
  // Origin resolves post-mount only — first server render falls back to the relative path
  // so the row is never blank and SSR never reads `window`.
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Clear any pending "Copied" reset on unmount.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const url = `${origin}/pickup/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Reset the confirmation after a beat; clear a prior timer first so a repeat
      // click restarts the window rather than racing an early reset.
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the idle label.
    }
  }

  // The aria-label always carries the action wording in BOTH states (never colour/icon
  // alone), satisfying WCAG 1.4.1. The visible label is wrapped in aria-live="polite"
  // so the swap to "Copied" is announced.
  // Rendered on its own full-width line (DataList subRow), so the URL gets the whole
  // row width: it reads on one line for short origins and wraps cleanly (never
  // char-by-char) for long ones, with the Copy button pinned to the end.
  return (
    <span className="flex items-center justify-between gap-[12px] rounded-md bg-grey/5 px-[12px] py-[8px]">
      <span className="min-w-0 break-all text-[14px] leading-[1.4] text-grey">
        {url}
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={handleCopy}
        aria-label={copied ? `${copiedLabel} — ${copyCta}` : copyCta}
      >
        <span aria-live="polite">{copied ? copiedLabel : copyCta}</span>
      </Button>
    </span>
  );
}
