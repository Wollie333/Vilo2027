import { notFound } from "next/navigation";

import { loadSiteContext, loadSitePage } from "@/lib/site/loadSitePage";
import type { SiteAssetResolver } from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";

import { SectionRenderer } from "./SectionRenderer";
import { SiteChrome } from "./SiteChrome";
import { SiteThemeRoot } from "./SiteThemeRoot";

/**
 * Resolve a `website-assets` storage path to a public URL for the section
 * renderer (shared SSOT in `lib/website/assets`; returns `undefined` for empty).
 */
export const siteAsset: SiteAssetResolver = (path) =>
  websiteAssetUrl(path) ?? undefined;

/**
 * Loads a site + one of its pages and renders the themed frame + sections. The
 * SAME component path the public site and (later) the live preview share. `404`s
 * when the site or page can't be resolved.
 */
export async function SitePageView({
  siteRef,
  pathSlug,
  preview = false,
}: {
  siteRef: string;
  pathSlug: string[];
  preview?: boolean;
}) {
  const ctx = await loadSiteContext(siteRef, { preview });
  if (!ctx) notFound();

  const result = await loadSitePage(ctx, pathSlug);
  if (!result) notFound();

  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome brand={ctx.brand} nav={ctx.nav}>
        <SectionRenderer
          sections={result.sections}
          data={result.data}
          asset={siteAsset}
        />
      </SiteChrome>
    </SiteThemeRoot>
  );
}
