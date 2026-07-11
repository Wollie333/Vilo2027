import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

export type AffiliateTier = {
  name: string;
  minEarnings: number;
  bonusPercent: number;
};

export type AffiliateTierInfo = {
  /** Cleared + paid earnings that count toward tier qualification. */
  earnings: number;
  current: AffiliateTier | null;
  next: AffiliateTier | null;
  /** How much more the affiliate must earn to reach the next tier (0 if maxed). */
  toNext: number;
  ladder: AffiliateTier[];
};

// Resolve an affiliate's current tier (by lifetime CLEARED+PAID earnings) + the
// next rung. Mirrors the SQL affiliate_tier_bonus() used at accrual time.
export async function getAffiliateTier(
  admin: Db,
  affiliateId: string,
): Promise<AffiliateTierInfo> {
  const [{ data: comms }, { data: tierRows }] = await Promise.all([
    admin
      .from("affiliate_commissions")
      .select("commission_amount")
      .eq("affiliate_id", affiliateId)
      .in("status", ["cleared", "paid"]),
    admin
      .from("affiliate_tiers")
      .select("name, min_lifetime_earnings, bonus_percent")
      .order("min_lifetime_earnings", { ascending: true }),
  ]);

  const earnings =
    (comms ?? []).reduce((s, c) => s + Number(c.commission_amount), 0) || 0;
  const ladder: AffiliateTier[] = (tierRows ?? []).map((t) => ({
    name: t.name as string,
    minEarnings: Number(t.min_lifetime_earnings),
    bonusPercent: Number(t.bonus_percent),
  }));

  let current: AffiliateTier | null = null;
  let next: AffiliateTier | null = null;
  for (const t of ladder) {
    if (earnings >= t.minEarnings) current = t;
    else {
      next = t;
      break;
    }
  }

  return {
    earnings: Math.round(earnings * 100) / 100,
    current,
    next,
    toNext: next
      ? Math.max(0, Math.round((next.minEarnings - earnings) * 100) / 100)
      : 0,
    ladder,
  };
}
