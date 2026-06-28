import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  buildSitePreviewPages,
  loadSiteContext,
  loadSiteRoomPage,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { buildSafariNav } from "@/lib/site/safariNav";
import { buildRoomJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";

import { JsonLd } from "./JsonLd";
import { RoomBookingDock } from "./RoomBookingDock";
import { RoomDockLayout } from "./RoomDockLayout";
import { SafariShell } from "./safari/SafariShell";
import { SafariSectionList, type SafariCtx } from "./sections/SafariSections";
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

  // Listing-style layout: the room gallery runs full-width up top, the rest of the
  // sections sit in the content column beside the sticky booking dock.
  const gallerySections = sections.filter((s) => s.type === "room_gallery");
  const contentSections = sections.filter((s) => s.type !== "room_gallery");

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

  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "safari") {
    const safariCtx: SafariCtx = {
      brandName: ctx.brand.name,
      contactEmail: ctx.brand.contactEmail,
      contactPhone: ctx.brand.contactPhone,
      homeHref:
        ctx.nav.find((l) => /^home$/i.test(l.label))?.href || ctx.nav[0]?.href,
      roomsHref: roomsHref || undefined,
      contactHref: ctx.nav.find((l) => /contact/i.test(l.label))?.href,
      reserveHref: headerBookHref || room.bookHref,
    };
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        <SafariShell
          brandName={ctx.brand.name}
          nav={buildSafariNav(ctx)}
          bookHref={headerBookHref}
          solidNav
          previewPages={previewPages}
          analytics={ctx.analytics}
          interactive={!ctx.preview}
        >
          <RoomDockLayout
            gallery={
              <SafariSectionList
                sections={gallerySections}
                data={data}
                asset={siteAsset}
                ctx={safariCtx}
              />
            }
            dock={
              <RoomBookingDock
                roomName={room.name}
                price={room.price}
                currency={room.currency}
                bookHref={room.bookHref}
                interactive
              />
            }
          >
            <SafariSectionList
              sections={contentSections}
              data={data}
              asset={siteAsset}
              ctx={safariCtx}
              interactive
            />
          </RoomDockLayout>
        </SafariShell>
      </>
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
          preview={
            ctx.preview
              ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
              : undefined
          }
          previewPages={previewPages}
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
          <RoomDockLayout
            gallery={
              <SectionRenderer
                sections={gallerySections}
                data={data}
                asset={siteAsset}
                websiteId={ctx.websiteId}
                interactive={!ctx.preview}
              />
            }
            dock={
              <RoomBookingDock
                roomName={room.name}
                price={room.price}
                currency={room.currency}
                bookHref={room.bookHref}
                interactive
              />
            }
          >
            <SectionRenderer
              sections={contentSections}
              data={data}
              asset={siteAsset}
              websiteId={ctx.websiteId}
              interactive
            />
          </RoomDockLayout>
        </SiteChrome>
      </SiteThemeRoot>
    </>
  );
}
