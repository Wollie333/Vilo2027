import { PencilLine } from "lucide-react";

import { AgreementBody } from "@/components/affiliate/AgreementBody";
import { requirePermission } from "@/lib/admin";
import { renderAgreementBody } from "@/lib/affiliate/agreement.shared";
import { resolveAffiliateTerms } from "@/lib/affiliate/programTerms";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Read-only reflection of the affiliate program terms. The terms are managed in
// the single source of truth (Admin → Legal docs → Affiliate Program Terms) and
// resolved live here via resolveAffiliateTerms — this page never edits them, so
// there is exactly one place they can change.
export default async function AffiliateTermsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [brand, { count: partnerCount }, terms] = await Promise.all([
    getBrandName(),
    service
      .from("affiliate_accounts")
      .select("id", { count: "exact", head: true }),
    resolveAffiliateTerms(service),
  ]);

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
        <strong className="font-semibold">Managed in Legal docs.</strong> The
        affiliate program terms are the single source of truth in{" "}
        <a
          href="/admin/legal#doc-affiliate-program-terms"
          className="font-semibold underline"
        >
          Legal docs → Affiliate Program Terms
        </a>
        . This page reflects the live terms partners sign — edit them there.
        {!usingPlacement ? (
          <>
            {" "}
            Nothing is published into that slot yet, so partners currently see
            the built-in fallback terms shown below; publishing a document takes
            over.
          </>
        ) : null}
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
          hash, date and IP), visible on each partner&apos;s record. Publishing
          a new version in Legal docs re-gates the portal: existing partners
          keep their account and earnings but must sign again before they can
          use it.
        </p>
      </div>

      <section className="am-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-bold text-brand-ink">
            Current terms{" "}
            <span className="ml-1 rounded-pill bg-brand-light px-2.5 py-0.5 align-middle text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
              {version}
            </span>
          </h2>
          <a
            href="/admin/legal#doc-affiliate-program-terms"
            className="btn-pri inline-flex h-9 items-center gap-1.5"
          >
            <PencilLine className="h-4 w-4" />
            Edit in Legal docs
          </a>
        </div>
        <p className="mt-0.5 text-[12.5px] text-brand-mute">
          Read-only — exactly what a partner sees and signs at the gate.
        </p>
        <div className="mt-4 max-h-[520px] overflow-y-auto rounded-card border border-brand-line bg-white p-4">
          <AgreementBody rendered={renderAgreementBody(terms.content, brand)} />
        </div>
      </section>
    </div>
  );
}
