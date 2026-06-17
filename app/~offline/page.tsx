// app/~offline/page.tsx — branded offline fallback (PLAT-02 / D-06).
//
// Precached by Serwist (additionalPrecacheEntries in next.config.ts) and served by
// the SW `fallbacks` rule when a document navigation fails offline. Copy comes from
// the EN/BG dictionary (offlineHeading/offlineBody, authored in 01-04); the surface
// is white-dominant with a teal accent per the brand 60/30/10 rule. The Montserrat
// font + token CSS are part of the precached shell, so this renders branded offline.
//
// NOTE: this page is rendered/precached at BUILD time, so the dictionary is resolved
// once (server-side getDict reads the lang cookie at build). It still renders the
// branded EN copy offline; live language is restored once the network returns.
import { getDict } from "@/platform/i18n/dictionary";

export default async function OfflinePage() {
  const t = await getDict();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-[16px] bg-white px-[24px] py-[32px] text-center">
      <span
        aria-hidden="true"
        className="h-[12px] w-[12px] rounded-full bg-teal"
      />
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {t.offlineHeading}
      </h1>
      <p className="max-w-[36ch] text-[16px] leading-[1.5] text-slate/80">
        {t.offlineBody}
      </p>
    </main>
  );
}
