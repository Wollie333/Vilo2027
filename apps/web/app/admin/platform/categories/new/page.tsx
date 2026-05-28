import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ListingCategoryRow } from "@/lib/taxonomy/types";

import { CategoryEditor } from "../CategoryEditor";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requirePermission("taxonomy.manage");
  const service = createAdminClient();

  const { data } = await service
    .from("listing_categories")
    .select("id, label, kind, parent_id")
    .is("deleted_at", null)
    .is("parent_id", null)
    .order("sort_order");

  const parents = (data ?? []) as Array<
    Pick<ListingCategoryRow, "id" | "label" | "kind">
  >;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000";

  return (
    <CategoryEditor
      isNew
      parents={parents}
      initial={{
        id,
        parentId: null,
        kind: "accommodation",
        slug: "",
        label: "",
        description: "",
        icon: "home",
        sortOrder: 100,
        isPublished: true,
        heroImageUrl: "",
        ogImageUrl: "",
        metaTitle: "",
        metaDescription: "",
        canonicalUrl: "",
        introMarkdown: "",
        faq: [],
      }}
    />
  );
}
