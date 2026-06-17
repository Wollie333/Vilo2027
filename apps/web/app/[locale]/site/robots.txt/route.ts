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
  const body = ctx
    ? `User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
