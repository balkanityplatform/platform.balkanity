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
} as const;

// The dictionary contract — bg.ts is type-checked against this (parity gate).
// Keys are fixed to en.ts's set; values widen to `string` so a different
// translation is valid while a MISSING or mistyped key fails `tsc` (T-04-03).
export type Dict = { [K in keyof typeof en]: string };
