import type { Metadata } from "next";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { SettingsHero } from "@/components/settings/SettingsHero";

import { AccountSettingsTabs } from "./_components/AccountSettingsTabs";

export const metadata: Metadata = {
  title: "Account settings · Vilo",
};

// Guest-facing settings shell. Tabs render via a client component so the
// active state tracks the current pathname correctly.

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BroadcastBanner />
      <SettingsHero
        title="Account settings"
        subtitle="Manage how Vilo reaches you about your trips and account."
        backHref="/my-trips"
        backLabel="Back to trips"
      >
        <AccountSettingsTabs />
      </SettingsHero>
      <div className="mt-6">{children}</div>
    </div>
  );
}
