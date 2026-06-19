"use client";
// app/driver/settings/DigestPreferenceCard.tsx — driver daily-digest opt-in island (NOTF-05).
//
// A Card holding the opt-in Toggle (OFF by default, D-07 — protects the Resend cap) + a
// self-chosen send-hour Select (D-08), saved via the gated saveDigestPreference action. The
// Select is DISABLED until the toggle is on (UI-SPEC interaction contract). Feedback is a
// neutral Toast on success (digestSavedToast) and a coral Toast ONLY on a genuine save failure
// (digestSaveFailed) — never coral for routine state. All hit targets ≥44px (Toggle/Select/
// Button primitives already enforce min-h-[44px]). Copy comes from the dictionary prop bag.
import { useActionState, useEffect, useState } from "react";
import { Card } from "@/platform/ui/Card";
import { Toggle } from "@/platform/ui/Toggle";
import { Select } from "@/platform/ui/Select";
import { Button } from "@/platform/ui/Button";
import { Toast, type ToastTone } from "@/platform/ui/Toast";
import {
  type DigestPreferenceState,
  saveDigestPreference,
} from "./actions";

const initialState: DigestPreferenceState = { status: "idle" };

export type DigestPreferenceCopy = {
  digestPrefTitle: string;
  digestPrefBody: string;
  digestEnableLabel: string;
  digestTimeLabel: string;
  digestSaveCta: string;
  digestSavedToast: string;
  digestSaveFailed: string;
};

// Whole-hour options 00:00–23:00 (the driver's self-chosen local send hour, D-08).
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function DigestPreferenceCard({
  initial,
  copy,
}: {
  initial: { enabled: boolean; hour: number | null };
  copy: DigestPreferenceCopy;
}) {
  const [state, formAction, pending] = useActionState(
    saveDigestPreference,
    initialState,
  );

  // The toggle drives whether the Select is enabled (OFF by default — initial defaults to false).
  const [enabled, setEnabled] = useState(initial.enabled);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(
    null,
  );

  // Surface the action outcome as a Toast: neutral on success, coral only on genuine failure.
  useEffect(() => {
    if (state.status === "success") {
      setToast({ message: copy.digestSavedToast, tone: "neutral" });
    } else if (state.status === "error") {
      setToast({ message: state.message ?? copy.digestSaveFailed, tone: "error" });
    }
  }, [state, copy.digestSavedToast, copy.digestSaveFailed]);

  return (
    <Card className="flex flex-col gap-[32px]">
      <div className="flex flex-col gap-[8px]">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
          {copy.digestPrefTitle}
        </h2>
        <p className="text-[16px] leading-[1.5] text-grey">{copy.digestPrefBody}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-[24px]">
        <Toggle
          name="enabled"
          label={copy.digestEnableLabel}
          checked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />

        <Select
          name="hour"
          label={copy.digestTimeLabel}
          defaultValue={initial.hour ?? 8}
          // Disabled/ignored until the toggle is on (UI-SPEC interaction contract).
          disabled={!enabled}
          className={!enabled ? "opacity-50" : ""}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </Select>

        <Button type="submit" disabled={pending}>
          {copy.digestSaveCta}
        </Button>
      </form>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[24px] flex justify-center">
          <Toast
            message={toast.message}
            tone={toast.tone}
            onDismiss={() => setToast(null)}
          />
        </div>
      ) : null}
    </Card>
  );
}
