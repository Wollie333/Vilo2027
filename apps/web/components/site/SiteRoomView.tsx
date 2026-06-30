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
import { SafariBookingDock } from "./safari/SafariBookingDock";
import { SafariSectionList, type SafariCtx } from "./sections/SafariSections";
import { SabelaShell } from "./sabela/SabelaShell";
import { SabelaSectionList, type SabelaCtx } from "./sabela/SabelaSections";
import { SabelaBookingDock } from "./sabela/SabelaBookingDock";
import { OceansViewShell } from "./oceansview/OceansViewShell";
import {
  OceansViewSectionList,
  type OceansViewCtx,
} from "./oceansview/OceansViewSections";
import { OceansViewBookingDock } from "./oceansview/OceansViewBookingDock";
import { MarmaladeShell } from "./marmalade/MarmaladeShell";
import {
  MarmaladeSectionList,
  type MarmaladeCtx,
} from "./marmalade/MarmaladeSections";
import { MarmaladeBookingDock } from "./marmalade/MarmaladeBookingDock";
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
    // Room-detail composition matching the design: the .suite-hero gallery
    // full-width, then a 2-column .room-layout (room content left, sticky .bk-card
    // booking dock right), reviews/CTA below. room_rate is the dock (dropped here).
    const safBody = contentSections.filter((s) =>
      ["room_overview", "room_amenities", "room_policies"].includes(s.type),
    );
    const safBelow = contentSections.filter(
      (s) =>
        ![
          "room_overview",
          "room_amenities",
          "room_policies",
          "room_rate",
        ].includes(s.type),
    );
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        <SiteThemeRoot theme={ctx.theme}>
          <SafariShell
            brandName={ctx.brand.name}
            nav={buildSafariNav(ctx)}
            bookHref={headerBookHref}
            solidNav
            previewPages={previewPages}
            analytics={ctx.analytics}
            interactive={!ctx.preview}
          >
            <SafariSectionList
              sections={gallerySections}
              data={data}
              asset={siteAsset}
              ctx={safariCtx}
            />
            <section
              className="section"
              style={{ paddingTop: "clamp(28px,4vw,44px)" }}
            >
              <div className="wrap">
                <div className="room-layout">
                  <div>
                    <SafariSectionList
                      sections={safBody}
                      data={data}
                      asset={siteAsset}
                      ctx={safariCtx}
                      interactive
                    />
                  </div>
                  <SafariBookingDock
                    price={room.price}
                    currency={room.currency}
                    bookHref={room.bookHref}
                    maxGuests={room.maxGuests}
                    interactive
                  />
                </div>
              </div>
            </section>
            <SafariSectionList
              sections={safBelow}
              data={data}
              asset={siteAsset}
              ctx={safariCtx}
              interactive
            />
          </SafariShell>
        </SiteThemeRoot>
      </>
    );
  }

  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "sabela") {
    const sabelaCtx: SabelaCtx = {
      brandName: ctx.brand.name,
      contactEmail: ctx.brand.contactEmail,
      contactPhone: ctx.brand.contactPhone,
      homeHref:
        ctx.nav.find((l) => /^home$/i.test(l.label))?.href || ctx.nav[0]?.href,
      roomsHref: roomsHref || undefined,
      contactHref: ctx.nav.find((l) => /contact/i.test(l.label))?.href,
      reserveHref: headerBookHref || room.bookHref,
    };
    // Room-detail composition matching the design (Suite.html): the .rd-gallery
    // full-width, then a 2-column .rd-grid — the room content on the left, the
    // sticky .book-widget dock on the right. room_rate is the dock (dropped here).
    const sabBody = contentSections.filter((s) =>
      ["room_overview", "room_amenities", "room_policies"].includes(s.type),
    );
    const sabBelow = contentSections.filter(
      (s) =>
        ![
          "room_overview",
          "room_amenities",
          "room_policies",
          "room_rate",
        ].includes(s.type),
    );
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        <SiteThemeRoot theme={ctx.theme}>
          <SabelaShell
            brandName={ctx.brand.name}
            nav={buildSafariNav(ctx)}
            bookHref={headerBookHref}
            solidNav
            previewPages={previewPages}
            analytics={ctx.analytics}
            interactive={!ctx.preview}
          >
            <SabelaSectionList
              sections={gallerySections}
              data={data}
              asset={siteAsset}
              ctx={sabelaCtx}
            />
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="wrap">
                <div className="rd-grid">
                  <div>
                    <SabelaSectionList
                      sections={sabBody}
                      data={data}
                      asset={siteAsset}
                      ctx={sabelaCtx}
                      interactive
                    />
                  </div>
                  <SabelaBookingDock
                    price={room.price}
                    currency={room.currency}
                    bookHref={room.bookHref}
                    maxGuests={room.maxGuests}
                    interactive
                  />
                </div>
              </div>
            </section>
            <SabelaSectionList
              sections={sabBelow}
              data={data}
              asset={siteAsset}
              ctx={sabelaCtx}
              interactive
            />
          </SabelaShell>
        </SiteThemeRoot>
      </>
    );
  }

  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "oceansview") {
    const ovCtx: OceansViewCtx = {
      brandName: ctx.brand.name,
      contactEmail: ctx.brand.contactEmail,
      contactPhone: ctx.brand.contactPhone,
      homeHref:
        ctx.nav.find((l) => /^home$/i.test(l.label))?.href || ctx.nav[0]?.href,
      roomsHref: roomsHref || undefined,
      contactHref: ctx.nav.find((l) => /contact/i.test(l.label))?.href,
      reserveHref: headerBookHref || room.bookHref,
    };
    // Room-detail composition matching the design (Room.html): the .rgal gallery
    // full-width, then a 2-column .rlayout — the room content (overview/amenities/
    // policies) on the left, the sticky .bkcard booking dock on the right — then
    // any reviews/CTA full-width below. room_rate is the dock, so it's dropped
    // from the body.
    const ovBody = contentSections.filter((s) =>
      ["room_overview", "room_amenities", "room_policies"].includes(s.type),
    );
    const ovBelow = contentSections.filter(
      (s) =>
        ![
          "room_overview",
          "room_amenities",
          "room_policies",
          "room_rate",
        ].includes(s.type),
    );
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        <SiteThemeRoot theme={ctx.theme}>
          <OceansViewShell
            brandName={ctx.brand.name}
            nav={buildSafariNav(ctx)}
            bookHref={headerBookHref}
            solidNav
            previewPages={previewPages}
            analytics={ctx.analytics}
            interactive={!ctx.preview}
          >
            <OceansViewSectionList
              sections={gallerySections}
              data={data}
              asset={siteAsset}
              ctx={ovCtx}
            />
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="wrap">
                <div className="rlayout">
                  <div>
                    <OceansViewSectionList
                      sections={ovBody}
                      data={data}
                      asset={siteAsset}
                      ctx={ovCtx}
                      interactive
                    />
                  </div>
                  <OceansViewBookingDock
                    price={room.price}
                    currency={room.currency}
                    bookHref={room.bookHref}
                    maxGuests={room.maxGuests}
                    interactive
                  />
                </div>
              </div>
            </section>
            <OceansViewSectionList
              sections={ovBelow}
              data={data}
              asset={siteAsset}
              ctx={ovCtx}
              interactive
            />
          </OceansViewShell>
        </SiteThemeRoot>
      </>
    );
  }
  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "marmalade") {
    const mmCtx: MarmaladeCtx = {
      brandName: ctx.brand.name,
      contactEmail: ctx.brand.contactEmail,
      contactPhone: ctx.brand.contactPhone,
      homeHref:
        ctx.nav.find((l) => /^home$/i.test(l.label))?.href || ctx.nav[0]?.href,
      roomsHref: roomsHref || undefined,
      contactHref: ctx.nav.find((l) => /contact/i.test(l.label))?.href,
      reserveHref: headerBookHref || room.bookHref,
    };
    // Room-detail composition matching the design (Room.html): the .rgal gallery
    // full-width, then a 2-column .rlayout — room content on the left, the sticky
    // .bkcard dock on the right — then reviews/CTA full-width. room_rate is the
    // dock, so it's dropped from the body.
    const mmBody = contentSections.filter((s) =>
      ["room_overview", "room_amenities", "room_policies"].includes(s.type),
    );
    const mmBelow = contentSections.filter(
      (s) =>
        ![
          "room_overview",
          "room_amenities",
          "room_policies",
          "room_rate",
        ].includes(s.type),
    );
    return (
      <>
        <JsonLd graph={jsonLdGraph} />
        <SiteThemeRoot theme={ctx.theme}>
          <MarmaladeShell
            brandName={ctx.brand.name}
            nav={buildSafariNav(ctx)}
            bookHref={headerBookHref}
            solidNav
            previewPages={previewPages}
            analytics={ctx.analytics}
            interactive={!ctx.preview}
          >
            <MarmaladeSectionList
              sections={gallerySections}
              data={data}
              asset={siteAsset}
              ctx={mmCtx}
            />
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="wrap">
                <div className="rlayout">
                  <div>
                    <MarmaladeSectionList
                      sections={mmBody}
                      data={data}
                      asset={siteAsset}
                      ctx={mmCtx}
                      interactive
                    />
                  </div>
                  <MarmaladeBookingDock
                    price={room.price}
                    currency={room.currency}
                    bookHref={room.bookHref}
                    maxGuests={room.maxGuests}
                    interactive
                  />
                </div>
              </div>
            </section>
            <MarmaladeSectionList
              sections={mmBelow}
              data={data}
              asset={siteAsset}
              ctx={mmCtx}
              interactive
            />
          </MarmaladeShell>
        </SiteThemeRoot>
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
