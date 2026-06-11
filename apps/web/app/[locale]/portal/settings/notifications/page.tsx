import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { PreferencesForm } from "@/components/notifications/PreferencesForm";
import { getBrandName } from "@/lib/brand";
import { loadPreferencesViewModel } from "@/lib/notifications/preferences-loader";

export const metadata: Metadata = {
  title: "Notifications · Settings",
};

export const dynamic = "force-dynamic";

export default async function PortalNotificationSettingsPage() {
  const brandName = await getBrandName();
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-brand-mute">
            Choose how {brandName} keeps you in the loop on bookings, refunds,
            and reviews.
          </p>
        </div>
        <Link
          href="/portal/notifications"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:text-brand-secondary"
        >
          View all notifications <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>
      <PreferencesForm
        initial={vm}
        revalidate={["/portal/settings/notifications"]}
      />
    </section>
  );
}
