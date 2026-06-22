// app/admin/settings/page.tsx — admin Settings hub (D-03 / AUI-01 completion), server-guarded.
//
// RSC: re-verifies the admin role server-side via getCurrentRole() (revalidates the JWT,
// never the cookie-trusting getSession — CLAUDE.md authz rule) BEFORE any render; a non-admin
// is redirected to /sign-in (threat T-12-16 — the gate stays on the page). The slate console
// chrome (sidebar + top bar + single bell) is owned by app/admin/layout.tsx (Plan 01) — this
// page renders NO <header> of its own.
//
// PURELY PRESENTATIONAL (D-03 / threat T-12-19): this is a navigation grouping that links the
// FOUR routes that already exist — Companies / Properties / Destinations / Platform health. It
// performs NO database read or write, defines NO new CRUD, and invents NO new route or schema.
// The Settings sidebar item targets this hub and its prefix-match highlight keeps Settings lit.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentRole } from "@/platform/auth/role";
import { getDict, getLang } from "@/platform/i18n/dictionary";

export default async function AdminSettingsPage() {
  // Role gate PRECEDES any render (T-12-16 preservation — never moved to the layout).
  if ((await getCurrentRole()) !== "admin") {
    redirect("/sign-in");
  }

  // Copy/lang only — no data read (this hub is a pure navigation grouping, D-03).
  const [t] = await Promise.all([getDict(), getLang()]);

  // Links to the FOUR existing routes (no new routes invented — T-12-19).
  const sections = [
    { href: "/admin/companies", label: t.companiesTitle },
    { href: "/admin/properties", label: t.propertiesTitle },
    { href: "/admin/destinations", label: t.destinationsTitle },
    { href: "/admin/health", label: t.healthTitle },
  ];

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-[32px] px-[24px] py-[48px]">
      <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
        {t.adminSettingsTitle}
      </h1>

      {/* Navigation grouping — the same section-nav link styling as app/admin/page.tsx. */}
      <nav className="flex flex-col gap-[12px]">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="inline-flex min-h-[44px] items-center rounded-md border border-grey/30 px-[16px] text-[16px] font-semibold text-slate hover:bg-slate/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
