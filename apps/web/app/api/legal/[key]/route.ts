import { NextResponse } from "next/server";

import {
  getPlacedDocument,
  getPublishedLegalDocument,
  type LegalPlacementSlot,
} from "@/lib/legalDocuments";

export const dynamic = "force-dynamic";

// Lightweight JSON feed for the in-page legal MODAL (LegalDocModalLink). Returns
// the PUBLISHED document for a key so checkout/signup can show it without leaving
// the flow. `terms`/`privacy`/`cookies` resolve via their placement; anything
// else is a /legal/<slug> document. 404 when nothing is published — the modal
// link then falls back to opening the full page (which shows its static copy).
const PLACEMENT_KEYS = new Set<LegalPlacementSlot>([
  "terms",
  "privacy",
  "cookies",
]);

function isPlacementKey(key: string): key is LegalPlacementSlot {
  return PLACEMENT_KEYS.has(key as LegalPlacementSlot);
}

export async function GET(
  _request: Request,
  { params }: { params: { key: string } },
) {
  const key = params.key;
  const doc = isPlacementKey(key)
    ? await getPlacedDocument(key)
    : await getPublishedLegalDocument(key);

  if (!doc || !doc.bodyHtml) {
    return NextResponse.json({ published: false }, { status: 404 });
  }

  return NextResponse.json({
    published: true,
    title: doc.title,
    html: doc.bodyHtml,
    lastUpdated: doc.updatedAt,
  });
}
