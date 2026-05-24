import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requirePermission("reviews.moderate");
  return (
    <PlaceholderPage
      title="Reviews"
      phase="D"
      description="Moderation queue — approve, reject, hide. Per AGENT_RULES, decisions are immutable once logged."
    />
  );
}
