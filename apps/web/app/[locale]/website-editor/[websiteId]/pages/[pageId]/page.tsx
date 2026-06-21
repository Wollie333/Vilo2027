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
        : data.page.title || data.page.slug;

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
    />
  );
}
