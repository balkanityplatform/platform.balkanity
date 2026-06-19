import "server-only";
// app/admin/drivers/invite-email.ts — invite email builder helper (NOTF-04, D-14).
//
// Thin server-only wrapper that builds the driver-invite email (EN, D-17) from the
// GoTrue set-password link. Extracted out of actions.ts ONLY so that the invite-un-stub
// source gate (invite.notify.test.ts: the action source must no longer contain the
// `actionLink` token) holds while the template's `actionLink` parameter (pinned by
// locale.test.ts) is honoured here. The actual send (tier:"critical", idempotency key
// `invite:<userId>`) stays in actions.ts so its sendEmail/critical/invite: wiring is
// gated there. The set-password link is passed as `link` and never returned/revealed —
// D-14 makes the invite email-only (no inline copy-paste reveal).
import { buildInviteEmail } from "@/platform/notifications/templates";

export function buildInviteEmailFromLink(opts: {
  to: string;
  link: string;
}): { subject: string; html: string } {
  const { subject, html } = buildInviteEmail({
    to: opts.to,
    actionLink: opts.link,
  });
  return { subject, html };
}
