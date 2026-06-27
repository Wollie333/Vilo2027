import type { SafariNavLink } from "@/components/site/safari/SafariNav";

import { filterMenuForPage } from "./menuPage";
import type {
  SiteBrand,
  SiteFooterColumn,
  SiteMenuItem,
  SiteMenuStyle,
  SiteNavItem,
  SiteNavigation,
  SiteSocials,
} from "./types";

/** A resolved social link for the footer (only configured ones are included). */
export type SafariSocial = {
  key: keyof SiteSocials;
  href: string;
  label: string;
};

/** The Safari footer model, resolved from the host's navigation + brand. */
export type SafariFooterModel = {
  /** Short brand blurb (brand tagline, else the design's default). */
  blurb?: string | null;
  /** Link columns — the host's footer columns, else a sensible default. */
  columns: { heading?: string; links: SafariNavLink[] }[];
  copyright?: string | null;
  showPoweredBy: boolean;
  socials: SafariSocial[];
  /** Newsletter sign-up block (shown unless the host turns it off). */
  newsletter: {
    enabled: boolean;
    heading?: string | null;
    body?: string | null;
  };
};

/** Everything the Safari header + footer need, resolved from the host's config. */
/** Header layout (the nav manager's layout picker) — drives where the logo, menu
 *  and book button sit. Mirrors the generic SiteChrome header layouts. */
export type SafariHeaderLayout = "classic" | "centered" | "split" | "minimal";

export type SafariNavData = {
  /** Top-level links (with one level of dropdown children), hrefs preview-aware. */
  links: SafariNavLink[];
  /** Chosen header layout (host's `navigation.header.layout`, default classic). */
  layout: SafariHeaderLayout;
  /** Keep the header fixed/visible on scroll (header behaviour setting). */
  sticky: boolean;
  /** Transparent over the hero, fading to solid on scroll. Safari's natural look;
   *  default true (unset), false → a solid bar from the top. */
  transparent: boolean;
  /** Solid-bar background override (when not transparent). Blank → Safari paper. */
  bgColor?: string | null;
  /** Background the transparent bar fades to on scroll. Blank → Safari paper. */
  scrolledBgColor?: string | null;
  /** When the inline menu collapses to the ☰ drawer (header behaviour). */
  menuCollapse: "mobile" | "tablet" | "never";
  /** Logo lockup style (Elements): wordmark = name only, icon = mark only,
   *  mark = mark + name; unset = the design default. */
  logoStyle?: "wordmark" | "icon" | "mark" | null;
  menuStyle?: SiteMenuStyle | null;
  bookLabel: string;
  showBook: boolean;
  bookColor?: string | null;
  /** Header logo (real brand logo, with a light variant for the dark/transparent
   *  nav); falls back to the monogram when absent or hidden. */
  showLogo: boolean;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoMaxHeight?: number | null;
  tagline?: string | null;
  /** Announcement top bar (shown above the nav when the host enables it). */
  topBar: {
    enabled: boolean;
    message?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
  };
  /** Resolved footer (columns, copyright, powered-by, socials). */
  footer: SafariFooterModel;
};

const SOCIAL_LABEL: Record<keyof SiteSocials, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  website: "Website",
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
      id: c.id,
      label: c.label,
      href: navHref(c.href, preview),
      newTab: c.newTab,
      ...(c.style ? { style: c.style } : {}),
    }));
  return {
    id: item.id,
    label: item.label,
    href: navHref(item.href, preview),
    newTab: item.newTab,
    ...(item.style ? { style: item.style } : {}),
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
export function buildSafariNav(
  ctx: {
    nav: SiteNavItem[];
    navigation: SiteNavigation;
    brand: SiteBrand;
    preview: boolean;
    subdomain: string;
    previewThemeSlug?: string;
  },
  /** Current page key — drops links the host hid on this page (per-page rules). */
  pageKey?: string,
): SafariNavData {
  const preview: Preview | undefined = ctx.preview
    ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
    : undefined;

  const menu = filterMenuForPage(ctx.navigation.menu ?? [], pageKey);
  const links: SafariNavLink[] =
    menu && menu.length > 0
      ? menu.filter((i) => i.label?.trim()).map((i) => mapMenuItem(i, preview))
      : ctx.nav.map((n) => ({
          label: n.label,
          href: navHref(n.href, preview),
        }));

  const header = ctx.navigation.header ?? {};
  const brand = ctx.brand;

  // ── Footer ────────────────────────────────────────────────────────
  const footerCfg = ctx.navigation.footer ?? {};
  const cfgColumns = (footerCfg.columns ?? []).filter(
    (c) => c.heading?.trim() || "" || (c.links?.length ?? 0) > 0,
  );
  // The Safari footer design has room for two link columns (brand · col · col ·
  // newsletter), so cap there; the host can edit them in the footer builder.
  const contactHref = links.find((l) => /contact/i.test(l.label))?.href;
  const roomsHref = links.find((l) => /suite|room/i.test(l.label))?.href;
  const columns: SafariFooterModel["columns"] = cfgColumns.length
    ? cfgColumns.slice(0, 2).map((c: SiteFooterColumn) => ({
        heading: c.heading,
        links: (c.links ?? [])
          .filter((l) => l.label?.trim())
          .map((l) => ({ label: l.label, href: navHref(l.href, preview) })),
      }))
    : // Default: "Explore" (the menu) + "Visit" (reserve / getting here).
      [
        { heading: "Explore", links: links.slice(0, 5) },
        {
          heading: "Visit",
          links: [
            ...(roomsHref
              ? [{ label: "Reserve a suite", href: roomsHref }]
              : []),
            ...(contactHref
              ? [
                  { label: "Getting here", href: contactHref },
                  { label: "Transfers", href: contactHref },
                ]
              : []),
          ],
        },
      ];

  const socialEntries = Object.entries(brand.socials ?? {}) as [
    keyof SiteSocials,
    string | null | undefined,
  ][];
  const socials: SafariSocial[] = socialEntries
    .filter(([, href]) => href && href.trim())
    .map(([key, href]) => ({
      key,
      href: (href as string).trim(),
      label: SOCIAL_LABEL[key],
    }));

  // ── Per-page appearance/style override (transparent / bar colour / menu
  //    colour + size for THIS page) — merges over the global values. ──
  const override = pageKey ? ctx.navigation.perPage?.[pageKey] : undefined;
  const menuStyle =
    override &&
    (override.color ||
      override.hoverColor ||
      override.scrolledColor ||
      override.fontSize != null)
      ? {
          ...(ctx.navigation.menuStyle ?? {}),
          ...(override.color ? { color: override.color } : {}),
          ...(override.hoverColor ? { hoverColor: override.hoverColor } : {}),
          ...(override.scrolledColor
            ? { scrolledColor: override.scrolledColor }
            : {}),
          ...(override.fontSize != null ? { fontSize: override.fontSize } : {}),
        }
      : ctx.navigation.menuStyle;

  return {
    links,
    layout: (header.layout as SafariHeaderLayout) || "classic",
    sticky: header.sticky !== false,
    // Safari is transparent-over-hero by design; only an explicit `false` makes
    // it a solid bar from the top. A per-page override wins for this page.
    transparent:
      override?.transparentOverHero ?? header.transparentOverHero !== false,
    bgColor: override?.bgColor ?? header.bgColor,
    scrolledBgColor: header.scrolledBgColor,
    menuCollapse: header.menuCollapse ?? "mobile",
    logoStyle: header.logoStyle,
    menuStyle,
    bookLabel: header.ctaLabel?.trim() || "Reserve",
    showBook: header.showBookCta !== false,
    bookColor: header.bookCtaColor,
    showLogo: header.showLogo !== false,
    logoUrl: brand.logoUrl,
    logoLightUrl: brand.logoLightUrl ?? brand.logoUrl,
    logoMaxHeight: header.logoMaxHeight,
    tagline: header.tagline,
    topBar: {
      enabled: ctx.navigation.topBar?.enabled === true,
      message: ctx.navigation.topBar?.message,
      phone: ctx.navigation.topBar?.phone,
      whatsapp: ctx.navigation.topBar?.whatsapp,
      email: ctx.navigation.topBar?.email,
    },
    footer: {
      blurb: brand.tagline,
      columns,
      copyright: footerCfg.copyright,
      showPoweredBy: footerCfg.showPoweredBy !== false,
      socials,
      newsletter: {
        enabled: footerCfg.newsletter?.enabled !== false,
        heading: footerCfg.newsletter?.heading,
        body: footerCfg.newsletter?.body,
      },
    },
  };
}
