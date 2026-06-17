// app/admin/page.tsx — placeholder admin console, server-guarded (D-03, T-03-03).
//
// Server Component guarded by getCurrentRole(): any non-admin (including
// unauthenticated) is redirected to /sign-in BEFORE render — the role gate is
// server-side, not UI-only (threat T-03-03). Renders the empty-state placeholder;
// onboarding (companies/properties/transfers) arrives in Phase 2. Plain markup on
// slate console chrome — styled tokens/components land in 01-04. Copy is the EN
// canonical from the UI-SPEC Copywriting Contract.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";

export default async function AdminPage() {
  const role = await getCurrentRole();

  if (role !== "admin") {
    redirect("/sign-in");
  }

  return (
    <main>
      {/* copy id: emptyHeading */}
      <h1>Nothing here yet</h1>
      {/* copy id: emptyBody */}
      <p>
        Your console is ready. Companies, properties, and transfers will appear
        here as you set them up.
      </p>
    </main>
  );
}
