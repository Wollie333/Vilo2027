import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { SeoForm } from "./SeoForm";

export const dynamic = "force-dynamic";

export default async function WebsiteSeoPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
  ]);
  if (!data) notFound();

  return (
    <div className="max-w-2xl">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("seoHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("seoSub")}</p>
      </header>

      <SeoForm
        websiteId={websiteId}
        fallbackTitle={data.brand.name ?? data.subdomain}
        previewHost={`${data.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site"}`}
        initial={{
          title: data.seo.title ?? "",
          description: data.seo.description ?? "",
          ogImagePath: data.seo.og_image_path ?? "",
          gscToken: data.seo.gsc_token ?? "",
          robotsIndex: data.seo.robots_index !== false,
          sitemapEnabled: data.seo.sitemap_enabled !== false,
        }}
      />
    </div>
  );
}
