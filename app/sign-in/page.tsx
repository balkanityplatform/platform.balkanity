// app/sign-in/page.tsx — admin magic-link sign-in (AUTH-04 / D-01), re-skinned (01-04).
//
// Server Component shell: resolves copy through the EN/BG dictionary (getDict reads
// the lang cookie server-side → no flash) and renders the brand-styled surface
// (white-dominant, teal accent — 60/30/10). The interactive form is a thin client
// island (SignInForm); auth behaviour is unchanged from 01-03. The LanguageToggle
// lets a guest/admin flip EN↔BG before signing in.
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { SignInForm } from "./SignInForm";

export default async function SignInPage() {
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-[24px] py-[32px]">
      <div className="flex justify-end">
        <LanguageToggle current={lang} label={t.langToggle} />
      </div>

      <div className="mt-[48px] flex flex-col gap-[24px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {t.signInCta}
        </h1>
        <SignInForm copy={{ emailLabel: t.emailLabel, signInCta: t.signInCta }} />
      </div>
    </main>
  );
}
