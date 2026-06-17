import { requirePermission } from "@/lib/admin";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { createAdminClient } from "@/lib/supabase/admin";

import { AffiliateAdminPanel } from "./_components/AffiliateAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [
    { data: accounts },
    { data: referrals },
    { data: commissions },
    { data: payouts },
  ] = await Promise.all([
    service
      .from("affiliate_accounts")
      .select("id, user_id, slug, status, currency, created_at")
      .order("created_at", { ascending: false }),
    service.from("affiliate_referrals").select("affiliate_id"),
    service
      .from("affiliate_commissions")
      .select(
        "affiliate_id, status, entry_type, payout_id, commission_amount, currency",
      ),
    service
      .from("affiliate_payouts")
      .select(
        "id, affiliate_id, method, status, gross_amount, fee_amount, net_amount, currency, requested_at",
      )
      .in("status", ["requested", "approved", "processing"])
      .order("requested_at", { ascending: true }),
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
  for (const r of referrals ?? []) {
    refCount.set(r.affiliate_id, (refCount.get(r.affiliate_id) ?? 0) + 1);
  }

  const commByAffiliate = new Map<string, typeof commissions>();
  for (const c of commissions ?? []) {
    const arr = commByAffiliate.get(c.affiliate_id) ?? [];
    arr.push(c);
    commByAffiliate.set(c.affiliate_id, arr);
  }

  const affiliates = accts.map((a) => {
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
      status: a.status as "active" | "suspended",
      currency: a.currency,
      name: profile?.full_name || "Unnamed",
      email: profile?.email ?? null,
      referrals: refCount.get(a.id) ?? 0,
      lifetime: bal.lifetime,
      available: bal.available,
      pending: bal.pending,
    };
  });

  const payoutRows = (payouts ?? []).map((p) => {
    const acct = accts.find((a) => a.id === p.affiliate_id);
    const profile = acct ? profileById.get(acct.user_id) : undefined;
    return {
      id: p.id,
      affiliateName: profile?.full_name || acct?.slug || "Affiliate",
      method: p.method,
      status: p.status,
      gross: Number(p.gross_amount),
      fee: Number(p.fee_amount),
      net: Number(p.net_amount),
      currency: p.currency,
      requestedAt: p.requested_at,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Affiliates
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every affiliate, their referrals and earnings, plus the payout queue.
          Commission rates are set per product in the Product manager.
        </p>
      </header>

      <AffiliateAdminPanel affiliates={affiliates} payouts={payoutRows} />
    </div>
  );
}
