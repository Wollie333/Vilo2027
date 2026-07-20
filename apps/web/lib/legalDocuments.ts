import { cache } from "react";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { createAdminClient } from "@/lib/supabase/admin";

// Generic, slug-addressable legal documents (WS-6a) — competition rules, Founding
// Host terms, review disclosure, the Looking-For POPIA notice, etc. Distinct from
// the three platform_settings docs in lib/legal.ts (booking terms + privacy).
//
// HTML is sanitised on READ as well as write (defence-in-depth: historic rows are
// never re-sanitised, so a later allowlist tightening still renders old stored
// HTML safely — the public page renders it raw).

export type LegalDocument = {
  slug: string;
  title: string;
  bodyHtml: string | null;
  version: number;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
};

type Row = {
  slug: string;
  title: string;
  body_html: string | null;
  version: number;
  is_published: boolean;
  published_at: string | null;
  updated_at: string | null;
};

function toDoc(r: Row): LegalDocument {
  return {
    slug: r.slug,
    title: r.title,
    bodyHtml:
      typeof r.body_html === "string" && r.body_html.trim().length > 0
        ? sanitiseListingHtml(r.body_html)
        : null,
    version: typeof r.version === "number" ? r.version : 1,
    isPublished: Boolean(r.is_published),
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

const SELECT =
  "slug, title, body_html, version, is_published, published_at, updated_at";

// A single PUBLISHED document by slug — the public /legal/[slug] route. Returns
// null when the slug is unknown or unpublished (→ 404).
export const getPublishedLegalDocument = cache(
  async (slug: string): Promise<LegalDocument | null> => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("legal_documents")
        .select(SELECT)
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      return data ? toDoc(data as Row) : null;
    } catch {
      return null;
    }
  },
);

// All documents (published or not) — the admin editor list.
export async function listLegalDocuments(): Promise<LegalDocument[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("legal_documents")
      .select(SELECT)
      .order("title", { ascending: true });
    return (data ?? []).map((r) => toDoc(r as Row));
  } catch {
    return [];
  }
}
