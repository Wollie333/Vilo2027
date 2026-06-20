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

import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  type SiteFooterConfig,
  type SiteFooterLayout,
  type SiteHeaderConfig,
  type SiteHeaderLayout,
} from "@/lib/site/themes";
import type {
  SiteBrand,
  SiteMenuItem,
  SiteNavItem,
  SiteNavigation,
  SiteTopBar,
} from "@/lib/site/types";

import { PreviewBanner } from "./PreviewBanner";
import { SiteAnalytics } from "./SiteAnalytics";

const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  website: Globe,
} as const;

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
        src={primarySrc}
        alt={brand.name}
        style={{ height, maxWidth: 180 }}
        className={`${imgCls} ${brand.logoIconUrl ? "hidden sm:block" : ""}`}
      />
      {brand.logoIconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoIconUrl}
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
      {nav.map((item) => {
        // Add data-nav-page for internal links so preview mode can intercept
        const isExternal = item.href.startsWith("http");
        const href = buildNavHref(item.href, preview);
        return (
          <a
            key={item.href}
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
  bookHref,
  bookLabel,
  dark,
  preview,
}: {
  variant: SiteHeaderLayout;
  brand: SiteBrand;
  menu: SiteMenuItem[];
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
          <MenuNav
            menu={menu}
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
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
        {bookHref ? <BookCta href={bookHref} label={bookLabel} /> : null}
      </div>
    );
  }
  // classic — logo left · nav · book right
  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
      <Logo brand={brand} dark={dark} preview={preview} />
      <MenuNav
        menu={menu}
        className="flex items-center gap-6"
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
  children,
}: {
  brand: SiteBrand;
  nav: SiteNavItem[];
  bookHref?: string;
  analyticsWebsiteId?: string;
  /** Chrome surface resolves dark → prefer the light logo variant. */
  darkChrome?: boolean;
  header?: SiteHeaderConfig;
  footer?: SiteFooterConfig;
  /** Preview mode context — shows banner and preserves params in nav links. */
  preview?: { subdomain: string; themeSlug?: string };
  navigation?: SiteNavigation;
  children: ReactNode;
}) {
  const bookLabel = navigation.header?.ctaLabel?.trim() || undefined;
  const effectiveBookHref = navigation.header?.ctaHref?.trim() || bookHref;
  const sticky = navigation.header?.sticky !== false;
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
  return (
    <div className="flex min-h-screen flex-col">
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

      {topBar?.enabled ? <TopBar bar={topBar} /> : null}

      <header
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
        }}
        className={`${sticky ? "sticky top-0 z-20" : ""}border-b`}
      >
        <div className="hidden md:block">
          <HeaderInner
            variant={header.desktop}
            brand={brand}
            menu={menu}
            bookHref={effectiveBookHref}
            bookLabel={bookLabel}
            dark={darkChrome}
            preview={preview}
          />
        </div>
        <div className="md:hidden">
          <HeaderInner
            variant={header.mobile}
            brand={brand}
            menu={menu}
            bookHref={effectiveBookHref}
            bookLabel={bookLabel}
            dark={darkChrome}
            preview={preview}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
        }}
        className="border-t"
      >
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
        {navigation.footer?.showPoweredBy !== false ? (
          <div style={{ borderColor: "var(--site-line)" }} className="border-t">
            <p
              style={{ color: "var(--site-mute)" }}
              className="mx-auto w-full max-w-5xl px-5 py-3 text-center text-[11px]"
            >
              Powered by Vilo
            </p>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
