import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import {
  loadSiteContext,
  loadSitePage,
  pageHref,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import type { SiteBrand, SiteData } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";
import { ensureDefaultMenu } from "@/lib/website/defaultMenu";
import { navigationSchema } from "@/app/[locale]/dashboard/website/schemas";

import { NavSectionEditor } from "./NavSectionEditor";

export const dynamic = "force-dynamic";

const SECTIONS = ["header", "menu", "footer"] as const;
type Section = (typeof SECTIONS)[number];

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

  // The host's REAL home page (draft) — rendered as the canvas backdrop so the
  // nav editor is true WYSIWYG (the menu sits on the real design, not a stock
  // hero). Loaded via the same path the public site uses; best-effort (a blank
  // result just falls back to the stock hero in the canvas).
  let homeSections: WebsiteSection[] = [];
  let homeData: SiteData | undefined;
  let homeBookHref: string | null = null;
  let contactEmail: string | null = null;
  let contactPhone: string | null = null;
  try {
    const siteCtx = await loadSiteContext(site.subdomain, {
      preview: true,
      siteParam: site.subdomain,
    });
    if (siteCtx) {
      const home = await loadSitePage(siteCtx, []);
      if (home) {
        homeSections = home.sections;
        homeData = home.data;
      }
      homeBookHref =
        siteCtx.propertyIds.length > 0 ? siteBookHref(siteCtx, {}) : null;
      contactEmail = siteCtx.brand.contactEmail ?? null;
      contactPhone = siteCtx.brand.contactPhone ?? null;
    }
  } catch {
    // Best-effort backdrop — the editor still works without the real page.
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
      homeSections={homeSections}
      homeData={homeData}
      homeBookHref={homeBookHref}
      contactEmail={contactEmail}
      contactPhone={contactPhone}
    />
  );
}
