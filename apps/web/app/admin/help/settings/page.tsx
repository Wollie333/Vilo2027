import { requirePermission } from "@/lib/admin";
import { fetchHelpSettings } from "@/lib/help/queries";

import { SettingsEditor } from "./SettingsEditor";

export const dynamic = "force-dynamic";

export default async function AdminHelpSettingsPage() {
  await requirePermission("help.manage");
  const settings = await fetchHelpSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Help settings
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Hero trending pills, contact channel toggles, and the community
          threads featured on the help home.
        </p>
      </header>

      <SettingsEditor
        trending={settings.trending}
        contact={settings.contact}
        community={settings.community}
      />
    </div>
  );
}
