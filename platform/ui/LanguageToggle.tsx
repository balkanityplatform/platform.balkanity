"use client";
// platform/ui/LanguageToggle.tsx — EN/BG one-tap language toggle (PLAT-04).
//
// A small client control with a ≥44px hit target. Tapping it calls the setLang
// server action to flip the `lang` cookie and refresh; because the cookie is read
// server-side (getLang in layout/pages), the reload renders the new language with
// no flash. The control receives the current lang so it can flip to the other one.
import { useTransition } from "react";
import { type Lang } from "@/platform/i18n/dictionary";
import { setLang } from "@/platform/i18n/lang";

export function LanguageToggle({
  current,
  label,
  className = "text-slate",
}: {
  current: Lang;
  label: string;
  // Text colour utility — defaults to slate (light surfaces); pass e.g.
  // "text-white" on the slate console header so the control stays legible.
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const next: Lang = current === "bg" ? "en" : "bg";

  return (
    <button
      type="button"
      // ≥44px hit target (WCAG 2.5.5); neutral control, not the teal accent.
      className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-[16px] text-[14px] font-semibold transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50 ${className}`}
      aria-label={`Switch language (${label})`}
      disabled={pending}
      onClick={() => startTransition(() => setLang(next))}
    >
      {label}
    </button>
  );
}
