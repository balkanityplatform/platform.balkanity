// app/set-password/page.tsx — set-password landing for invite + recovery (AUTH-04).
//
// Server Component. Requires an active session: /auth/confirm verifies the invite
// or recovery OTP (establishing the session cookies) and forwards here. We
// re-validate with auth.getUser() (revalidates the JWT server-side — never trust
// the cookie alone for an authz gate); an unauthenticated visitor is redirected to
// /sign-in. The interactive form is a thin client island; no-flash dictionary copy.
import Image from "next/image";
import { redirect } from "next/navigation";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { SetPasswordForm } from "./SetPasswordForm";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

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
          {t.setPasswordHeading}
        </h1>
        <SetPasswordForm
          copy={{
            newPasswordLabel: t.newPasswordLabel,
            confirmPasswordLabel: t.confirmPasswordLabel,
            setPasswordCta: t.setPasswordCta,
          }}
        />
      </div>
    </main>
  );
}
