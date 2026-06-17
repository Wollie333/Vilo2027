import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { websiteAssetUrl } from "@/lib/website/assets";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { BrandForm } from "./BrandForm";

export const dynamic = "force-dynamic";

export default async function WebsiteBrandPage({
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
          {t("brandHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("brandSub")}</p>
      </header>

      <BrandForm
        websiteId={websiteId}
        initialName={data.brand.name ?? ""}
        initialTagline={data.brand.tagline ?? ""}
        initialLogoUrl={websiteAssetUrl(data.brand.logo_path)}
      />
    </div>
  );
}
