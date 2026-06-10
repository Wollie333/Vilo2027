import type { Metadata } from "next";

import { SettingsProfileHeader } from "@/components/settings/SettingsProfileHeader";

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
    <div className="mx-auto max-w-[1140px] px-1 py-1">
      {/* White profile header + stat band, then horizontal underline tabs
          (matches the Settings design). */}
      <SettingsProfileHeader />
      <div className="mt-6">
        <SettingsTabs />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
