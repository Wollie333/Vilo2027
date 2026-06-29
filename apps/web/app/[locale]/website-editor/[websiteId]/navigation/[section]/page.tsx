import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import {
  loadSiteContext,
  loadSitePage,
  pageHref,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { siteSurfaceIsDark, type SiteThemeConfig } from "@/lib/site/themes";
import { themeSwatches } from "@/lib/site/themeSwatches";
import type {
  SiteBrand,
  SiteConversion,
  SiteData,
  SiteNavItem,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";
import { ensureDefaultMenu } from "@/lib/website/defaultMenu";
import { navigationSchema } from "@/app/[locale]/dashboard/website/schemas";

import { NavSectionEditor } from "./NavSectionEditor";

export const dynamic = "force-dynamic";

const SECTIONS = ["header", "menu", "footer"] as const;
type Section = (typeof SECTIONS)[number];

/** One page the host can put behind the live menu in the nav-editor canvas. */
export type NavBackdrop = {
  key: string;
  label: string;
  sections: WebsiteSection[];
  data?: SiteData;
};

export default async function NavigationSectionEditorPage({
  params,
}: {
  params: Promise<{ websiteId: string; section: string }>;
}) {
  const { websiteId, section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();

  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) notFound();

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain, navigation, brand, theme")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) notFound();

  const navigation =
    section === "menu"
      ? await ensureDefaultMenu(
          supabase,
          websiteId,
          navigationSchema.parse(site.navigation ?? {}),
        )
      : navigationSchema.parse(site.navigation ?? {});
  const rawBrand = (site.brand ?? {}) as Record<string, unknown>;
  const brandName =
    (rawBrand.name as string | undefined)?.trim() || site.subdomain;
  // Resolved brand for the live theme preview (real logo + socials + tagline).
  const brand: SiteBrand = {
    name: brandName,
    tagline: (rawBrand.tagline as string | null) ?? null,
    logoUrl: websiteAssetUrl(rawBrand.logo_path as string | undefined),
    logoLightUrl:
      websiteAssetUrl(rawBrand.logo_light_path as string | undefined) ??
      websiteAssetUrl(rawBrand.logo_path as string | undefined),
    socials:
      (rawBrand.socials as SiteBrand["socials"] | undefined) ?? undefined,
  };
  const themePreset =
    ((site.theme ?? {}) as { preset?: string }).preset ?? null;

  const [{ data: pageRows }, { data: roomRows }] = await Promise.all([
    supabase
      .from("website_pages")
      .select("kind, slug, nav_label, title, nav_order")
      .eq("website_id", websiteId)
      .order("nav_order", { ascending: true }),
    // Visible rooms + their own names — for the auto-rooms hide list in the
    // menu builder. (Labels use the room's name, not the website override.)
    supabase
      .from("website_rooms")
      .select(
        "room_id, sort_order, room:property_rooms!inner ( name, deleted_at )",
      )
      .eq("website_id", websiteId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }),
  ]);
  const pages = (pageRows ?? []).map((p) => ({
    label: p.nav_label?.trim() || p.title?.trim() || p.slug,
    href: pageHref(p.kind, p.slug),
  }));

  // The host's REAL pages (draft) — rendered as the canvas backdrop so the nav
  // editor is true WYSIWYG (the menu sits on the real design, not a stock hero).
  // Every page is loaded via the same path the public site uses so the host can
  // switch which page sits behind the menu. Best-effort (a blank result just
  // falls back to the stock hero in the canvas). Capped to keep load bounded.
  const backdrops: NavBackdrop[] = [];
  let homeBookHref: string | null = null;
  let contactEmail: string | null = null;
  let contactPhone: string | null = null;
  // Generic-theme canvas inputs (non-Safari): the resolved theme + chrome data.
  let themeConfig: SiteThemeConfig | null = null;
  let navItems: SiteNavItem[] = [];
  let conversion: SiteConversion | null = null;
  let chromeLayout: "full" | "boxed" = "full";
  let darkChrome = false;
  try {
    const siteCtx = await loadSiteContext(site.subdomain, {
      preview: true,
      siteParam: site.subdomain,
    });
    if (siteCtx) {
      homeBookHref =
        siteCtx.propertyIds.length > 0 ? siteBookHref(siteCtx, {}) : null;
      contactEmail = siteCtx.brand.contactEmail ?? null;
      contactPhone = siteCtx.brand.contactPhone ?? null;
      themeConfig = siteCtx.theme;
      navItems = siteCtx.nav;
      conversion = siteCtx.conversion;
      chromeLayout = siteCtx.layout;
      darkChrome = siteSurfaceIsDark(siteCtx.theme);
      // Home first, then the rest in nav order. Skip the bespoke funnel pages
      // (checkout/thank-you) — they aren't useful menu backdrops.
      const candidates = (pageRows ?? [])
        .filter((p) => !["checkout", "thank-you"].includes(p.kind))
        .sort((a, b) => (a.kind === "home" ? -1 : b.kind === "home" ? 1 : 0))
        .slice(0, 12);
      const loaded = await Promise.all(
        candidates.map(async (p): Promise<NavBackdrop | null> => {
          const path = p.kind === "home" ? [] : [p.slug];
          const res = await loadSitePage(siteCtx, path).catch(() => null);
          if (!res) return null;
          return {
            key: p.kind === "home" ? "home" : p.slug,
            label:
              p.kind === "home"
                ? "Home"
                : p.nav_label?.trim() || p.title?.trim() || p.slug,
            sections: res.sections,
            data: res.data,
          };
        }),
      );
      backdrops.push(...loaded.filter((b): b is NavBackdrop => b !== null));
    }
  } catch {
    // Best-effort backdrop — the editor still works without the real pages.
  }
  const rooms = (roomRows ?? [])
    .map((r) => {
      const room = r.room as unknown as {
        name: string;
        deleted_at: string | null;
      } | null;
      return room && !room.deleted_at
        ? { roomId: r.room_id as string, name: room.name }
        : null;
    })
    .filter((x): x is { roomId: string; name: string } => x !== null);

  return (
    <NavSectionEditor
      websiteId={websiteId}
      section={section as Section}
      initial={navigation}
      pages={pages}
      rooms={rooms}
      brandName={brandName}
      brand={brand}
      themePreset={themePreset}
      subdomain={site.subdomain}
      backdrops={backdrops}
      homeBookHref={homeBookHref}
      contactEmail={contactEmail}
      contactPhone={contactPhone}
      themeConfig={themeConfig}
      navItems={navItems}
      conversion={conversion}
      chromeLayout={chromeLayout}
      darkChrome={darkChrome}
      themeSwatches={themeSwatches(site.theme)}
    />
  );
}
