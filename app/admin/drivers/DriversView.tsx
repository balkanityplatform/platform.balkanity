"use client";
// app/admin/drivers/DriversView.tsx — Drivers console view (ONBD-05).
//
// Client view rendering the InviteDriverForm island at the top, and either the
// invited-driver list (name + phone + email per row) or the drivers empty state.
//
// The slate console chrome (sidebar + top bar + the single alerts bell +
// LanguageToggle) is owned by app/admin/layout.tsx (Plan 01) — this view renders NO
// <header> of its own and mounts NO bell (the shell owns the single own-rows bell).
//
// NOTE: drivers have no active/inactive lifecycle in v1 (the invite is the only
// account-creation path, AUTH-03), so this list is a plain roster rather than the
// active/inactive DataList used by companies/properties. All copy is passed in from
// the server page (dictionary-resolved → no flash, PLAT-04).
import { InviteDriverForm, type InviteDriverCopy } from "./InviteDriverForm";

export type DriverRow = {
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type DriversViewCopy = InviteDriverCopy & {
  driversTitle: string;
  inviteDriverTitle: string;
  driversEmptyHeading: string;
  driversEmptyBody: string;
};

export function DriversView({
  drivers,
  copy,
}: {
  drivers: DriverRow[];
  copy: DriversViewCopy;
}) {
  const formCopy: InviteDriverCopy = {
    emailLabel: copy.emailLabel,
    driverNameLabel: copy.driverNameLabel,
    driverPhoneLabel: copy.driverPhoneLabel,
    generateInviteLinkCta: copy.generateInviteLinkCta,
    inviteEmailSentNote: copy.inviteEmailSentNote,
    fieldRequired: copy.fieldRequired,
    saveFailed: copy.saveFailed,
  };

  return (
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
  );
}
