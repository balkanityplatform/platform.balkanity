// app/admin/page.tsx — placeholder admin console, server-guarded (D-03, T-03-03),
// re-skinned (01-04).
//
// Server Component guarded by getCurrentRole(): any non-admin (including
// unauthenticated) is redirected to /sign-in BEFORE render — the role gate is
// server-side, not UI-only (threat T-03-03). Copy is resolved through the EN/BG
// dictionary; chrome is slate console (60/30/10 — slate secondary surface). The
// onboarding (companies/properties/transfers) arrives in Phase 2.
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";

export default async function AdminPage() {
  const role = await getCurrentRole();

  if (role !== "admin") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  return (
    <main className="min-h-dvh bg-white">
      {/* Slate console chrome (60/30/10 secondary surface). */}
      <header className="flex items-center justify-between bg-slate px-[24px] py-[16px]">
        {/* Real Balkanity mark (D-09 / SC-5) on a white chip so the teal mark
            stays on white per D-07 (never re-drawn; from public/brand). */}
        <span className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px]">
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </span>
        <LanguageToggle current={lang} label={t.langToggle} className="text-white" />
      </header>

      <section className="mx-auto max-w-2xl px-[24px] py-[48px]">
        {/* copy id: emptyHeading */}
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {t.emptyHeading}
        </h1>
        {/* copy id: emptyBody */}
        <p className="mt-[16px] text-[16px] leading-[1.5] text-grey">
          {t.emptyBody}
        </p>
      </section>
    </main>
  );
}
