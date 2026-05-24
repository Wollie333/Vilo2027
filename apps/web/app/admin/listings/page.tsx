import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  await requirePermission("listings.edit");
  return (
    <PlaceholderPage
      title="Listings"
      phase="B"
      description="All listings across the platform with feature, hide, and moderation actions."
    />
  );
}
