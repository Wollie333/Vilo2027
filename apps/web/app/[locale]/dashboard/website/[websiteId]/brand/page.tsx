import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { pageHref } from "@/lib/site/loadSitePage";
import type { SiteNavItem } from "@/lib/site/types";
import { createServerClient } from "@/lib/supabase/server";
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
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
  ]);
  if (!data) notFound();

  // Real nav for the live preview (visible pages, ordered).
  const supabase = createServerClient();
  const { data: pages } = await supabase
    .from("website_pages")
    .select("kind, slug, nav_label, title, nav_order, show_in_nav")
    .eq("website_id", websiteId)
    .eq("show_in_nav", true)
    .order("nav_order", { ascending: true });
  const nav: SiteNavItem[] = (pages ?? []).map((p) => ({
    label: p.nav_label || p.title || p.slug,
    href: pageHref(p.kind, p.slug),
  }));

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
  const initial = deriveStudioState(data.brand, data.theme, assetUrls);

  return (
    <div>
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("brandHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("brandSub")}</p>
      </header>

      <BrandStudio
        websiteId={websiteId}
        initial={initial}
        nav={nav}
        fallbackName={fallbackName}
      />
    </div>
  );
}
