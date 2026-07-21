import { Wallet } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { createAdminClient } from "@/lib/supabase/admin";

import { PayoutsManager } from "./_components/PayoutsManager";

export const dynamic = "force-dynamic";

// Commission payout management, filterable by campaign.
//
// One thing this screen is careful NOT to pretend: a payout is per PARTNER, not
// per campaign — `affiliate_payouts` settles whatever cleared commission that
// partner holds, across every campaign. So the campaign filter scopes the
// COMMISSION figures, and each partner's payout requests are shown alongside,
// labelled as covering their whole cleared balance.

type Search = { campaign?: string };

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const selected = searchParams.campaign ?? "all";

  const [{ data: campaigns }, { data: payouts }] = await Promise.all([
    service
      .from("affiliate_campaigns")
      .select("id, name, slug, status")
      .order("created_at", { ascending: false }),
    service
      .from("affiliate_payouts")
      .select(
        "id, affiliate_id, method, status, gross_amount, fee_amount, net_amount, currency, requested_at, processed_at, provider_reference, failure_reason",
      )
      .order("requested_at", { ascending: false })
      .limit(200),
  ]);

  // Commission rows, scoped to the chosen campaign.
  let commissionQuery = service
    .from("affiliate_commissions")
    .select(
      "id, affiliate_id, campaign_id, status, entry_type, kind, payout_id, commission_amount, currency, created_at, paid_at",
    );
  if (selected === "none") {
    commissionQuery = commissionQuery.is("campaign_id", null);
  } else if (selected !== "all") {
    commissionQuery = commissionQuery.eq("campaign_id", selected);
  }
  const { data: commissions } = await commissionQuery;
  const rows = commissions ?? [];

  // Resolve partner identities once.
  const affiliateIds = Array.from(
    new Set([
      ...rows.map((r) => r.affiliate_id),
      ...(payouts ?? []).map((p) => p.affiliate_id),
    ]),
  ).filter(Boolean) as string[];

  const partner = new Map<
    string,
    { name: string; email: string | null; slug: string }
  >();
  if (affiliateIds.length) {
    const { data: accounts } = await service
      .from("affiliate_accounts")
      .select("id, user_id, slug")
      .in("id", affiliateIds);
    const userIds = (accounts ?? []).map((a) => a.user_id);
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
    const byUser = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const a of accounts ?? []) {
      const p = byUser.get(a.user_id);
      partner.set(a.id, {
        name: p?.full_name || p?.email || "Unnamed partner",
        email: p?.email ?? null,
        slug: a.slug as string,
      });
    }
  }

  // Per-partner rollup of the (campaign-scoped) commission rows.
  const byAffiliate = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byAffiliate.get(r.affiliate_id) ?? [];
    list.push(r);
    byAffiliate.set(r.affiliate_id, list);
  }

  const partnerRows = Array.from(byAffiliate.entries())
    .map(([affiliateId, list]) => {
      const bal = summariseCommissions(
        list.map((c) => ({
          status: c.status as string,
          entry_type: c.entry_type as string,
          payout_id: c.payout_id as string | null,
          commission_amount: Number(c.commission_amount),
          currency: c.currency as string | null,
        })),
      );
      const info = partner.get(affiliateId);
      return {
        id: affiliateId,
        name: info?.name ?? "—",
        email: info?.email ?? null,
        slug: info?.slug ?? "",
        pending: bal.pending,
        available: bal.available,
        inPayout: bal.inPayout,
        paid: bal.paid,
        lifetime: bal.lifetime,
        currency: bal.currency,
        entries: list.length,
      };
    })
    .sort((a, b) => b.available - a.available || b.lifetime - a.lifetime);

  const totals = summariseCommissions(
    rows.map((c) => ({
      status: c.status as string,
      entry_type: c.entry_type as string,
      payout_id: c.payout_id as string | null,
      commission_amount: Number(c.commission_amount),
      currency: c.currency as string | null,
    })),
  );

  // Payout requests: all of them, tagged with whether that partner has
  // commission in the selected campaign (so the filter is informative, not a lie).
  const inScope = new Set(byAffiliate.keys());
  const payoutRows = (payouts ?? []).map((p) => ({
    id: p.id as string,
    affiliateId: p.affiliate_id as string,
    name: partner.get(p.affiliate_id as string)?.name ?? "—",
    method: p.method as string,
    status: p.status as string,
    gross: Number(p.gross_amount),
    fee: Number(p.fee_amount),
    net: Number(p.net_amount),
    currency: (p.currency as string) ?? "ZAR",
    requestedAt: p.requested_at as string,
    processedAt: p.processed_at as string | null,
    reference: (p.provider_reference as string | null) ?? null,
    failureReason: (p.failure_reason as string | null) ?? null,
    inSelectedCampaign: inScope.has(p.affiliate_id as string),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
          <Wallet className="h-6 w-6 text-brand-primary" />
          Payouts
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Commission owed and paid, per partner. Filter by campaign to see what
          a competition has earned its partners.
        </p>
      </header>

      <PayoutsManager
        campaigns={(campaigns ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
          status: c.status as string,
        }))}
        selected={selected}
        totals={totals}
        partners={partnerRows}
        payouts={payoutRows}
      />
    </div>
  );
}
