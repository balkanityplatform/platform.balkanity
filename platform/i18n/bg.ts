// platform/i18n/bg.ts — Bulgarian dictionary (PLAT-04 / T-04-03).
//
// The `: Dict` annotation is the parity GATE: every key in en.ts must be present
// and correctly typed here, or `tsc` fails the build — a missing BG translation
// can never ship silently. Plain typed JSON, no i18n library (D-05).
import type { Dict } from "./en";

export const bg: Dict = {
  signInCta: "Изпрати магически линк",
  magicLinkSent: "Проверете имейла си — изпратихме ви линк за вход.",
  signInError:
    "Не успяхме да изпратим магическия линк. Проверете имейл адреса и опитайте отново.",
  emailLabel: "Имейл адрес",
  emptyHeading: "Все още няма нищо тук",
  emptyBody:
    "Конзолата ви е готова. Компаниите, имотите и трансферите ще се появят тук, щом ги настроите.",
  offlineHeading: "Нямате връзка",
  offlineBody:
    "Balkanity се нуждае от връзка за тази страница. Ще се свържем отново автоматично, щом сте онлайн.",
  langToggle: "EN / BG",
};
