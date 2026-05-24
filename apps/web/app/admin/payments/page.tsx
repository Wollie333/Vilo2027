import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requirePermission("payments.view");
  return (
    <PlaceholderPage
      title="Payments"
      phase="D"
      description="All payments, refund queue, manual EFT approvals. Atomic via Edge Function."
    />
  );
}
