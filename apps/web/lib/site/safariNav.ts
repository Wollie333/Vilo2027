import type { SafariNavLink } from "@/components/site/safari/SafariNav";

import type {
  SiteMenuItem,
  SiteMenuStyle,
  SiteNavItem,
  SiteNavigation,
} from "./types";

/** Everything the Safari header needs, resolved from the host's navigation. */
export type SafariNavData = {
  /** Top-level links (with one level of dropdown children), hrefs preview-aware. */
  links: SafariNavLink[];
  menuStyle?: SiteMenuStyle | null;
  bookLabel: string;
  showBook: boolean;
  bookColor?: string | null;
};

type Preview = { subdomain: string; themeSlug?: string };

/** Same path rule as SiteChrome.buildNavHref — external untouched; in preview a
 *  site path becomes `/site/<path>?site=…&preview=1&theme=…`. */
function navHref(href: string, preview?: Preview): string {
  if (!href || href.startsWith("http")) return href || "#";
  if (!preview) return href;
  const p = new URLSearchParams();
  p.set("site", preview.subdomain);
  p.set("preview", "1");
  if (preview.themeSlug) p.set("theme", preview.themeSlug);
  const clean = href.startsWith("/") ? href : `/${href}`;
  const base = clean === "/" ? "/site" : `/site${clean}`;
  return `${base}?${p.toString()}`;
}

function mapMenuItem(item: SiteMenuItem, preview?: Preview): SafariNavLink {
  const children = (item.children ?? [])
    .filter((c) => c.label?.trim())
    .map((c) => ({
      label: c.label,
      href: navHref(c.href, preview),
      newTab: c.newTab,
    }));
  return {
    label: item.label,
    href: navHref(item.href, preview),
    newTab: item.newTab,
    ...(children.length ? { children } : {}),
  };
}

/**
 * Build the Safari header model from the live site context. Prefers the host's
 * built menu (`navigation.menu`, already auto-rooms-expanded by the loader) so
 * the host has full control; falls back to the page-derived nav when no menu is
 * configured. Book button + menu styling come straight from the host's header
 * settings.
 */
export function buildSafariNav(ctx: {
  nav: SiteNavItem[];
  navigation: SiteNavigation;
  preview: boolean;
  subdomain: string;
  previewThemeSlug?: string;
}): SafariNavData {
  const preview: Preview | undefined = ctx.preview
    ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
    : undefined;

  const menu = ctx.navigation.menu;
  const links: SafariNavLink[] =
    menu && menu.length > 0
      ? menu.filter((i) => i.label?.trim()).map((i) => mapMenuItem(i, preview))
      : ctx.nav.map((n) => ({
          label: n.label,
          href: navHref(n.href, preview),
        }));

  const header = ctx.navigation.header ?? {};
  return {
    links,
    menuStyle: ctx.navigation.menuStyle,
    bookLabel: header.ctaLabel?.trim() || "Reserve",
    showBook: header.showBookCta !== false,
    bookColor: header.bookCtaColor,
  };
}
