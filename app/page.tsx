// app/page.tsx — role-based root redirect (D-03, SC-3).
//
// Server Component. Resolves the request's role via getCurrentRole() (which uses
// auth.getUser(), revalidating the JWT) and routes by role:
//   null   → /sign-in  (unauthenticated; admin sign-in is the only `/` entry)
//   admin  → /admin
//   driver → /driver    (route reserved; may 404 until Phase 2 — acceptable, D-03)
//   guest  → /sign-in    (guests never enter via `/`; they use /pickup/<slug> in
//                         Phase 4 — bounce to sign-in is the documented neutral choice)
// `/` itself never renders UI — it is purely a router.
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/platform/auth/role";

export default async function Home() {
  const role = await getCurrentRole();

  // Explicit control flow: do NOT rely on redirect() throwing NEXT_REDIRECT to
  // prevent case fall-through (WR-06). Each branch breaks so the routing stays
  // correct even if redirect() is ever wrapped/swapped or a log line is added.
  switch (role) {
    case "admin":
      redirect("/admin");
      break;
    case "driver":
      redirect("/driver");
      break;
    case "guest":
      // Guests do not depend on `/` (D-03); neutral bounce to sign-in.
      redirect("/sign-in");
      break;
    default:
      redirect("/sign-in");
  }
}
