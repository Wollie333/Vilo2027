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

// ─── Placements (single source of truth binding layer) ───────────────
// A well-known app "slot" points at whichever legal_documents row fills it
// (see migration 20260731165000_legal_placements). Consumers resolve slot → doc
// so the admin/lawyer publishes once and every surface updates. This is the
// fixed launch catalog (founder choice: core four + Founding Host / Review /
// Looking-For); everything else is a free /legal/<slug> page or a per-campaign
// binding. Adding a NEW kind of slot needs a matching consumer in code — but
// reassigning which doc fills an existing slot is done in the admin, no deploy.

export type LegalPlacementSlot =
  | "terms"
  | "privacy"
  | "cookies"
  | "affiliate_program_terms"
  | "founding_host_terms"
  | "review_disclosure"
  | "looking_for";

export const LEGAL_PLACEMENT_SLOTS: ReadonlyArray<{
  slot: LegalPlacementSlot;
  label: string;
  /** Where this slot's document is shown in the app. */
  usedAt: string;
}> = [
  { slot: "terms", label: "Terms of Service", usedAt: "/terms + checkout" },
  { slot: "privacy", label: "Privacy Policy", usedAt: "/privacy + checkout" },
  {
    slot: "cookies",
    label: "Cookies Policy",
    usedAt: "/cookies + cookie banner",
  },
  {
    slot: "affiliate_program_terms",
    label: "Affiliate Program Terms",
    usedAt: "Affiliate gate + partner signup",
  },
  {
    slot: "founding_host_terms",
    label: "Founding Host Terms",
    usedAt: "/legal/founding-host-terms",
  },
  {
    slot: "review_disclosure",
    label: "Review Disclosure",
    usedAt: "/legal/review-disclosure",
  },
  {
    slot: "looking_for",
    label: "Looking-For Notice",
    usedAt: "/legal/looking-for-notice",
  },
];

// The PUBLISHED document currently bound to a slot, or null when nothing is
// placed / the placed doc is unpublished. Consumers fall back to their built-in
// static copy on null, so a page is never blank.
export const getPlacedDocument = cache(
  async (slot: LegalPlacementSlot): Promise<LegalDocument | null> => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("legal_placements")
        .select("doc_slug")
        .eq("slot", slot)
        .maybeSingle();
      const docSlug = (data as { doc_slug: string | null } | null)?.doc_slug;
      if (!docSlug) return null;
      return await getPublishedLegalDocument(docSlug);
    } catch {
      return null;
    }
  },
);

// slot → bound doc_slug for every slot (published or not) — the admin Placements
// panel. Missing rows resolve to null so a freshly added slot still lists.
export async function listPlacements(): Promise<
  Record<LegalPlacementSlot, string | null>
> {
  const result = Object.fromEntries(
    LEGAL_PLACEMENT_SLOTS.map((s) => [s.slot, null]),
  ) as Record<LegalPlacementSlot, string | null>;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("legal_placements")
      .select("slot, doc_slug");
    for (const row of (data ?? []) as Array<{
      slot: string;
      doc_slug: string | null;
    }>) {
      if (row.slot in result) {
        result[row.slot as LegalPlacementSlot] = row.doc_slug;
      }
    }
    return result;
  } catch {
    return result;
  }
}

// The version to stamp onto a booking's consent record for the Terms and Privacy
// slots. Uses the PUBLISHED placed doc's legal_documents.version; falls back to 1
// (the built-in static copy = v1) when nothing is published into the slot — which
// is exactly what the public /terms and /privacy pages then show. This keeps
// bookings.accepted_terms_version / accepted_privacy_version a faithful record of
// what the guest actually saw at checkout, sourced from the single doc store.
export async function getPlacedLegalVersions(): Promise<{
  terms: number;
  privacy: number;
}> {
  const [terms, privacy] = await Promise.all([
    getPlacedDocument("terms"),
    getPlacedDocument("privacy"),
  ]);
  return { terms: terms?.version ?? 1, privacy: privacy?.version ?? 1 };
}
