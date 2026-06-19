import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSiteRef, loadSiteContext } from "@/lib/site/loadSitePage";
import { websiteAssetUrl } from "@/lib/website/assets";

export const dynamic = "force-dynamic";

/**
 * RSS 2.0 feed for the site's published blog posts.
 * Accessible via /feed.xml on tenant hosts or /<locale>/site/feed.xml?site=<sub>.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteParam = url.searchParams.get("site");
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-vilo-site-host"),
    siteParam,
  });

  if (!ref) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const ctx = await loadSiteContext(ref, { preview: false });
  if (!ctx) {
    return new NextResponse("Site not found", { status: 404 });
  }

  // Load published posts
  const sb = createAdminClient();
  const { data: posts } = await sb
    .from("website_blog_posts")
    .select(
      "title, slug, excerpt, cover_path, publish_at, created_at, author_name, author:website_blog_authors ( name )",
    )
    .eq("website_id", ctx.websiteId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("publish_at", { ascending: false, nullsFirst: false })
    .limit(50);

  // Build the site URL (for absolute links)
  const hostHeader = h.get("x-vilo-site-host") ?? h.get("host") ?? ref;
  const protocol = hostHeader.includes("localhost") ? "http" : "https";
  const siteUrl = `${protocol}://${hostHeader}`;

  // Build RSS XML
  const items = (posts ?? [])
    .map((p) => {
      const row = p as {
        title: string;
        slug: string;
        excerpt: string | null;
        cover_path: string | null;
        publish_at: string | null;
        created_at: string;
        author_name: string | null;
        author: { name: string | null } | { name: string | null }[] | null;
      };
      const pubDate = row.publish_at ?? row.created_at;
      // author may come back as array from the join
      const authorObj = Array.isArray(row.author) ? row.author[0] : row.author;
      const authorName = authorObj?.name ?? row.author_name ?? "";
      const imageUrl = websiteAssetUrl(row.cover_path ?? undefined);

      // Escape XML special characters
      const escapeXml = (str: string) =>
        str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const enclosure = imageUrl
        ? `<enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />`
        : "";

      return `    <item>
      <title>${escapeXml(row.title)}</title>
      <link>${siteUrl}/blog/${row.slug}</link>
      <guid isPermaLink="true">${siteUrl}/blog/${row.slug}</guid>
      <pubDate>${new Date(pubDate).toUTCString()}</pubDate>
      ${authorName ? `<author>${escapeXml(authorName)}</author>` : ""}
      ${row.excerpt ? `<description>${escapeXml(row.excerpt)}</description>` : ""}
      ${enclosure}
    </item>`;
    })
    .join("\n");

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(ctx.brand.name)} Blog</title>
    <link>${siteUrl}/blog</link>
    <description>${escapeXml(ctx.brand.tagline ?? `Latest posts from ${ctx.brand.name}`)}</description>
    <language>${ctx.locale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
