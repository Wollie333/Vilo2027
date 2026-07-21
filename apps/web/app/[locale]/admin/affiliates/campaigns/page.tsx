import { Trophy } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import {
  describeCompetition,
  describeLadder,
} from "@/lib/affiliate/campaignConfig";
import type {
  CommissionStructure,
  Competition,
} from "@/lib/affiliate/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

import { CampaignsList } from "./_components/CampaignsList";

export const dynamic = "force-dynamic";

// WS-1i — campaigns were config-in-code with no admin screen, so the Founding
// Race sat in `draft` unseen. This is the list; the builder is one level down.

export default async function AdminCampaignsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: campaigns } = await service
    .from("affiliate_campaigns")
    .select(
      "id, slug, name, status, starts_at, ends_at, commission_structure, competition",
    )
    .order("created_at", { ascending: false });

  const rows = campaigns ?? [];

  // Enrolled partner counts, one query for all campaigns.
  const { data: enrollments } = rows.length
    ? await service
        .from("affiliate_campaign_enrollments")
        .select("campaign_id, status")
        .in(
          "campaign_id",
          rows.map((c) => c.id),
        )
    : { data: [] as { campaign_id: string; status: string }[] };

  const enrolledByCampaign = new Map<string, number>();
  for (const e of enrollments ?? []) {
    if (e.status !== "active") continue;
    enrolledByCampaign.set(
      e.campaign_id,
      (enrolledByCampaign.get(e.campaign_id) ?? 0) + 1,
    );
  }

  const list = rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    status: c.status as string,
    starts_at: c.starts_at as string | null,
    ends_at: c.ends_at as string | null,
    enrolled: enrolledByCampaign.get(c.id) ?? 0,
    ladder: describeLadder(
      (c.commission_structure ?? null) as CommissionStructure | null,
    ),
    competition: describeCompetition(
      (c.competition ?? null) as Competition | null,
    ),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
          <Trophy className="h-6 w-6 text-brand-primary" />
          Campaigns
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Competitions and their commission ladders. A campaign pays its own
          rates to enrolled partners while it is live, so nothing goes active
          until you launch it here.
        </p>
      </header>

      <CampaignsList campaigns={list} />
    </div>
  );
}
