import {
  ChevronDown,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";
import type { ReactNode } from "react";

import { siteImageUrl } from "@/lib/site/image";
import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  type SiteFooterConfig,
  type SiteFooterLayout,
  type SiteHeaderConfig,
  type SiteHeaderLayout,
} from "@/lib/site/themes";
import type {
  SiteAnalyticsSettings,
  SiteBrand,
  SiteConversion,
  SiteFooterColumn,
  SiteFormDef,
  SiteMenuItem,
  SiteNavItem,
  SiteNavigation,
  SiteTopBar,
} from "@/lib/site/types";

import { AnnouncementBar } from "./AnnouncementBar";
import { PreviewBanner } from "./PreviewBanner";
import { SiteAnalytics } from "./SiteAnalytics";
import { SiteMarketing } from "./SiteMarketing";
import { SiteMobileMenu } from "./SiteMobileMenu";
import { SitePopup } from "./SitePopup";
import { StickyHeader } from "./StickyHeader";
import { WhatsAppButton } from "./WhatsAppButton";

type MenuCollapse = "mobile" | "tablet" | "never";

const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  website: Globe,
} as const;

/** Builder-only chrome editing: click the header/footer to select + edit it. */
export type ChromeTarget = "header" | "footer";
export type ChromeEditable = {
  selected: ChromeTarget | null;
  onSelect: (target: ChromeTarget) => void;
};

/**
 * Wraps the header/footer region in a click-to-select overlay when the chrome is
 * being edited inline in the page builder. On the public site (`editable`
 * undefined) it renders the children verbatim — zero markup/behaviour change.
 * In edit mode the region's own links are made inert (pointer-events: none) so a
 * click selects the region instead of navigating.
 */
function ChromeEditWrap({
  editable,
  target,
  label,
  children,
}: {
  editable?: ChromeEditable;
  target: ChromeTarget;
  label: string;
  children: ReactNode;
}) {
  if (!editable) return <>{children}</>;
  const selected = editable.selected === target;
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        editable.onSelect(target);
      }}
      style={{
        position: "relative",
        cursor: "pointer",
        outline: selected ? "2px solid #10B981" : "1px dashed transparent",
        outlineOffset: -2,
        transition: "outline-color .12s",
      }}
      className="vilo-chrome-edit"
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 40,
          background: selected ? "#10B981" : "#064E3B",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 8px",
          borderBottomRightRadius: 7,
          letterSpacing: ".02em",
          opacity: selected ? 1 : 0,
        }}
        className="vilo-chrome-label"
      >
        {label}
      </span>
      <div style={{ pointerEvents: "none" }}>{children}</div>
    </div>
  );
}

/**
 * Logo per chosen style: wordmark (name), icon (mark only), mark (logo+name).
 * On a dark chrome surface it prefers the light logo variant; on narrow screens
 * it swaps in the compact icon variant when one is set.
 */
function BrandLogo({
  brand,
  dark = false,
}: {
  brand: SiteBrand;
  dark?: boolean;
}) {
  const style = brand.logoStyle ?? "mark";
  const height = brand.logoMaxHeight ?? 40;
  const initial =
    brand.monogram?.trim().slice(0, 2).toUpperCase() ||
    (brand.name || "·").trim().charAt(0).toUpperCase();
  const primarySrc = (dark && brand.logoLightUrl) || brand.logoUrl || null;
  const nameEl = (
    <span
      style={{
        fontFamily: "var(--site-font-heading)",
        fontWeight: "var(--site-weight-heading)" as unknown as number,
        letterSpacing: "var(--site-tracking-heading)",
        color: "var(--site-ink)",
      }}
      className="truncate text-lg"
    >
      {brand.name}
    </span>
  );

  if (style === "wordmark") return nameEl;

  const imgCls = "w-auto object-contain";
  const markEl = primarySrc ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={siteImageUrl(primarySrc, { width: 360, quality: 85 })}
        alt={brand.name}
        style={{ height, maxWidth: 180 }}
        className={`${imgCls} ${brand.logoIconUrl ? "hidden sm:block" : ""}`}
      />
      {brand.logoIconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={siteImageUrl(brand.logoIconUrl, { width: 160, quality: 85 })}
          alt={brand.name}
          style={{ height }}
          className={`${imgCls} sm:hidden`}
        />
      ) : null}
    </>
  ) : (
    <span
      style={{
        background: "var(--site-accent)",
        color: "var(--site-accent-ink)",
        borderRadius: "var(--site-radius)",
        height,
        width: height,
      }}
      className="flex items-center justify-center text-sm font-bold"
    >
      {initial}
    </span>
  );

  if (style === "icon") return markEl;
  return (
    <span className="flex items-center gap-2.5">
      {markEl}
      {nameEl}
    </span>
  );
}

function Logo({
  brand,
  dark,
  preview,
}: {
  brand: SiteBrand;
  dark?: boolean;
  preview?: { subdomain: string; themeSlug?: string };
}) {
  const href = buildNavHref("/", preview);
  return (
    <a
      href={href}
      data-nav-page="home"
      className="flex min-w-0 items-center gap-2.5"
    >
      <BrandLogo brand={brand} dark={dark} />
    </a>
  );
}

function BookCta({ href, label }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      data-vilo-book
      style={{
        background: "var(--site-btn-primary-bg)",
        color: "var(--site-btn-primary-color)",
        border: "var(--site-btn-primary-border)",
        borderRadius: "var(--site-btn-primary-radius)",
      }}
      className="shrink-0 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
    >
      {label || "Book now"}
    </a>
  );
}

/** Thin contact/announcement strip above the header (phone / WhatsApp / email). */
function TopBar({ bar }: { bar: SiteTopBar }) {
  const phone = bar.phone?.trim();
  const wa = bar.whatsapp?.trim();
  const email = bar.email?.trim();
  const msg = bar.message?.trim();
  if (!phone && !wa && !email && !msg) return null;
  const waHref = wa ? `https://wa.me/${wa.replace(/[^\d]/g, "")}` : null;
  return (
    <div
      style={{ background: "var(--site-ink)", color: "var(--site-bg)" }}
      className="px-5 py-1.5 text-xs"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-1 sm:justify-between">
        {msg ? <span className="font-medium">{msg}</span> : <span />}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1 hover:opacity-80"
            >
              <Phone className="h-3 w-3" />
              {phone}
            </a>
          ) : null}
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:opacity-80"
            >
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </a>
          ) : null}
          {email ? (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1 hover:opacity-80"
            >
              <Mail className="h-3 w-3" />
              {email}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Convert an internal href like "/" or "/about" to a page key. */
function hrefToPageKey(href: string): string {
  if (href === "/" || href === "") return "home";
  // Strip leading slash and hash fragments
  const clean = href.replace(/^\//, "").split("#")[0];
  return clean || "home";
}

/** Build a preview-aware href for navigation links. */
function buildNavHref(
  href: string,
  preview?: { subdomain: string; themeSlug?: string },
): string {
  // External links pass through unchanged
  if (href.startsWith("http")) return href;
  // No preview mode — use regular href
  if (!preview) return href;

  // In preview mode, build a URL that preserves preview params
  const params = new URLSearchParams();
  params.set("site", preview.subdomain);
  params.set("preview", "1");
  if (preview.themeSlug) params.set("theme", preview.themeSlug);

  // Normalize path: "/" becomes "/site", "/about" becomes "/site/about"
  const cleanPath = href.startsWith("/") ? href : `/${href}`;
  const basePath = cleanPath === "/" ? "/site" : `/site${cleanPath}`;

  return `${basePath}?${params.toString()}`;
}

function NavLinks({
  nav,
  className = "",
  preview,
}: {
  nav: SiteNavItem[];
  className?: string;
  preview?: { subdomain: string; themeSlug?: string };
}) {
  if (nav.length === 0) return null;

  return (
    <nav className={className}>
      {nav.map((item, index) => {
        // Add data-nav-page for internal links so preview mode can intercept
        const isExternal = item.href.startsWith("http");
        const href = buildNavHref(item.href, preview);
        return (
          <a
            key={`${item.href}-${index}`}
            href={href}
            data-nav-page={isExternal ? undefined : hrefToPageKey(item.href)}
            style={{ color: "var(--site-mute)" }}
            className="text-sm font-medium transition-colors hover:opacity-80"
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

type PreviewCtx = { subdomain: string; themeSlug?: string };

function MenuLink({
  item,
  className = "",
  preview,
}: {
  item: SiteMenuItem;
  className?: string;
  preview?: PreviewCtx;
}) {
  const isExternal = item.href.startsWith("http");
  const href = buildNavHref(item.href, preview);
  return (
    <a
      href={href}
      target={item.newTab ? "_blank" : undefined}
      rel={item.newTab ? "noopener noreferrer" : undefined}
      data-nav-page={isExternal ? undefined : hrefToPageKey(item.href)}
      style={{ color: "var(--site-mute)" }}
      className={`transition-colors hover:opacity-80 ${className}`}
    >
      {item.label}
    </a>
  );
}

/** Header menu with one level of (CSS hover/focus) dropdowns — no client JS. */
function MenuNav({
  menu,
  className = "",
  preview,
}: {
  menu: SiteMenuItem[];
  className?: string;
  preview?: PreviewCtx;
}) {
  if (menu.length === 0) return null;
  return (
    <nav className={className}>
      {menu.map((item) =>
        item.children && item.children.length > 0 ? (
          <div key={item.id} className="group relative">
            <button
              type="button"
              style={{ color: "var(--site-mute)" }}
              className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
            >
              {item.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="invisible absolute left-0 top-full z-30 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div
                style={{
                  background: "var(--site-surface)",
                  border: "1px solid var(--site-line)",
                  borderRadius: "var(--site-radius)",
                }}
                className="min-w-[180px] py-1.5 shadow-lift"
              >
                {item.children.map((child) => (
                  <MenuLink
                    key={child.id}
                    item={child}
                    preview={preview}
                    className="block px-4 py-2 text-sm font-medium"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <MenuLink
            key={item.id}
            item={item}
            preview={preview}
            className="text-sm font-medium"
          />
        ),
      )}
    </nav>
  );
}

/**
 * Responsive header menu: the full inline menu (desktop hover-dropdowns) at/above
 * the collapse breakpoint, and a hamburger drawer below it. `collapse` lets the
 * host choose when it collapses — phones only, tablets too, or never.
 */
function HeaderMenu({
  menu,
  collapse,
  navClassName,
  bookHref,
  bookLabel,
  dark,
  preview,
}: {
  menu: SiteMenuItem[];
  collapse: MenuCollapse;
  navClassName: string;
  bookHref?: string;
  bookLabel?: string;
  dark?: boolean;
  preview?: PreviewCtx;
}) {
  if (menu.length === 0) return null;
  if (collapse === "never") {
    return (
      <MenuNav
        menu={menu}
        className={`flex ${navClassName}`}
        preview={preview}
      />
    );
  }
  const fullShow = collapse === "tablet" ? "hidden lg:flex" : "hidden md:flex";
  const burgerShow = collapse === "tablet" ? "lg:hidden" : "md:hidden";
  return (
    <>
      <MenuNav
        menu={menu}
        className={`${fullShow} ${navClassName}`}
        preview={preview}
      />
      <SiteMobileMenu
        menu={menu}
        bookHref={bookHref}
        bookLabel={bookLabel}
        dark={dark}
        className={burgerShow}
      />
    </>
  );
}

function ContactLinks({ brand }: { brand: SiteBrand }) {
  if (!brand.contactEmail && !brand.contactPhone) return null;
  return (
    <div
      style={{ color: "var(--site-mute)" }}
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
    >
      {brand.contactEmail ? (
        <a
          href={`mailto:${brand.contactEmail}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
        >
          <Mail className="h-3.5 w-3.5" />
          {brand.contactEmail}
        </a>
      ) : null}
      {brand.contactPhone ? (
        <a
          href={`tel:${brand.contactPhone}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
        >
          <Phone className="h-3.5 w-3.5" />
          {brand.contactPhone}
        </a>
      ) : null}
    </div>
  );
}

function SocialLinks({ brand }: { brand: SiteBrand }) {
  if (!brand.socials) return null;
  const keys = Object.keys(SOCIAL_ICONS) as Array<keyof typeof SOCIAL_ICONS>;
  if (!keys.some((k) => brand.socials?.[k])) return null;
  return (
    <div className="flex items-center gap-3">
      {keys.map((key) => {
        const url = brand.socials?.[key];
        if (!url) return null;
        const Icon = SOCIAL_ICONS[key];
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={key}
            style={{
              background: "var(--site-social-bg)",
              color: "var(--site-social-fg)",
              border: "var(--site-social-border)",
              borderRadius: "var(--site-social-radius)",
            }}
            className="flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-80"
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}

// ── Header layout variants ────────────────────────────────
function HeaderInner({
  variant,
  brand,
  menu,
  collapse,
  bookHref,
  bookLabel,
  dark,
  preview,
}: {
  variant: SiteHeaderLayout;
  brand: SiteBrand;
  menu: SiteMenuItem[];
  collapse: MenuCollapse;
  bookHref?: string;
  bookLabel?: string;
  dark?: boolean;
  preview?: { subdomain: string; themeSlug?: string };
}) {
  if (variant === "centered") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 py-4">
        <Logo brand={brand} dark={dark} preview={preview} />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <HeaderMenu
            menu={menu}
            collapse={collapse}
            navClassName="flex-wrap items-center gap-x-6 gap-y-2"
            bookHref={bookHref}
            bookLabel={bookLabel}
            dark={dark}
            preview={preview}
          />
          {bookHref ? <BookCta href={bookHref} label={bookLabel} /> : null}
        </div>
      </div>
    );
  }
  if (variant === "minimal") {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Logo brand={brand} dark={dark} preview={preview} />
        <div className="flex items-center gap-2">
          {bookHref ? <BookCta href={bookHref} label={bookLabel} /> : null}
          {/* Minimal stays compact: the menu is always a hamburger drawer. */}
          {menu.length > 0 ? (
            <SiteMobileMenu
              menu={menu}
              bookHref={bookHref}
              bookLabel={bookLabel}
              dark={dark}
            />
          ) : null}
        </div>
      </div>
    );
  }
  // classic — logo left · nav · book right
  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
      <Logo brand={brand} dark={dark} preview={preview} />
      <HeaderMenu
        menu={menu}
        collapse={collapse}
        navClassName="items-center gap-6"
        bookHref={bookHref}
        bookLabel={bookLabel}
        dark={dark}
        preview={preview}
      />
      {bookHref ? <BookCta href={bookHref} label={bookLabel} /> : null}
    </div>
  );
}

// ── Footer layout variants ────────────────────────────────
function FooterBrandName({ brand }: { brand: SiteBrand }) {
  return (
    <span
      style={{
        fontFamily: "var(--site-font-heading)",
        fontWeight: "var(--site-weight-heading)" as unknown as number,
        letterSpacing: "var(--site-tracking-heading)",
        color: "var(--site-ink)",
      }}
      className="text-base"
    >
      {brand.name}
    </span>
  );
}

function FooterInner({
  variant,
  brand,
  nav,
  preview,
}: {
  variant: SiteFooterLayout;
  brand: SiteBrand;
  nav: SiteNavItem[];
  preview?: { subdomain: string; themeSlug?: string };
}) {
  if (variant === "columns") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <FooterBrandName brand={brand} />
          <ContactLinks brand={brand} />
          <SocialLinks brand={brand} />
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <NavLinks
            nav={nav}
            className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end"
            preview={preview}
          />
          <span style={{ color: "var(--site-mute)" }} className="text-xs">
            © {brand.name}
          </span>
        </div>
      </div>
    );
  }
  if (variant === "simple") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <FooterBrandName brand={brand} />
        <SocialLinks brand={brand} />
        <span style={{ color: "var(--site-mute)" }} className="text-xs">
          © {brand.name}
        </span>
      </div>
    );
  }
  // centered — brand · nav · contact · socials · copyright (all centered)
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 py-10 text-center">
      <FooterBrandName brand={brand} />
      <NavLinks
        nav={nav}
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        preview={preview}
      />
      <ContactLinks brand={brand} />
      <SocialLinks brand={brand} />
      <span style={{ color: "var(--site-mute)" }} className="text-xs">
        © {brand.name}
      </span>
    </div>
  );
}

/** Widget-column footer (host-built). Brand + social, then custom link columns. */
function FooterColumns({
  brand,
  columns,
  copyright,
  preview,
}: {
  brand: SiteBrand;
  columns: SiteFooterColumn[];
  copyright?: string | null;
  preview?: PreviewCtx;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12">
      <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-3">
          <FooterBrandName brand={brand} />
          {brand.tagline ? (
            <p style={{ color: "var(--site-mute)" }} className="text-sm">
              {brand.tagline}
            </p>
          ) : null}
          <SocialLinks brand={brand} />
        </div>
        {columns.map((col) => (
          <div key={col.id} className="flex flex-col gap-2">
            {col.heading ? (
              <span
                style={{ color: "var(--site-ink)" }}
                className="text-sm font-semibold"
              >
                {col.heading}
              </span>
            ) : null}
            {col.links.map((l) => (
              <MenuLink
                key={l.id}
                item={l}
                preview={preview}
                className="text-sm"
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{ borderColor: "var(--site-line)", color: "var(--site-mute)" }}
        className="mt-8 border-t pt-5 text-center text-xs"
      >
        {copyright?.trim() || `© ${brand.name}`}
      </div>
    </div>
  );
}

/**
 * Header + footer for a tenant micro-site, themed off `--site-*` vars. The
 * header/footer LAYOUT is chosen per theme (Phase 5.5) with separate desktop +
 * mobile variants — both are rendered and toggled at the `md` breakpoint, so
 * each viewport uses its own layout. Pure presentational.
 *
 * When `analyticsWebsiteId` is set (public render, never preview) a cookieless
 * pageview beacon is mounted (Phase 0A).
 *
 * Internal nav links include `data-nav-page` attributes with the page key,
 * which the Brand Studio preview can intercept via event delegation to stay
 * on the same URL while switching pages.
 *
 * When `preview` is set, a black banner shows at the top indicating preview
 * mode, and nav links preserve the preview/theme query params.
 */
export function SiteChrome({
  brand,
  nav,
  bookHref,
  analyticsWebsiteId,
  darkChrome = false,
  header = DEFAULT_HEADER,
  footer = DEFAULT_FOOTER,
  preview,
  navigation = {},
  conversion = {},
  analytics = {},
  popupForm = null,
  websiteId,
  editable,
  layout = "full",
  children,
}: {
  brand: SiteBrand;
  nav: SiteNavItem[];
  bookHref?: string;
  analyticsWebsiteId?: string;
  /** Site width: "full" = edge-to-edge (default); "boxed" = centred max-width. */
  layout?: "full" | "boxed";
  /** Chrome surface resolves dark → prefer the light logo variant. */
  darkChrome?: boolean;
  header?: SiteHeaderConfig;
  footer?: SiteFooterConfig;
  /** Preview mode context — shows banner and preserves params in nav links. */
  preview?: { subdomain: string; themeSlug?: string };
  navigation?: SiteNavigation;
  /** Conversion chrome (WhatsApp button + announcement bar + pop-up). */
  conversion?: SiteConversion;
  /** Host third-party analytics (GA4 + Meta Pixel + consent gate). */
  analytics?: SiteAnalyticsSettings;
  /** Resolved definition of the pop-up's embedded form (when one is set). */
  popupForm?: SiteFormDef | null;
  /** The site id — lets the pop-up's embedded form submit. */
  websiteId?: string;
  /** Builder-only: makes the header/footer click-to-select for inline editing. */
  editable?: ChromeEditable;
  children: ReactNode;
}) {
  const bookLabel = navigation.header?.ctaLabel?.trim() || undefined;
  const effectiveBookHref = navigation.header?.ctaHref?.trim() || bookHref;
  const sticky = navigation.header?.sticky !== false;
  const menuCollapse: MenuCollapse =
    navigation.header?.menuCollapse ?? "mobile";
  const topBar = navigation.topBar;
  // Explicit menu wins; otherwise fall back to the page-derived nav.
  const menu: SiteMenuItem[] =
    navigation.menu && navigation.menu.length > 0
      ? navigation.menu
      : nav.map((n) => ({ id: n.href, label: n.label, href: n.href }));
  const flatNav: SiteNavItem[] = menu.map((m) => ({
    label: m.label,
    href: m.href,
  }));
  const footerColumns = navigation.footer?.columns ?? [];
  // Transparent-over-hero and a top bar can't coexist (the fixed header would
  // overlay the top bar) — the top bar wins.
  const transparentOver =
    navigation.header?.transparentOverHero === true && !topBar?.enabled;
  const headerDark = transparentOver || darkChrome;
  const boxed = layout === "boxed";
  const body = (
    <div
      className="flex min-h-screen w-full flex-col"
      style={
        boxed
          ? {
              maxWidth: 1280,
              marginInline: "auto",
              background: "var(--site-bg)",
              boxShadow: "0 0 60px rgba(0,0,0,0.12)",
            }
          : undefined
      }
    >
      {analyticsWebsiteId ? (
        <SiteAnalytics websiteId={analyticsWebsiteId} />
      ) : null}

      {/* Preview mode banner */}
      {preview ? (
        <PreviewBanner
          subdomain={preview.subdomain}
          themeSlug={preview.themeSlug}
        />
      ) : null}

      <AnnouncementBar
        announcement={conversion.announcement}
        preview={Boolean(preview)}
      />

      <ChromeEditWrap editable={editable} target="header" label="Header">
        {topBar?.enabled ? <TopBar bar={topBar} /> : null}

        <StickyHeader sticky={sticky} transparent={transparentOver}>
          <div className="hidden md:block">
            <HeaderInner
              variant={header.desktop}
              brand={brand}
              menu={menu}
              collapse={menuCollapse}
              bookHref={effectiveBookHref}
              bookLabel={bookLabel}
              dark={headerDark}
              preview={preview}
            />
          </div>
          <div className="md:hidden">
            <HeaderInner
              variant={header.mobile}
              brand={brand}
              menu={menu}
              collapse={menuCollapse}
              bookHref={effectiveBookHref}
              bookLabel={bookLabel}
              dark={headerDark}
              preview={preview}
            />
          </div>
        </StickyHeader>
      </ChromeEditWrap>

      <main className="flex-1">{children}</main>

      <ChromeEditWrap editable={editable} target="footer" label="Footer">
        <footer
          style={{
            background: "var(--site-surface)",
            borderColor: "var(--site-line)",
          }}
          className="border-t"
        >
          {footerColumns.length > 0 ? (
            <FooterColumns
              brand={brand}
              columns={footerColumns}
              copyright={navigation.footer?.copyright}
              preview={preview}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <FooterInner
                  variant={footer.desktop}
                  brand={brand}
                  nav={flatNav}
                  preview={preview}
                />
              </div>
              <div className="md:hidden">
                <FooterInner
                  variant={footer.mobile}
                  brand={brand}
                  nav={flatNav}
                  preview={preview}
                />
              </div>
            </>
          )}
          {navigation.footer?.showPoweredBy !== false ? (
            <div
              style={{ borderColor: "var(--site-line)" }}
              className="border-t"
            >
              <p
                style={{ color: "var(--site-mute)" }}
                className="mx-auto w-full max-w-5xl px-5 py-3 text-center text-[11px]"
              >
                Powered by Vilo
              </p>
            </div>
          ) : null}
        </footer>
      </ChromeEditWrap>

      <WhatsAppButton whatsapp={conversion.whatsapp} />

      <SitePopup
        popup={conversion.popup}
        form={popupForm}
        websiteId={websiteId}
        interactive={!preview}
      />

      <SiteMarketing analytics={analytics} interactive={!preview} />
    </div>
  );
  if (!boxed) return body;
  // Boxed: centre the site in a contained column over a subtle backdrop.
  return (
    <div
      className="flex justify-center"
      style={{
        background: "color-mix(in srgb, var(--site-ink) 8%, var(--site-bg))",
      }}
    >
      {body}
    </div>
  );
}
