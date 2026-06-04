import type { Metadata } from "next";

import { SettingsHero } from "@/components/settings/SettingsHero";

import { SettingsTabs } from "./_components/SettingsTabs";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SettingsHero
        title="Settings"
        subtitle="Manage your profile, public host page, banking, and plan."
        backHref="/dashboard"
        backLabel="Back to dashboard"
      >
        <SettingsTabs />
      </SettingsHero>
      <div className="mt-6">{children}</div>
    </div>
  );
}
