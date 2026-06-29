import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SitePageView } from "@/components/site/SitePageView";
import { resolveSiteRef } from "@/lib/site/loadSitePage";
import { siteMetadata } from "@/lib/site/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; preview?: string; theme?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const h = await headers();
  return siteMetadata({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
    pathSlug: [],
    preview: sp?.preview === "1",
  });
}

// Tenant site home. The W5 middleware rewrites a tenant request to
// /<locale>/site (locale = the business default_language) and sets the
// x-wielo-site-host header. Testable now via /<locale>/site?site=<subdomain>.
//
// Mounted under [locale] (not a standalone (site) group) because the app's
// only root layout lives at [locale]/layout.tsx; a second route-group root
// layout can't coexist with a non-grouped [locale] root in Next 14. Tenant
// sites stay visually isolated via <SiteThemeRoot>'s scoped --site-* vars.
export default async function SiteHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string;
    preview?: string;
    theme?: string;
    embed?: string;
  }>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();
  return (
    <SitePageView
      siteRef={ref}
      pathSlug={[]}
      preview={sp?.preview === "1"}
      themeSlug={sp?.theme}
      siteParam={sp?.site}
      embed={sp?.embed === "1"}
    />
  );
}
