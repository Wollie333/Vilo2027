import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { ArticleEditor } from "../_components/ArticleEditor";
import { NewArticleId } from "./NewArticleId";

export const dynamic = "force-dynamic";

export default async function NewHelpArticlePage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const { data: categories } = await service
    .from("help_categories")
    .select("id, name, slug")
    .is("deleted_at", null)
    .eq("is_published", true)
    .order("sort_order");

  return (
    <NewArticleId>
      {(id) => (
        <ArticleEditor
          mode="create"
          defaults={{
            id,
            title: "",
            slug: "",
            excerpt: "",
            bodyHtml: "",
            bodyJson: { type: "doc", content: [] },
            categoryId: null,
            audience: "both",
            status: "draft",
            featuredRank: null,
            readTimeMinutes: 4,
            hasVideo: false,
            isDeleted: false,
          }}
          categories={
            (categories ?? []) as { id: string; name: string; slug: string }[]
          }
        />
      )}
    </NewArticleId>
  );
}
