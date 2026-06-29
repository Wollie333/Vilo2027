import type { MetadataRoute } from "next";

import { createServerClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wielo.co.za";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient();

  const [
    { data: articles },
    { data: categories },
    { data: listingCategories },
  ] = await Promise.all([
    supabase
      .from("help_articles")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(2000),
    supabase
      .from("help_categories")
      .select("slug, updated_at")
      .eq("is_published", true)
      .is("deleted_at", null)
      .limit(200),
    supabase
      .from("property_categories")
      .select("slug, updated_at")
      .eq("is_published", true)
      .is("deleted_at", null)
      .limit(500),
  ]);

  const now = new Date().toISOString();

  const root: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/help/articles`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/booking-management`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const articleEntries: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${BASE_URL}/help/${(a as { slug: string }).slug}`,
    lastModified:
      (a as { updated_at?: string; published_at?: string }).updated_at ??
      (a as { published_at?: string }).published_at ??
      now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const categoryEntries: MetadataRoute.Sitemap = (categories ?? []).map(
    (c) => ({
      url: `${BASE_URL}/help/category/${(c as { slug: string }).slug}`,
      lastModified: (c as { updated_at?: string }).updated_at ?? now,
      changeFrequency: "weekly",
      priority: 0.5,
    }),
  );

  const listingCategoryEntries: MetadataRoute.Sitemap = (
    listingCategories ?? []
  ).map((c) => ({
    url: `${BASE_URL}/c/${(c as { slug: string }).slug}`,
    lastModified: (c as { updated_at?: string }).updated_at ?? now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...root,
    ...listingCategoryEntries,
    ...categoryEntries,
    ...articleEntries,
  ];
}
