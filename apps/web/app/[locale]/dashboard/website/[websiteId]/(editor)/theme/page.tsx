import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadActiveThemes } from "@/lib/site/themes.server";
import { listRestorePoints } from "@/lib/website/restorePoints";

import { loadWebsiteEditorData } from "../../loadWebsiteEditorData";
import { SavedDesigns } from "./SavedDesigns";
import { ThemeGallery } from "./ThemeGallery";

export const dynamic = "force-dynamic";

export default async function WebsiteThemePage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data, themes, restorePoints] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
    loadActiveThemes(),
    listRestorePoints(websiteId),
  ]);
  if (!data) notFound();

  const activeSlug = (data.theme.preset as string | undefined) || "warm";

  return (
    <div className="space-y-8">
      <div>
        <header className="mb-5">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            {t("themesHeading")}
          </h2>
          <p className="mt-1 text-sm text-brand-mute">{t("themesSub")}</p>
        </header>
        <ThemeGallery
          websiteId={websiteId}
          themes={themes}
          activeSlug={activeSlug}
          subdomain={data.subdomain}
        />
      </div>

      <SavedDesigns websiteId={websiteId} restorePoints={restorePoints} />
    </div>
  );
}
