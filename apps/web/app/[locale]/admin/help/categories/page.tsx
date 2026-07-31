import { requirePermission } from "@/lib/admin";
import type { HelpCategoryRow } from "@/lib/help/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { CategoriesEditor } from "./CategoriesEditor";

export const dynamic = "force-dynamic";

export default async function AdminHelpCategoriesPage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const { data } = await service
    .from("help_categories")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Help categories
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
          The categories that group articles on the public <code>/help</code>{" "}
          centre. Each one carries an icon, an audience and a sort order — lower
          numbers come first.
        </p>
      </header>

      <CategoriesEditor rows={(data ?? []) as HelpCategoryRow[]} />
    </div>
  );
}
