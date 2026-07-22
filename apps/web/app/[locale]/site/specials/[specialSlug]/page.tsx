import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SiteCurrencyProvider } from "@/components/site/SiteCurrencyProvider";
import { SiteSpecialView } from "@/components/site/SiteSpecialView";
import { resolveSiteRef } from "@/lib/site/loadSitePage";
import { siteMetadata } from "@/lib/site/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  params: Promise<{ specialSlug: string }>;
  searchParams: Promise<{ site?: string; preview?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const h = await headers();
  // Site-level metadata for now (offer-specific OG title/image is a follow-up —
  // needs specialSlug wired into loadSiteMeta).
  return siteMetadata({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
    preview: sp?.preview === "1",
  });
}

// Individual offer detail page (/specials/<slug>) — the special card links here so
// a guest can browse the offer before booking. Renders the theme's offer-detail
// design (bespoke for OceansView, generic otherwise) for the matched special.
export default async function SiteSpecialPage({
  params,
  searchParams,
}: {
  params: Promise<{ specialSlug: string }>;
  searchParams: Promise<{ site?: string; preview?: string; theme?: string }>;
}) {
  const { specialSlug } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  return (
    <SiteCurrencyProvider>
      <SiteSpecialView
        siteRef={ref}
        specialSlug={specialSlug}
        preview={sp?.preview === "1"}
        siteParam={sp?.site}
        themeSlug={sp?.theme}
      />
    </SiteCurrencyProvider>
  );
}
