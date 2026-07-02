import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  buildSitePreviewPages,
  loadSiteContext,
  loadSitePage,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { pageKeyFor } from "@/lib/site/menuPage";
import { buildSiteJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import type { SiteAssetResolver } from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  pageStartsWithHero,
  sectionsStartWithHero,
} from "@/lib/website/pageDocOps";

import { FirePixelEvent } from "./FirePixelEvent";
import { JsonLd } from "./JsonLd";
import { PageHeadCode, PageBodyCode } from "./PageHeadCode";
import { SectionRenderer } from "./SectionRenderer";
import { PageDocRenderer } from "./v2/PageDocRenderer";
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

  // Per-page marketing overrides. Live site only: fire the host's chosen
  // Pixel/GA4 event for this page + inject its custom head code. A Builder V2
  // page keeps these in its PageDoc `meta` (set in the builder's Page Settings
  // overlay), so prefer `doc.meta`; legacy flat pages read the page-row
  // `seo_overrides`. Read straight through, so edits take effect without republish.
  const pageOv = (result.page.seoOverrides ?? {}) as {
    pixelEvent?: string;
    headCode?: string;
  };
  const docMeta = (result.doc?.meta ?? {}) as {
    events?: unknown;
    headCode?: string;
  };
  // Builder V2 pages carry a MULTI-event set in `meta.events` (Events tab); legacy
  // flat pages carry a single `seo_overrides.pixelEvent`. Fire each on load,
  // live site only. (Purchase stays auto-wired on the booking thank-you.)
  const docEvents = Array.isArray(docMeta.events)
    ? (docMeta.events as unknown[]).filter(
        (e): e is string => typeof e === "string" && !!e && e !== "none",
      )
    : [];
  const legacyEvent = (pageOv.pixelEvent || "").trim();
  const pageEvents = ctx.preview
    ? []
    : docEvents.length
      ? docEvents
      : legacyEvent && legacyEvent !== "none"
        ? [legacyEvent]
        : [];
  const pageHeadCode = !ctx.preview
    ? docMeta.headCode?.trim() || pageOv.headCode?.trim() || ""
    : "";
  const pageBodyCode = !ctx.preview
    ? ((docMeta as { bodyCode?: string }).bodyCode?.trim() ?? "")
    : "";
  // Everything below sets cookies / tracks, so it's POPIA consent-gated unless the
  // host turned the gate off (`cookieConsent.enabled === false`).
  const consentRequired = ctx.analytics?.cookieConsent?.enabled !== false;
  const pageMarketing = (
    <>
      {pageEvents.map((e, i) => (
        <FirePixelEvent
          key={`${e}-${i}`}
          event={e}
          consentRequired={consentRequired}
        />
      ))}
      {pageHeadCode ? (
        <PageHeadCode html={pageHeadCode} consentRequired={consentRequired} />
      ) : null}
      {pageBodyCode ? (
        <PageBodyCode html={pageBodyCode} consentRequired={consentRequired} />
      ) : null}
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

  // Builder V2 (v:2) pages render through the ONE token renderer inside the
  // generic chrome — bypassing the bespoke per-theme layers (deleted at cutover).
  // The theme's tokens still apply via SiteThemeRoot, so it stays on-brand.
  if (result.doc) {
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
            pageHasHero={pageStartsWithHero(result.doc)}
          >
            <PageDocRenderer
              doc={result.doc}
              data={result.data}
              asset={siteAsset}
              websiteId={ctx.websiteId}
              interactive
              brand={{
                name: ctx.brand.name,
                monogram: ctx.brand.monogram ?? undefined,
                socials: {
                  instagram: ctx.brand.socials?.instagram ?? undefined,
                  facebook: ctx.brand.socials?.facebook ?? undefined,
                },
              }}
              menu={(ctx.navigation?.menu ?? []).map((m) => m.label)}
            />
          </SiteChrome>
        </SiteThemeRoot>
      </>
    );
  }

  // Builder V2 cutover: EVERY page renders through the ONE token path — a stored
  // PageDoc via PageDocRenderer (above), else flat sections via the generic
  // SiteChrome + SectionRenderer below. The bespoke per-theme layers are gone; the
  // active theme still supplies colours/fonts via SiteThemeRoot tokens.
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
          pageHasHero={sectionsStartWithHero(result.sections)}
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
