import { requirePermission } from "@/lib/admin";

import { AdminSettingsTabs } from "./_components/AdminSettingsTabs";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("platform.settings");

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Platform settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Runtime configuration for the platform — branding, business identity,
          how Wielo gets paid, legal documents and tracking.
        </p>
      </header>

      <AdminSettingsTabs />

      <div className="pt-1">{children}</div>
    </div>
  );
}
