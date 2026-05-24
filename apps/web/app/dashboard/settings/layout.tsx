import type { Metadata } from "next";

import { SettingsTabs } from "./_components/SettingsTabs";

export const metadata: Metadata = {
  title: "Settings · Vilo",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Manage your profile, public host page, banking, and plan.
        </p>
      </header>
      <SettingsTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
