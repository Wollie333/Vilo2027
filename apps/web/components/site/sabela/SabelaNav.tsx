"use client";

import { useEffect, useState } from "react";

import { BurgerGlyph } from "@/components/site/BurgerGlyph";
import type { SafariHeaderLayout, SafariNavData } from "@/lib/site/safariNav";
import type {
  LogoOverride,
  MenuItemStyleLayer,
  SiteMenuStyle,
} from "@/lib/site/types";

import type { SafariNavLink } from "../safari/SafariNav";

/** Sabela reuses the theme-agnostic nav link model resolved by buildSafariNav. */
export type SabelaNavLink = SafariNavLink;

const WEIGHT: Record<NonNullable<SiteMenuStyle["weight"]>, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/** True when a #rrggbb colour is dark enough to need light text on top. */
function isDarkColor(hex?: string | null): boolean {
  const c = (hex || "").trim().replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

/** Scoped CSS that applies the host's menu style to the Sabela header + drawer.
 *  The scrolled-state colour uses `.nav.scrolled` (Sabela's solid-on-scroll
 *  class). With no colour set, the design's adaptive default is left untouched. */
function menuStyleCss(style?: SiteMenuStyle | null): string {
  if (!style) return "";
  const color = style.color?.trim();
  const hover = style.hoverColor?.trim() || color;
  const weight = style.weight ? WEIGHT[style.weight] : undefined;
  const rules: string[] = [];
  const type: string[] = [];
  if (weight) type.push(`font-weight:${weight}`);
  if (style.uppercase) type.push("text-transform:uppercase");
  if (type.length)
    rules.push(
      `.wielo-sabela .nav-links a,.wielo-sabela .mnav-links a{${type.join(";")}}`,
    );
  if (color)
    rules.push(
      `.wielo-sabela .nav-links a,.wielo-sabela .mnav-links a{color:${color};opacity:1}`,
    );
  if (hover)
    rules.push(
      `.wielo-sabela .nav-links a:hover,.wielo-sabela .mnav-links a:hover{color:${hover};opacity:1}`,
    );
  const scrolledColor = style.scrolledColor?.trim();
  const scrolledHover = style.scrolledHoverColor?.trim() || scrolledColor;
  if (scrolledColor)
    rules.push(
      `.wielo-sabela .nav.scrolled .nav-links a{color:${scrolledColor};opacity:1}`,
    );
  if (scrolledHover)
    rules.push(
      `.wielo-sabela .nav.scrolled .nav-links a:hover{color:${scrolledHover};opacity:1}`,
    );
  if (typeof style.itemGap === "number")
    rules.push(`.wielo-sabela .nav-links{gap:${style.itemGap}px}`);
  const subColor = style.submenuColor?.trim();
  const subHover = style.submenuHoverColor?.trim() || subColor;
  const subBg = style.submenuBg?.trim();
  if (subBg)
    rules.push(
      `.wielo-sabela .nav-sub{background:${subBg};border-color:${subBg}}`,
    );
  if (subColor)
    rules.push(
      `.wielo-sabela .nav-sub a,.wielo-sabela .mnav-sub a{color:${subColor}}`,
    );
  if (subHover)
    rules.push(
      `.wielo-sabela .nav-sub a:hover,.wielo-sabela .mnav-sub a:hover{color:${subHover}}`,
    );
  if (typeof style.fontSize === "number")
    rules.push(`.wielo-sabela .nav-links a{font-size:${style.fontSize}px}`);

  const tb = style.tablet;
  if (tb) {
    const tr: string[] = [];
    if (tb.color?.trim()) tr.push(`color:${tb.color.trim()}`);
    if (typeof tb.fontSize === "number") tr.push(`font-size:${tb.fontSize}px`);
    if (tb.weight) tr.push(`font-weight:${WEIGHT[tb.weight]}`);
    if (tb.uppercase !== undefined)
      tr.push(`text-transform:${tb.uppercase ? "uppercase" : "none"}`);
    const parts: string[] = [];
    if (tr.length) parts.push(`.wielo-sabela .nav-links a{${tr.join(";")}}`);
    if (tb.hoverColor?.trim())
      parts.push(
        `.wielo-sabela .nav-links a:hover{color:${tb.hoverColor.trim()}}`,
      );
    if (parts.length)
      rules.push(`@media (max-width:1024px){${parts.join("")}}`);
  }

  const mb = style.mobile;
  if (mb) {
    if (mb.overlayBg?.trim())
      rules.push(`.wielo-sabela .mnav{background:${mb.overlayBg.trim()}}`);
    const mr: string[] = [];
    if (mb.color?.trim()) mr.push(`color:${mb.color.trim()}`);
    if (typeof mb.fontSize === "number") mr.push(`font-size:${mb.fontSize}px`);
    if (mb.weight) mr.push(`font-weight:${WEIGHT[mb.weight]}`);
    if (mb.uppercase !== undefined)
      mr.push(`text-transform:${mb.uppercase ? "uppercase" : "none"}`);
    if (mr.length) rules.push(`.wielo-sabela .mnav-links a{${mr.join(";")}}`);
    if (mb.hoverColor?.trim())
      rules.push(
        `.wielo-sabela .mnav-links a:hover{color:${mb.hoverColor.trim()}}`,
      );
  }
  return rules.join("");
}

/** One style layer → CSS declarations (no selector). */
function itemLayerDecls(s: MenuItemStyleLayer): string {
  const out: string[] = [];
  if (s.color?.trim()) out.push(`color:${s.color.trim()};opacity:1`);
  if (typeof s.fontSize === "number") out.push(`font-size:${s.fontSize}px`);
  if (s.weight) out.push(`font-weight:${WEIGHT[s.weight]}`);
  if (s.uppercase !== undefined)
    out.push(`text-transform:${s.uppercase ? "uppercase" : "none"}`);
  if (s.bg?.trim()) out.push(`background:${s.bg.trim()};display:inline-block`);
  if (s.pill) out.push("border-radius:9999px;padding:.35em 1em");
  return out.join(";");
}
const mergeLayers = (
  base: MenuItemStyleLayer,
  over?: MenuItemStyleLayer,
): MenuItemStyleLayer => ({ ...base, ...(over ?? {}) });

/** Scoped CSS for per-link styling (the selected-link Style controls). */
function menuItemStyleCss(
  links: SabelaNavLink[],
  previewDevice?: "desktop" | "tablet" | "phone",
): string {
  const rules: string[] = [];
  const walk = (list: SabelaNavLink[]) => {
    for (const l of list) {
      const st = l.style;
      if (l.id && st) {
        const id = l.id;
        const inlineSel = `.wielo-sabela .nav-links a.mi-${id},.wielo-sabela .nav-sub a.mi-${id}`;
        const drawerSel = `.wielo-sabela .mnav-links a.mi-${id},.wielo-sabela .mnav-sub a.mi-${id},.wielo-sabela .mnav-parent.mi-${id}`;
        const desktop: MenuItemStyleLayer = {
          color: st.color,
          hoverColor: st.hoverColor,
          fontSize: st.fontSize,
          weight: st.weight,
          uppercase: st.uppercase,
          bg: st.bg,
          pill: st.pill,
        };
        const inlineLayer =
          previewDevice === "tablet"
            ? mergeLayers(desktop, st.tablet)
            : desktop;
        const inlineDecls = itemLayerDecls(inlineLayer);
        if (inlineDecls) rules.push(`${inlineSel}{${inlineDecls}}`);
        const inlineHover = inlineLayer.hoverColor?.trim();
        if (inlineHover)
          rules.push(
            `.wielo-sabela .nav-links a.mi-${id}:hover,.wielo-sabela .nav-sub a.mi-${id}:hover{color:${inlineHover}}`,
          );
        if (!previewDevice && st.tablet) {
          const tDecls = itemLayerDecls(st.tablet);
          if (tDecls)
            rules.push(`@media (max-width:1024px){${inlineSel}{${tDecls}}}`);
        }
        const drawerLayer = mergeLayers(desktop, st.mobile);
        const drawerDecls = itemLayerDecls(drawerLayer);
        if (drawerDecls) rules.push(`${drawerSel}{${drawerDecls}}`);
        const drawerHover = drawerLayer.hoverColor?.trim();
        if (drawerHover)
          rules.push(
            `.wielo-sabela .mnav-links a.mi-${id}:hover,.wielo-sabela .mnav-sub a.mi-${id}:hover{color:${drawerHover}}`,
          );
      }
      if (l.children?.length) walk(l.children);
    }
  };
  walk(links);
  return rules.join("");
}

const CARET = (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginLeft: 5 }}
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Sabela fixed header: transparent + light over the full-bleed dark hero, fading
 * to a solid blurred bar on scroll (the design's `.nav.over-hero` → `.scrolled`,
 * gated by the root's `data-hero="full"`). Renders the host's menu (one level of
 * dropdowns), styled by the host's menu style, with a host-controlled book
 * button. Scroll + dropdown + drawer state are the only reason this is a client
 * component. Shape mirrors SafariNav so the same nav model drives both themes.
 */
export function SabelaNav({
  brandName,
  monogram,
  tagline,
  showLogo = true,
  logoUrl,
  logoLightUrl,
  logoMaxHeight,
  links,
  layout = "classic",
  bookHref,
  bookLabel = "Enquire",
  showBook = true,
  bookColor,
  menuStyle,
  forceSolid = false,
  sticky = true,
  bgColor,
  scrolledBgColor,
  scrolledBorderColor,
  menuCollapse = "mobile",
  logoStyle,
  logoTablet,
  logoMobile,
  burger,
  forceMenuOpen = false,
  previewDevice,
}: {
  brandName: string;
  monogram: string;
  tagline?: string | null;
  layout?: SafariHeaderLayout;
  showLogo?: boolean;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoMaxHeight?: number | null;
  links: SabelaNavLink[];
  bookHref?: string | null;
  bookLabel?: string;
  showBook?: boolean;
  bookColor?: string | null;
  menuStyle?: SiteMenuStyle | null;
  forceSolid?: boolean;
  sticky?: boolean;
  bgColor?: string | null;
  scrolledBgColor?: string | null;
  scrolledBorderColor?: string | null;
  menuCollapse?: "mobile" | "tablet" | "never";
  logoStyle?: "wordmark" | "icon" | "mark" | null;
  logoTablet?: LogoOverride;
  logoMobile?: LogoOverride;
  burger?: {
    color?: string;
    size?: number;
    weight?: "thin" | "regular" | "bold";
    style?: "lines" | "short" | "dots" | "grid";
    bg?: string;
  };
  forceMenuOpen?: boolean;
  previewDevice?: "desktop" | "tablet" | "phone";
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (forceSolid) {
      setScrolled(true);
      return;
    }
    const onScroll = (e?: Event) => {
      const t = e?.target;
      const containerY = t instanceof HTMLElement ? t.scrollTop : 0;
      setScrolled(window.scrollY > 12 || containerY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [forceSolid]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openMobile, setOpenMobile] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (forceMenuOpen) setMenuOpen(true);
  }, [forceMenuOpen]);

  const cls = [
    "nav over-hero",
    scrolled || forceSolid ? "scrolled" : "",
    sticky ? "" : "nav-static",
    menuCollapse === "never" ? "" : `collapse-${menuCollapse}`,
  ]
    .filter(Boolean)
    .join(" ");

  const solid = forceSolid || scrolled;
  const customBg = forceSolid
    ? bgColor?.trim()
    : scrolled
      ? scrolledBgColor?.trim()
      : "";
  const customBorder = solid ? scrolledBorderColor?.trim() : "";
  const headerStyle =
    customBg || customBorder
      ? {
          ...(customBg
            ? {
                background: customBg,
                color: isDarkColor(customBg) ? "#fff" : "var(--site-ink)",
              }
            : {}),
          ...(customBorder ? { borderBottomColor: customBorder } : {}),
        }
      : undefined;

  const bookCss = bookColor?.trim()
    ? `.wielo-sabela .nav-book-custom,.wielo-sabela .nav-book-custom:hover{background:${bookColor.trim()}!important;border-color:${bookColor.trim()}!important;color:#fff!important}`
    : "";
  const styleCss =
    menuStyleCss(menuStyle) + menuItemStyleCss(links, previewDevice) + bookCss;
  const bookClass = bookColor?.trim() ? " nav-book-custom" : "";
  const homeHref = links[0]?.href || "#";
  const headerLogo = solid ? logoUrl || logoLightUrl : logoLightUrl || logoUrl;
  const solidLogo = logoUrl || logoLightUrl;
  const book = showBook && bookHref;
  const bookStyle = bookColor?.trim()
    ? { background: bookColor, borderColor: bookColor, color: "#fff" }
    : undefined;

  type LogoCfg = {
    show: boolean;
    style?: "wordmark" | "icon" | "mark" | null;
    height: number;
  };
  const baseLogo: LogoCfg = {
    show: showLogo,
    style: logoStyle,
    height: logoMaxHeight || 38,
  };
  const resolveLogo = (d: "desktop" | "tablet" | "phone"): LogoCfg => {
    const o = d === "tablet" ? logoTablet : d === "phone" ? logoMobile : null;
    if (!o) return baseLogo;
    return {
      show: o.show ?? baseLogo.show,
      style: o.style ?? baseLogo.style,
      height: o.maxHeight ?? baseLogo.height,
    };
  };
  const hasLogoOverride = Boolean(logoTablet || logoMobile);

  const renderBrandInner = (
    logoSrc: string | null | undefined,
    cfg: LogoCfg,
  ) => {
    const nameEl = (
      <span className="brand-name">
        {brandName}
        {tagline ? <small>{tagline}</small> : null}
      </span>
    );
    const imgEl = logoSrc ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="brand-logo"
        src={logoSrc}
        alt={brandName}
        style={{ height: cfg.height }}
      />
    ) : null;
    const markEl = imgEl ?? (
      <span
        className="brand-mark"
        style={{
          width: cfg.height,
          height: cfg.height,
          fontSize: Math.round(cfg.height * 0.5),
        }}
      >
        {monogram}
      </span>
    );
    if (!cfg.show) return nameEl;
    if (cfg.style === "wordmark") return nameEl;
    if (cfg.style === "icon") return markEl;
    if (cfg.style === "mark")
      return (
        <>
          {markEl}
          {nameEl}
        </>
      );
    return (
      imgEl ?? (
        <>
          {markEl}
          {nameEl}
        </>
      )
    );
  };

  const headerBrand = !hasLogoOverride ? (
    renderBrandInner(headerLogo, baseLogo)
  ) : previewDevice ? (
    renderBrandInner(headerLogo, resolveLogo(previewDevice))
  ) : (
    <>
      <span className="brand-rd brand-rd-dt">
        {renderBrandInner(headerLogo, resolveLogo("desktop"))}
      </span>
      <span className="brand-rd brand-rd-tb">
        {renderBrandInner(headerLogo, resolveLogo("tablet"))}
      </span>
      <span className="brand-rd brand-rd-mb">
        {renderBrandInner(headerLogo, resolveLogo("phone"))}
      </span>
    </>
  );
  const logoRdCss =
    hasLogoOverride && !previewDevice
      ? ".wielo-sabela .brand-rd-tb,.wielo-sabela .brand-rd-mb{display:none}" +
        ".wielo-sabela .brand-rd-dt{display:contents}" +
        "@media (max-width:1024px){.wielo-sabela .brand-rd-dt{display:none}.wielo-sabela .brand-rd-tb{display:contents}}" +
        "@media (max-width:640px){.wielo-sabela .brand-rd-tb{display:none}.wielo-sabela .brand-rd-mb{display:contents}}"
      : "";

  return (
    <>
      {styleCss ? <style>{styleCss}</style> : null}
      {logoRdCss ? <style>{logoRdCss}</style> : null}
      <header className={`${cls} lay-${layout}`} style={headerStyle}>
        <div className="wrap nav-in">
          <a href={homeHref} className="brand">
            {headerBrand}
          </a>
          <nav className="nav-links">
            {links.map((l) =>
              l.children && l.children.length > 0 ? (
                <span key={l.href + l.label} className="has-sub">
                  <a
                    href={l.href}
                    className={
                      l.id ? `nav-link caret mi-${l.id}` : "nav-link caret"
                    }
                    target={l.newTab ? "_blank" : undefined}
                    rel={l.newTab ? "noopener noreferrer" : undefined}
                  >
                    {l.label}
                    {CARET}
                  </a>
                  <div className="nav-sub">
                    {l.children.map((c) => (
                      <a
                        key={c.href + c.label}
                        href={c.href}
                        className={c.id ? `mi-${c.id}` : undefined}
                        target={c.newTab ? "_blank" : undefined}
                        rel={c.newTab ? "noopener noreferrer" : undefined}
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                </span>
              ) : (
                <a
                  key={l.href + l.label}
                  href={l.href}
                  className={l.id ? `nav-link mi-${l.id}` : "nav-link"}
                  target={l.newTab ? "_blank" : undefined}
                  rel={l.newTab ? "noopener noreferrer" : undefined}
                >
                  {l.label}
                </a>
              ),
            )}
          </nav>
          <div className="nav-right">
            {book ? (
              <a
                href={bookHref}
                className={`btn btn-primary btn-sm${bookClass}`}
                style={bookStyle}
              >
                <span>{bookLabel}</span>
              </a>
            ) : null}
            <button
              type="button"
              className="nav-burger"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              style={
                burger?.bg?.trim()
                  ? {
                      background: burger.bg.trim(),
                      borderRadius: 8,
                      padding: 6,
                    }
                  : undefined
              }
            >
              <BurgerGlyph burger={burger} />
            </button>
          </div>
        </div>
      </header>

      <div className={menuOpen ? "mnav open" : "mnav"}>
        <div
          className="mnav-top"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a
            href={homeHref}
            className="brand"
            onClick={() => setMenuOpen(false)}
          >
            {renderBrandInner(solidLogo, resolveLogo("phone"))}
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-label="Close menu"
            style={{ display: "block" }}
            onClick={() => setMenuOpen(false)}
          >
            <svg
              width={burger?.size ?? 26}
              height={burger?.size ?? 26}
              viewBox="0 0 24 24"
              fill="none"
              stroke={burger?.color?.trim() || "currentColor"}
              strokeWidth={
                burger?.weight === "thin"
                  ? 1
                  : burger?.weight === "bold"
                    ? 2.5
                    : 1.5
              }
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="mnav-links">
          {links.map((l) => {
            const hasKids = l.children && l.children.length > 0;
            if (!hasKids) {
              return (
                <a
                  key={l.href + l.label}
                  href={l.href}
                  className={l.id ? `mi-${l.id}` : undefined}
                  target={l.newTab ? "_blank" : undefined}
                  rel={l.newTab ? "noopener noreferrer" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              );
            }
            const expanded = !!openMobile[l.href + l.label];
            return (
              <div key={l.href + l.label} className="mnav-group">
                <button
                  type="button"
                  className={l.id ? `mnav-parent mi-${l.id}` : "mnav-parent"}
                  aria-expanded={expanded}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: 0,
                    cursor: "pointer",
                    color: "inherit",
                    font: "inherit",
                  }}
                  onClick={() =>
                    setOpenMobile((s) => ({
                      ...s,
                      [l.href + l.label]: !expanded,
                    }))
                  }
                >
                  {l.label}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                      transform: expanded ? "rotate(180deg)" : "none",
                      transition: "transform .2s",
                    }}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {expanded ? (
                  <div
                    className="mnav-sub"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      paddingLeft: 14,
                    }}
                  >
                    {l.children!.map((c) => (
                      <a
                        key={c.href + c.label}
                        href={c.href}
                        className={c.id ? `mi-${c.id}` : undefined}
                        target={c.newTab ? "_blank" : undefined}
                        rel={c.newTab ? "noopener noreferrer" : undefined}
                        onClick={() => setMenuOpen(false)}
                        style={{ fontSize: "1.1rem" }}
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        {book ? (
          <a
            href={bookHref}
            className={`btn btn-primary btn-lg btn-block${bookClass}`}
            style={{ ...(bookStyle ?? {}), marginTop: 24 }}
            onClick={() => setMenuOpen(false)}
          >
            <span>{bookLabel}</span>
          </a>
        ) : null}
      </div>
    </>
  );
}

export type { SafariNavData };
