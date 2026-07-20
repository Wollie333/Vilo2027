import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/app/_components/legal/LegalPage";
import { getBrandName } from "@/lib/brand";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import { stripHtml } from "@/lib/sanitiseHtml";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [doc, brand] = await Promise.all([
    getPublishedLegalDocument(slug),
    getBrandName(),
  ]);
  if (!doc) return { title: `Legal | ${brand}` };
  const desc = doc.bodyHtml ? stripHtml(doc.bodyHtml).slice(0, 155) : "";
  return {
    title: `${doc.title} | ${brand}`,
    description: desc || `${doc.title} — ${brand}.`,
  };
}

// Public, slug-addressable legal document (WS-6a). Renders the admin-authored,
// sanitised HTML through the shared LegalPage. 404s on an unknown/unpublished slug.
export default async function LegalDocumentPage({ params }: Props) {
  const { slug } = await params;
  const doc = await getPublishedLegalDocument(slug);
  if (!doc || !doc.bodyHtml) {
    notFound();
  }

  return (
    <LegalPage
      title={doc.title}
      lastUpdated={fmtDate(doc.publishedAt ?? doc.updatedAt)}
      bodyHtml={doc.bodyHtml}
    />
  );
}
