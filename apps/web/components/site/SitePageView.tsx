import { headers } from "next/headers";
import { notFound } from "next/navigation";

// Per-theme skins. Every rule is scoped to `.wielo-<slug>` (set by SiteThemeRoot),
// so importing it globally here only ever styles a host site under an active
// theme — never the Wielo app chrome.
import "./themes/theme-skins.css";

import {
  assembleSiteDataByType,
  buildSitePreviewPages,
  findRoomsIndexHref,
  loadSiteContext,
  loadSitePage,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { pageKeyFor } from "@/lib/site/menuPage";
import { buildSiteJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import type { SiteAssetResolver } from "@/lib/site/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";
import { parseContentProfileLoose } from "@/lib/website/contentProfile.schema";
import {
  pageStartsWithHero,
  sectionsStartWithHero,
} from "@/lib/website/pageDocOps";

import { FirePixelEvent } from "./FirePixelEvent";
import { JsonLd } from "./JsonLd";
import { OceansViewAbout } from "./oceansview/OceansViewAbout";
import { OceansViewHome } from "./oceansview/OceansViewHome";
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

  // Every theme (Safari included) renders through the ONE shared chrome + section
  // components; its look comes entirely from its `--site-*` tokens (SiteThemeRoot)
  // plus its scoped `.wielo-<slug>` rules in theme-skins.css. There are no bespoke
  // per-theme renderers — that layer was removed at the Builder-V2 cutover.
  // The shared theme-preview bar's page navigator (every theme, every page).
  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  // Oceans View — the founder's bespoke HOME design. Rendered by a dedicated
  // component wired to the host's content_profile (hero copy, story, experiences)
  // + live listing data (rooms, reviews, gallery, booking funnel), inside the
  // themed chrome. Content stays put on theme change: the profile is the SSOT, so
  // switching to/from Oceans View re-skins without touching the host's copy.
  if (ctx.theme.preset === "oceansview" && result.page.kind === "home") {
    const sbx = createAdminClient();
    const [{ data: cpRow }, extras, roomsHrefRaw] = await Promise.all([
      sbx
        .from("host_websites")
        .select("content_profile")
        .eq("id", ctx.websiteId)
        .maybeSingle<{ content_profile: unknown }>(),
      assembleSiteDataByType(
        sbx,
        ctx,
        new Set([
          "rooms_preview",
          "reviews",
          "gallery",
          "booking_search",
        ] as const),
      ),
      findRoomsIndexHref(ctx),
    ]);
    const cp = parseContentProfileLoose(cpRow?.content_profile);
    const roomsHref = roomsHrefRaw ?? "/rooms";
    const experiences = (cp.experiences?.items ?? []).map((e) => ({
      title: e.title,
      body: e.body ?? null,
      imageUrl: e.imagePath ? (websiteAssetUrl(e.imagePath) ?? null) : null,
    }));
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
            // The bespoke home opens with a full-bleed hero, so the header can
            // ride transparent-over-hero like the other themes' home pages.
            pageHasHero
          >
            <OceansViewHome
              brandName={ctx.brand.name}
              roomsHref={roomsHref}
              bookHref={headerBookHref ?? roomsHref}
              interactive={!ctx.preview}
              heroHeadline={cp.home?.hero?.headline ?? null}
              heroSubheadline={
                cp.home?.hero?.subheadline ?? cp.brand?.tagline ?? null
              }
              heroImageUrl={
                cp.home?.hero?.imagePath
                  ? (websiteAssetUrl(cp.home.hero.imagePath) ?? null)
                  : null
              }
              story={cp.about?.story ?? cp.home?.intro?.body ?? null}
              experiences={experiences}
              rooms={extras.rooms_preview?.rooms}
              reviews={extras.reviews}
              gallery={extras.gallery?.images}
              bookingData={extras.booking_search}
            />
          </SiteChrome>
        </SiteThemeRoot>
      </>
    );
  }

  // Oceans View — the founder's bespoke ABOUT design. Story + host bio come from
  // content_profile; stats/imagery from live listing data; demo copy is fallback
  // only. Sections needing data we don't collect (multi-year timeline, full team)
  // are omitted, not fabricated. Same content-persistence contract as home.
  if (ctx.theme.preset === "oceansview" && result.page.kind === "about") {
    const sbx = createAdminClient();
    const [{ data: cpRow }, extras, roomsHrefRaw] = await Promise.all([
      sbx
        .from("host_websites")
        .select("content_profile")
        .eq("id", ctx.websiteId)
        .maybeSingle<{ content_profile: unknown }>(),
      assembleSiteDataByType(
        sbx,
        ctx,
        new Set(["rooms_preview", "reviews", "gallery"] as const),
      ),
      findRoomsIndexHref(ctx),
    ]);
    const cp = parseContentProfileLoose(cpRow?.content_profile);
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
            // Opens with a full-bleed page-head image → header can ride
            // transparent-over-hero like the home page.
            pageHasHero
          >
            <OceansViewAbout
              brandName={ctx.brand.name}
              roomsHref={roomsHrefRaw ?? "/rooms"}
              contactHref="/contact"
              heroImageUrl={
                cp.home?.hero?.imagePath
                  ? (websiteAssetUrl(cp.home.hero.imagePath) ?? null)
                  : null
              }
              tagline={cp.brand?.tagline ?? null}
              story={cp.about?.story ?? cp.home?.intro?.body ?? null}
              hostBioBody={cp.about?.hostBio?.body ?? null}
              hostPhotoUrl={
                cp.about?.hostBio?.photoPath
                  ? (websiteAssetUrl(cp.about.hostBio.photoPath) ?? null)
                  : null
              }
              rooms={extras.rooms_preview?.rooms}
              reviews={extras.reviews}
              gallery={extras.gallery?.images}
            />
          </SiteChrome>
        </SiteThemeRoot>
      </>
    );
  }

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
