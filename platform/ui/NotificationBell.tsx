"use client";
// platform/ui/NotificationBell.tsx — Alerts bell + feed panel client island (NOTF-01, D-04).
//
// The drivers' PRIMARY in-app channel and the admin alarm surface. A labelled "Alerts"
// text control (UI-SPEC Bell Affordance Decision — a plain word label, no glyph and no
// pictographic mark of any kind; the brand never invents a mark) with a teal numeric unread
// badge. Opening it shows the caller's OWN notifications newest-first (seeded server-side via
// readOwnNotifications, kept live by the poll), marks the visible items read on open, and
// offers "Mark all read".
//
// LIVE REFRESH (D-04 — poll-on-focus, NOT a push subscription): the poll mechanism is copied
// VERBATIM from app/driver/PoolView.tsx — refetchNotifications() on window `focus` +
// `visibilitychange` + a ~25s interval while the tab is visible, swallowing transient errors
// (keep last-good). There is deliberately no push-subscription / change-feed channel here.
//
// WIDENING LOCK (threat T-07-BELL1): refetchNotifications reuses the same caller-auth
// own-rows-only read as the RSC seed — the poll can never widen the surface.
//
// COLOUR-IS-NEVER-THE-SOLE-SIGNAL (WCAG 1.4.1, brand-locked): unread = teal dot + 600-weight
// title (two cues); a read row is 400-weight grey. The admin `email_cap_near` alarm carries a
// CORAL dot AND its explicit text title — never colour alone.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/platform/ui/Button";
import { Toast } from "@/platform/ui/Toast";
import type { NotificationRow } from "@/platform/notifications/feed";
import {
  refetchNotifications,
  markRead,
  markAllRead,
} from "@/app/notifications/actions";

export type NotificationBellCopy = {
  alertsTrigger: string; // "Alerts" — the TEXT label on the trigger (no glyph).
  alertsTriggerAria: string; // "Alerts, {count} unread" — {count} interpolated.
  alertsPanelTitle: string;
  markAllReadCta: string;
  alertsEmptyHeading: string;
  alertsEmptyBody: string;
  alertsLoadFailed: string;
};

const POLL_INTERVAL_MS = 25_000; // ~20-30s live refresh (D-04 / UI-SPEC) — copied PoolView shape.

// {count} token fill for the trigger a11y label (no shared helper; small + local).
function fillCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

export function NotificationBell({
  initial,
  lang,
  copy,
}: {
  initial: NotificationRow[];
  lang: "en" | "bg";
  copy: NotificationBellCopy;
}) {
  // `lang` is accepted for parity with the other islands (no-flash copy is server-resolved);
  // the rendered strings all come from `copy`, so the island stays locale-agnostic.
  void lang;

  const [rows, setRows] = useState<NotificationRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const unreadCount = rows.reduce((n, r) => (r.read_at == null ? n + 1 : n), 0);
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  // Live refresh: re-read own notifications on focus + a light interval while visible.
  // Copied VERBATIM from PoolView — poll-on-focus, NOT a push subscription (D-04).
  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const fresh = await refetchNotifications();
      setRows(fresh);
    } catch {
      // Transient poll failure is non-fatal — keep the last good list; the next tick retries.
    }
  }, []);

  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    const onFocus = () => pollRef.current();
    const onVisible = () => pollRef.current();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => pollRef.current(), POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  // Open the panel and mark every currently-visible unread row read (mark-on-open). Optimistic
  // local update, then the gated markAllRead server action; a genuine failure shows a coral Toast.
  async function onOpen() {
    setOpen(true);
    if (unreadCount === 0) return;
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) => (r.read_at == null ? { ...r, read_at: now } : r)),
    );
    try {
      await markAllRead();
    } catch {
      setToast(copy.alertsLoadFailed);
    }
  }

  // Explicit "Mark all read" CTA — gated action then refetch to reconcile with the server.
  async function onMarkAllRead() {
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) => (r.read_at == null ? { ...r, read_at: now } : r)),
    );
    try {
      await markAllRead();
      const fresh = await refetchNotifications();
      setRows(fresh);
    } catch {
      setToast(copy.alertsLoadFailed);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Alerts trigger: a labelled TEXT control + teal numeric badge. NO bell glyph/emoji. */}
      <button
        type="button"
        aria-label={fillCount(copy.alertsTriggerAria, unreadCount)}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : onOpen())}
        className="inline-flex min-h-[44px] items-center gap-[8px] rounded-md px-[12px] text-[14px] font-semibold text-current transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <span>{copy.alertsTrigger}</span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal px-[4px] text-[14px] font-semibold leading-none text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away backdrop (transparent) — closes the panel without altering read-state. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            role="dialog"
            aria-label={copy.alertsPanelTitle}
            className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[70vh] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-md border border-grey/30 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-grey/20 px-[16px] py-[12px]">
              <h2 className="text-[16px] font-semibold leading-[1.4] text-slate">
                {copy.alertsPanelTitle}
              </h2>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onMarkAllRead}
                  className="h-[44px] px-[12px] text-[14px]"
                >
                  {copy.markAllReadCta}
                </Button>
              )}
            </div>

            {rows.length === 0 ? (
              // Neutral empty state — NOT an error (no new alerts is the calm default).
              <div className="flex flex-col gap-[4px] px-[16px] py-[32px] text-center">
                <p className="text-[16px] font-semibold leading-[1.4] text-slate">
                  {copy.alertsEmptyHeading}
                </p>
                <p className="text-[14px] leading-[1.5] text-grey">
                  {copy.alertsEmptyBody}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-grey/15 overflow-y-auto">
                {rows.map((r) => {
                  const unread = r.read_at == null;
                  const capNear = r.type === "email_cap_near";
                  // Dot colour: coral for the cap-near alarm; teal for an unread item; grey for read.
                  const dotClass = capNear
                    ? "bg-coral"
                    : unread
                      ? "bg-teal"
                      : "bg-grey/40";
                  return (
                    <li
                      key={r.id}
                      className="flex min-h-[44px] items-start gap-[8px] px-[16px] py-[12px]"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-[6px] inline-block h-[10px] w-[10px] flex-none rounded-full ${dotClass}`}
                      />
                      <div className="flex flex-col gap-[2px]">
                        <span
                          className={`text-[14px] leading-[1.4] ${
                            unread
                              ? "font-semibold text-slate"
                              : "font-normal text-grey"
                          }`}
                        >
                          {r.title}
                        </span>
                        {/* email_cap_near (D-11): the coral dot above + this explicit "Email cap
                            nearing" title text are TWO cues — colour is never the sole signal
                            (WCAG 1.4.1). The pre-rendered title already carries the marker text. */}
                        {r.body && (
                          <span className="text-[14px] leading-[1.4] text-grey">
                            {r.body}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-[60] flex justify-center px-[24px]">
          <Toast message={toast} tone="error" onDismiss={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}
