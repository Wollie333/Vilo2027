import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { ThemeForm } from "./ThemeForm";

export const dynamic = "force-dynamic";

export default async function WebsiteThemePage({
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
    <div className="max-w-3xl">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("themeHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("themeSub")}</p>
      </header>

      <ThemeForm
        websiteId={websiteId}
        initial={{
          preset: data.theme.preset ?? "classic",
          accent: data.theme.accent ?? "",
          font: data.theme.font ?? "",
          radius: data.theme.radius ?? "",
        }}
      />
    </div>
  );
}
