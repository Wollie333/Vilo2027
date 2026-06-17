import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  MarketingManager,
  type MarketingAsset,
} from "./_components/MarketingManager";

export const dynamic = "force-dynamic";

export default async function AdminAffiliateMarketingPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data } = await service
    .from("marketing_assets")
    .select(
      "id, category, title, description, body, link_url, file_path, file_url, mime_type, width, height, sort_order, is_active",
    )
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Marketing material
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Create and manage the banners, social posts, email templates, AI
          prompts, videos and blogs affiliates use. Published items appear in
          the affiliate portal with each affiliate&apos;s referral link baked
          in.
        </p>
      </header>

      <MarketingManager assets={(data ?? []) as MarketingAsset[]} />
    </div>
  );
}
