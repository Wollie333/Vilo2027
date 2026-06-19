import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadPageBuilder } from "./loadPageBuilder";
import { PageSeoCard } from "./_components/PageSeoCard";
import { SectionBuilder } from "./_components/SectionBuilder";

export const dynamic = "force-dynamic";

export default async function WebsitePageBuilder({
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

  const title =
    data.page.kind === "home"
      ? t("pageHome")
      : data.page.kind === "about"
        ? t("pageAbout")
        : data.page.title || data.page.slug;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/dashboard/website/${websiteId}/pages`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute hover:text-brand-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("allPages")}
          </Link>
          <h2 className="mt-1 font-display text-lg font-bold text-brand-ink">
            {t("editingPage", { page: title })}
          </h2>
        </div>
      </div>

      <PageSeoCard
        websiteId={websiteId}
        pageId={pageId}
        fallbackTitle={title}
        initial={{
          title: data.page.seo.title ?? "",
          description: data.page.seo.description ?? "",
        }}
      />

      <SectionBuilder
        websiteId={websiteId}
        pageId={pageId}
        initialSections={data.sections}
        brand={data.brand}
        theme={data.theme}
        nav={data.nav}
        dataByType={data.dataByType}
      />
    </div>
  );
}
