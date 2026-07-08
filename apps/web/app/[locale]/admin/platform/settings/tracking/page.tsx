import { getMetaIntegration } from "@/lib/integrations/meta";

import { MetaPixelForm } from "../MetaPixelForm";
import { TrackingIdsForm } from "../TrackingIdsForm";

export const dynamic = "force-dynamic";

// Tracking tab — the PLATFORM's own marketing pixels (Wielo's marketing site +
// funnel), distinct from a host's per-site tracking under /dashboard/tracking.
export default async function PlatformTrackingSettingsPage() {
  const meta = await getMetaIntegration();

  return (
    <div className="space-y-6">
      <MetaPixelForm
        pixelId={meta.pixelId ?? ""}
        pixelEnabled={meta.pixelEnabled}
        testEventCode={meta.testEventCode ?? ""}
        capiTokenSet={meta.capiTokenSet}
        capiEnabled={meta.capiEnabled}
      />
      <TrackingIdsForm
        initial={{
          ga4: meta.ga4 ?? "",
          gtm: meta.gtm ?? "",
          tiktok: meta.tiktok ?? "",
          googleAds: meta.googleAds ?? "",
        }}
      />
    </div>
  );
}
