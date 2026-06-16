import type { Metadata } from "next";

import { getAffiliateForUser } from "@/lib/affiliate/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { MarketingAssetCard } from "../_components/MarketingAssetCard";

export const metadata: Metadata = { title: "Affiliate marketing" };
export const dynamic = "force-dynamic";

type Asset = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
};

export default async function AffiliateMarketingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null;

  const { data: assets } = await admin
    .from("marketing_assets")
    .select(
      "id, title, description, category, file_url, mime_type, width, height",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://vilo.co.za";
  const referralLink = `${baseUrl}/r/${account.slug}`;

  const rows = (assets ?? []) as Asset[];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
          Marketing material
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Download banners and images, or copy the ready-made embed code — your
          referral link is built in.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
          No marketing material has been published yet. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <MarketingAssetCard
              key={a.id}
              asset={a}
              referralLink={referralLink}
            />
          ))}
        </div>
      )}
    </div>
  );
}
