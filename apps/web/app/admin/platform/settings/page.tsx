import { requirePermission } from "@/lib/admin";
import { getBrandName } from "@/lib/brand";

import { BrandNameForm } from "./BrandNameForm";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  await requirePermission("platform.settings");
  const brand = await getBrandName();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Platform settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Runtime configuration for the platform.
        </p>
      </header>

      <BrandNameForm initial={brand} />
    </div>
  );
}
