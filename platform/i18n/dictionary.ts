// platform/i18n/dictionary.ts — server-side language + dictionary resolution.
//
// Reads the `lang` cookie server-side (no-flash SSR: the server already knows the
// language before the first byte). EN is the default (D-04); only an exact `bg`
// cookie value selects Bulgarian — any spoofed/garbage value falls back to EN
// (T-04-01: no injection surface).
import { cookies } from "next/headers";
import { type Dict, en } from "./en";
import { bg } from "./bg";

export type Lang = "en" | "bg";

export const LANG_COOKIE = "lang";

export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "bg" ? "bg" : "en"; // EN default; only exact "bg" flips.
}

export async function getDict(): Promise<Dict> {
  return (await getLang()) === "bg" ? bg : en;
}
