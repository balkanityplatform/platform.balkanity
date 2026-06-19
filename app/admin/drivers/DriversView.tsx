"use client";
// app/admin/drivers/DriversView.tsx — Drivers console view (ONBD-05).
//
// Client view rendering the slate console chrome (reused from the companies/
// properties slices), the InviteDriverForm island at the top, and either the
// invited-driver list (name + phone + email per row) or the drivers empty state.
//
// NOTE: drivers have no active/inactive lifecycle in v1 (the invite is the only
// account-creation path, AUTH-03), so this list is a plain roster rather than the
// active/inactive DataList used by companies/properties. All copy is passed in from
// the server page (dictionary-resolved → no flash, PLAT-04).
import Image from "next/image";
import { LanguageToggle } from "@/platform/ui/LanguageToggle";
import {
  NotificationBell,
  type NotificationBellCopy,
} from "@/platform/ui/NotificationBell";
import type { NotificationRow } from "@/platform/notifications/feed";
import { InviteDriverForm, type InviteDriverCopy } from "./InviteDriverForm";

export type DriverRow = {
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type DriversViewCopy = InviteDriverCopy & {
  langToggle: string;
  driversTitle: string;
  inviteDriverTitle: string;
  driversEmptyHeading: string;
  driversEmptyBody: string;
};

export function DriversView({
  drivers,
  lang,
  copy,
  bellInitial,
  bellCopy,
}: {
  drivers: DriverRow[];
  lang: "en" | "bg";
  copy: DriversViewCopy;
  bellInitial: NotificationRow[];
  bellCopy: NotificationBellCopy;
}) {
  const formCopy: InviteDriverCopy = {
    emailLabel: copy.emailLabel,
    driverNameLabel: copy.driverNameLabel,
    driverPhoneLabel: copy.driverPhoneLabel,
    generateInviteLinkCta: copy.generateInviteLinkCta,
    inviteLinkDeliveryNote: copy.inviteLinkDeliveryNote,
    inviteLinkCopyCta: copy.inviteLinkCopyCta,
    fieldRequired: copy.fieldRequired,
    saveFailed: copy.saveFailed,
  };

  return (
    <main className="min-h-dvh bg-white">
      {/* Slate console chrome (reused from the companies/properties pages). */}
      <header className="flex items-center justify-between bg-slate px-[24px] py-[16px]">
        <span className="inline-flex items-center rounded-[6px] bg-white px-[8px] py-[4px]">
          <Image
            src="/brand/balkanity-logo.png"
            alt="Balkanity"
            width={96}
            height={96}
            className="h-[28px] w-auto"
          />
        </span>
        {/* Alerts bell — admin slate chrome, header-right (reuses the driver bell, D-08). */}
        <span className="inline-flex items-center gap-[8px] text-white">
          <NotificationBell
            initial={bellInitial}
            lang={lang}
            copy={bellCopy}
          />
          <LanguageToggle
            current={lang}
            label={copy.langToggle}
            className="text-white"
          />
        </span>
      </header>

      <section className="mx-auto flex max-w-2xl flex-col gap-[32px] px-[24px] py-[48px]">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-slate">
          {copy.driversTitle}
        </h1>

        {/* Invite form — always available at the top of the page. */}
        <div className="flex flex-col gap-[16px]">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
            {copy.inviteDriverTitle}
          </h2>
          <InviteDriverForm copy={formCopy} />
        </div>

        {drivers.length === 0 ? (
          <div className="flex flex-col gap-[8px]">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-slate">
              {copy.driversEmptyHeading}
            </h2>
            <p className="text-[16px] leading-[1.5] text-grey">
              {copy.driversEmptyBody}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-grey/20 rounded-md border border-grey/30 bg-white">
            {drivers.map((d) => (
              <li
                key={d.user_id}
                className="flex min-h-[56px] flex-col gap-[4px] px-[16px] py-[12px]"
              >
                <span className="text-[16px] font-semibold leading-[1.4] text-slate">
                  {d.name}
                </span>
                <span className="text-[14px] leading-[1.4] text-grey">
                  {[d.phone, d.email].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
