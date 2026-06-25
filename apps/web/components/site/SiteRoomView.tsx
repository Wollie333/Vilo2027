import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  buildSitePreviewPages,
  loadSiteContext,
  loadSiteRoomPage,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { buildRoomJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";

import { JsonLd } from "./JsonLd";
import { SafariShell } from "./safari/SafariShell";
import { SafariRoomContent } from "./safari/pages/SafariRoomContent";
import { SectionRenderer } from "./SectionRenderer";
import { SiteChrome } from "./SiteChrome";
import { siteAsset } from "./SitePageView";
import { SiteThemeRoot } from "./SiteThemeRoot";

/**
 * Renders one ROOM as a full page: the themed frame + the host's room-detail
 * template (or the theme default), with the viewed room injected into the
 * room-scoped sections. A breadcrumb (Home › Rooms › <room>) sits above the
 * sections for navigation + SEO. 404s when the slug matches no visible room.
 */
export async function SiteRoomView({
  siteRef,
  roomSlug,
  preview = false,
  siteParam,
  themeSlug,
}: {
  siteRef: string;
  roomSlug: string;
  preview?: boolean;
  siteParam?: string | null;
  themeSlug?: string;
}) {
  const ctx = await loadSiteContext(siteRef, { preview, siteParam, themeSlug });
  if (!ctx) notFound();

  const result = await loadSiteRoomPage(ctx, roomSlug);
  if (!result) notFound();
  const { room, sections, data, roomsHref } = result;

  let jsonLdGraph: Record<string, unknown>[] = [];
  if (!ctx.preview) {
    const h = await headers();
    const host = h.get("x-vilo-site-host") || h.get("host") || "";
    if (host) {
      const scheme =
        host.startsWith("localhost") || host.startsWith("127.")
          ? "http"
          : "https";
      jsonLdGraph = buildRoomJsonLd({
        ctx,
        room,
        roomSlug,
        roomsHref,
        origin: `${scheme}://${host}`,
      });
    }
  }

  const headerBookHref =
    ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined;

  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "safari") {
    const previewPages = ctx.preview
      ? await buildSitePreviewPages(ctx)
      : undefined;
    return (
      <SafariShell
        brandName={ctx.brand.name}
        navLinks={ctx.nav}
        bookHref={headerBookHref}
        previewPages={previewPages}
      >
        <SafariRoomContent />
      </SafariShell>
    );
  }

  return (
    <>
      <JsonLd graph={jsonLdGraph} />
      <SiteThemeRoot theme={ctx.theme}>
        <SiteChrome
          brand={ctx.brand}
          nav={ctx.nav}
          navigation={ctx.navigation}
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
        >
          <nav
            aria-label="Breadcrumb"
            style={{ color: "var(--site-mute)" }}
            className="mx-auto w-full max-w-5xl px-5 pt-8 text-sm"
          >
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <a href="/" className="hover:opacity-80">
                  Home
                </a>
              </li>
              <li aria-hidden>›</li>
              <li>
                {roomsHref ? (
                  <a href={roomsHref} className="hover:opacity-80">
                    Rooms
                  </a>
                ) : (
                  <span>Rooms</span>
                )}
              </li>
              <li aria-hidden>›</li>
              <li style={{ color: "var(--site-ink)" }} className="font-medium">
                {room.name}
              </li>
            </ol>
          </nav>
          <SectionRenderer
            sections={sections}
            data={data}
            asset={siteAsset}
            websiteId={ctx.websiteId}
            interactive={!ctx.preview}
          />
        </SiteChrome>
      </SiteThemeRoot>
    </>
  );
}
