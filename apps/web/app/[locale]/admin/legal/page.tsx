import {
  LEGAL_PLACEMENT_SLOTS,
  listLegalDocuments,
  listPlacements,
} from "@/lib/legalDocuments";

import { LegalDocumentsManager } from "../platform/settings/LegalDocumentsManager";
import { PlacementsPanel } from "../platform/settings/PlacementsPanel";

export const dynamic = "force-dynamic";

// The lawyer's screen: every legal document (create / edit / publish, each live
// at /legal/<slug>) plus Placements — bind each app slot (Terms, Privacy,
// Cookies, affiliate & competition rules) to the document that fills it. Publish
// once, update everywhere. Same components as the admin Documents tab.
export default async function AdminLegalPage() {
  const [docs, placements] = await Promise.all([
    listLegalDocuments(),
    listPlacements(),
  ]);

  return (
    <section className="space-y-6">
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
