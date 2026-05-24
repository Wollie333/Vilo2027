import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  await requirePermission("bookings.edit");
  return (
    <PlaceholderPage
      title="Bookings"
      phase="B"
      description="Cross-platform booking list with status overrides and CSV export."
    />
  );
}
