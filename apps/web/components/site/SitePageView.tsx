import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  buildSitePreviewPages,
  loadSiteContext,
  loadSitePage,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { pageKeyFor } from "@/lib/site/menuPage";
import { buildSafariNav } from "@/lib/site/safariNav";
import { buildSiteJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import type { SiteAssetResolver } from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";

import { FirePixelEvent } from "./FirePixelEvent";
import { JsonLd } from "./JsonLd";
import { PageHeadCode } from "./PageHeadCode";
import { SafariSiteView } from "./safari/SafariSiteView";
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
  siteParam,
  embed = false,
}: {
  siteRef: string;
  pathSlug: string[];
  preview?: boolean;
  themeSlug?: string;
  /** Set when the site is reached via the app-domain ?site= affordance — makes
   *  on-site booking links carry the /[locale]/site prefix so they resolve. */
  siteParam?: string | null;
  /** Embedded in a manager-card iframe → hide the preview banner. */
  embed?: boolean;
}) {
  const ctx = await loadSiteContext(siteRef, { preview, themeSlug, siteParam });
  if (!ctx) notFound();

  const result = await loadSitePage(ctx, pathSlug);
  if (!result) notFound();

  // Current page key for per-page menu rules (show/hide links per page).
  const currentPageKey = pageKeyFor(result.page.kind, result.page.slug);

  // Build preview context for SiteChrome if in preview mode
  const previewContext = ctx.preview
    ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
    : undefined;

  // Structured data (schema.org) — public render only; never advertise preview.
  let jsonLdGraph: Record<string, unknown>[] = [];
  if (!ctx.preview) {
    const h = await headers();
    const host = h.get("x-wielo-site-host") || h.get("host") || "";
    if (host) {
      const scheme =
        host.startsWith("localhost") || host.startsWith("127.")
          ? "http"
          : "https";
      jsonLdGraph = buildSiteJsonLd({
        ctx,
        result,
        pathSlug,
        origin: `${scheme}://${host}`,
      });
    }
  }

  // Default the header "Book now" CTA to the on-site checkout whenever the site
  // has a bookable property (a host-set navigation CTA still wins). Omitted when
  // there's nothing to book, so the button never links to a 404.
  const headerBookHref =
    ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined;

  // Per-page marketing overrides (Page settings → seo_overrides). Live site only:
  // fire the host's chosen Pixel/GA4 event for this page + inject its custom head
  // code. Read straight from the page row, so they take effect without republish.
  const pageOv = (result.page.seoOverrides ?? {}) as {
    pixelEvent?: string;
    headCode?: string;
  };
  const pagePixelEvent =
    !ctx.preview && pageOv.pixelEvent && pageOv.pixelEvent !== "none"
      ? pageOv.pixelEvent
      : null;
  const pageHeadCode = !ctx.preview ? pageOv.headCode?.trim() || "" : "";
  const pageMarketing = (
    <>
      {pagePixelEvent ? <FirePixelEvent event={pagePixelEvent} /> : null}
      {pageHeadCode ? <PageHeadCode html={pageHeadCode} /> : null}
    </>
  );

  // Safari is a fully bespoke design (the NenGama Lodge look) — it renders
  // through its own self-contained, scoped layer rather than the shared chrome +
  // section components, so it matches the design exactly. Driven by the same
  // page sections (by type) so content stays host-editable.
  // Safari is a fully bespoke design (the NenGama Lodge look) — every page kind it
  // ships renders through its own self-contained, scoped layer so it matches the
  // design exactly. Unmapped kinds fall through to the standard themed pipeline.
  // The shared theme-preview bar's page navigator (every theme, every page).
  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  // Safari is fully bespoke — EVERY page renders through its layer (no page ever
  // falls back to the standard chrome / old styles).
  const activeThemeSlug = ctx.previewThemeSlug ?? ctx.theme.preset;
  if (activeThemeSlug === "safari") {
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        {pageMarketing}
        {/* Wrap in SiteThemeRoot so the host's --site-accent reaches the Safari
            layer (its --accent derives from it); Safari keeps its own bg/ink. */}
        <SiteThemeRoot theme={ctx.theme}>
          <SafariSiteView
            kind={result.page.kind}
            pageTitle={result.page.title ?? undefined}
            sections={result.sections}
            data={result.data}
            asset={siteAsset}
            brandName={ctx.brand.name}
            contactEmail={ctx.brand.contactEmail}
            contactPhone={ctx.brand.contactPhone}
            nav={buildSafariNav(ctx, currentPageKey)}
            bookHref={headerBookHref}
            previewPages={previewPages}
            analytics={ctx.analytics}
            interactive={!ctx.preview}
            websiteId={ctx.websiteId}
          />
        </SiteThemeRoot>
      </>
    );
  }

  return (
    <>
      <JsonLd graph={jsonLdGraph} />
      {pageMarketing}
      <SiteThemeRoot theme={ctx.theme}>
        <SiteChrome
          brand={ctx.brand}
          nav={ctx.nav}
          navigation={ctx.navigation}
          currentPageKey={currentPageKey}
          conversion={ctx.conversion}
          analytics={ctx.analytics}
          layout={ctx.layout}
          popupForm={ctx.popupForm}
          websiteId={ctx.websiteId}
          bookHref={headerBookHref}
          darkChrome={siteSurfaceIsDark(ctx.theme)}
          analyticsWebsiteId={ctx.preview ? undefined : ctx.websiteId}
          header={ctx.theme.header}
          footer={ctx.theme.footer}
          preview={previewContext}
          hideBanner={embed}
          previewPages={previewPages}
        >
          <SectionRenderer
            sections={result.sections}
            data={result.data}
            asset={siteAsset}
            websiteId={ctx.websiteId}
            // Live on the public render (live + preview) so forms work in preview;
            // analytics stays preview-gated in SiteChrome's SiteMarketing.
            interactive
          />
        </SiteChrome>
      </SiteThemeRoot>
    </>
  );
}
