import {
  LEGAL_PLACEMENT_SLOTS,
  listLegalDocuments,
  listPlacements,
} from "@/lib/legalDocuments";

import { LegalDocumentsManager } from "../LegalDocumentsManager";
import { PlacementsPanel } from "../PlacementsPanel";

export const dynamic = "force-dynamic";

// Documents tab — the single source of truth for legal copy. Every document is
// slug-addressable at /legal/<slug>; the Placements panel binds each app slot
// (Terms, Privacy, Cookies, Affiliate terms, …) to the document that fills it,
// so publishing once updates every surface. Your attorney pastes final copy and
// assigns it here — no deploy.
export default async function AdminLegalDocumentsPage() {
  const [docs, placements] = await Promise.all([
    listLegalDocuments(),
    listPlacements(),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-base font-bold text-brand-ink">
          Legal documents
        </h2>
        <p className="mb-3 mt-1 text-sm text-brand-mute">
          Slug-addressable legal pages published at{" "}
          <code className="rounded bg-brand-light px-1 py-0.5 text-[12px]">
            /legal/&lt;slug&gt;
          </code>
          . Paste final copy from your attorney; each publish retains a version.
          Use <strong>Placements</strong> below to assign a document to Terms,
          Privacy, Cookies, the affiliate gate, and more.
        </p>
      </div>

      <PlacementsPanel
        slots={LEGAL_PLACEMENT_SLOTS}
        placements={placements}
        docs={docs.map((d) => ({
          slug: d.slug,
          title: d.title,
          isPublished: d.isPublished,
        }))}
      />

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
