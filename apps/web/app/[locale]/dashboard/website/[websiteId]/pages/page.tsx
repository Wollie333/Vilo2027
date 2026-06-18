import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadPagesList } from "./loadPagesList";
import { PagesManager } from "./PagesManager";

export const dynamic = "force-dynamic";

export default async function WebsitePagesList({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, pages] = await Promise.all([
    getTranslations("website"),
    loadPagesList(websiteId),
  ]);
  if (!pages) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("pagesHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("pagesManageSub")}</p>
      </header>

      <PagesManager websiteId={websiteId} initialPages={pages} />
    </div>
  );
}
