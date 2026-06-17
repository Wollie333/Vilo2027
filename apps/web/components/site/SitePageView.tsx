import { notFound } from "next/navigation";

import { loadSiteContext, loadSitePage } from "@/lib/site/loadSitePage";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SectionRenderer } from "./SectionRenderer";
import { SiteChrome } from "./SiteChrome";
import { SiteThemeRoot } from "./SiteThemeRoot";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";

/**
 * Resolve a `website-assets` storage path to a public URL. Pass-through for
 * values that are already absolute URLs (e.g. preview sample data).
 */
export const siteAsset: SiteAssetResolver = (path) => {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return SUPA
    ? `${SUPA}/storage/v1/object/public/website-assets/${path}`
    : path;
};

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
