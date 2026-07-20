import { listLegalDocuments } from "@/lib/legalDocuments";

import { LegalDocumentsManager } from "../LegalDocumentsManager";

export const dynamic = "force-dynamic";

// Documents tab — generic, slug-addressable legal documents (WS-6a). Distinct from
// the platform booking-terms/privacy on the Legal tab. Your attorney pastes final
// copy here and it takes effect live at /legal/<slug>, version-retained.
export default async function AdminLegalDocumentsPage() {
  const docs = await listLegalDocuments();

  return (
    <section>
      <h2 className="font-display text-base font-bold text-brand-ink">
        Legal documents
      </h2>
      <p className="mb-3 mt-1 text-sm text-brand-mute">
        Slug-addressable legal pages published at{" "}
        <code className="rounded bg-brand-light px-1 py-0.5 text-[12px]">
          /legal/&lt;slug&gt;
        </code>{" "}
        — competition rules, Founding Host terms, review disclosure, POPIA
        notices. Paste final copy from your attorney; each publish retains a
        version. (Booking terms &amp; privacy live on the <strong>Legal</strong>{" "}
        tab.)
      </p>
      <LegalDocumentsManager
        docs={docs.map((d) => ({
          slug: d.slug,
          title: d.title,
          bodyHtml: d.bodyHtml,
          version: d.version,
          isPublished: d.isPublished,
        }))}
      />
    </section>
  );
}
