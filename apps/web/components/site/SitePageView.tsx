import { notFound } from "next/navigation";

import { loadSiteContext, loadSitePage } from "@/lib/site/loadSitePage";
import { siteSurfaceIsDark } from "@/lib/site/themes";
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
 *
 * @param themeSlug - Optional theme slug to preview a different theme (for the
 *   theme gallery preview modal). When provided, the site renders with that
 *   theme's base instead of its own stored theme.
 */
export async function SitePageView({
  siteRef,
  pathSlug,
  preview = false,
  themeSlug,
}: {
  siteRef: string;
  pathSlug: string[];
  preview?: boolean;
  themeSlug?: string;
}) {
  const ctx = await loadSiteContext(siteRef, { preview, themeSlug });
  if (!ctx) notFound();

  const result = await loadSitePage(ctx, pathSlug);
  if (!result) notFound();

  // Build preview context for SiteChrome if in preview mode
  const previewContext = ctx.preview
    ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
    : undefined;

  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome
        brand={ctx.brand}
        nav={ctx.nav}
        navigation={ctx.navigation}
        darkChrome={siteSurfaceIsDark(ctx.theme)}
        analyticsWebsiteId={ctx.preview ? undefined : ctx.websiteId}
        header={ctx.theme.header}
        footer={ctx.theme.footer}
        preview={previewContext}
      >
        <SectionRenderer
          sections={result.sections}
          data={result.data}
          asset={siteAsset}
          websiteId={ctx.websiteId}
          interactive={!ctx.preview}
        />
      </SiteChrome>
    </SiteThemeRoot>
  );
}
