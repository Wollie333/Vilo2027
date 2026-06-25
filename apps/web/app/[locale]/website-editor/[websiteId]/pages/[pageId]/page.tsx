import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadPageBuilder } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/loadPageBuilder";

import { PageBuilder } from "./PageBuilder";

export const dynamic = "force-dynamic";

export default async function FullScreenPageBuilder({
  params,
}: {
  params: Promise<{ websiteId: string; pageId: string }>;
}) {
  const { websiteId, pageId } = await params;
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

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site";

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
      }}
      domain={`${data.subdomain}.${root}`}
      ogImageUrl={data.ogImageUrl}
      initialLayout={data.layout}
      pageKind={data.page.kind}
      sampleRoom={data.sampleRoom}
    />
  );
}
