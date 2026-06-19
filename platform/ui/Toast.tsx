"use client";
// platform/ui/Toast.tsx — presentational transient toast (PLAT-03, D-03).
//
// PURE PRESENTATION — no business logic. A lost-claim is NOT an error (D-03): the
// neutral default tone uses a muted grey surface and role="status" (polite). Only a
// genuine transport/claim failure uses the `error` tone (coral surface + role="alert").
// Auto-dismisses after a few seconds; the consumer owns the message + dismissal.
//
// Montserrat is the platform font (project-wide @theme); typography uses the 14/16px
// Label/Body tokens. The toast is positioned by the consumer's wrapper, not here, so it
// stays composable (a fixed bottom-centre band is the driver-pool usage).
import { useEffect } from "react";

export type ToastTone = "neutral" | "error";

export function Toast({
  message,
  tone = "neutral",
  onDismiss,
  autoDismissMs = 4000,
}: {
  message: string;
  // Default neutral — the lost-claim toast is NOT an error (D-03). Coral only for
  // genuine transport/claim failures.
  tone?: ToastTone;
  onDismiss: () => void;
  autoDismissMs?: number;
}) {
  useEffect(() => {
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
  }, [onDismiss, autoDismissMs]);

  // Neutral = muted grey surface (slate-on-grey); error = coral. Never coral for neutral.
  const surface =
    tone === "error"
      ? "bg-coral text-white"
      : "bg-slate text-white";

  return (
    <div
      // Neutral lost-claim is polite (status); a real failure is assertive (alert).
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto inline-flex items-center rounded-md px-[16px] py-[12px] text-[14px] font-semibold leading-[1.4] shadow-lg ${surface}`}
    >
      {message}
    </div>
  );
}
