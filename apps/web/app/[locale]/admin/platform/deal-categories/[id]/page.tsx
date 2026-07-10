import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { DealCategoryEditor } from "../DealCategoryEditor";

export const dynamic = "force-dynamic";

type SpecialCategoryRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  intro_markdown: string | null;
};

export default async function EditDealCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("taxonomy.manage");
  const service = createAdminClient();

  const { data: row } = await service
    .from("special_categories")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!row) notFound();
  const category = row as SpecialCategoryRow;

  return (
    <DealCategoryEditor
      isNew={false}
      initial={{
        id: category.id,
        key: category.key,
        label: category.label,
        description: category.description ?? "",
        icon: category.icon ?? "Sparkles",
        sortOrder: category.sort_order,
        isActive: category.is_active,
        metaTitle: category.meta_title ?? "",
        metaDescription: category.meta_description ?? "",
        ogImageUrl: category.og_image_url ?? "",
        introMarkdown: category.intro_markdown ?? "",
      }}
    />
  );
}
