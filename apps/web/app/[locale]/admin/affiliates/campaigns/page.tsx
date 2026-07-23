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
      "id, slug, name, status, starts_at, ends_at, commission_structure, competition, max_participants",
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
    capacity: (c.max_participants as number | null) ?? null,
    ladder: describeLadder(
      (c.commission_structure ?? null) as CommissionStructure | null,
    ),
    competition: describeCompetition(
      (c.competition ?? null) as Competition | null,
    ),
  }));

  return <CampaignsList campaigns={list} />;
}
