import { requirePermission } from "@/lib/admin";
import { resolveAffiliateTerms } from "@/lib/affiliate/programTerms";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { AffiliateTermsEditor } from "./_components/AffiliateTermsEditor";

export const dynamic = "force-dynamic";

export default async function AffiliateTermsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: settings }, brand, { count: partnerCount }, terms] =
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
      resolveAffiliateTerms(service),
    ]);

  // The version partners actually sign: the affiliate_program_terms placement
  // document when published, otherwise the legacy affiliate_settings version
  // this editor writes (the fallback).
  const version = terms.version;
  const usingPlacement = version.startsWith("legal-v");
  // WS-6b — how many partners have actually signed the version now on file.
  const { count: signedCount } = await service
    .from("affiliate_agreement_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("version", version);
  const partners = partnerCount ?? 0;
  const signed = signedCount ?? 0;

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        {usingPlacement ? (
          <>
            <strong className="font-semibold">
              Managed in Legal docs now.
            </strong>{" "}
            The affiliate program terms are published from{" "}
            <a href="/admin/legal" className="font-semibold underline">
              Legal docs → Affiliate Program Terms
            </a>{" "}
            — that document is what partners sign. This editor only feeds the
            legacy fallback, used when nothing is published into that slot.
          </>
        ) : (
          <>
            <strong className="font-semibold">Tip:</strong> you can now manage
            these terms in{" "}
            <a href="/admin/legal" className="font-semibold underline">
              Legal docs → Affiliate Program Terms
            </a>{" "}
            (the single source of truth). Publishing a document there makes it
            the affiliate terms; this editor is the fallback until you do.
          </>
        )}
      </div>

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
        initialVersion={settings?.terms_version ?? "v1"}
        brand={brand}
      />
    </div>
  );
}
