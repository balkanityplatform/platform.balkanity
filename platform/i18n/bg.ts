// platform/i18n/bg.ts — Bulgarian dictionary (PLAT-04 / T-04-03).
//
// The `: Dict` annotation is the parity GATE: every key in en.ts must be present
// and correctly typed here, or `tsc` fails the build — a missing BG translation
// can never ship silently. Plain typed JSON, no i18n library (D-05).
import type { Dict } from "./en";

export const bg: Dict = {
  signInHeading: "Вход",
  signInCta: "Вход",
  signInError: "Невалиден имейл или парола.",
  emailLabel: "Имейл адрес",
  passwordLabel: "Парола",
  forgotPasswordLink: "Забравена парола?",
  forgotPasswordHeading: "Възстановяване на паролата",
  sendResetCta: "Изпрати линк за възстановяване",
  resetEmailSent:
    "Ако съществува акаунт за този имейл, изпратихме линк за възстановяване на паролата.",
  setPasswordHeading: "Задайте паролата си",
  newPasswordLabel: "Нова парола",
  confirmPasswordLabel: "Потвърдете паролата",
  setPasswordCta: "Запази паролата",
  passwordMismatch: "Паролите не съвпадат. Моля, опитайте отново.",
  passwordTooShort: "Използвайте поне 8 символа за паролата си.",
  emptyHeading: "Все още няма нищо тук",
  emptyBody:
    "Конзолата ви е готова. Компаниите, имотите и трансферите ще се появят тук, щом ги настроите.",
  offlineHeading: "Нямате връзка",
  offlineBody:
    "Balkanity се нуждае от връзка за тази страница. Ще се свържем отново автоматично, щом сте онлайн.",
  langToggle: "EN / BG",
};
