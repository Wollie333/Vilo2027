import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  DealCategoriesEditor,
  type DealCategoryRow,
} from "./DealCategoriesEditor";

export const dynamic = "force-dynamic";

export default async function AdminDealCategoriesPage() {
  await requirePermission("taxonomy.manage");
  const service = createAdminClient();

  const { data } = await service
    .from("special_categories")
    .select(
      "id, key, label, description, icon, sort_order, is_active, meta_title, meta_description",
    )
    .is("deleted_at", null)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Deal categories
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
          The categories hosts can assign to their deals/specials. These power
          the public <code>/deals</code> filter and appear as filter chips in
          the directory. Hosts pick from this list when creating a deal.
        </p>
      </header>

      <DealCategoriesEditor rows={(data ?? []) as DealCategoryRow[]} />
    </div>
  );
}
