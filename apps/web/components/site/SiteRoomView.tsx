import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { commerceParams } from "@/lib/analytics/pixel";
import {
  buildSitePreviewPages,
  loadSiteContext,
  loadSiteRoomPage,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { buildRoomJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";

import { FirePixelEvent } from "./FirePixelEvent";
import { JsonLd } from "./JsonLd";
import { RoomBookingDock } from "./RoomBookingDock";
import { RoomDockLayout } from "./RoomDockLayout";
import { SectionRenderer } from "./SectionRenderer";
import { SiteChrome } from "./SiteChrome";
import { siteAsset } from "./SitePageView";
import { SiteThemeRoot } from "./SiteThemeRoot";
import { PageDocRenderer } from "./v2/PageDocRenderer";

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
  // The sticky `RoomBookingDock` (right rail) IS the booking widget for this layout,
  // so the flat template's `room_rate` block (a full-width RoomBookingForm) would be
  // a SECOND, duplicate booking form in the content column — drop it here. room_rate
  // stays in the template (keeps the required-widget contract if the page is later
  // authored as a PageDoc); it's just not rendered inline beside the dock.
  const gallerySections = sections.filter((s) => s.type === "room_gallery");
  const contentSections = sections.filter(
    (s) => s.type !== "room_gallery" && s.type !== "room_rate",
  );

  let jsonLdGraph: Record<string, unknown>[] = [];
  if (!ctx.preview) {
    const h = await headers();
    const host = h.get("x-wielo-site-host") || h.get("host") || "";
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

  // Meta ViewContent — WEBSITE feature (host micro-site) → fires the HOST's own
  // pixel (the Wielo platform pixel is suppressed on tenant renders). Gated on
  // the host's own consent setting + skipped in preview.
  const viewContentPropertyId = ctx.propertyIds.find((id): id is string =>
    Boolean(id),
  );
  const viewContent =
    !ctx.preview && viewContentPropertyId ? (
      <FirePixelEvent
        event="ViewContent"
        consentRequired={ctx.analytics?.cookieConsent?.enabled !== false}
        params={commerceParams({
          contentIds: [viewContentPropertyId],
          contentName: room.name ?? undefined,
          currency: room.currency ?? "ZAR",
          ...(room.price != null && Number(room.price) > 0
            ? { value: Number(room.price) }
            : {}),
        })}
      />
    ) : null;

  // Builder V2: a PageDoc room-detail template renders through the ONE token
  // renderer inside the generic chrome (the intended cutover behaviour — bypasses
  // the bespoke per-theme room layers below). The active room is already injected
  // into the doc's room-scoped leaves by loadSiteRoomPage.
  if (result.doc) {
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        {viewContent}
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
            // Room-detail opens with the breadcrumb (light text), never a
            // full-bleed hero — so the header must stay SOLID, not transparent-
            // over-hero (which would render invisible white links and overlap
            // the breadcrumb). Matches the bespoke room path below.
            pageHasHero={false}
          >
            <nav
              aria-label="Breadcrumb"
              style={{
                color: "var(--site-mute)",
                // Match the section band EXACTLY (1180 inner + 24px gutter) so the
                // breadcrumb text starts at the same x as the content/photo below.
                maxWidth: 1180 + 48,
                paddingInline: 24,
              }}
              className="mx-auto w-full pt-8 text-sm"
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
                <li
                  style={{ color: "var(--site-ink)" }}
                  className="font-medium"
                >
                  {room.name}
                </li>
              </ol>
            </nav>
            <PageDocRenderer
              doc={result.doc}
              data={data}
              asset={siteAsset}
              websiteId={ctx.websiteId}
              interactive={!ctx.preview}
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

  return (
    <>
      <JsonLd graph={jsonLdGraph} />
      {viewContent}
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
          pageHasHero={false}
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
                maxGuests={room.maxGuests}
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
