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

  // --- Фаза 2: онбординг на доставчици (UI-SPEC Copywriting Contract) ---

  // Заглавия на страници
  companiesTitle: "Компании",
  propertiesTitle: "Имоти",
  destinationsTitle: "Дестинации",
  driversTitle: "Шофьори",
  inviteDriverTitle: "Покани шофьор",

  // Основни / вторични бутони (режим редактиране ползва saveChangesCta)
  createCompanyCta: "Създай компания",
  addPropertyCta: "Добави имот",
  saveDestinationCta: "Запази дестинация",
  generateInviteLinkCta: "Генерирай линк за покана",
  saveChangesCta: "Запази промените",
  cancelCta: "Отказ",

  // Празни състояния
  companiesEmptyHeading: "Все още няма компании",
  companiesEmptyBody:
    "Създайте първата си компания, за да започнете да добавяте имоти и дестинации за резервация.",
  propertiesEmptyHeading: "Все още няма имоти",
  propertiesEmptyBody:
    "Добавете имот към тази компания. Всеки имот може да има една или повече дестинации за резервация.",
  destinationsEmptyHeading: "Все още няма дестинации",
  destinationsEmptyBody:
    "Добавете дестинация, за да генерирате нейния споделим /pickup линк и да зададете цена.",
  driversEmptyHeading: "Все още няма поканени шофьори",
  driversEmptyBody:
    "Поканете шофьор, за да изградите своя пул от заявки. Шофьорите задават собствена парола от линка, който споделите.",

  // Грешки
  fieldRequired: "Това поле е задължително.",
  slugTaken: "Този линк вече се използва. Изберете друг.",
  slugInvalid: "Използвайте само малки букви, цифри и тирета.",
  commissionRange: "Комисионната трябва да е между 0 и 100%.",
  saveFailed: "Запазването е неуспешно. Проверете връзката си и опитайте отново.",

  // Панел „Вие задържате“ (D-06) — токените {pct}/{amount} се интерполират във формата (План 04)
  youKeepCommissionLine: "Комисионна на компанията ({pct}%): €{amount}",
  youKeepNetLine: "Вие задържате (преди такси): €{amount}",
  youKeepFeeNote:
    "Прогнозна такса на Stripe ~1.5% + €0.25 на резервация (прилага се при плащане, Фаза 3).",

  // Предупреждение при промяна на линк (D-10, коралово)
  slugEditWarning:
    "Промяната на този линк ще наруши всички вече споделени /pickup линкове. Старият линк ще спре да работи.",

  // Доставка на покана за шофьор (D-04)
  inviteLinkDeliveryNote:
    "Копирайте този линк и го изпратете на шофьора. Той ще зададе собствена парола и ще влезе.",
  inviteLinkCopyCta: "Копирай линка",
  driverAlreadyInvited: "Този шофьор вече е поканен.",

  // Деструктивни — потвърждения за деактивиране / изтриване
  deactivateDestinationConfirm: "Да деактивирам ли дестинацията?",
  deactivateDestinationConfirmBody:
    "Нейният /pickup линк ще спре да работи незабавно. Можете да я активирате отново по-късно.",
  deactivatePropertyConfirm: "Да деактивирам ли имота?",
  deactivatePropertyConfirmBody:
    "Първо деактивирайте неговите дестинации. Имот с активни дестинации не може да бъде деактивиран.",
  deactivateCompanyConfirm: "Да деактивирам ли компанията?",
  deactivateCompanyConfirmBody:
    "Първо деактивирайте нейните имоти. Компания с активни имоти не може да бъде деактивирана.",
  deleteForeverConfirm: "Да изтрия ли завинаги?",
  deleteForeverConfirmBody:
    "Това не може да бъде отменено. Достъпно е само защото нищо не препраща към този запис.",
  deactivateConfirmCta: "Деактивирай",
  deleteForeverCta: "Изтрий завинаги",
  keepCta: "Запази",

  // Помощен текст при блокирано деактивиране (D-12)
  deactivateCompanyBlocked:
    "Първо деактивирайте нейните имоти. Компания с активни имоти не може да бъде деактивирана.",
  deactivatePropertyBlocked:
    "Първо деактивирайте неговите дестинации. Имот с активни дестинации не може да бъде деактивиран.",

  // Етикети на полета
  companyNameLabel: "Име на компания",
  propertyNameLabel: "Име на имот",
  destinationLabelLabel: "Етикет на дестинация",
  slugLabel: "Линк (slug)",
  addressLabel: "Адрес",
  zoneLabel: "Зона / район",
  airportLabel: "Летище",
  priceLabel: "Цена",
  commissionPctLabel: "Комисионна %",
  activeLabel: "Активен",
  inactiveLabel: "Неактивен",
  driverNameLabel: "Име на шофьор",
  driverPhoneLabel: "Телефон на шофьор",
};
