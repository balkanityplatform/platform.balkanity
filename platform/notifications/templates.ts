import "server-only";
// platform/notifications/templates.ts — plain-HTML transactional email builders (NOTF-02/03).
//
// `import "server-only"` (line 1): these builders read server-side copy and run on the
// webhook/cron/lifecycle paths (PLAT-05). Each builder takes the resolved values + a
// `lang` BY ARGUMENT and returns `{ to, subject, html }` — they do NOT call getDict()
// (no request cookie on the webhook/cron path, Pitfall 2). They resolve copy via
// getDictFor(lang) (added in Plan 01) and build plain HTML strings — NO react-email.
//
// Email Layout Contract: single-column ~560px, slate #2F4858 body on white, inline teal
// #029B87 accent, at most ONE ≥44px CTA. NO external CSS/JS (email-client safe).
//
// PII boundary (threat T-07-SE6, Pitfall 5): ONLY buildAssignedEmail interpolates the
// driver first name + phone, and its `to` is always the row's guest_email. arrived /
// admin-booking / digest carry NO driver/guest PII in the body.
import { getDictFor, type Lang } from "@/platform/i18n/dictionary";

export type BuiltEmail = { to: string; subject: string; html: string };

// Minimal {token} interpolation (mirrors confirmation-email.ts fill()).
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

// Resolve a (possibly-null) row locale to a concrete Lang — null/garbage → EN (D-17).
function langFor(locale: string | null | undefined): Lang {
  return locale === "bg" ? "bg" : "en";
}

// HTML-escape interpolated user-derived values so a name/phone can never inject markup.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Shared single-column shell. heading + body paragraphs; optional ONE CTA.
function shell(opts: {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
}): string {
  const { heading, paragraphs, cta } = opts;
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:#2F4858;font-size:16px;line-height:1.5;">${p}</p>`,
    )
    .join("");
  const button = cta
    ? `<p style="margin:24px 0 0;"><a href="${cta.href}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 24px;background:#029B87;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:Montserrat,Arial,sans-serif;padding:24px;">
<tr><td>
<h1 style="margin:0 0 16px;color:#029B87;font-size:22px;">${heading}</h1>
${body}
${button}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Guest "driver assigned" — the ONLY email carrying driver name + phone, ONLY to the
//    guest (D-16, threat T-07-SE6). Locale resolved from the transfer row's locale.
export function buildAssignedEmail(args: {
  locale: string | null;
  guestEmail: string;
  driverName: string;
  driverPhone: string;
}): BuiltEmail {
  const t = getDictFor(langFor(args.locale));
  const html = shell({
    heading: t.emailAssignedHeading,
    paragraphs: [
      fill(t.emailAssignedBody, {
        driverName: esc(args.driverName),
        driverPhone: esc(args.driverPhone),
      }),
    ],
  });
  return { to: args.guestEmail, subject: t.emailAssignedSubject, html };
}

// ── Guest "driver arrived" — heads-up only, NO driver info (D-16). Guest locale.
export function buildArrivedEmail(args: {
  locale: string | null;
  guestEmail: string;
}): BuiltEmail {
  const t = getDictFor(langFor(args.locale));
  const html = shell({
    heading: t.emailArrivedHeading,
    paragraphs: [t.emailArrivedBody],
  });
  return { to: args.guestEmail, subject: t.emailArrivedSubject, html };
}

// ── Admin booking alert — EN-only (D-17). NO guest/driver PII in the body.
export function buildAdminBookingEmail(args: { to: string }): BuiltEmail {
  const t = getDictFor("en");
  const html = shell({
    heading: t.emailAdminBookingHeading,
    paragraphs: [t.emailAdminBookingBody],
  });
  return { to: args.to, subject: t.emailAdminBookingSubject, html };
}

// ── Driver invite — EN-only (D-17). ONE CTA "Set your password" → actionLink.
export function buildInviteEmail(args: {
  to: string;
  actionLink: string;
}): BuiltEmail {
  const t = getDictFor("en");
  const html = shell({
    heading: t.emailInviteHeading,
    paragraphs: [t.emailInviteBody],
    cta: { label: t.emailInviteCta, href: args.actionLink },
  });
  return { to: args.to, subject: t.emailInviteSubject, html };
}

// ── Driver daily digest — EN-only. Lists masked pool operational fields + own runs.
//    NEVER guest PII (threat T-07-SE6). Consumed by Plan 05's digest.ts (which supplies
//    the already-masked rows). Each item renders operational fields ONLY.
export type DigestItem = {
  arrival_at?: string | null;
  airport?: string | null;
  zone?: string | null;
  flight_no?: string | null;
  amount_cents?: number | null;
  pax?: number | null;
  luggage_count?: number | null;
};

export function buildDigestEmail(args: {
  poolItems: DigestItem[];
  ownRuns: DigestItem[];
}): BuiltEmail {
  const t = getDictFor("en");
  const renderItems = (items: DigestItem[]): string =>
    items
      .map((i) => {
        const parts = [
          i.arrival_at,
          i.airport,
          i.zone, // AREA only — masked, non-PII
          i.flight_no,
          i.pax != null ? `${i.pax} pax` : null,
          i.luggage_count != null ? `${i.luggage_count} bags` : null,
          i.amount_cents != null ? `${(i.amount_cents / 100).toFixed(2)}` : null,
        ].filter((p): p is string => p != null && p !== "");
        return `<li style="margin:0 0 8px;color:#2F4858;">${esc(parts.join(" · "))}</li>`;
      })
      .join("");

  const hasContent = args.poolItems.length > 0 || args.ownRuns.length > 0;
  const paragraphs: string[] = hasContent
    ? [
        t.emailDigestIntro,
        `<ul style="margin:0;padding-left:20px;">${renderItems(args.poolItems)}${renderItems(args.ownRuns)}</ul>`,
      ]
    : [t.emailDigestEmptyBody];

  const html = shell({ heading: t.emailDigestHeading, paragraphs });
  return { to: "", subject: t.emailDigestSubject, html };
}
