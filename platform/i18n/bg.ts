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
  // D-14: поканата е само по имейл — успешното състояние потвърждава изпращането.
  inviteEmailSentNote:
    "Поканата е изпратена. Шофьорът ще получи имейл с линк за задаване на парола и вход.",

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

  // --- Фаза 4: резервация + статус (UI-SPEC Copywriting Contract) ---

  // Страница за резервация — /pickup/<slug> (BOOK-01/02/04). {airport}/{zone}/{amount} се интерполират сървърно.
  bookingFareCaption: "Трансфер от летище · {airport} → {zone}",
  bookingTotalToPay: "Общо за плащане",
  bookingYourDetails: "Вашите данни",
  bookingFullNameLabel: "Пълно име",
  bookingEmailLabel: "Имейл",
  bookingPhoneLabel: "Телефонен номер",
  bookingFlightLabel: "Номер на полет",
  bookingArrivalDateLabel: "Дата на пристигане",
  bookingArrivalTimeLabel: "Час на пристигане",
  bookingPassengersLabel: "Пътници",
  bookingPassengersHelp: "1 до 8",
  bookingLuggageLabel: "Багаж (по избор)",
  bookingNotesLabel: "Бележки за вашия шофьор (по избор)",
  bookingNotesPlaceholder:
    "Каквото шофьорът трябва да знае — напр. нужно столче за кола, място за среща.",
  bookingContinueCta: "Продължи към плащане",
  bookingContinuePending: "Стартиране на плащането…",
  bookingBackCta: "Назад",

  // Предплатено и невъзстановимо оповестяване (BOOK-04 — видимо ПРЕДИ плащане).
  disclosureHeading: "Предплатено и невъзстановимо",
  disclosureBody:
    "Плащате пълната цена сега. Тази резервация е невъзстановима след плащане — моля, проверете повторно датата, часа на пристигане и номера на полета, преди да продължите.",
  disclosureCheckboxLabel:
    "Разбирам, че тази резервация е предплатена и невъзстановима.",
  disclosureBlockedError:
    "Моля, потвърдете, че разбирате, че резервацията е невъзстановима.",

  // Грешки при валидиране на резервацията (BOOK-02 — сървърен zod, показани инлайн).
  bookingFieldRequired: "Това поле е задължително.",
  bookingInvalidEmail: "Въведете валиден имейл адрес.",
  bookingInvalidPhone: "Въведете валиден телефонен номер, включително код на държавата.",
  bookingArrivalPast: "Изберете дата и час на пристигане в бъдещето.",
  bookingPassengersRange: "Пътниците трябва да са между 1 и 8.",
  bookingFailed:
    "Плащането не можа да бъде стартирано. Проверете връзката си и опитайте отново.",

  // Неактивен / недостъпен slug.
  slugUnavailableHeading: "Този линк за вземане не е достъпен",
  slugUnavailableBody:
    "Тази дестинация вече не е достъпна за резервация. Моля, свържете се с компанията, която сподели този линк.",

  // Имейл за потвърждение (BOOK-06 — генериран в тази фаза, изпращането СТЪБНАТО → Фаза 7).
  confirmEmailSubject: "Вашият трансфер от летището е потвърден — платени €{amount}",
  confirmEmailHeading: "Плащането е получено — всичко е готово",
  confirmEmailBody:
    "Получихме вашето плащане от €{amount} за вашия трансфер на {arrivalDate}. Следете шофьора и статуса на вземането по всяко време чрез защитения линк по-долу.",
  confirmEmailCta: "Проследи резервацията ми",
  confirmEmailFooter: "Тази резервация е предплатена и невъзстановима.",

  // Страница за статус — /status/<id> (BOOK-07, AUTH-02, SC4).
  statusTitle: "Статус на резервацията",
  statusYourTrip: "Вашето пътуване",
  statusRouteLine: "{airport} → {zone}",
  statusArrivalLine: "Пристигане {arrivalDate} в {arrivalTime}",
  statusFlightLine: "Полет {flightNo}",
  statusPaxLine: "{pax} пътник(ци)",
  statusTimelineHeading: "Статус",
  statusReceiptHeading: "Плащане",
  statusReceiptPaidLine: "Платени €{amount} на {paidDate}",
  statusReceiptSubNote: "Предплатено · невъзстановимо",
  statusDriverHeading: "Вашият шофьор",
  statusDriverLine: "{driverFirstName} · {driverPhone}",
  statusDriverPreClaimNote:
    "Ще покажем данните на вашия шофьор тук веднага щом трансферът ви бъде поет.",
  statusExpired: "Този линк е изтекъл или не е валиден. Заявете нов линк по-долу.",
  statusExpiredCta: "Вземи нов линк",

  // Страница за проследяване / повторен достъп — /track (D-07, AUTH-02).
  trackTitle: "Проследете резервацията си",
  trackBody:
    "Въведете имейла, с който направихте резервацията, и ще ви изпратим защитен линк към статуса на резервацията ви.",
  trackEmailLabel: "Имейл",
  trackSendCta: "Изпрати ми линк към резервацията",
  trackSuccessNeutral:
    "Ако този имейл има резервация, изпратихме защитен линк към него. Проверете входящата си поща.",
  trackError: "Линкът не можа да бъде изпратен. Проверете връзката си и опитайте отново.",

  // Страница след плащане — /pay/success (BOOK-05, SC2/SC5).
  paySuccessTitle: "Плащане за трансфер",
  paySuccessNoRef: "Не е посочена референция за трансфер.",
  paySuccessNotFound: "Не успяхме да намерим този трансфер.",
  paySuccessConfirming: "Плащането е получено — потвърждаваме го.",
  paySuccessTrackCta: "Вижте статуса на резервацията си",
  paySuccessTrackFallback: "Или поискайте нов линк по имейл.",

  // --- Фаза 6: шофьорско PWA + админ конзола за трансфери (UI-SPEC Copywriting Contract) ---

  // Шофьорско PWA — пул / поемане / маршрут (CLAIM-01/04/05/06, D-03/D-04/D-06)
  claimTransferCta: "Поеми",
  poolEmptyHeading: "Няма трансфери за поемане",
  poolEmptyBody:
    "Новите платени трансфери се появяват тук автоматично. Дръпнете за опресняване или проверете отново скоро.",
  claimLostToast: "Току-що поет от друг шофьор",
  claimFailedToast: "Поемането е неуспешно. Проверете връзката си и опитайте отново.",
  myRunTitle: "Моят маршрут",
  runEmptyHeading: "Няма активни трансфери",
  runEmptyBody: "Поемете трансфер от пула, за да започнете маршрута си.",
  // CTA за придвижване на статуса — етикетът се определя според следващия легален преход (D-04/D-05)
  advanceToEnRouteCta: "Започни шофиране",
  advanceToArrivedCta: "Отбележи пристигане",
  advanceToPickedUpCta: "Отбележи взет пътник",
  advanceToCompletedCta: "Отбележи завършен",
  completedTodayTitle: "Завършени днес",
  advanceFailedToast: "Обновяването е неуспешно. Проверете връзката си и опитайте отново.",

  // Админ конзола за трансфери — списък / детайли / операции (OPS-01/02/03/04, D-07..D-12)
  transfersTitle: "Трансфери",
  filterByStatusLabel: "Статус",
  needsAttentionFilterCta: "Изискват внимание",
  transferSearchPlaceholder: "Търсене по име, номер на полет или дестинация",
  transfersEmptyHeading: "Все още няма трансфери",
  transfersEmptyBody: "Платените резервации се появяват тук, щом гостите завършат плащането.",
  transfersNoMatchBody: "Няма трансфери, отговарящи на филтрите ви.",
  needsAttentionBadge: "Изисква внимание",
  assignDriverCta: "Назначи шофьор",
  reassignDriverCta: "Преназначи",
  releaseTransferCta: "Освободи",
  cancelTransferCta: "Отмени трансфера",
  refundTransferCta: "Възстанови сума",
  actionReasonLabel: "Причина (записва се)",
  refundAmountLabel: "Сума за възстановяване",
  // Токените {fee}/{amount} остават ЛИТЕРАЛНИ — консумиращият компонент ги замества (D-12).
  refundFeeDisclosure:
    "Таксата за обработка на Stripe от ~€{fee} НЕ се възстановява с тази сума.",
  cancelOfferRefundCta: "Да издам ли и възстановяване?",
  // Деструктивни потвърждения (D-10/D-11) — отмяната никога не възстановява автоматично; причина задължителна.
  cancelTransferConfirm:
    "Да отменя ли този трансфер? На госта не се възстановява автоматично сума — използвайте „Възстанови сума“ отделно, ако е необходимо. Въведете причина, за да продължите.",
  refundConfirm:
    "Да издам ли възстановяване от €{amount}? Таксата за обработка от ~€{fee} не се възстановява. Въведете причина, за да продължите.",
  reassignConfirm: "Да преназнача ли този трансфер на друг шофьор?",
  releaseConfirm:
    "Да освободя ли този трансфер обратно в пула? Той става отново достъпен за поемане. Въведете причина, за да продължите.",
  transferDriverIdLabel: "ID на шофьор",
  confirmActionCta: "Потвърди",

  // --- Фаза 7: известия (UI-SPEC Copywriting Contract) ---

  // Камбана / емисия известия (Шофьор + Админ). {count} се интерполира в a11y етикета.
  alertsTrigger: "Известия",
  alertsTriggerAria: "Известия, {count} непрочетени",
  alertsPanelTitle: "Известия",
  markAllReadCta: "Отбележи всички като прочетени",
  alertsEmptyHeading: "Нямате нови известия",
  alertsEmptyBody:
    "Новите известия за трансфери и резервации ще се появяват тук.",
  alertsLoadFailed:
    "Известията не можаха да се заредят. Проверете връзката си и опитайте отново.",

  // Заглавия на известия (пре-рендирани в notifications.title)
  notifNewPoolTitle: "Нов трансфер за поемане",
  notifRunAssignedTitle: "Назначен ви е трансфер",
  notifRunReassignedTitle: "Вашият трансфер беше преназначен",
  notifRunReleasedTitle: "Вашият трансфер беше върнат в пула",
  notifRunCancelledTitle: "Вашият трансфер беше отменен",
  notifNewBookingTitle: "Нова платена резервация",
  notifEmailCapTitle: "Лимитът за имейли наближава — известителните имейли са на пауза",

  // Дневен дайджест — настройки за шофьора (D-07/D-08)
  digestPrefTitle: "Дневен дайджест",
  digestPrefBody:
    "Получавайте един сутрешен имейл с трансферите за поемане и вашите маршрути за деня. Изключено по подразбиране.",
  digestEnableLabel: "Изпращай ми дневен дайджест",
  digestTimeLabel: "Изпрати в",
  digestSaveCta: "Запази настройките за дайджест",
  digestSavedToast: "Настройките за дайджест са запазени",
  digestSaveFailed:
    "Запазването е неуспешно. Проверете връзката си и опитайте отново.",

  // Теми на транзакционни имейли (шаблоните се изграждат в План 02)
  emailAssignedSubject: "Вашият шофьор е назначен",
  emailArrivedSubject: "Вашият шофьор пристигна",
  emailAdminBookingSubject: "Нова платена резервация",
  emailInviteSubject: "Поканени сте да шофирате с Balkanity",
  emailDigestSubject: "Вашият ден с Balkanity: трансфери за поемане",

  // Текст на имейлите (plain-HTML шаблони, План 02). {token} се интерполира чрез fill().
  // Гост „шофьорът е назначен“ — ЕДИНСТВЕНИЯТ имейл с име + телефон на шофьора, САМО до госта (D-16).
  emailAssignedHeading: "Вашият шофьор е на път",
  emailAssignedBody:
    "Вашият шофьор {driverName} ({driverPhone}) беше назначен за вашия трансфер от летището. Ще ви посрещне при пристигането.",
  // Гост „шофьорът пристигна“ — само уведомление.
  emailArrivedHeading: "Вашият шофьор пристигна",
  emailArrivedBody:
    "Вашият шофьор пристигна на мястото за вземане за вашия трансфер. Моля, отидете до мястото за среща.",
  // Админ известие за резервация (само EN — BG за пълнота на паритета).
  emailAdminBookingHeading: "Нова платена резервация",
  emailAdminBookingBody:
    "Нов трансфер беше платен и вече е в пула за поемане.",
  // Покана за шофьор (само EN — BG за пълнота). Един CTA бутон (D-13).
  emailInviteHeading: "Поканени сте да шофирате с Balkanity",
  emailInviteBody:
    "Поканени сте да се присъедините към Balkanity като шофьор. Задайте паролата си, за да активирате акаунта си и да започнете да поемате трансфери.",
  emailInviteCta: "Задайте паролата си",
  // Дневен дайджест (само EN — BG за пълнота). emailDigestEmptyBody при липса на трансфери.
  emailDigestHeading: "Вашият ден с Balkanity",
  emailDigestIntro:
    "Ето трансферите за поемане и вашите маршрути за днес.",
  emailDigestEmptyBody:
    "В момента няма трансфери за поемане. Проверявайте приложението през деня за нови.",

  // --- Фаза 8: здраве на платформата (UI-SPEC Copywriting Contract) ---

  // Заглавие на страница / панел
  healthTitle: "Здраве на платформата",

  // Измервател на лимита за имейли (HLTH-03). Цифрата се изобразява като „{sent} / {cap}“;
  // всяко коралово/кехлибарено състояние носи словесен ТЕКСТОВ маркер (WCAG 1.4.1).
  emailCapLabel: "Изпратени имейли днес",
  emailCapWarning: "Наближава дневният лимит",
  emailCapAtCap: "Дневният лимит е достигнат — некритичните имейли са на пауза",
  emailCapZero: "Все още няма изпратени имейли днес.",

  // Панел „заседнали трансфери“ (HLTH-04). Бейджът на реда е коралов главен ТЕКСТОВ маркер.
  stuckHeading: "Заседнали трансфери",
  stuckBadge: "НЕПОЕТ",
  stuckEmptyHeading: "Няма заседнали трансфери",
  stuckEmptyBody:
    "Всеки платен трансфер има шофьор или има достатъчно време. В момента нищо не изисква намеса.",

  // Панел „равнение на плащанията“ (HLTH-02). Бейджът на реда е коралов главен ТЕКСТОВ маркер.
  reconHeading: "Равнение на плащанията",
  reconBadge: "ЗА ПРЕГЛЕД",
  reconEmptyHeading: "Всички плащания са равнени",
  reconEmptyBody:
    "Всяка платена Stripe сесия има съответстващ платен трансфер. Няма несъответствия за проверка.",

  // CTA за разрешаване (изчиства здравно събитие след ръчно повторение на webhook) + грешка на уиджета.
  healthResolveCta: "Отбележи като разрешено",
  healthLoadFailed: "Здравните данни не можаха да се заредят. Опреснете, за да опитате отново.",

  // --- Фаза 9: dev-only showcase на дизайн системата (D-11) ---
  // Заглавия на секции за временния /dev/design-system маршрут (404 в продукция).
  // Само собственото chrome на showcase-а е ключирано; вътрешните статус етикети на
  // StatusDot/stepper остават в STATE_META (само EN, съществуващ модел).
  devShowcaseTitle: "Дизайн система",
  devShowcaseIntro:
    "Основа на дизайн системата (Фаза 9) — всеки токен и компонент, показан в състоянията и вариантите си. Само за разработка; не е част от потребителска повърхност.",
  devShowcaseTokensHeading: "Токени",
  devShowcaseColoursHeading: "Цветове",
  devShowcaseRadiiHeading: "Радиуси",
  devShowcaseSpacingHeading: "Отстояния",
  devShowcaseTypeScaleHeading: "Типографска скала",
  devShowcaseStatusDotHeading: "Статус бейдж",
  devShowcaseStatusDotVariantHeading: "Вариант",
  devShowcaseStepperHeading: "Степер на жизнения цикъл",
  devShowcaseRouteMotifHeading: "Мотив на маршрута",
};
