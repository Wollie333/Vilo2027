"use client";

import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  SiteAssetResolver,
  SiteBrand,
  SiteConversion,
  SiteData,
  SiteNavItem,
  SiteNavigation,
} from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionRenderer } from "./SectionRenderer";
import { SiteChrome } from "./SiteChrome";
import { SiteThemeRoot } from "./SiteThemeRoot";

// Generic-theme analogue of SafariNavCanvas: the host's REAL page rendered behind
// the LIVE chrome in the nav editor, for every non-Safari theme. Uses the exact
// public render path (SiteThemeRoot > SiteChrome > SectionRenderer) so the canvas
// can't drift from production. `navigation` is the editor's in-progress config, so
// header/menu/footer edits reflect instantly; `chromeInert` + non-interactive
// sections keep it a preview (no clicks, no analytics).

const canvasAsset: SiteAssetResolver = (path) =>
  websiteAssetUrl(path) ?? undefined;

export function SiteChromeCanvas({
  theme,
  brand,
  nav,
  navigation,
  currentPageKey,
  conversion,
  layout,
  darkChrome,
  bookHref,
  websiteId,
  sections,
  data,
  previewDevice,
}: {
  theme: SiteThemeConfig;
  brand: SiteBrand;
  /** Resolved top-level page nav (fallback when there's no host menu). */
  nav: SiteNavItem[];
  /** Live navigation config (editor state) — drives the header menu + footer. */
  navigation: SiteNavigation;
  /** The page behind the menu — drops links hidden on it (per-page rules). */
  currentPageKey?: string;
  /** Builder: active device, so per-link styles preview for that screen size. */
  previewDevice?: "desktop" | "tablet" | "phone";
  conversion?: SiteConversion;
  layout?: "full" | "boxed";
  darkChrome?: boolean;
  bookHref?: string | null;
  websiteId?: string;
  sections: WebsiteSection[];
  data?: SiteData;
}) {
  return (
    <SiteThemeRoot theme={theme}>
      <SiteChrome
        brand={brand}
        nav={nav}
        navigation={navigation}
        currentPageKey={currentPageKey}
        previewDevice={previewDevice}
        conversion={conversion}
        layout={layout}
        darkChrome={darkChrome}
        header={theme.header}
        footer={theme.footer}
        bookHref={bookHref ?? undefined}
        websiteId={websiteId}
        chromeInert
      >
        <SectionRenderer
          sections={sections}
          data={data}
          asset={canvasAsset}
          interactive={false}
        />
      </SiteChrome>
    </SiteThemeRoot>
  );
}
