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

  const [{ data: settings }, brand, { count: partnerCount }] =
    await Promise.all([
      service
        .from("affiliate_settings")
        .select("terms_content, terms_version")
        .eq("id", true)
        .maybeSingle(),
      getBrandName(),
      service
        .from("affiliate_accounts")
        .select("id", { count: "exact", head: true }),
    ]);

  const version = settings?.terms_version ?? "v1";
  // WS-6b — how many partners have actually signed the version now on file.
  const { count: signedCount } = await service
    .from("affiliate_agreement_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("version", version);
  const partners = partnerCount ?? 0;
  const signed = signedCount ?? 0;

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

      <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Signatures on version {version}
        </div>
        <div className="num mt-1.5 font-display text-[26px] font-bold leading-none text-brand-ink">
          {signed}
          <span className="text-[15px] font-semibold text-brand-mute">
            {" "}
            / {partners} partners
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-brand-mute">
          Every acceptance is stored as an immutable signed copy (full text,
          hash, date and IP), visible on each partner&apos;s record. Bumping the
          version number re-gates the portal: existing partners keep their
          account and earnings but must sign again before they can use it.
        </p>
      </div>

      <AffiliateTermsEditor
        initialContent={settings?.terms_content ?? ""}
        initialVersion={version}
        brand={brand}
      />
    </div>
  );
}
