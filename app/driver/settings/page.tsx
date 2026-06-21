// app/driver/settings/page.tsx — driver Profile (settings) RSC (D-03/D-04/D-05), server-guarded.
//
// RSC: re-verifies the DRIVER role server-side via getCurrentRole() (revalidates the JWT,
// never the cookie-trusting getSession — CLAUDE.md authz rule) BEFORE any read or render;
// a non-driver is redirected to /sign-in.
//
// Composes the Profile top→bottom (D-03), every element backed by EXISTING data only
// (D-04 truthfulness guard — no earnings, ratings, stats, or avatar upload):
//   1. Identity header — the caller's OWN email (always present from the verified
//      auth.getUser() session) + optional name from driver_profiles.name; an initials chip,
//      never an avatar photo.
//   2. The restyled DigestPreferenceCard (chrome on the DS Card primitive; behaviour
//      verbatim — NOTF-05 unchanged).
//   3. The LanguageToggle surfaced as a settings row.
//   4. A sign-out button wired to signOutAction (the lone new write, D-05).
//
// PREFERENCE READ: driver_profiles has NO driver self-read RLS policy (only admin-read; the
// no-extra-policy lock from migrations 0002/0007). So the current preference is read with a
// NARROW service-role select keyed to the caller's VERIFIED auth.uid() (read from the
// revalidated JWT, never a client arg) — the uid identity is the row-scope gate.
//
// The slim top header (logo · bell · language) now lives in app/driver/layout.tsx (Plan 01) —
// this page renders NO <header> of its own.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { DigestPreferenceCard } from "./DigestPreferenceCard";
import { signOutAction } from "./actions";

// Always dynamic — the preference is per-user state, never statically cached.
export const dynamic = "force-dynamic";

// Initials from a display name (or email local-part) for the no-photo identity chip.
function initials(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

  // Narrow service-role read of THIS driver's own digest preference + display name
  // (keyed to auth.uid()). driver_profiles.name is read verbatim from the existing column.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("driver_profiles")
    .select("name, digest_enabled, digest_send_hour")
    .eq("user_id", user.id)
    .maybeSingle();

  const initial = {
    enabled: Boolean(profile?.digest_enabled),
    hour: (profile?.digest_send_hour as number | null) ?? null,
  };

  // Identity: email is always present; name is optional (Discretion A1 — use it if present).
  const email = user.email ?? "";
  const displayName = (profile?.name as string | null)?.trim() || null;
  const chipSource = displayName ?? email;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-[16px] px-[24px] py-[48px]">
      {/* (1) Identity header — caller's OWN session identity; initials chip, no avatar photo. */}
      <Card className="flex items-center gap-[16px]">
        <span
          aria-hidden
          className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-teal/10 text-[16px] font-semibold text-teal"
        >
          {initials(chipSource)}
        </span>
        <div className="flex min-w-0 flex-col">
          {displayName ? (
            <>
              <span className="truncate text-[18px] font-semibold leading-[1.3] text-slate">
                {displayName}
              </span>
              <span className="truncate text-[14px] leading-[1.4] text-grey">{email}</span>
            </>
          ) : (
            <span className="truncate text-[18px] font-semibold leading-[1.3] text-slate">
              {email}
            </span>
          )}
        </div>
      </Card>

      {/* (2) Restyled digest-preference card — behaviour verbatim (NOTF-05). */}
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

      {/* (3) Language settings row. */}
      <Card className="flex items-center justify-between gap-[16px]">
        <span className="text-[16px] font-semibold text-slate">{t.langToggle}</span>
        <LanguageToggle current={lang} label={t.langToggle} />
      </Card>

      {/* (4) Sign out — the lone new write (D-05); server-action form submit. */}
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          {t.driverSignOutCta}
        </Button>
      </form>
    </section>
  );
}
