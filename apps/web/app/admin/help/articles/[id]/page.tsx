import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import type { HelpAudience, HelpStatus } from "@/lib/help/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { ArticleEditor } from "../_components/ArticleEditor";

export const dynamic = "force-dynamic";

export default async function EditHelpArticlePage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const [{ data: article }, { data: categories }] = await Promise.all([
    service
      .from("help_articles")
      .select(
        "id, slug, title, excerpt, body_html, body_json, category_id, audience, status, featured_rank, read_time_minutes, has_video, deleted_at",
      )
      .eq("id", params.id)
      .maybeSingle(),
    service
      .from("help_categories")
      .select("id, name, slug")
      .is("deleted_at", null)
      .order("sort_order"),
  ]);

  if (!article) notFound();
  const a = article as {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    body_html: string;
    body_json: unknown;
    category_id: string | null;
    audience: HelpAudience;
    status: HelpStatus;
    featured_rank: number | null;
    read_time_minutes: number;
    has_video: boolean;
    deleted_at: string | null;
  };

  return (
    <ArticleEditor
      mode="update"
      defaults={{
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        bodyHtml: a.body_html,
        bodyJson: a.body_json,
        categoryId: a.category_id,
        audience: a.audience,
        status: a.status,
        featuredRank: a.featured_rank,
        readTimeMinutes: a.read_time_minutes,
        hasVideo: a.has_video,
        isDeleted: Boolean(a.deleted_at),
      }}
      categories={
        (categories ?? []) as { id: string; name: string; slug: string }[]
      }
    />
  );
}
