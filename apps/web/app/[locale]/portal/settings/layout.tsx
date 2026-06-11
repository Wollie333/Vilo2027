import type { Metadata } from "next";

import { PortalSettingsTabs } from "./_components/PortalSettingsTabs";

export const metadata: Metadata = {
  title: "Settings",
};

export default function PortalSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Manage your profile, notifications, privacy and sign-in details.
        </p>
      </header>
      <div className="mb-7">
        <PortalSettingsTabs />
      </div>
      {children}
    </div>
  );
}
