import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  MarketingManager,
  type LibraryImage,
  type MarketingAsset,
} from "./_components/MarketingManager";

export const dynamic = "force-dynamic";

const BUCKET = "marketing-assets";

export default async function AdminAffiliateMarketingPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: assets }, { data: objects }, { data: usedRows }] =
    await Promise.all([
      // Default-programme archive only — a campaign's own assets live on its tab.
      service
        .from("marketing_assets")
        .select(
          "id, category, title, description, body, link_url, file_path, file_url, mime_type, width, height, sort_order, is_active",
        )
        .is("campaign_id", null)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      // The Wielo media library = every object in the marketing-assets bucket.
      service.storage.from(BUCKET).list("", {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      }),
      // In-use guard spans EVERY asset (campaign + default) referencing a file.
      service
        .from("marketing_assets")
        .select("file_path")
        .not("file_path", "is", null),
    ]);

  // Which library files any marketing asset already references — those are marked
  // "in use" and protected from deletion (the asset would break otherwise).
  const inUse = new Set(
    (usedRows ?? [])
      .map((a) => a.file_path)
      .filter((p): p is string => Boolean(p)),
  );

  const library: LibraryImage[] = (objects ?? [])
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

  return (
    <MarketingManager
      assets={(assets ?? []) as MarketingAsset[]}
      library={library}
    />
  );
}
