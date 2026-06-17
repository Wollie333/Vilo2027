import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SitePageView } from "@/components/site/SitePageView";
import { resolveSiteRef } from "@/lib/site/loadSitePage";

export const dynamic = "force-dynamic";

// Any non-home tenant page by path (e.g. /<locale>/site/about). The more
// specific blog/[postSlug] route handles the blog.
export default async function SiteSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ site?: string; preview?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-vilo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();
  return (
    <SitePageView
      siteRef={ref}
      pathSlug={slug ?? []}
      preview={sp?.preview === "1"}
    />
  );
}
