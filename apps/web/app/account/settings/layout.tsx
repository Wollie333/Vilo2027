import type { Metadata } from "next";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";

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
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Manage how Vilo reaches you about your trips and account.
        </p>
      </header>
      <AccountSettingsTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
