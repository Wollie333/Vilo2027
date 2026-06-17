import { ChevronRight } from "lucide-react";

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

  const { count: productCount } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .neq("affiliate_type", "none");

  const memberSince = account.accepted_at
    ? new Date(account.accepted_at).toLocaleDateString("en-ZA", {
        month: "short",
        year: "numeric",
      })
    : null;
  const isActive = account.status === "active";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-1">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <span>Portal</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">Affiliates</span>
          </nav>
          <h1 className="mt-1 font-display text-[24px] font-extrabold leading-none text-brand-ink">
            Affiliate Portal
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2 pb-0.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold ${
              isActive
                ? "border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]"
                : "border-[#FDE9C8] bg-[#FFFBEB] text-[#B45309]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-brand-primary" : "bg-status-pending"
              }`}
            />
            {isActive ? "Active partner" : "Suspended"}
          </span>
          {memberSince ? (
            <span className="text-[12px] text-brand-mute">
              Member since {memberSince}
            </span>
          ) : null}
        </div>
      </div>

      <AffiliateNav productCount={productCount ?? 0} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
