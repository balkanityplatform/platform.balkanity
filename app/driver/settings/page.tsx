// app/driver/settings/page.tsx — driver settings RSC (NOTF-05, D-07/D-08), server-guarded.
//
// RSC: re-verifies the DRIVER role server-side via getCurrentRole() (revalidates the JWT,
// never the cookie-trusting getSession — CLAUDE.md authz rule) BEFORE any read or render;
// a non-driver is redirected to /sign-in. Hosts the daily-digest preference card.
//
// PREFERENCE READ: driver_profiles has NO driver self-read RLS policy (only admin-read; the
// no-extra-policy lock from migrations 0002/0007). So the current preference is read with a
// NARROW service-role select keyed to the caller's VERIFIED auth.uid() (read from the
// revalidated JWT, never a client arg) — the uid identity is the row-scope gate, mirroring
// the gated-service-role pattern used for the write.
//
// Copy is resolved server-side (no-flash, PLAT-04) and handed to the client island as an
// explicit prop bag — mirrors app/driver/page.tsx with the DRIVER warm-light chrome.
import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { DigestPreferenceCard } from "./DigestPreferenceCard";

// Always dynamic — the preference is per-user state, never statically cached.
export const dynamic = "force-dynamic";

export default async function DriverSettingsPage() {
  if ((await getCurrentRole()) !== "driver") {
    redirect("/sign-in");
  }

  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // The caller's verified uid (revalidated JWT) — the row-scope gate for the narrow read.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Narrow service-role read of THIS driver's own digest preference (keyed to auth.uid()).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("driver_profiles")
    .select("digest_enabled, digest_send_hour")
    .eq("user_id", user.id)
    .maybeSingle();

  const initial = {
    enabled: Boolean(profile?.digest_enabled),
    hour: (profile?.digest_send_hour as number | null) ?? null,
  };

  return (
    <main className="min-h-dvh bg-white">
      {/* Driver warm-light chrome: white header w/ logo chip + LanguageToggle (UI-SPEC). */}
      <header className="flex items-center justify-between border-b border-grey/20 bg-white px-[24px] py-[16px]">
        <span className="inline-flex items-center">
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </span>
        <LanguageToggle current={lang} label={t.langToggle} />
      </header>

      <section className="mx-auto flex max-w-2xl flex-col gap-[16px] px-[24px] py-[48px]">
        <DigestPreferenceCard
          initial={initial}
          copy={{
            digestPrefTitle: t.digestPrefTitle,
            digestPrefBody: t.digestPrefBody,
            digestEnableLabel: t.digestEnableLabel,
            digestTimeLabel: t.digestTimeLabel,
            digestSaveCta: t.digestSaveCta,
            digestSavedToast: t.digestSavedToast,
            digestSaveFailed: t.digestSaveFailed,
          }}
        />
      </section>
    </main>
  );
}
