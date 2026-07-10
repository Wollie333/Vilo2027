import { Link } from "@/i18n/navigation";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  DealCategoriesTable,
  type DealCategoryRow,
} from "./DealCategoriesTable";

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Deal categories
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
            The categories hosts can assign to their deals/specials. These power
            the public <code>/deals</code> filter and appear as filter chips in
            the directory. Each row carries its own SEO content for search
            engines.
          </p>
        </div>
        <Link
          href="/admin/platform/deal-categories/new"
          className="inline-flex h-9 items-center rounded-md bg-brand-primary px-3.5 text-[13px] font-semibold text-white hover:bg-brand-secondary"
        >
          + Add deal category
        </Link>
      </header>

      <DealCategoriesTable rows={(data ?? []) as DealCategoryRow[]} />
    </div>
  );
}
