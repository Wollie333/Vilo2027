import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { AffiliateTermsEditor } from "./_components/AffiliateTermsEditor";

export const dynamic = "force-dynamic";

export default async function AffiliateTermsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: settings }, brand] = await Promise.all([
    service
      .from("affiliate_settings")
      .select("terms_content, terms_version")
      .eq("id", true)
      .maybeSingle(),
    getBrandName(),
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
          Affiliate terms
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          The terms guests and hosts must accept to join the affiliate
          programme. Changes go live immediately on the sign-up gate.
        </p>
      </header>

      <AffiliateTermsEditor
        initialContent={settings?.terms_content ?? ""}
        initialVersion={settings?.terms_version ?? "v1"}
        brand={brand}
      />
    </div>
  );
}
