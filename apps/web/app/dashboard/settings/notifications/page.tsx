import type { Metadata } from "next";

import { PreferencesForm } from "@/components/notifications/PreferencesForm";
import { loadPreferencesViewModel } from "@/lib/notifications/preferences-loader";

export const metadata: Metadata = {
  title: "Notifications · Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const vm = await loadPreferencesViewModel();
  if (!vm) {
    return (
      <section>
        <p className="text-sm text-brand-mute">
          Sign in to manage notifications.
        </p>
      </section>
    );
  }

  return (
    <section>
      <header className="mb-6">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          Notifications
        </h2>
        <p className="mt-1 text-sm text-brand-mute">
          Choose what reaches you and how. Locked categories cover account
          security and critical billing — they always send.
        </p>
      </header>
      <PreferencesForm
        initial={vm}
        revalidate={["/dashboard/settings/notifications"]}
      />
    </section>
  );
}
