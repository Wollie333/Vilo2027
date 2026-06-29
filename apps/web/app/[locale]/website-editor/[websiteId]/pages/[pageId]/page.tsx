import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadPageBuilder } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/loadPageBuilder";

import { PageBuilder } from "./PageBuilder";
import { loadRoomBuilder } from "./loadRoomBuilder";
import { RoomBuilder } from "./RoomBuilder";

export const dynamic = "force-dynamic";

export default async function FullScreenPageBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ websiteId: string; pageId: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { websiteId, pageId } = await params;
  const { room: roomId } = await searchParams;

  // Room-scoped editing: `?room=<id>` opens the per-room editor (the room's
  // overrides layered over the shared template) instead of the template builder.
  // Reuse loadPageBuilder for the live canvas (theme chrome + per-type data pool).
  if (roomId) {
    const [roomData, pageData] = await Promise.all([
      loadRoomBuilder(websiteId, pageId, roomId),
      loadPageBuilder(websiteId, pageId),
    ]);
    if (!roomData || !pageData) notFound();
    return <RoomBuilder data={roomData} page={pageData} />;
  }

  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadPageBuilder(websiteId, pageId),
  ]);
  if (!data) notFound();

  const pageTitle =
    data.page.kind === "home"
      ? t("pageHome")
      : data.page.kind === "about"
        ? t("pageAbout")
        : data.page.kind === "room_detail"
          ? t("pageRoomDetail")
          : data.page.title || data.page.slug;

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";

  return (
    <PageBuilder
      websiteId={websiteId}
      pageId={pageId}
      pageTitle={pageTitle}
      subdomain={data.subdomain}
      initialSections={data.sections}
      brand={data.brand}
      theme={data.theme}
      nav={data.nav}
      navigation={data.navigation}
      dataByType={data.dataByType}
      savedSections={data.savedSections}
      initialNav={data.navConfig}
      navPages={data.navPages}
      brandName={data.brandName}
      pageSlug={data.page.slug}
      pageSeo={{
        title: data.page.seo.title ?? "",
        description: data.page.seo.description ?? "",
        focusKeyword: data.page.seo.focusKeyword ?? "",
        image: data.page.seo.image ?? "",
        pixelEvent: data.page.seo.pixelEvent ?? "none",
        headCode: data.page.seo.headCode ?? "",
        noindex: data.page.seo.noindex ?? false,
      }}
      domain={`${data.subdomain}.${root}`}
      ogImageUrl={data.ogImageUrl}
      initialLayout={data.layout}
      pageKind={data.page.kind}
      sampleRoom={data.sampleRoom}
    />
  );
}
