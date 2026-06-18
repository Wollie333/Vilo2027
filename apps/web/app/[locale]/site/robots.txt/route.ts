import { loadSiteContext, resolveSiteRef } from "@/lib/site/loadSitePage";

export const dynamic = "force-dynamic";

// Per-site robots. Disallows everything until the site resolves + is published,
// then allows all and points at the per-site sitemap.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = resolveSiteRef({
    host: request.headers.get("x-vilo-site-host"),
    siteParam: url.searchParams.get("site"),
  });

  const ctx = ref ? await loadSiteContext(ref, { preview: false }) : null;
  const seo = (ctx?.seo ?? {}) as {
    robots_index?: boolean;
    sitemap_enabled?: boolean;
  };
  // Indexable unless the site is unresolved or the host opted out of indexing.
  const indexable = Boolean(ctx) && seo.robots_index !== false;
  const sitemapLine =
    indexable && seo.sitemap_enabled !== false
      ? `Sitemap: ${url.origin}/sitemap.xml\n`
      : "";
  const body = indexable
    ? `User-agent: *\nAllow: /\n${sitemapLine}`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
