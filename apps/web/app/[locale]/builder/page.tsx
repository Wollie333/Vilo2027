import { getThemeBlueprints } from "@/lib/website/themeSections";
import { resolveThemeBase } from "@/lib/site/themes.server";
import { createServerClient } from "@/lib/supabase/server";
import { newPageDoc } from "@/lib/website/widgets/factories";
import { flatSectionsToPageDoc } from "@/lib/website/blueprints";
import {
  isPageDoc,
  parsePageDocLoose,
  type PageDoc,
} from "@/lib/website/pageDoc.schema";
import { parseSectionsLoose } from "@/lib/website/sections.schema";
import {
  loadSiteContext,
  loadSitePage,
  roomMenuLinks,
} from "@/lib/site/loadSitePage";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type { SiteNavigation, SiteMenuItem, SiteData } from "@/lib/site/types";
import { DEMO_ROOMS } from "@/lib/site/sampleSite";

import { BuilderShell } from "./BuilderShell";
import type { Brand as BuilderBrand } from "./BrandStudioOverlay";
import { EMPTY_ANALYTICS, type BuilderAnalytics } from "./PageSettingsOverlay";
import "./builder-chrome.css";
// Load the per-theme skin stylesheet so the builder canvas renders the SAME
// pixel-perfect theme design the live site shows (the canvas already carries the
// `.wielo-<slug>` scope via SiteThemeRoot + `[data-section-type]` hooks). Editing
// then matches what visitors see.
import "@/components/site/themes/theme-skins.css";

type PageOpt = { key: string; label: string; href: string };

// Raw `host_websites.brand` jsonb shape (subset the builder overlay reads).
type RawBrand = {
  name?: string | null;
  tagline?: string | null;
  monogram?: string | null;
  socials?: { instagram?: string | null; facebook?: string | null } | null;
};

// Raw `host_websites.settings.analytics` jsonb → the builder's flat working shape.
type RawAnalytics = {
  ga4?: string | null;
  metaPixel?: string | null;
  gtm?: string | null;
  tiktok?: string | null;
  googleAds?: string | null;
  cookieConsent?: {
    enabled?: boolean | null;
    message?: string | null;
    privacyHref?: string | null;
  } | null;
};

function toBuilderAnalytics(
  raw: RawAnalytics | null | undefined,
): BuilderAnalytics {
  if (!raw) return EMPTY_ANALYTICS;
  return {
    ga4: raw.ga4 ?? "",
    metaPixel: raw.metaPixel ?? "",
    gtm: raw.gtm ?? "",
    tiktok: raw.tiktok ?? "",
    googleAds: raw.googleAds ?? "",
    cookieConsentEnabled: raw.cookieConsent?.enabled ?? true,
    cookieConsentMessage: raw.cookieConsent?.message ?? "",
    privacyHref: raw.cookieConsent?.privacyHref ?? "",
  };
}

function toBuilderBrand(raw: RawBrand | null | undefined): BuilderBrand {
  return {
    name: raw?.name ?? undefined,
    tagline: raw?.tagline ?? undefined,
    monogram: raw?.monogram ?? undefined,
    socials: {
      instagram: raw?.socials?.instagram ?? undefined,
      facebook: raw?.socials?.facebook ?? undefined,
    },
  };
}

// Builder V2 — Phase 3a–3e: the standalone, full-screen builder shell.
//
// Two modes:
//  • Real page  — ?websiteId=&pageId= loads that page's stored PageDoc (or
//    converts its legacy flat sections) via the OWNER-authed client (RLS gates
//    access) and enables autosave + Publish (Phase 3e-2 Server Actions).
//  • Demo       — ?theme=<slug>&page=<key> renders a read-only theme blueprint
//    (no persistence). Default: the Safari home blueprint.
export const dynamic = "force-dynamic";

const DEFAULT_THEME = "safari";

function themeName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Load a real page (owner-checked via RLS on the authed client). */
async function loadRealPage(
  websiteId: string,
  pageId: string,
): Promise<{
  doc: PageDoc;
  docName: string;
  kind: string;
  theme: SiteThemeConfig;
  domain: string;
  brand: BuilderBrand;
  navigation: SiteNavigation;
  analytics: BuilderAnalytics;
  pages: PageOpt[];
  roomLinks: PageOpt[];
  initialData: SiteData;
} | null> {
  const supabase = createServerClient();
  const { data: page } = await supabase
    .from("website_pages")
    .select("id, title, kind, slug, draft_sections")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle<{
      id: string;
      title: string | null;
      kind: string;
      slug: string | null;
      draft_sections: unknown;
    }>();
  if (!page) return null; // not found OR not owned (RLS)

  const { data: site } = await supabase
    .from("host_websites")
    .select("theme, subdomain, custom_domain, brand, navigation, settings")
    .eq("id", websiteId)
    .maybeSingle<{
      theme: SiteThemeConfig | null;
      subdomain: string | null;
      custom_domain: string | null;
      brand: RawBrand | null;
      navigation: SiteNavigation | null;
      settings: { analytics?: RawAnalytics | null } | null;
    }>();

  const { data: pageRows } = await supabase
    .from("website_pages")
    .select("kind, slug, nav_label, title, nav_order")
    .eq("website_id", websiteId)
    .order("nav_order", { ascending: true });
  const pages: PageOpt[] = (pageRows ?? []).map((p) => {
    const home = p.kind === "home";
    return {
      key: home ? "home" : (p.slug ?? ""),
      label: p.nav_label?.trim() || p.title?.trim() || p.slug || p.kind,
      href: home ? "/" : `/${p.slug ?? ""}`,
    };
  });

  // Resolve the working doc: stored PageDoc → use it; legacy flat sections →
  // convert; empty → a blank doc.
  const draft = page.draft_sections;
  let doc: PageDoc;
  if (isPageDoc(draft)) {
    doc = parsePageDocLoose(draft) ?? newPageDoc();
  } else {
    const flat = parseSectionsLoose(draft);
    doc = flat.length ? flatSectionsToPageDoc(flat) : newPageDoc();
  }

  const domain =
    site?.custom_domain?.trim() ||
    (site?.subdomain ? `${site.subdomain}.wielo.site` : "yoursite.wielo.site");

  // Real auto-populate data for the CANVAS (Phase 4b-2): assemble the host's live
  // SiteData for this page (keyed by the SAME node ids the builder doc uses, since
  // both come from `draft_sections`) so blocks like the rooms grid render the host's
  // real rooms/reviews/gallery instead of demo content — and edits made via the
  // "Edit room data" modal show in place. Best-effort: any failure falls back to the
  // demo canvas data (no regression). Newly-added blocks still get demo until saved.
  let initialData: SiteData = {};
  // The host's individual room pages, as selectable menu links (nav quick-add).
  let roomLinks: PageOpt[] = [];
  try {
    const sub = site?.subdomain?.trim();
    if (sub) {
      const ctx = await loadSiteContext(sub, {
        preview: true,
        siteParam: sub,
      });
      if (ctx) {
        const real = await loadSitePage(
          ctx,
          page.kind === "home" ? [] : [page.slug ?? page.kind],
        );
        if (real?.data) initialData = real.data;
        roomLinks = (await roomMenuLinks(ctx)).map((r) => ({
          key: r.roomId,
          label: r.label,
          href: r.href,
        }));
      }
    }
  } catch {
    // fall back to demo-only canvas data
  }

  return {
    doc,
    docName: page.title?.trim() || themeName(page.kind),
    kind: page.kind,
    theme: (site?.theme ?? {}) as SiteThemeConfig,
    domain,
    brand: toBuilderBrand(site?.brand),
    navigation: (site?.navigation ?? {}) as SiteNavigation,
    analytics: toBuilderAnalytics(site?.settings?.analytics),
    pages,
    roomLinks,
    initialData,
  };
}

export default async function BuilderPage({
  searchParams,
}: {
  searchParams?: {
    theme?: string;
    page?: string;
    websiteId?: string;
    pageId?: string;
    nav?: string;
  };
}) {
  // Dashboard "Navigation" deep-links here with ?nav=links|header|footer to open
  // the Nav builder overlay straight away (the old full-screen nav studio is gone).
  const navTab =
    searchParams?.nav === "header" ||
    searchParams?.nav === "footer" ||
    searchParams?.nav === "links"
      ? searchParams.nav
      : undefined;

  // ── Real-page mode (persists) ──
  if (searchParams?.websiteId && searchParams?.pageId) {
    const real = await loadRealPage(
      searchParams.websiteId,
      searchParams.pageId,
    );
    if (real) {
      return (
        <BuilderShell
          docName={real.docName}
          themeLabel="Live page"
          theme={real.theme}
          initialDoc={real.doc}
          websiteId={searchParams.websiteId}
          pageId={searchParams.pageId}
          domain={real.domain}
          brand={real.brand}
          navigation={real.navigation}
          analytics={real.analytics}
          pages={real.pages}
          roomLinks={real.roomLinks}
          pageKind={real.kind}
          initialData={real.initialData}
          autoOpenNav={!!navTab}
          navTab={navTab}
        />
      );
    }
    // Fall through to demo mode when the page isn't accessible.
  }

  // ── Demo / blueprint mode (read-only) ──
  const slug = searchParams?.theme || DEFAULT_THEME;
  const blueprints = getThemeBlueprints(slug);
  const base = await resolveThemeBase(slug);
  const chosen =
    blueprints.find((b) => b.key === searchParams?.page) ?? blueprints[0];

  // Demo nav + pages derived from the theme's blueprint pages.
  const demoPages: PageOpt[] = blueprints.map((b) => ({
    key: b.key,
    label: b.label,
    href: b.key === "home" ? "/" : `/${b.key}`,
  }));
  const demoNav: SiteNavigation = {
    menu: demoPages.map(
      (p, i): SiteMenuItem => ({
        id: `demo-${i}`,
        label: p.label,
        href: p.href,
      }),
    ),
  };
  // Demo room-page links (so the nav "Quick-add a room page" is testable without
  // a real host); slug mirrors the /rooms/<slug> route derived from the name.
  const demoRoomLinks: PageOpt[] = DEMO_ROOMS.rooms.map((r) => ({
    key: r.id,
    label: r.name,
    href: `/rooms/${r.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`,
  }));

  return (
    <BuilderShell
      docName={`${themeName(slug)} — ${chosen?.label ?? "Page"}`}
      themeLabel={themeName(slug)}
      theme={{ base }}
      initialDoc={chosen?.doc ?? newPageDoc()}
      templates={blueprints.map((b) => ({
        key: b.key,
        label: b.label,
        doc: b.doc,
      }))}
      domain={`${slug}.wielo.site`}
      brand={{
        name: themeName(slug),
        monogram: themeName(slug).slice(0, 1),
      }}
      navigation={demoNav}
      pages={demoPages}
      roomLinks={demoRoomLinks}
      pageKind={chosen?.key}
      autoOpenNav={!!navTab}
      navTab={navTab}
    />
  );
}
