import { requirePermission } from "@/lib/admin";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  AffiliateLeaderboard,
  type LeaderboardRow,
} from "../_components/AffiliateLeaderboard";

export const dynamic = "force-dynamic";

// The universal affiliate directory / live lifetime leaderboard: every affiliate
// ever (default + competition — one affiliate_accounts spine), ranked by lifetime
// referrals or earnings, each row drilling into that affiliate's full record.
export default async function AdminAffiliateDirectoryPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [
    { data: accounts },
    { data: referrals },
    { data: commissions },
    { data: clicks },
  ] = await Promise.all([
    service
      .from("affiliate_accounts")
      .select("id, user_id, slug, status, currency")
      .order("created_at", { ascending: false }),
    service.from("affiliate_referrals").select("affiliate_id, campaign_id"),
    service
      .from("affiliate_commissions")
      .select(
        "affiliate_id, status, entry_type, payout_id, commission_amount, currency",
      ),
    service.from("affiliate_clicks").select("affiliate_id"),
  ]);

  const accts = accounts ?? [];
  const userIds = accts.map((a) => a.user_id);
  const { data: profiles } = userIds.length
    ? await service
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : {
        data: [] as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[],
      };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const refCount = new Map<string, number>();
  const campRefCount = new Map<string, number>();
  for (const r of referrals ?? []) {
    refCount.set(r.affiliate_id, (refCount.get(r.affiliate_id) ?? 0) + 1);
    if (r.campaign_id)
      campRefCount.set(
        r.affiliate_id,
        (campRefCount.get(r.affiliate_id) ?? 0) + 1,
      );
  }
  const clickCount = new Map<string, number>();
  for (const c of clicks ?? [])
    clickCount.set(c.affiliate_id, (clickCount.get(c.affiliate_id) ?? 0) + 1);

  const commByAffiliate = new Map<string, typeof commissions>();
  for (const c of commissions ?? []) {
    const arr = commByAffiliate.get(c.affiliate_id) ?? [];
    arr.push(c);
    commByAffiliate.set(c.affiliate_id, arr);
  }

  const rows: LeaderboardRow[] = accts.map((a) => {
    const profile = profileById.get(a.user_id);
    const bal = summariseCommissions(
      (commByAffiliate.get(a.id) ?? []).map((c) => ({
        status: c.status,
        entry_type: c.entry_type,
        payout_id: c.payout_id,
        commission_amount: Number(c.commission_amount),
        currency: c.currency,
      })),
      a.currency,
    );
    return {
      id: a.id,
      userId: a.user_id,
      slug: a.slug,
      name: profile?.full_name || "Unnamed",
      email: profile?.email ?? null,
      status: a.status as "pending" | "active" | "suspended",
      currency: a.currency,
      clicks: clickCount.get(a.id) ?? 0,
      referrals: refCount.get(a.id) ?? 0,
      campaignReferrals: campRefCount.get(a.id) ?? 0,
      lifetime: bal.lifetime,
      available: bal.available,
    };
  });

  return <AffiliateLeaderboard rows={rows} />;
}
