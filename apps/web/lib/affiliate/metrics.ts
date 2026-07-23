import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  summariseCommissions,
  type AffiliateBalance,
  type CommissionRowLike,
} from "./balance";
import { round2 } from "./fees";

// ── Read-side metrics behind the campaign Metrics tab + the program analytics
// page. NO money is written here. Commission totals reuse summariseCommissions
// (the same "sum the signed rows" derivation the balances use) so a metric can
// never disagree with the Overview or the payout threshold. The funnel counts
// come from the SECURITY DEFINER RPCs (campaign_funnel / program_affiliate_
// funnel) so the listings half always matches the leaderboard.

type Db = ReturnType<typeof createAdminClient>;

export type Funnel = {
  clicks: number;
  referrals: number;
  hosts: number;
  listedHosts: number;
  payingHosts: number;
  liveListings: number;
};

/** Net commission per kind (subscription / setup_fee / upgrade / conversion_bonus). */
export type CommissionByKind = {
  kind: string;
  /** Accrual rows for this kind that were not voided. */
  count: number;
  /** Net rand earned for this kind (accruals + clawback offsets, voided excluded). */
  net: number;
};

export type ScorePoint = { date: string; listings: number };

export type CampaignPartnerRow = {
  affiliateId: string;
  name: string;
  slug: string;
  referrals: number;
  liveListings: number;
  /** Net commission this partner earned UNDER THIS CAMPAIGN (lifetime, signed). */
  earned: number;
  currency: string;
};

export type CampaignMetrics = {
  funnel: Funnel;
  balance: AffiliateBalance;
  byKind: CommissionByKind[];
  trend: ScorePoint[];
  partners: CampaignPartnerRow[];
};

type CommRow = CommissionRowLike & {
  affiliate_id: string;
  kind: string;
};

const KIND_ORDER = ["subscription", "conversion_bonus", "upgrade", "setup_fee"];

/** Fold commission rows into a per-kind net summary, kinds in display order. */
function summariseByKind(rows: CommRow[]): CommissionByKind[] {
  const byKind = new Map<string, { count: number; net: number }>();
  for (const r of rows) {
    const cur = byKind.get(r.kind) ?? { count: 0, net: 0 };
    if (r.status === "voided") {
      byKind.set(r.kind, cur); // voided accruals contribute nothing
      continue;
    }
    cur.net += Number(r.commission_amount ?? 0);
    if (r.entry_type === "accrual") cur.count += 1;
    byKind.set(r.kind, cur);
  }
  return [...byKind.entries()]
    .map(([kind, v]) => ({ kind, count: v.count, net: round2(v.net) }))
    .sort(
      (a, b) =>
        (KIND_ORDER.indexOf(a.kind) + 1 || 99) -
        (KIND_ORDER.indexOf(b.kind) + 1 || 99),
    );
}

async function resolveNames(
  admin: Db,
  affiliateIds: string[],
): Promise<Map<string, { name: string; slug: string }>> {
  const nameById = new Map<string, { name: string; slug: string }>();
  if (!affiliateIds.length) return nameById;
  const { data: accounts } = await admin
    .from("affiliate_accounts")
    .select("id, user_id, slug")
    .in("id", affiliateIds);
  const userIds = (accounts ?? []).map((a) => a.user_id);
  const { data: profiles } = userIds.length
    ? await admin
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
  const profileByUser = new Map((profiles ?? []).map((p) => [p.id, p]));
  for (const a of accounts ?? []) {
    const p = profileByUser.get(a.user_id);
    nameById.set(a.id, {
      name: p?.full_name || p?.email || "Unnamed partner",
      slug: a.slug,
    });
  }
  return nameById;
}

export async function loadCampaignMetrics(
  campaignId: string,
): Promise<CampaignMetrics> {
  const admin = createAdminClient();

  const [
    { data: funnelRow },
    { data: rawScores },
    { data: commissions },
    { data: refs },
    { data: trendRows },
  ] = await Promise.all([
    admin.rpc("campaign_funnel", { p_campaign_id: campaignId }),
    admin.rpc("campaign_active_listings", { p_campaign_id: campaignId }),
    admin
      .from("affiliate_commissions")
      .select(
        "affiliate_id, kind, status, entry_type, payout_id, commission_amount, currency",
      )
      .eq("campaign_id", campaignId),
    admin
      .from("affiliate_referrals")
      .select("affiliate_id")
      .eq("campaign_id", campaignId),
    admin
      .from("affiliate_campaign_daily_scores")
      .select("score_date, active_listings")
      .eq("campaign_id", campaignId)
      .order("score_date", { ascending: true }),
  ]);

  const f = (Array.isArray(funnelRow) ? funnelRow[0] : funnelRow) ?? {};
  const funnel: Funnel = {
    clicks: Number(f.clicks ?? 0),
    referrals: Number(f.referrals ?? 0),
    hosts: Number(f.hosts ?? 0),
    listedHosts: Number(f.listed_hosts ?? 0),
    payingHosts: Number(f.paying_hosts ?? 0),
    liveListings: Number(f.live_listings ?? 0),
  };

  const commRows = (commissions ?? []) as CommRow[];
  const balance = summariseCommissions(commRows);
  const byKind = summariseByKind(commRows);

  // Daily total live listings across the campaign (one point per date).
  const byDate = new Map<string, number>();
  for (const r of trendRows ?? []) {
    byDate.set(
      r.score_date as string,
      (byDate.get(r.score_date as string) ?? 0) +
        Number(r.active_listings ?? 0),
    );
  }
  const trend: ScorePoint[] = [...byDate.entries()].map(([date, listings]) => ({
    date,
    listings,
  }));

  // Per-partner rows: union of everyone who has referred, scored or earned here.
  const listingsById = new Map(
    (
      (rawScores ?? []) as { affiliate_id: string; active_listings: number }[]
    ).map((s) => [s.affiliate_id, Number(s.active_listings)]),
  );
  const refCount = new Map<string, number>();
  for (const r of refs ?? []) {
    refCount.set(r.affiliate_id, (refCount.get(r.affiliate_id) ?? 0) + 1);
  }
  const earnedById = new Map<string, number>();
  for (const r of commRows) {
    if (r.status === "voided") continue;
    earnedById.set(
      r.affiliate_id,
      (earnedById.get(r.affiliate_id) ?? 0) + Number(r.commission_amount ?? 0),
    );
  }
  const partnerIds = Array.from(
    new Set([...listingsById.keys(), ...refCount.keys(), ...earnedById.keys()]),
  );
  const nameById = await resolveNames(admin, partnerIds);
  const partners: CampaignPartnerRow[] = partnerIds
    .map((id) => ({
      affiliateId: id,
      name: nameById.get(id)?.name ?? "—",
      slug: nameById.get(id)?.slug ?? "",
      referrals: refCount.get(id) ?? 0,
      liveListings: listingsById.get(id) ?? 0,
      earned: round2(earnedById.get(id) ?? 0),
      currency: balance.currency,
    }))
    .sort((a, b) => b.liveListings - a.liveListings || b.earned - a.earned);

  return { funnel, balance, byKind, trend, partners };
}

// ── Program-wide ─────────────────────────────────────────────────────────────

export type PayoutSummary = {
  requested: number;
  approved: number;
  processing: number;
  paidTotal: number;
  paidCount: number;
  feeTotal: number;
};

export type CampaignCompareRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  referrals: number;
  liveListings: number;
  payingHosts: number;
  earned: number;
};

export type ProgramMetrics = {
  funnel: Funnel & { activePartners: number };
  balance: AffiliateBalance;
  byKind: CommissionByKind[];
  payouts: PayoutSummary;
  campaigns: CampaignCompareRow[];
  /** The default programme (campaign_id IS NULL) as its own comparison row. */
  defaultProgram: { referrals: number; earned: number };
};

export async function loadProgramMetrics(): Promise<ProgramMetrics> {
  const admin = createAdminClient();

  const [
    { data: funnelRow },
    { data: commissions },
    { data: payouts },
    { data: campaigns },
    { data: refs },
  ] = await Promise.all([
    admin.rpc("program_affiliate_funnel"),
    admin
      .from("affiliate_commissions")
      .select(
        "campaign_id, kind, status, entry_type, payout_id, commission_amount, currency",
      ),
    admin
      .from("affiliate_payouts")
      .select("status, gross_amount, fee_amount, net_amount"),
    admin
      .from("affiliate_campaigns")
      .select("id, slug, name, status, created_at")
      .order("created_at", { ascending: true }),
    admin.from("affiliate_referrals").select("campaign_id"),
  ]);

  const f = (Array.isArray(funnelRow) ? funnelRow[0] : funnelRow) ?? {};
  const funnel = {
    clicks: Number(f.clicks ?? 0),
    referrals: Number(f.referrals ?? 0),
    hosts: Number(f.hosts ?? 0),
    listedHosts: Number(f.listed_hosts ?? 0),
    payingHosts: Number(f.paying_hosts ?? 0),
    liveListings: Number(f.live_listings ?? 0),
    activePartners: Number(f.active_partners ?? 0),
  };

  const commRows = (commissions ?? []) as (CommRow & {
    campaign_id: string | null;
  })[];
  const balance = summariseCommissions(commRows);
  const byKind = summariseByKind(commRows);

  const payoutSummary: PayoutSummary = {
    requested: 0,
    approved: 0,
    processing: 0,
    paidTotal: 0,
    paidCount: 0,
    feeTotal: 0,
  };
  for (const p of payouts ?? []) {
    const net = Number(p.net_amount ?? 0);
    if (p.status === "requested") payoutSummary.requested += net;
    else if (p.status === "approved") payoutSummary.approved += net;
    else if (p.status === "processing") payoutSummary.processing += net;
    else if (p.status === "paid") {
      payoutSummary.paidTotal += net;
      payoutSummary.paidCount += 1;
      payoutSummary.feeTotal += Number(p.fee_amount ?? 0);
    }
  }
  (Object.keys(payoutSummary) as (keyof PayoutSummary)[]).forEach((k) => {
    payoutSummary[k] = round2(payoutSummary[k]);
  });

  // Per-campaign net earned + referral counts, plus the default programme.
  const earnedByCampaign = new Map<string, number>();
  let defaultEarned = 0;
  for (const r of commRows) {
    if (r.status === "voided") continue;
    const amt = Number(r.commission_amount ?? 0);
    if (r.campaign_id) {
      earnedByCampaign.set(
        r.campaign_id,
        (earnedByCampaign.get(r.campaign_id) ?? 0) + amt,
      );
    } else {
      defaultEarned += amt;
    }
  }
  const refByCampaign = new Map<string, number>();
  let defaultRefs = 0;
  for (const r of refs ?? []) {
    if (r.campaign_id) {
      refByCampaign.set(
        r.campaign_id,
        (refByCampaign.get(r.campaign_id) ?? 0) + 1,
      );
    } else {
      defaultRefs += 1;
    }
  }

  // Per-campaign live listings + paying hosts from the funnel RPC (few campaigns).
  const campaignRows = (campaigns ?? []) as {
    id: string;
    slug: string;
    name: string;
    status: string;
  }[];
  const funnels = await Promise.all(
    campaignRows.map(async (c) => {
      const { data } = await admin.rpc("campaign_funnel", {
        p_campaign_id: c.id,
      });
      const row = (Array.isArray(data) ? data[0] : data) ?? {};
      return {
        id: c.id,
        liveListings: Number(row.live_listings ?? 0),
        payingHosts: Number(row.paying_hosts ?? 0),
      };
    }),
  );
  const funnelById = new Map(funnels.map((x) => [x.id, x]));

  const compareRows: CampaignCompareRow[] = campaignRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    status: c.status,
    referrals: refByCampaign.get(c.id) ?? 0,
    liveListings: funnelById.get(c.id)?.liveListings ?? 0,
    payingHosts: funnelById.get(c.id)?.payingHosts ?? 0,
    earned: round2(earnedByCampaign.get(c.id) ?? 0),
  }));

  return {
    funnel,
    balance,
    byKind,
    payouts: payoutSummary,
    campaigns: compareRows,
    defaultProgram: { referrals: defaultRefs, earned: round2(defaultEarned) },
  };
}
