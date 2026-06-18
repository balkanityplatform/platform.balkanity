// app/track/page.tsx — guest status-link re-access page (D-07 / AUTH-02).
//
// A guest who lost their confirmation link enters the email they booked with to receive
// a fresh status-page magic link. The action ALWAYS returns a neutral success (no
// account enumeration). All copy is resolved server-side from getDict() (no client flash).
// This is a guest document → forced NetworkFirst by app/sw.ts (Task 3d).
import { getDict } from "@/platform/i18n/dictionary";
import { TrackForm } from "./TrackForm";

export default async function TrackPage() {
  const t = await getDict();

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-[24px] px-[16px] py-[48px]">
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {t.trackTitle}
      </h1>
      <p className="text-[16px] leading-[1.5] text-slate">{t.trackBody}</p>
      <TrackForm
        copy={{
          emailLabel: t.trackEmailLabel,
          sendCta: t.trackSendCta,
        }}
      />
    </main>
  );
}
