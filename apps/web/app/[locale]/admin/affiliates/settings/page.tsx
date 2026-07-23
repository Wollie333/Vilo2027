import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { AffiliateSettingsClient } from "../_components/AffiliateSettingsClient";
import { AffiliateTiersEditor } from "../_components/AffiliateTiersEditor";

export const dynamic = "force-dynamic";

export default async function AffiliateSettingsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: settings }, { data: fees }, { data: tiers }] =
    await Promise.all([
      service
        .from("affiliate_settings")
        .select(
          "cookie_days, hold_days, min_payout_threshold, terms_version, attribution_model, currency",
        )
        .eq("id", true)
        .maybeSingle(),
      service
        .from("affiliate_payout_fees")
        .select("method, fixed_fee, percent_fee, cap_fee, currency"),
      service
        .from("affiliate_tiers")
        .select("id, name, min_lifetime_earnings, bonus_percent")
        .order("min_lifetime_earnings", { ascending: true }),
    ]);

  return (
    <div className="space-y-6">
      <AffiliateSettingsClient
        settings={{
          cookieDays: settings?.cookie_days ?? 30,
          holdDays: settings?.hold_days ?? 30,
          minPayoutThreshold: Number(settings?.min_payout_threshold ?? 250),
          termsVersion: settings?.terms_version ?? "v1",
          attributionModel: (settings?.attribution_model ?? "last_click") as
            | "first_click"
            | "last_click",
          currency: settings?.currency ?? "ZAR",
        }}
        fees={(fees ?? []).map((f) => ({
          method: f.method as "eft" | "paystack" | "paypal",
          fixedFee: Number(f.fixed_fee),
          percentFee: Number(f.percent_fee),
          capFee: f.cap_fee != null ? Number(f.cap_fee) : null,
        }))}
      />

      <AffiliateTiersEditor
        tiers={(tiers ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          minEarnings: Number(t.min_lifetime_earnings),
          bonusPercent: Number(t.bonus_percent),
        }))}
      />
    </div>
  );
}
