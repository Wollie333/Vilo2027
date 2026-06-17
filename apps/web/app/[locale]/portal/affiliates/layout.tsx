import { getAffiliateForUser } from "@/lib/affiliate/account";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AffiliateNav } from "./_components/AffiliateNav";
import { AffiliateTermsGate } from "./_components/AffiliateTermsGate";

export const dynamic = "force-dynamic";

// Gate the whole /portal/affiliates subtree behind affiliate-terms acceptance.
// Until the user has an affiliate account, every sub-route shows the terms gate
// in place (no redirect). No host check — any authenticated user qualifies.
export default async function AffiliatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);

  if (!account) {
    const [{ data: settings }, brand] = await Promise.all([
      admin
        .from("affiliate_settings")
        .select("terms_version, terms_content")
        .eq("id", true)
        .maybeSingle(),
      getBrandName(),
    ]);
    return (
      <AffiliateTermsGate
        brand={brand}
        termsVersion={settings?.terms_version ?? "v1"}
        termsContent={settings?.terms_content ?? ""}
      />
    );
  }

  return (
    <div>
      <AffiliateNav />
      {children}
    </div>
  );
}
