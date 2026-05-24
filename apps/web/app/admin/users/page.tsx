import { requirePermission } from "@/lib/admin";

import { PlaceholderPage } from "../_components/PlaceholderPage";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePermission("users.view");
  return (
    <PlaceholderPage
      title="Users"
      phase="B"
      description="Search across all hosts and guests, filter by role and activity, jump to detail."
    />
  );
}
