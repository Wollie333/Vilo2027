import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { siteAsset } from "@/components/site/SitePageView";
import { loadSiteContext, loadSitePage } from "@/lib/site/loadSitePage";

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

  // Render the host's REAL home page (chrome + sections) in preview mode WITHOUT
  // a SiteThemeRoot — the client ThemeForm wraps it in the live-edited `--site-*`
  // vars so changing preset/accent/font/corners re-themes the real page instantly.
  let preview = (
    <div
      className="px-6 py-16 text-center text-sm"
      style={{ color: "var(--site-mute)" }}
    >
      {t("themeSub")}
    </div>
  );
  const ctx = await loadSiteContext(data.subdomain, { preview: true });
  if (ctx) {
    const result = await loadSitePage(ctx, []);
    if (result) {
      preview = (
        <SiteChrome brand={ctx.brand} nav={ctx.nav} bookHref="#">
          <SectionRenderer
            sections={result.sections}
            data={result.data}
            asset={siteAsset}
          />
        </SiteChrome>
      );
    }
  }

  return (
    <div>
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
        preview={preview}
      />
    </div>
  );
}
