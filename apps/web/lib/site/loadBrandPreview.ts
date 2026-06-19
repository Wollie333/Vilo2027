import "server-only";

import { loadWebsiteEditorData } from "@/app/[locale]/dashboard/website/[websiteId]/loadWebsiteEditorData";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type { SiteBrand, SiteData, SiteNavItem } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { loadSiteContext, loadSitePage } from "./loadSitePage";
import {
  DEMO_GALLERY,
  DEMO_ROOMS,
  SAMPLE_DATA,
  SAMPLE_NAV,
  SAMPLE_PAGES,
} from "./sampleSite";

export type PreviewPage = {
  key: string;
  label: string;
  path: string;
  sections: WebsiteSection[];
  data: SiteData;
};

export type BrandPreview = {
  brand: SiteBrand;
  theme: SiteThemeConfig;
  nav: SiteNavItem[];
  pages: PreviewPage[];
};

/** Fill empty rooms / gallery sections with demo content so the host can design
 * the brand even before they've added real rooms or photos. */
function withDemoFallback(
  sections: WebsiteSection[],
  data: SiteData,
): SiteData {
  const out: SiteData = { ...data };
  for (const s of sections) {
    if (s.type === "rooms_preview") {
      const e = out[s.id];
      if (!e || e.type !== "rooms_preview" || e.data.rooms.length === 0) {
        out[s.id] = { type: "rooms_preview", data: DEMO_ROOMS };
      }
    } else if (s.type === "gallery") {
      const e = out[s.id];
      if (!e || e.type !== "gallery" || e.data.images.length === 0) {
        out[s.id] = { type: "gallery", data: DEMO_GALLERY };
      }
    }
  }
  return out;
}

/**
 * Owner-scoped load of a host's REAL website (preview mode) for the Brand Studio
 * live preview — every published/draft page with its sections and live data, so
 * the preview is the actual public site. The studio overlays the *draft*
 * brand/theme on top via postMessage, so theming updates live while content
 * stays real. Empty rooms/gallery get demo fillers; a brand-new empty site falls
 * back to a demo home page. Returns null if the site isn't owned by the host.
 */
export async function loadBrandPreview(
  websiteId: string,
): Promise<BrandPreview | null> {
  const editor = await loadWebsiteEditorData(websiteId);
  if (!editor) return null;

  const ctx = await loadSiteContext(editor.subdomain, { preview: true });
  if (!ctx) return null;

  const results = await Promise.all(
    ctx.nav.map(async (item): Promise<PreviewPage | null> => {
      const pathSlug =
        item.href === "/" ? [] : item.href.replace(/^\//, "").split("/");
      const res = await loadSitePage(ctx, pathSlug);
      if (!res) return null;
      return {
        key: pathSlug.join("/") || "home",
        label: item.label,
        path: item.href,
        sections: res.sections,
        data: withDemoFallback(res.sections, res.data),
      };
    }),
  );
  const pages = results.filter((p): p is PreviewPage => p !== null);

  // Brand-new / empty site — fall back to a demo home so the brand can still be
  // designed against realistic content.
  if (!pages.some((p) => p.sections.length > 0)) {
    return {
      brand: ctx.brand,
      theme: ctx.theme,
      nav: SAMPLE_NAV,
      pages: SAMPLE_PAGES.map((p) => ({
        key: p.key,
        label: p.label,
        path: p.path,
        sections: p.sections,
        data: SAMPLE_DATA,
      })),
    };
  }

  return { brand: ctx.brand, theme: ctx.theme, nav: ctx.nav, pages };
}
