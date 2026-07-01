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
import type { SiteThemeConfig } from "@/lib/site/themes";
import type { SiteNavigation, SiteMenuItem } from "@/lib/site/types";

import { BuilderShell } from "./BuilderShell";
import type { Brand as BuilderBrand } from "./BrandStudioOverlay";
import "./builder-chrome.css";

type PageOpt = { key: string; label: string; href: string };

// Raw `host_websites.brand` jsonb shape (subset the builder overlay reads).
type RawBrand = {
  name?: string | null;
  tagline?: string | null;
  monogram?: string | null;
  socials?: { instagram?: string | null; facebook?: string | null } | null;
};

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
  theme: SiteThemeConfig;
  domain: string;
  brand: BuilderBrand;
  navigation: SiteNavigation;
  pages: PageOpt[];
} | null> {
  const supabase = createServerClient();
  const { data: page } = await supabase
    .from("website_pages")
    .select("id, title, kind, draft_sections")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle<{
      id: string;
      title: string | null;
      kind: string;
      draft_sections: unknown;
    }>();
  if (!page) return null; // not found OR not owned (RLS)

  const { data: site } = await supabase
    .from("host_websites")
    .select("theme, subdomain, custom_domain, brand, navigation")
    .eq("id", websiteId)
    .maybeSingle<{
      theme: SiteThemeConfig | null;
      subdomain: string | null;
      custom_domain: string | null;
      brand: RawBrand | null;
      navigation: SiteNavigation | null;
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

  return {
    doc,
    docName: page.title?.trim() || themeName(page.kind),
    theme: (site?.theme ?? {}) as SiteThemeConfig,
    domain,
    brand: toBuilderBrand(site?.brand),
    navigation: (site?.navigation ?? {}) as SiteNavigation,
    pages,
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
  };
}) {
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
          pages={real.pages}
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
    />
  );
}
