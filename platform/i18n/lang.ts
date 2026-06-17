"use server";
// platform/i18n/lang.ts — language-preference server action (PLAT-04 / D-05).
//
// Writes the low-trust `lang` UI-preference cookie (no auth value, T-04-04) and
// refreshes so the server re-renders in the chosen language with no flash. The
// cookie is NOT httpOnly so the toggle could also read it client-side if needed;
// the binding requirement is that it is server-readable for SSR.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { type Lang, LANG_COOKIE } from "./dictionary";

export async function setLang(next: Lang): Promise<void> {
  // Normalise to the exact union — never persist arbitrary input (T-04-01).
  const value: Lang = next === "bg" ? "bg" : "en";

  (await cookies()).set(LANG_COOKIE, value, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  // Re-render the whole tree server-side so the new language takes effect.
  revalidatePath("/", "layout");
}
