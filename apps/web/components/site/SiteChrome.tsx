import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
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
import type { SiteBrand, SiteNavItem } from "@/lib/site/types";

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

function Logo({ brand, dark }: { brand: SiteBrand; dark?: boolean }) {
  return (
    <a href="/" className="flex min-w-0 items-center gap-2.5">
      <BrandLogo brand={brand} dark={dark} />
    </a>
  );
}

function BookCta({ href }: { href: string }) {
  return (
    <a
      href={href}
      data-vilo-book
      style={{
        background: "var(--site-accent)",
        color: "var(--site-accent-ink)",
        borderRadius: "var(--site-radius)",
      }}
      className="shrink-0 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
    >
      Book now
    </a>
  );
}

function NavLinks({
  nav,
  className = "",
}: {
  nav: SiteNavItem[];
  className?: string;
}) {
  if (nav.length === 0) return null;
  return (
    <nav className={className}>
      {nav.map((item) => (
        <a
          key={item.href}
          href={item.href}
          style={{ color: "var(--site-mute)" }}
          className="text-sm font-medium transition-colors hover:opacity-80"
        >
          {item.label}
        </a>
      ))}
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
  nav,
  bookHref,
  dark,
}: {
  variant: SiteHeaderLayout;
  brand: SiteBrand;
  nav: SiteNavItem[];
  bookHref?: string;
  dark?: boolean;
}) {
  if (variant === "centered") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 py-4">
        <Logo brand={brand} dark={dark} />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <NavLinks
            nav={nav}
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
          />
          {bookHref ? <BookCta href={bookHref} /> : null}
        </div>
      </div>
    );
  }
  if (variant === "minimal") {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Logo brand={brand} dark={dark} />
        {bookHref ? <BookCta href={bookHref} /> : null}
      </div>
    );
  }
  // classic — logo left · nav · book right
  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
      <Logo brand={brand} dark={dark} />
      <NavLinks nav={nav} className="flex items-center gap-6" />
      {bookHref ? <BookCta href={bookHref} /> : null}
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
}: {
  variant: SiteFooterLayout;
  brand: SiteBrand;
  nav: SiteNavItem[];
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
 */
export function SiteChrome({
  brand,
  nav,
  bookHref,
  analyticsWebsiteId,
  darkChrome = false,
  header = DEFAULT_HEADER,
  footer = DEFAULT_FOOTER,
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
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {analyticsWebsiteId ? (
        <SiteAnalytics websiteId={analyticsWebsiteId} />
      ) : null}

      <header
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
        }}
        className="sticky top-0 z-20 border-b"
      >
        <div className="hidden md:block">
          <HeaderInner
            variant={header.desktop}
            brand={brand}
            nav={nav}
            bookHref={bookHref}
            dark={darkChrome}
          />
        </div>
        <div className="md:hidden">
          <HeaderInner
            variant={header.mobile}
            brand={brand}
            nav={nav}
            bookHref={bookHref}
            dark={darkChrome}
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
          <FooterInner variant={footer.desktop} brand={brand} nav={nav} />
        </div>
        <div className="md:hidden">
          <FooterInner variant={footer.mobile} brand={brand} nav={nav} />
        </div>
      </footer>
    </div>
  );
}
