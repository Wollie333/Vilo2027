import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { pageHref } from "@/lib/site/loadSitePage";
import type { SiteNavItem } from "@/lib/site/types";
import type { SiteThemeConfig } from "@/lib/site/themes";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { BrandForm } from "./BrandForm";

export const dynamic = "force-dynamic";

const SOCIAL_KEYS = [
  "instagram",
  "facebook",
  "x",
  "youtube",
  "linkedin",
  "website",
] as const;

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

  const socials = Object.fromEntries(
    SOCIAL_KEYS.map((k) => [k, data.brand.socials?.[k] ?? ""]),
  ) as Record<(typeof SOCIAL_KEYS)[number], string>;

  return (
    <div>
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("brandHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("brandSub")}</p>
      </header>

      <BrandForm
        websiteId={websiteId}
        theme={(data.theme ?? {}) as SiteThemeConfig}
        nav={nav}
        initialName={data.brand.name ?? ""}
        initialTagline={data.brand.tagline ?? ""}
        initialLogoUrl={websiteAssetUrl(data.brand.logo_path)}
        initialFaviconUrl={websiteAssetUrl(data.brand.favicon_path)}
        initialLogoStyle={data.brand.logo_style ?? "mark"}
        initialContactEmail={data.brand.contact?.email ?? ""}
        initialContactPhone={data.brand.contact?.phone ?? ""}
        initialSocials={socials}
      />
    </div>
  );
}
