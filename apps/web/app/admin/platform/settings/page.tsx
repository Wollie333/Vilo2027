import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  await requirePermission("platform.settings");
  return (
    <PlaceholderPage
      title="Platform settings"
      phase="E"
      description="Key-value editor for platform_settings (ranking weights, trial length, sender emails, default policies)."
    />
  );
}
