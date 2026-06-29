import type { Metadata } from "next";

import { getAffiliateForUser } from "@/lib/affiliate/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  type LibraryAsset,
  MarketingLibrary,
} from "../_components/MarketingLibrary";

export const metadata: Metadata = { title: "Affiliate marketing" };
export const dynamic = "force-dynamic";

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
      "id, category, title, description, body, link_url, file_url, mime_type, width",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://wielo.co.za";
  const referralLink = `${baseUrl}/r/${account.slug}`;

  return (
    <MarketingLibrary
      assets={(assets ?? []) as LibraryAsset[]}
      referralLink={referralLink}
    />
  );
}
