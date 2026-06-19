import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadActiveThemes } from "@/lib/site/themes.server";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { ThemeGallery } from "./ThemeGallery";

export const dynamic = "force-dynamic";

export default async function WebsiteThemePage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data, themes] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
    loadActiveThemes(),
  ]);
  if (!data) notFound();

  const activeSlug = (data.theme.preset as string | undefined) || "classic";

  return (
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
      />
    </div>
  );
}
