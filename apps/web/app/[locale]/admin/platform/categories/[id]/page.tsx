import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ListingCategoryRow } from "@/lib/taxonomy/types";

import { CategoryEditor } from "../CategoryEditor";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("taxonomy.manage");
  const service = createAdminClient();

  const [{ data: row }, { data: allRows }] = await Promise.all([
    service
      .from("property_categories")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle(),
    service
      .from("property_categories")
      .select("id, label, kind, parent_id")
      .is("deleted_at", null)
      .is("parent_id", null)
      .eq("kind", "accommodation")
      .order("sort_order"),
  ]);

  if (!row) notFound();
  const category = row as ListingCategoryRow;
  const parents = (allRows ?? []) as Array<
    Pick<ListingCategoryRow, "id" | "label" | "kind">
  >;

  return (
    <CategoryEditor
      isNew={false}
      parents={parents}
      initial={{
        id: category.id,
        parentId: category.parent_id,
        kind: category.kind,
        slug: category.slug,
        label: category.label,
        description: category.description ?? "",
        icon: category.icon,
        sortOrder: category.sort_order,
        isPublished: category.is_published,
        heroImageUrl: category.hero_image_url ?? "",
        ogImageUrl: category.og_image_url ?? "",
        metaTitle: category.meta_title ?? "",
        metaDescription: category.meta_description ?? "",
        canonicalUrl: category.canonical_url ?? "",
        introMarkdown: category.intro_markdown ?? "",
        faq: Array.isArray(category.faq) ? category.faq : [],
      }}
    />
  );
}
