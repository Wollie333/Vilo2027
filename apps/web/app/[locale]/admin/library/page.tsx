import type { Metadata } from "next";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  SystemLibraryManager,
  type LibraryImage,
} from "./SystemLibraryManager";

export const metadata: Metadata = { title: "System library" };

export const dynamic = "force-dynamic";

const BUCKET = "marketing-assets";

export default async function AdminLibraryPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  // List the app's image store (newest first). The bucket is public-read, so a
  // getPublicUrl is enough to render + copy each one.
  const { data: objects } = await service.storage.from(BUCKET).list("", {
    limit: 500,
    sortBy: { column: "created_at", order: "desc" },
  });

  // Which files an affiliate marketing asset still references — those can't be
  // deleted from here (the asset would break), so the UI marks them "in use".
  const { data: usedRows } = await service
    .from("marketing_assets")
    .select("file_path")
    .not("file_path", "is", null);
  const inUse = new Set((usedRows ?? []).map((r) => r.file_path as string));

  const images: LibraryImage[] = (objects ?? [])
    // storage.list can return a folder placeholder row with no id — skip it.
    .filter((o) => o.id && o.name)
    .map((o) => {
      const { data } = service.storage.from(BUCKET).getPublicUrl(o.name);
      return {
        path: o.name,
        url: data.publicUrl,
        sizeBytes:
          (o.metadata?.size as number | undefined) ??
          (o.metadata?.contentLength as number | undefined) ??
          null,
        mime: (o.metadata?.mimetype as string | undefined) ?? null,
        createdAt: o.created_at ?? null,
        inUse: inUse.has(o.name),
      };
    });

  return <SystemLibraryManager images={images} />;
}
