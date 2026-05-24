import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function HostsPage() {
  await requirePermission("users.view");
  return (
    <PlaceholderPage
      title="Hosts"
      phase="B"
      description="List hosts with filters for verification, plan, and suspension state."
    />
  );
}
