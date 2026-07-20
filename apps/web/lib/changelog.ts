import "server-only";

import { cache } from "react";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { createAdminClient } from "@/lib/supabase/admin";

// WS-3b — data-backed, customer-facing changelog. Each entry can credit the host
// who asked, by name. The public /change-log page renders these when any are
// published, else falls back to the repo CHANGELOG.md file parse.
//
// HTML is sanitised on READ as well as write (defence-in-depth, mirrors
// lib/legalDocuments.ts): historic rows are never re-sanitised, so a later
// allowlist tightening still renders old stored HTML safely.

export type ChangelogEntry = {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string | null;
  creditedHostId: string | null;
  creditedName: string | null;
  featureRequestId: string | null;
  shippedAt: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type Row = {
  id: string;
  slug: string;
  title: string;
  body_html: string | null;
  credited_host_id: string | null;
  credited_name: string | null;
  feature_request_id: string | null;
  shipped_at: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
};

const SELECT =
  "id, slug, title, body_html, credited_host_id, credited_name, feature_request_id, shipped_at, is_published, published_at, created_at, updated_at";

function toEntry(r: Row): ChangelogEntry {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    bodyHtml:
      typeof r.body_html === "string" && r.body_html.trim().length > 0
        ? sanitiseListingHtml(r.body_html)
        : null,
    creditedHostId: r.credited_host_id,
    creditedName: r.credited_name,
    featureRequestId: r.feature_request_id,
    shippedAt: r.shipped_at,
    isPublished: Boolean(r.is_published),
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Newest-shipped first. Powers the public /change-log page when non-empty.
export const listPublishedChangelogEntries = cache(
  async (): Promise<ChangelogEntry[]> => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("changelog_entries")
        .select(SELECT)
        .eq("is_published", true)
        .order("shipped_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      return (data ?? []).map((r) => toEntry(r as Row));
    } catch {
      return [];
    }
  },
);

// All entries (published or not) — the admin editor list.
export async function listAllChangelogEntries(): Promise<ChangelogEntry[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("changelog_entries")
      .select(SELECT)
      .order("shipped_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => toEntry(r as Row));
  } catch {
    return [];
  }
}

// Host options for the credit picker (id + display name + email).
export type HostOption = { id: string; name: string; email: string | null };

export async function listHostOptions(): Promise<HostOption[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("hosts")
      .select("id, user_profiles:user_id(full_name, email)")
      .is("deleted_at", null)
      .limit(500);
    return (data ?? []).map((h) => {
      const profile = h.user_profiles as unknown as {
        full_name: string | null;
        email: string | null;
      } | null;
      return {
        id: h.id as string,
        name: profile?.full_name?.trim() || profile?.email || "Unnamed host",
        email: profile?.email ?? null,
      };
    });
  } catch {
    return [];
  }
}

// Shipped Build Board items an entry can deep-link to (id + title).
export async function listShippedFeatureRequests(): Promise<
  { id: string; title: string }[]
> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("feature_requests")
      .select("id, title")
      .eq("status", "shipped")
      .is("merged_into_id", null)
      .order("title", { ascending: true });
    return (data ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
    }));
  } catch {
    return [];
  }
}
