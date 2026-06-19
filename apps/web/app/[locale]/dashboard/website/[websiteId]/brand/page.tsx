import { notFound } from "next/navigation";

import { loadActiveThemes } from "@/lib/site/themes.server";
import type { SitePreset } from "@/lib/site/themes";
import { websiteAssetUrl } from "@/lib/website/assets";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { BRAND_ASSET_SLOTS, type BrandAssetSlot } from "../../schemas";
import { BrandStudio } from "./BrandStudio";
import { deriveStudioState } from "./studio";

export const dynamic = "force-dynamic";

export default async function WebsiteBrandPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [data, themes] = await Promise.all([
    loadWebsiteEditorData(websiteId),
    loadActiveThemes(),
  ]);
  if (!data) notFound();

  // Resolve every brand-asset slot → public URL for the preview chrome.
  const slotPath: Record<BrandAssetSlot, string | undefined> = {
    primary: data.brand.logo_path,
    light: data.brand.logo_light_path,
    icon: data.brand.logo_icon_path,
    favicon: data.brand.favicon_path,
    apple: data.brand.apple_icon_path,
  };
  const assetUrls = Object.fromEntries(
    BRAND_ASSET_SLOTS.map((slot) => [slot, websiteAssetUrl(slotPath[slot])]),
  ) as Record<BrandAssetSlot, string | null>;

  const fallbackName = data.businessName || data.subdomain;

  // Resolve the active theme's base: the copied base on the saved theme, else the
  // catalogue theme matching its slug, else the first theme.
  const presetSlug = (data.theme.preset as string | undefined) || "classic";
  const base: SitePreset =
    (data.theme.base as SitePreset | undefined) ??
    themes.find((t) => t.slug === presetSlug)?.base ??
    themes[0].base;

  const initial = deriveStudioState(data.brand, data.theme, assetUrls, base);

  return (
    <BrandStudio
      websiteId={websiteId}
      initial={initial}
      themes={themes}
      fallbackName={fallbackName}
      subdomain={data.subdomain}
      liveHref={`/site?site=${data.subdomain}&preview=1`}
    />
  );
}
