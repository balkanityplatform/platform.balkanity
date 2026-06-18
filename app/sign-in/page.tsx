// app/sign-in/page.tsx — admin/driver email + password sign-in (AUTH-04).
//
// Server Component shell: resolves copy through the EN/BG dictionary (getDict reads
// the lang cookie server-side → no flash) and renders the brand-styled surface
// (white-dominant, teal accent — 60/30/10). The interactive form is a thin client
// island (SignInForm); on success the action redirects to `/` (role-routes). The
// LanguageToggle lets the user flip EN↔BG before signing in.
import Image from "next/image";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { SignInForm } from "./SignInForm";

export default async function SignInPage() {
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-[24px] py-[32px]">
      <div className="flex items-center justify-between">
        {/* Real Balkanity mark (D-09 / SC-5) — never re-drawn; from public/brand. */}
        <Image
          src="/brand/balkanity-logo.png"
          alt="Balkanity"
          width={120}
          height={120}
          priority
          className="h-[48px] w-auto"
        />
        <LanguageToggle current={lang} label={t.langToggle} />
      </div>

      <div className="mt-[48px] flex flex-col gap-[24px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {t.signInHeading}
        </h1>
        <SignInForm
          copy={{
            emailLabel: t.emailLabel,
            passwordLabel: t.passwordLabel,
            signInCta: t.signInCta,
            forgotPasswordLink: t.forgotPasswordLink,
          }}
        />
      </div>
    </main>
  );
}
