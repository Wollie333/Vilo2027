import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { VideoForm } from "../VideoForm";

export const dynamic = "force-dynamic";

export default async function NewHelpVideoPage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const { data: categories } = await service
    .from("help_categories")
    .select("id, name, slug")
    .is("deleted_at", null)
    .order("sort_order");

  return (
    <VideoForm
      mode="create"
      defaults={{
        id: "00000000-0000-0000-0000-000000000000",
        title: "",
        description: "",
        categoryId: null,
        audience: "both",
        embedUrl: "",
        thumbnailUrl: null,
        durationSeconds: 0,
        status: "draft",
        featuredRank: null,
        sortOrder: 100,
        isNew: false,
      }}
      categories={
        (categories ?? []) as { id: string; name: string; slug: string }[]
      }
    />
  );
}
