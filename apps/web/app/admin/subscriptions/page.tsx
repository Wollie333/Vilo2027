import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  await requirePermission("subscriptions.edit");
  return (
    <PlaceholderPage
      title="Subscriptions"
      phase="D"
      description="Force plan changes, comp billing periods, restrict accounts. Reason required on every change."
    />
  );
}
