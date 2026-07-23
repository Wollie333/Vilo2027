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
      <div>
        <h2 className="font-display text-[17px] font-bold text-brand-ink">
          Marketing material
        </h2>
        <p className="mt-0.5 text-[12.5px] text-brand-mute">
          Create and manage the banners, social posts, email templates, AI
          prompts, videos and blogs affiliates use. Published items appear in
          the affiliate portal with each affiliate&apos;s referral link baked
          in.
        </p>
      </div>

      <MarketingManager assets={(data ?? []) as MarketingAsset[]} />
    </div>
  );
}
