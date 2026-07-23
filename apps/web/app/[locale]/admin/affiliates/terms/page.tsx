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
      <div className="am-card p-4">
        <div className="smallcaps">Signatures on version {version}</div>
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
