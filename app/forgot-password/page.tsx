// app/forgot-password/page.tsx — self-service password reset request (AUTH-04).
//
// Server Component shell mirroring the sign-in surface (white-dominant, teal accent;
// no-flash dictionary copy). The interactive form is a thin client island. No auth
// required — anyone can request a reset; the action returns a generic confirmation
// so the page never reveals whether an account exists.
import Image from "next/image";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-[24px] py-[32px]">
      <div className="flex items-center justify-between">
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
          {t.forgotPasswordHeading}
        </h1>
        <ForgotPasswordForm
          copy={{ emailLabel: t.emailLabel, sendResetCta: t.sendResetCta }}
        />
      </div>
    </main>
  );
}
