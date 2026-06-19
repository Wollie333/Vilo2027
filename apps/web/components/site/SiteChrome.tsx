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
  // "mark" — logo/mark + name
  return (
    <span className="flex items-center gap-2.5">
      {markEl}
      {nameEl}
    </span>
  );
}

/**
 * Header + footer for a tenant micro-site, themed off `--site-*` vars. Pure
 * presentational; nav links are plain anchors (the site is its own host, not the
 * app's i18n router). An optional Book CTA deep-links into the booking engine.
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
  children,
}: {
  brand: SiteBrand;
  nav: SiteNavItem[];
  bookHref?: string;
  analyticsWebsiteId?: string;
  /** Chrome surface resolves dark → prefer the light logo variant. */
  darkChrome?: boolean;
  children: ReactNode;
}) {
  const year = "©"; // year stamped by the caller if needed; avoid Date in render

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
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandLogo brand={brand} dark={darkChrome} />
          </a>

          <nav className="hidden items-center gap-6 md:flex">
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

          {bookHref ? (
            <a
              href={bookHref}
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
          ) : null}
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
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 py-10 text-center">
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
          {nav.length > 0 ? (
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{ color: "var(--site-mute)" }}
                  className="text-sm transition-colors hover:opacity-80"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}

          {brand.contactEmail || brand.contactPhone ? (
            <div
              style={{ color: "var(--site-mute)" }}
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm"
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
          ) : null}

          {brand.socials ? (
            <div className="flex items-center justify-center gap-3">
              {(
                Object.keys(SOCIAL_ICONS) as Array<keyof typeof SOCIAL_ICONS>
              ).map((key) => {
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
          ) : null}

          <span style={{ color: "var(--site-mute)" }} className="text-xs">
            {year} {brand.name}
          </span>
        </div>
      </footer>
    </div>
  );
}
