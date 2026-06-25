import { createAdminClient } from "@/lib/supabase/admin";
import {
  listRoomSlugs,
  loadSiteContext,
  resolveSiteRef,
} from "@/lib/site/loadSitePage";

export const dynamic = "force-dynamic";

// Per-site sitemap. Served at <site-host>/sitemap.xml (the middleware rewrites
// there in W5); testable via /<locale>/site/sitemap.xml?site=<sub>.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = resolveSiteRef({
    host: request.headers.get("x-vilo-site-host"),
    siteParam: url.searchParams.get("site"),
  });
  if (!ref) return new Response("Not found", { status: 404 });

  const ctx = await loadSiteContext(ref, { preview: false });
  if (!ctx) return new Response("Not found", { status: 404 });

  // Honour the host's "generate a sitemap" toggle (default on).
  const seo = ctx.seo as { sitemap_enabled?: boolean };
  if (seo.sitemap_enabled === false) {
    return new Response("Not found", { status: 404 });
  }

  const sb = createAdminClient();
  const [{ data: pages }, { data: posts }, roomSlugs] = await Promise.all([
    sb
      .from("website_pages")
      .select("kind, slug, updated_at")
      .eq("website_id", ctx.websiteId),
    sb
      .from("website_blog_posts")
      .select("slug, publish_at, created_at, updated_at")
      .eq("website_id", ctx.websiteId)
      .eq("status", "published")
      .is("deleted_at", null),
    listRoomSlugs(ctx),
  ]);

  const origin = url.origin;
  const loc = (path: string) =>
    `${origin}${path}`.replace(/\/+$/, "") || origin;

  const day = (v: string | null | undefined) => v?.slice(0, 10);
  const pageRows = pages ?? [];
  const homeRow = pageRows.find((p) => p.kind === "home");

  const entries: { path: string; lastmod?: string }[] = [
    { path: "/", lastmod: day(homeRow?.updated_at as string | null) },
    ...pageRows
      // room_detail is a template rendered only via /rooms/<slug>, not browsable.
      .filter((p) => p.kind !== "home" && p.kind !== "room_detail")
      .map((p) => ({
        path: `/${p.slug}`,
        lastmod: day(p.updated_at as string | null),
      })),
    ...roomSlugs.map((slug) => ({ path: `/rooms/${slug}` })),
    ...(posts ?? []).map((p) => ({
      path: `/blog/${p.slug}`,
      lastmod: day(
        (p.updated_at ?? p.publish_at ?? p.created_at) as string | null,
      ),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${loc(e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
