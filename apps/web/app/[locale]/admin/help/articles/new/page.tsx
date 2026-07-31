import { randomUUID } from "node:crypto";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { ArticleEditor } from "../_components/ArticleEditor";

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

  // A fresh id for the new article, generated server-side. (Previously a client
  // component supplied this via a function-as-children render prop, which is an
  // illegal Server→Client boundary and threw on load once Help was un-hidden.)
  return (
    <ArticleEditor
      mode="create"
      defaults={{
        id: randomUUID(),
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
  );
}
