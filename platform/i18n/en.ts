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
} as const;

// The dictionary contract — bg.ts is type-checked against this (parity gate).
// Keys are fixed to en.ts's set; values widen to `string` so a different
// translation is valid while a MISSING or mistyped key fails `tsc` (T-04-03).
export type Dict = { [K in keyof typeof en]: string };
