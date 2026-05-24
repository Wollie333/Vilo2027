import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  await requirePermission("platform.features");
  return (
    <PlaceholderPage
      title="Feature flags"
      phase="E"
      description="plan_features matrix editor + host_feature_overrides creator. Pre-MVP all-open policy preserved with a warning banner."
    />
  );
}
