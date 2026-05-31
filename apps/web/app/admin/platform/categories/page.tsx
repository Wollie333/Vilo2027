import Link from "next/link";

import { requirePermission } from "@/lib/admin";
import { getAllCategoriesForAdmin } from "@/lib/taxonomy/getCategories";

import { CategoriesTable } from "./CategoriesTable";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requirePermission("taxonomy.manage");
  const rows = await getAllCategoriesForAdmin();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Listing categories
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
            The taxonomy that powers the host wizard, the public browse filter,
            and every <code>/c/[slug]</code> landing page. Organise
            accommodation under the Accommodation root with as many leaves as
            you need. Each row carries its own SEO content for search engines.
          </p>
        </div>
        <Link
          href="/admin/platform/categories/new"
          className="inline-flex h-9 items-center rounded-md bg-brand-primary px-3.5 text-[13px] font-semibold text-white hover:bg-brand-secondary"
        >
          + Add category
        </Link>
      </header>

      <CategoriesTable rows={rows} />
    </div>
  );
}
