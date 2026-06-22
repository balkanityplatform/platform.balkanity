// app/admin/layout.tsx — shared admin console shell (AUI-01 / AUI-05, D-04).
//
// CONSOLIDATES the per-page slate <header> chips (logo + bell + LanguageToggle) that every
// admin route renders independently into ONE source, mounts the NotificationBell ONCE, and
// establishes the slate-console chrome: a persistent left sidebar (Dashboard / Transfers /
// Drivers / Settings) + a slate top bar (client search + signed-in identity + the single
// bell + LanguageToggle), responsive to a hamburger overlay drawer below the desktop
// breakpoint. EXACT analog: app/driver/layout.tsx (the Phase 11 D-04 consolidation).
//
// The bell seed is RELOCATED, not widened: readOwnNotifications() is the SAME caller-auth
// own-rows-only RLS read each admin page already used (threats T-12-01/T-12-02 mitigate) —
// a layout RSC may call it because it is server-side. No service-role client, no data write,
// no new trust boundary here.
//
// NO role gate in the layout (T-12-01): every admin RSC page keeps its own
// `getCurrentRole() === "admin"` re-gate BEFORE its read (preservation — matches the driver
// layout, which also does not gate). The signed-in identity is read from the VERIFIED session
// via auth.getUser() (revalidated JWT, never the cookie-trusting getSession — T-12-03).
//
// NOTE: the per-page <header> blocks are NOT deleted here — each Wave-2 surface slice removes
// its own page header so file ownership stays disjoint (a transient double-header mid-wave is
// acceptable, mirroring the Phase 11 carry-forward).
import { getDict, getLang } from "@/platform/i18n/dictionary";
import { createClient } from "@/platform/supabase/server";
import { readOwnNotifications } from "@/platform/notifications/feed";
import { NotificationBell } from "@/platform/ui/NotificationBell";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import { AdminSidebar } from "./_nav/AdminSidebar";
import { AdminTopBar } from "./_nav/AdminTopBar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  // Own-rows-only seed for the single Alerts bell (caller-auth RLS — never service-role).
  const bellInitial = await readOwnNotifications();

  // Signed-in admin identity from the VERIFIED session (revalidated JWT, never getSession).
  // Email is always present; name is not read here (email alone is acceptable per the plan's
  // Claude's-Discretion). No role gate — each page re-gates getCurrentRole() before its read.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";

  return (
    <div className="flex min-h-dvh bg-white">
      {/* Persistent slate sidebar (lg+) / hidden below — the hamburger toggle + overlay
          drawer it owns are slotted into the top bar below the desktop breakpoint. */}
      <AdminSidebar
        copy={{
          navDashboard: t.navDashboard,
          transfersTitle: t.transfersTitle,
          driversTitle: t.driversTitle,
          navSettings: t.navSettings,
          // Accessible landmark/toggle label — reuse the Dashboard label (no new key;
          // Task 1 is the phase's single key-introduction point).
          navMenuLabel: t.navDashboard,
        }}
      />

      {/* Right column: slate top bar + white content area. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar
          copy={{
            searchPlaceholder: t.transferSearchPlaceholder,
            signedInAs: t.signedInAs,
            menuSlotLabel: t.navDashboard,
          }}
          identity={{ email }}
          actions={
            <>
              {/* The single NotificationBell — same alerts* prop-bag the driver layout uses. */}
              <NotificationBell
                initial={bellInitial}
                lang={lang}
                copy={{
                  alertsTrigger: t.alertsTrigger,
                  alertsTriggerAria: t.alertsTriggerAria,
                  alertsPanelTitle: t.alertsPanelTitle,
                  markAllReadCta: t.markAllReadCta,
                  alertsEmptyHeading: t.alertsEmptyHeading,
                  alertsEmptyBody: t.alertsEmptyBody,
                  alertsLoadFailed: t.alertsLoadFailed,
                }}
              />
              <LanguageToggle
                current={lang}
                label={t.langToggle}
                className="text-white"
              />
            </>
          }
        />

        <main className="min-w-0 flex-1 bg-white">{children}</main>
      </div>
    </div>
  );
}
