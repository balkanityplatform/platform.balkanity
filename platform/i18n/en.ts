// platform/i18n/en.ts — English dictionary (PLAT-04, D-04: EN is the default).
//
// SOURCE OF TRUTH for the dictionary shape: `Dict = typeof en`. Every Phase 1
// string id from the UI-SPEC Copywriting Contract lives here with its EN canonical
// copy; bg.ts must satisfy this exact shape (a missing/extra key fails `tsc`).
// Plain typed JSON — no i18n library (D-05).
export const en = {
  signInHeading: "Sign in",
  signInCta: "Sign in",
  signInError: "Invalid email or password.",
  emailLabel: "Email address",
  passwordLabel: "Password",
  forgotPasswordLink: "Forgot password?",
  forgotPasswordHeading: "Reset your password",
  sendResetCta: "Send reset link",
  resetEmailSent:
    "If an account exists for that email, we've sent a password reset link.",
  setPasswordHeading: "Set your password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm password",
  setPasswordCta: "Save password",
  passwordMismatch: "The passwords don't match. Please try again.",
  passwordTooShort: "Use at least 8 characters for your password.",
  emptyHeading: "Nothing here yet",
  emptyBody:
    "Your console is ready. Companies, properties, and transfers will appear here as you set them up.",
  offlineHeading: "You're offline",
  offlineBody:
    "Balkanity needs a connection for this page. We'll reconnect automatically when you're back online.",
  langToggle: "EN / BG",

  // --- Phase 2: supply-side onboarding (UI-SPEC Copywriting Contract) ---

  // Page titles
  companiesTitle: "Companies",
  propertiesTitle: "Properties",
  destinationsTitle: "Destinations",
  driversTitle: "Drivers",
  inviteDriverTitle: "Invite driver",

  // Primary / secondary CTAs (edit-mode reuses saveChangesCta)
  createCompanyCta: "Create company",
  addPropertyCta: "Add property",
  saveDestinationCta: "Save destination",
  generateInviteLinkCta: "Generate invite link",
  saveChangesCta: "Save changes",
  cancelCta: "Cancel",

  // Empty states
  companiesEmptyHeading: "No companies yet",
  companiesEmptyBody:
    "Create your first company to start adding properties and bookable destinations.",
  propertiesEmptyHeading: "No properties yet",
  propertiesEmptyBody:
    "Add a property under this company. Each property can have one or more bookable destinations.",
  destinationsEmptyHeading: "No destinations yet",
  destinationsEmptyBody:
    "Add a destination to generate its shareable /pickup link and set its price.",
  driversEmptyHeading: "No drivers invited yet",
  driversEmptyBody:
    "Invite a driver to build your claim pool. Drivers set their own password from the link you share.",

  // Errors
  fieldRequired: "This field is required.",
  slugTaken: "That link is already in use. Choose a different one.",
  slugInvalid: "Use lowercase letters, numbers, and hyphens only.",
  commissionRange: "Commission must be between 0 and 100%.",
  saveFailed: "Couldn't save. Check your connection and try again.",

  // "You keep" panel (D-06) — {pct}/{amount} tokens interpolated in the form island (Plan 04)
  youKeepCommissionLine: "Company commission ({pct}%): €{amount}",
  youKeepNetLine: "You keep (before fees): €{amount}",
  youKeepFeeNote:
    "Estimated Stripe fee ~1.5% + €0.25 per booking (applied at payment, Phase 3).",

  // Slug edit warning (D-10, coral)
  slugEditWarning:
    "Changing this link will break any /pickup links you've already shared. The old link will stop working.",

  // Driver invite delivery (D-04)
  inviteLinkDeliveryNote:
    "Copy this link and send it to the driver. They'll set their own password and sign in.",
  inviteLinkCopyCta: "Copy link",
  driverAlreadyInvited: "That driver has already been invited.",
  // D-14: invite is email-only — the success state confirms the email was sent.
  inviteEmailSentNote:
    "Invite sent. The driver will receive an email with a link to set their password and sign in.",

  // Destructive — deactivate / delete confirmations
  deactivateDestinationConfirm: "Deactivate destination?",
  deactivateDestinationConfirmBody:
    "Its /pickup link will stop working immediately. You can reactivate it later.",
  deactivatePropertyConfirm: "Deactivate property?",
  deactivatePropertyConfirmBody:
    "Deactivate its destinations first. A property with active destinations can't be deactivated.",
  deactivateCompanyConfirm: "Deactivate company?",
  deactivateCompanyConfirmBody:
    "Deactivate its properties first. A company with active properties can't be deactivated.",
  deleteForeverConfirm: "Delete permanently?",
  deleteForeverConfirmBody:
    "This can't be undone. Only available because nothing references this record.",
  deactivateConfirmCta: "Deactivate",
  deleteForeverCta: "Delete permanently",
  keepCta: "Keep",

  // Blocked-deactivation helper copy (D-12)
  deactivateCompanyBlocked:
    "Deactivate its properties first. A company with active properties can't be deactivated.",
  deactivatePropertyBlocked:
    "Deactivate its destinations first. A property with active destinations can't be deactivated.",

  // Field labels
  companyNameLabel: "Company name",
  propertyNameLabel: "Property name",
  destinationLabelLabel: "Destination label",
  slugLabel: "Link slug",
  addressLabel: "Address",
  zoneLabel: "Zone / area",
  airportLabel: "Airport",
  priceLabel: "Price",
  commissionPctLabel: "Commission %",
  activeLabel: "Active",
  inactiveLabel: "Inactive",
  driverNameLabel: "Driver name",
  driverPhoneLabel: "Driver phone",

  // --- Phase 4: booking + status (UI-SPEC Copywriting Contract) ---

  // Booking page — /pickup/<slug> (BOOK-01/02/04). {airport}/{zone}/{amount} interpolated server-side.
  bookingFareCaption: "Airport transfer · {airport} → {zone}",
  bookingTotalToPay: "Total to pay",
  bookingYourDetails: "Your details",
  bookingFullNameLabel: "Full name",
  bookingEmailLabel: "Email",
  bookingPhoneLabel: "Phone number",
  bookingFlightLabel: "Flight number",
  bookingArrivalDateLabel: "Arrival date",
  bookingArrivalTimeLabel: "Arrival time",
  bookingPassengersLabel: "Passengers",
  bookingPassengersHelp: "1 to 8",
  bookingLuggageLabel: "Bags (optional)",
  bookingNotesLabel: "Notes for your driver (optional)",
  bookingNotesPlaceholder:
    "Anything the driver should know — e.g. car seat needed, meeting point.",
  bookingContinueCta: "Pay €{amount} & confirm",
  bookingContinuePending: "Confirming…",
  bookingBackCta: "Back",

  // Prepaid & non-refundable disclosure (BOOK-04 — visible BEFORE payment).
  disclosureHeading: "Prepaid & non-refundable",
  disclosureBody:
    "You pay the full fare now. This booking is non-refundable once paid — please double-check your arrival date, time, and flight number before continuing.",
  disclosureCheckboxLabel:
    "I understand this booking is prepaid and non-refundable.",
  disclosureBlockedError:
    "Please confirm you understand the booking is non-refundable.",

  // Booking validation errors (BOOK-02 — server-side zod, surfaced inline).
  bookingFieldRequired: "This field is required.",
  bookingInvalidEmail: "Enter a valid email address.",
  bookingInvalidPhone: "Enter a valid phone number, including country code.",
  bookingArrivalPast: "Choose an arrival date and time in the future.",
  bookingPassengersRange: "Passengers must be between 1 and 8.",
  bookingFailed:
    "Couldn't start your payment. Check your connection and try again.",

  // Inactive / unavailable slug.
  slugUnavailableHeading: "This pickup link isn't available",
  slugUnavailableBody:
    "This destination is no longer bookable. Please contact the company that shared this link.",

  // Confirmation email (BOOK-06 — generated this phase, send STUBBED → Phase 7).
  confirmEmailSubject: "Your airport transfer is confirmed — €{amount} paid",
  confirmEmailHeading: "Payment received — you're all set",
  confirmEmailBody:
    "We've received your payment of €{amount} for your transfer on {arrivalDate}. Track your driver and pickup status any time using the secure link below.",
  confirmEmailCta: "Track my booking",
  confirmEmailFooter: "This booking is prepaid and non-refundable.",

  // Status page — /status/<id> (BOOK-07, AUTH-02, SC4).
  statusTitle: "Booking status",
  statusYourTrip: "Your trip",
  statusRouteLine: "{airport} → {zone}",
  statusArrivalLine: "Arriving {arrivalDate} at {arrivalTime}",
  statusFlightLine: "Flight {flightNo}",
  statusPaxLine: "{pax} passenger(s)",
  statusTimelineHeading: "Status",
  statusReceiptHeading: "Payment",
  statusReceiptPaidLine: "Paid €{amount} on {paidDate}",
  statusReceiptSubNote: "Prepaid · non-refundable",
  statusDriverHeading: "Your driver",
  statusDriverLine: "{driverFirstName} · {driverPhone}",
  statusDriverPreClaimNote:
    "We'll show your driver's details here as soon as your transfer is claimed.",
  statusExpired: "This link has expired or isn't valid. Request a fresh link below.",
  statusExpiredCta: "Get a new link",

  // Track / re-access page — /track (D-07, AUTH-02).
  trackTitle: "Track your booking",
  trackBody:
    "Enter the email you booked with and we'll send you a secure link to your booking status.",
  trackEmailLabel: "Email",
  trackSendCta: "Send my booking link",
  trackSuccessNeutral:
    "If that email has a booking, we've sent a secure link to it. Check your inbox.",
  trackError: "Couldn't send the link. Check your connection and try again.",

  // Post-Checkout display-only page — /pay/success (BOOK-05, SC2/SC5). Display-only,
  // never authoritative "paid" except the webhook-confirmed branch.
  paySuccessTitle: "Transfer payment",
  paySuccessNoRef: "No transfer reference provided.",
  paySuccessNotFound: "We couldn't find that transfer.",
  paySuccessConfirming: "Payment received — we're confirming it.",
  paySuccessTrackCta: "View your booking status",
  paySuccessTrackFallback: "Or request a fresh link by email.",

  // --- Phase 10: guest "Transfer Pass" surface (UI-SPEC Copywriting Contract) ---
  // Shared boarding-pass shell + details-grid captions + Stripe trust footer +
  // the restyled /pay/cancel page. Captions are styling-uppercased in the
  // components (NOT baked into the string). passRefLabel uses the in-source
  // fill() {token} interpolation, not an i18n library.
  passEyebrow: "Transfer Pass",
  passRefLabel: "Ref: {shortId}",
  passDate: "Date",
  passFlightNo: "Flight No.",
  passGuests: "Guests",
  passTime: "Time",
  passPaymentPending: "Pending prepayment",
  payTrustFooter: "Secured payment · powered by Stripe",
  payCancelTitle: "Payment cancelled",
  payCancelBody: "Your payment was not completed.",
  payCancelTrackCta: "Track your booking",

  // --- Phase 6: driver PWA + admin transfers console (UI-SPEC Copywriting Contract) ---

  // Driver PWA — pool / claim / run (CLAIM-01/04/05/06, D-03/D-04/D-06)
  claimTransferCta: "Claim",
  poolEmptyHeading: "No transfers to claim",
  poolEmptyBody:
    "New paid transfers appear here automatically. Pull to refresh or check back shortly.",
  claimLostToast: "Just claimed by another driver",
  claimFailedToast: "Couldn't claim. Check your connection and try again.",
  myRunTitle: "My run",
  runEmptyHeading: "No active transfers",
  runEmptyBody: "Claim a transfer from the pool to start your run.",
  // Advance-status CTA — label resolves per the next legal edge via lifecycle.ts (D-04/D-05)
  advanceToEnRouteCta: "Start driving",
  advanceToArrivedCta: "Mark arrived",
  advanceToPickedUpCta: "Mark picked up",
  advanceToCompletedCta: "Mark completed",
  completedTodayTitle: "Completed today",
  advanceFailedToast: "Couldn't update. Check your connection and try again.",

  // Admin transfers console — list / detail / ops actions (OPS-01/02/03/04, D-07..D-12)
  transfersTitle: "Transfers",
  filterByStatusLabel: "Status",
  needsAttentionFilterCta: "Needs attention",
  transferSearchPlaceholder: "Search name, flight no. or destination",
  transfersEmptyHeading: "No transfers yet",
  transfersEmptyBody: "Paid bookings appear here as guests complete checkout.",
  transfersNoMatchBody: "No transfers match your filters.",
  needsAttentionBadge: "Needs attention",
  assignDriverCta: "Assign driver",
  reassignDriverCta: "Reassign",
  releaseTransferCta: "Release",
  cancelTransferCta: "Cancel transfer",
  refundTransferCta: "Refund",
  actionReasonLabel: "Reason (recorded)",
  refundAmountLabel: "Refund amount",
  // {fee}/{amount} tokens stay LITERAL — the consuming component substitutes them (D-12).
  refundFeeDisclosure:
    "The ~€{fee} Stripe processing fee is NOT recovered by this refund.",
  cancelOfferRefundCta: "Also issue a refund?",
  // Destructive confirmations (D-10/D-11) — cancel never auto-refunds; reason required.
  cancelTransferConfirm:
    "Cancel this transfer? The guest is not automatically refunded — use Refund separately if needed. Enter a reason to continue.",
  refundConfirm:
    "Issue a €{amount} refund? The ~€{fee} processing fee is not recovered. Enter a reason to continue.",
  reassignConfirm: "Reassign this transfer to another driver?",
  releaseConfirm:
    "Release this transfer back to the pool? It becomes claimable again. Enter a reason to continue.",
  // Assign/reassign target the driver by id (the admin pastes/enters the driver's id) and a
  // generic confirm CTA closes each destructive dialog (the dismiss CTA reuses cancelCta).
  transferDriverIdLabel: "Driver id",
  confirmActionCta: "Confirm",

  // --- Phase 7: notifications (UI-SPEC Copywriting Contract) ---

  // In-app bell / feed (Driver + Admin). {count} interpolated in the trigger a11y label.
  alertsTrigger: "Alerts",
  alertsTriggerAria: "Alerts, {count} unread",
  alertsPanelTitle: "Alerts",
  markAllReadCta: "Mark all read",
  alertsEmptyHeading: "You're all caught up",
  alertsEmptyBody:
    "New alerts about transfers and bookings will appear here.",
  alertsLoadFailed:
    "Couldn't load alerts. Check your connection and try again.",

  // In-app notification item titles (pre-rendered into notifications.title)
  notifNewPoolTitle: "New transfer available to claim",
  notifRunAssignedTitle: "You were assigned a transfer",
  notifRunReassignedTitle: "Your transfer was reassigned",
  notifRunReleasedTitle: "Your transfer was released to the pool",
  notifRunCancelledTitle: "Your transfer was cancelled",
  notifNewBookingTitle: "New paid booking",
  notifEmailCapTitle: "Email cap nearing — best-effort emails paused",

  // Driver daily-digest preference UI (D-07/D-08)
  digestPrefTitle: "Daily digest",
  digestPrefBody:
    "Get one morning email with the day's claimable transfers and your runs. Off by default.",
  digestEnableLabel: "Email me a daily digest",
  digestTimeLabel: "Send at",
  digestSaveCta: "Save digest settings",
  digestSavedToast: "Digest preferences saved",
  digestSaveFailed:
    "Couldn't save. Check your connection and try again.",

  // Transactional email subjects (templates built in Plan 02)
  emailAssignedSubject: "Your driver is assigned",
  emailArrivedSubject: "Your driver has arrived",
  emailAdminBookingSubject: "New paid booking",
  emailInviteSubject: "You're invited to drive with Balkanity",
  emailDigestSubject: "Your Balkanity day: transfers to claim",

  // Email body copy (plain-HTML templates, Plan 02). {token} interpolated via fill().
  // Guest "driver assigned" — the ONLY email carrying driver name + phone, ONLY to the guest (D-16).
  emailAssignedHeading: "Your driver is on the way",
  emailAssignedBody:
    "Your driver {driverName} ({driverPhone}) has been assigned to your airport transfer. They'll meet you on arrival.",
  // Guest "driver arrived" — heads-up only, no PII beyond the assignment already sent.
  emailArrivedHeading: "Your driver has arrived",
  emailArrivedBody:
    "Your driver has arrived at the pickup point for your transfer. Please head to the meeting point.",
  // Admin booking alert (EN-only).
  emailAdminBookingHeading: "New paid booking",
  emailAdminBookingBody:
    "A new transfer has been paid and is now in the claim pool.",
  // Driver invite (EN-only, un-stubbed in Plan 02). One CTA button (D-13).
  emailInviteHeading: "You're invited to drive with Balkanity",
  emailInviteBody:
    "You've been invited to join Balkanity as a driver. Set your password to activate your account and start claiming transfers.",
  emailInviteCta: "Set your password",
  // Driver daily digest (EN-only). emailDigestEmptyBody used when nothing is claimable.
  emailDigestHeading: "Your Balkanity day",
  emailDigestIntro:
    "Here are the transfers available to claim and your runs for today.",
  emailDigestEmptyBody:
    "No transfers are available to claim right now. Check the app through the day for new ones.",

  // --- Phase 8: platform health (UI-SPEC Copywriting Contract) ---

  // Page / panel heading
  healthTitle: "Platform health",

  // Email-cap gauge (HLTH-03). The figure renders as "{sent} / {cap}"; every coral/amber
  // state carries a worded TEXT marker (WCAG 1.4.1 — colour is never the sole signal).
  emailCapLabel: "Emails sent today",
  emailCapWarning: "Approaching daily cap",
  emailCapAtCap: "Daily cap reached — non-critical emails paused",
  emailCapZero: "No emails sent yet today.",

  // Stuck-transfer panel (HLTH-04). The row badge is the coral uppercase TEXT marker.
  stuckHeading: "Stuck transfers",
  stuckBadge: "UNCLAIMED",
  stuckEmptyHeading: "No stuck transfers",
  stuckEmptyBody:
    "Every paid transfer has a driver or has time to spare. Nothing needs chasing right now.",

  // Reconciliation panel (HLTH-02). The row badge is the coral uppercase TEXT marker.
  reconHeading: "Payment reconciliation",
  reconBadge: "NEEDS REVIEW",
  reconEmptyHeading: "All payments reconciled",
  reconEmptyBody:
    "Every paid Stripe session has a matching paid transfer. No discrepancies to investigate.",

  // Resolve CTA (clears a health event after human-driven webhook replay) + widget error state.
  healthResolveCta: "Mark resolved",
  healthLoadFailed: "Couldn't load health data. Refresh to try again.",

  // --- Phase 9: dev-only design-system showcase chrome (D-11) ---
  // Section headings for the throwaway, production-gated /dev/design-system route.
  // Only the showcase's OWN chrome is keyed; component-internal StatusDot/stepper
  // status labels stay in STATE_META (English-only, existing pattern).
  devShowcaseTitle: "Design system",
  devShowcaseIntro:
    "Phase 9 design-system foundation — every token and component rendered across its states and variants. Dev-only; not part of any user-facing surface.",
  devShowcaseTokensHeading: "Tokens",
  devShowcaseColoursHeading: "Colours",
  devShowcaseRadiiHeading: "Radii",
  devShowcaseSpacingHeading: "Spacing",
  devShowcaseTypeScaleHeading: "Type scale",
  devShowcaseStatusDotHeading: "Status badge",
  devShowcaseStatusDotVariantHeading: "Variant",
  devShowcaseStepperHeading: "Lifecycle stepper",
  devShowcaseRouteMotifHeading: "Route motif",

  // --- Phase 11: driver PWA rebuild (UI-SPEC Copywriting Contract) ---
  // Presentation-only re-skin. Bottom-nav labels (DUI-02), the coral pool badge
  // (DUI-01, presentation copy over status='paid' — NOT a new TransferState), the
  // en_route→arrived advance label (DUI-04), the Profile sign-out CTA (D-05), and
  // the detail-grid caption keys that replace the hardcoded English in run/[id].
  navAvailable: "Available",
  navMyTrips: "My Trips",
  navProfile: "Profile",
  driverUnclaimedBadge: "Unclaimed",
  driverConfirmArrivalCta: "Confirm arrival",
  driverSignOutCta: "Sign out",
  driverArrivalLabel: "Arrival",
  driverFlightLabel: "Flight",
  driverFareLabel: "Fare",
  driverPassengersLabel: "Passengers",
  driverLuggageLabel: "Luggage",
  driverGuestNameLabel: "Guest name",
  driverGuestPhoneLabel: "Guest phone",
  driverNotesLabel: "Notes",
} as const;

// The dictionary contract — bg.ts is type-checked against this (parity gate).
// Keys are fixed to en.ts's set; values widen to `string` so a different
// translation is valid while a MISSING or mistyped key fails `tsc` (T-04-03).
export type Dict = { [K in keyof typeof en]: string };
