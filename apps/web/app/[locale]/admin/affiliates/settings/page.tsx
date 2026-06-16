import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { AffiliateSettingsClient } from "../_components/AffiliateSettingsClient";

export const dynamic = "force-dynamic";

export default async function AffiliateSettingsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: settings }, { data: fees }, { data: assets }] =
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
        .from("marketing_assets")
        .select(
          "id, title, category, file_url, mime_type, is_active, created_at",
        )
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/affiliates"
          className="inline-flex items-center gap-1.5 text-sm text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to affiliates
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">
          Affiliate programme settings
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Tracking window, refund hold, payout threshold, processor fees and the
          marketing material affiliates can use.
        </p>
      </header>

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
        assets={(assets ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          fileUrl: a.file_url,
          mimeType: a.mime_type,
          isActive: a.is_active,
        }))}
      />
    </div>
  );
}
