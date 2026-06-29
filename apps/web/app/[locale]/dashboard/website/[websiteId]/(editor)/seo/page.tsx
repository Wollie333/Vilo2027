import { notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { loadWebsiteEditorData } from "../../loadWebsiteEditorData";
import { SeoForm, type PageSeoRow } from "./SeoForm";

export const dynamic = "force-dynamic";

export default async function WebsiteSeoPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const data = await loadWebsiteEditorData(websiteId);
  if (!data) notFound();

  // Per-page SEO completeness (the website is already owner-verified above).
  const supabase = createServerClient();
  const { data: pageRows } = await supabase
    .from("website_pages")
    .select("id, kind, title, slug, seo_overrides")
    .eq("website_id", websiteId)
    .order("nav_order", { ascending: true });

  const pages: PageSeoRow[] = (pageRows ?? []).map((p) => {
    const seo = (p.seo_overrides ?? {}) as {
      title?: string;
      description?: string;
    };
    return {
      id: p.id,
      name: p.title?.trim() || p.kind,
      kind: p.kind,
      slug: p.slug,
      hasTitle: Boolean(seo.title?.trim()),
      hasDescription: Boolean(seo.description?.trim()),
    };
  });

  return (
    <SeoForm
      websiteId={websiteId}
      fallbackTitle={data.brand.name ?? data.subdomain}
      previewHost={`${data.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site"}`}
      pages={pages}
      initial={{
        title: data.seo.title ?? "",
        description: data.seo.description ?? "",
        ogImagePath: data.seo.og_image_path ?? "",
        gscToken: data.seo.gsc_token ?? "",
        robotsIndex: data.seo.robots_index !== false,
        sitemapEnabled: data.seo.sitemap_enabled !== false,
      }}
    />
  );
}
