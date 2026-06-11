import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import type { HelpAudience, HelpStatus, HelpVideoRow } from "@/lib/help/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { VideoForm } from "../VideoForm";

export const dynamic = "force-dynamic";

export default async function EditHelpVideoPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const [{ data: video }, { data: categories }] = await Promise.all([
    service.from("help_videos").select("*").eq("id", params.id).maybeSingle(),
    service
      .from("help_categories")
      .select("id, name, slug")
      .is("deleted_at", null)
      .order("sort_order"),
  ]);

  if (!video) notFound();
  const v = video as HelpVideoRow;

  return (
    <VideoForm
      mode="update"
      defaults={{
        id: v.id,
        title: v.title,
        description: v.description,
        categoryId: v.category_id,
        audience: v.audience as HelpAudience,
        embedUrl: v.embed_url,
        thumbnailUrl: v.thumbnail_url,
        durationSeconds: v.duration_seconds,
        status: v.status as HelpStatus,
        featuredRank: v.featured_rank,
        sortOrder: v.sort_order,
        isNew: v.is_new,
      }}
      categories={
        (categories ?? []) as { id: string; name: string; slug: string }[]
      }
    />
  );
}
