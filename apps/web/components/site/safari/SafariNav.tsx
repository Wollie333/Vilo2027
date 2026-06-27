"use client";

import { useEffect, useState } from "react";

import type { SafariHeaderLayout } from "@/lib/site/safariNav";
import type {
  MenuItemStyle,
  MenuItemStyleLayer,
  SiteMenuStyle,
} from "@/lib/site/types";

/** A nav link as rendered in the Safari header (supports one level of dropdown). */
export type SafariNavLink = {
  /** Stable menu-item id — drives the per-link style class `mi-<id>`. */
  id?: string;
  label: string;
  href: string;
  newTab?: boolean;
  /** Per-link responsive style override (the selected-link Style controls). */
  style?: MenuItemStyle;
  children?: SafariNavLink[];
};

const WEIGHT: Record<NonNullable<SiteMenuStyle["weight"]>, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/** True when a #rrggbb colour is dark enough to need light text on top (so a
 *  host's custom solid/scrolled header colour stays readable — brand + menu +
 *  burger flip to white over a dark bar, dark over a light one). */
function isDarkColor(hex?: string | null): boolean {
  const c = (hex || "").trim().replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

/** Scoped CSS that applies the host's menu style to the Safari header + drawer.
 *  When the host sets a colour/hover it takes effect in EVERY nav state (over the
 *  hero, scrolled-solid, and the mobile drawer) — their choice wins. The links
 *  inherit their colour from `.nav`, so a direct rule on the link overrides the
 *  adaptive default in all states. With no colour set, the design's adaptive
 *  white/ink is left untouched. */
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
      `.vilo-safari .nav-links a,.vilo-safari .mnav-links a{${type.join(";")}}`,
    );
  if (color)
    rules.push(
      `.vilo-safari .nav-links a,.vilo-safari .mnav-links a{color:${color};opacity:1}`,
    );
  if (hover)
    rules.push(
      `.vilo-safari .nav-links a:hover,.vilo-safari .mnav-links a:hover{color:${hover};opacity:1}`,
    );
  // Horizontal spacing between top-level links (Layout → item spacing).
  if (typeof style.itemGap === "number")
    rules.push(`.vilo-safari .nav-links{gap:${style.itemGap}px}`);
  // Sub-menu (dropdown) styling — desktop dropdown panel + items, and the mobile
  // drawer's nested links, so nested links are styled separately from the top.
  const subColor = style.submenuColor?.trim();
  const subHover = style.submenuHoverColor?.trim() || subColor;
  const subBg = style.submenuBg?.trim();
  if (subBg)
    rules.push(
      `.vilo-safari .nav-dd-menu{background:${subBg};border-color:${subBg}}`,
    );
  if (subColor)
    rules.push(
      `.vilo-safari .nav-dd-menu a,.vilo-safari .mnav-sub a{color:${subColor}}`,
    );
  if (subHover)
    rules.push(
      `.vilo-safari .nav-dd-menu a:hover,.vilo-safari .mnav-sub a:hover{color:${subHover}}`,
    );
  // Desktop top-level link size (inline menu only — the drawer has its own size).
  if (typeof style.fontSize === "number")
    rules.push(`.vilo-safari .nav-links a{font-size:${style.fontSize}px}`);

  // ── Tablet override — the inline menu at tablet widths (≤1024px). Only the
  //    fields the host changed for tablet; everything else inherits desktop. ──
  const tb = style.tablet;
  if (tb) {
    const tr: string[] = [];
    if (tb.color?.trim()) tr.push(`color:${tb.color.trim()}`);
    if (typeof tb.fontSize === "number") tr.push(`font-size:${tb.fontSize}px`);
    if (tb.weight) tr.push(`font-weight:${WEIGHT[tb.weight]}`);
    if (tb.uppercase !== undefined)
      tr.push(`text-transform:${tb.uppercase ? "uppercase" : "none"}`);
    const parts: string[] = [];
    if (tr.length) parts.push(`.vilo-safari .nav-links a{${tr.join(";")}}`);
    if (tb.hoverColor?.trim())
      parts.push(
        `.vilo-safari .nav-links a:hover{color:${tb.hoverColor.trim()}}`,
      );
    if (parts.length)
      rules.push(`@media (max-width:1024px){${parts.join("")}}`);
  }

  // ── Mobile override — the ☰ drawer / overlay. Its own background + link
  //    styling, independent of the desktop inline menu. ──
  const mb = style.mobile;
  if (mb) {
    if (mb.overlayBg?.trim())
      rules.push(`.vilo-safari .mnav{background:${mb.overlayBg.trim()}}`);
    const mr: string[] = [];
    if (mb.color?.trim()) mr.push(`color:${mb.color.trim()}`);
    if (typeof mb.fontSize === "number") mr.push(`font-size:${mb.fontSize}px`);
    if (mb.weight) mr.push(`font-weight:${WEIGHT[mb.weight]}`);
    if (mb.uppercase !== undefined)
      mr.push(`text-transform:${mb.uppercase ? "uppercase" : "none"}`);
    if (mr.length) rules.push(`.vilo-safari .mnav-links a{${mr.join(";")}}`);
    if (mb.hoverColor?.trim())
      rules.push(
        `.vilo-safari .mnav-links a:hover{color:${mb.hoverColor.trim()}}`,
      );
  }
  return rules.join("");
}

// ── Per-LINK style (the selected-link Style controls) ────────────────────────
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

/**
 * Scoped CSS for per-link styling. Each styled link carries a `mi-<id>` class;
 * inline links (header + dropdown) get the desktop layer (with a tablet @media on
 * the live site), the drawer copy gets the mobile-merged layer. In the builder the
 * `previewDevice` is set, so the inline rule renders the ACTIVE device's merged
 * style flat (no media query) — the canvas reflects the chosen screen size at once.
 */
function menuItemStyleCss(
  links: SafariNavLink[],
  previewDevice?: "desktop" | "tablet" | "phone",
): string {
  const rules: string[] = [];
  const walk = (list: SafariNavLink[]) => {
    for (const l of list) {
      const st = l.style;
      if (l.id && st) {
        const id = l.id;
        const inlineSel = `.vilo-safari .nav-links a.mi-${id},.vilo-safari .nav-dd-menu a.mi-${id}`;
        const drawerSel = `.vilo-safari .mnav-links a.mi-${id},.vilo-safari .mnav-sub a.mi-${id},.vilo-safari .mnav-parent.mi-${id}`;
        const desktop: MenuItemStyleLayer = {
          color: st.color,
          hoverColor: st.hoverColor,
          fontSize: st.fontSize,
          weight: st.weight,
          uppercase: st.uppercase,
          bg: st.bg,
          pill: st.pill,
        };
        // Inline links: the active device's merged layer in the builder; the
        // desktop layer + a tablet @media on the live site.
        const inlineLayer =
          previewDevice === "tablet"
            ? mergeLayers(desktop, st.tablet)
            : desktop;
        const inlineDecls = itemLayerDecls(inlineLayer);
        if (inlineDecls) rules.push(`${inlineSel}{${inlineDecls}}`);
        const inlineHover = inlineLayer.hoverColor?.trim();
        if (inlineHover)
          rules.push(
            `.vilo-safari .nav-links a.mi-${id}:hover,.vilo-safari .nav-dd-menu a.mi-${id}:hover{color:${inlineHover}}`,
          );
        if (!previewDevice && st.tablet) {
          const tDecls = itemLayerDecls(st.tablet);
          if (tDecls)
            rules.push(`@media (max-width:1024px){${inlineSel}{${tDecls}}}`);
        }
        // Drawer copy: the mobile-merged layer (shown when the drawer is open).
        const drawerLayer = mergeLayers(desktop, st.mobile);
        const drawerDecls = itemLayerDecls(drawerLayer);
        if (drawerDecls) rules.push(`${drawerSel}{${drawerDecls}}`);
        const drawerHover = drawerLayer.hoverColor?.trim();
        if (drawerHover)
          rules.push(
            `.vilo-safari .mnav-links a.mi-${id}:hover,.vilo-safari .mnav-sub a.mi-${id}:hover{color:${drawerHover}}`,
          );
      }
      if (l.children?.length) walk(l.children);
    }
  };
  walk(links);
  return rules.join("");
}

/**
 * NenGama-style fixed header: transparent + light over the hero, fading to a
 * solid blurred bar on scroll (the design's `.nav.over-hero` → `.solid`). Renders
 * the host's menu (`navigation.menu`) — including one level of dropdowns — styled
 * by the host's menu style, with a host-controlled "book" button. The scroll +
 * dropdown state are the only reason this is a client component.
 */
export function SafariNav({
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
  bookLabel = "Reserve",
  showBook = true,
  bookColor,
  menuStyle,
  forceSolid = false,
  sticky = true,
  bgColor,
  scrolledBgColor,
  menuCollapse = "mobile",
  logoStyle,
  forceMenuOpen = false,
  previewDevice,
}: {
  brandName: string;
  monogram: string;
  tagline?: string | null;
  /** Header layout — places logo/menu/book (the nav manager's layout picker). */
  layout?: SafariHeaderLayout;
  /** Real brand logo: a light variant for the transparent-over-hero state and a
   *  standard one for the solid bar + drawer; falls back to the monogram. */
  showLogo?: boolean;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoMaxHeight?: number | null;
  links: SafariNavLink[];
  bookHref?: string | null;
  bookLabel?: string;
  showBook?: boolean;
  bookColor?: string | null;
  menuStyle?: SiteMenuStyle | null;
  /** Solid bar from the top (no transparent-over-hero) — pages without a dark
   *  hero (checkout), the builder, OR the host turning transparency off. */
  forceSolid?: boolean;
  /** Keep the header pinned/visible on scroll (header behaviour). False → the
   *  header scrolls away with the page. */
  sticky?: boolean;
  /** Solid-bar background override (transparency off). Blank → Safari paper. */
  bgColor?: string | null;
  /** Background the transparent bar fades to on scroll. Blank → Safari paper. */
  scrolledBgColor?: string | null;
  /** Breakpoint at which the inline menu collapses to the ☰ drawer. */
  menuCollapse?: "mobile" | "tablet" | "never";
  /** Logo lockup style (Elements): wordmark/icon/mark; unset = design default. */
  logoStyle?: "wordmark" | "icon" | "mark" | null;
  /** Builder-only: force the ☰ drawer OPEN so the host can preview + style the
   *  mobile menu in the nav editor's phone device. Never set on the live site. */
  forceMenuOpen?: boolean;
  /** Builder-only: the active device, so per-link styles render flat for that
   *  screen size in the canvas (no media query). Unset on the live site. */
  previewDevice?: "desktop" | "tablet" | "phone";
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (forceSolid) return;
    // capture:true so a scroll inside a bounded container (the nav-manager's
    // header preview) also drives the transparent→solid fade — scroll events
    // don't bubble, so without capture only the live window scroll would count.
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
  // Which mobile-drawer parents are expanded (accordion).
  const [openMobile, setOpenMobile] = useState<Record<string, boolean>>({});

  // Builder phone preview: open the drawer so the host can see + style the mobile
  // menu. Runs when forceMenuOpen flips on (e.g. switching to the phone device).
  useEffect(() => {
    if (forceMenuOpen) setMenuOpen(true);
  }, [forceMenuOpen]);

  const cls = [
    forceSolid
      ? "nav solid"
      : scrolled
        ? "nav over-hero solid"
        : "nav over-hero",
    // Non-sticky → un-pin the bar (CSS makes it absolute over the hero when
    // transparent, or in-flow when solid) so it scrolls away with the page.
    sticky ? "" : "nav-static",
    // Where the inline menu collapses to the ☰ drawer (CSS media queries).
    menuCollapse === "never" ? "" : `collapse-${menuCollapse}`,
  ]
    .filter(Boolean)
    .join(" ");

  // Custom solid background (host's Behaviour colours): the solid-from-top bar
  // uses `bgColor`; the transparent bar fades to `scrolledBgColor` once scrolled.
  const customBg = forceSolid
    ? bgColor?.trim()
    : scrolled
      ? scrolledBgColor?.trim()
      : "";
  // A custom bar colour also sets a readable text colour (brand + menu + burger
  // inherit it); the host's explicit menu colour, if any, still wins for links.
  const headerStyle = customBg
    ? {
        background: customBg,
        color: isDarkColor(customBg) ? "#fff" : "var(--ink)",
      }
    : undefined;

  // The host's book-button colour as a scoped rule so it also wins on HOVER (the
  // design's solid-bar `.btn-on-dark:hover` would otherwise override the inline
  // colour). Covers the header + drawer book buttons.
  const bookCss = bookColor?.trim()
    ? `.vilo-safari .nav-book-custom,.vilo-safari .nav-book-custom:hover{background:${bookColor.trim()}!important;border-color:${bookColor.trim()}!important;color:#fff!important}`
    : "";
  const styleCss =
    menuStyleCss(menuStyle) + menuItemStyleCss(links, previewDevice) + bookCss;
  const bookClass = bookColor?.trim() ? " nav-book-custom" : "";
  const homeHref = links[0]?.href || "#";
  // Logo: light variant over the dark hero, standard variant on the solid bar +
  // drawer. Falls back to the monogram when no logo / hidden.
  const solid = forceSolid || scrolled;
  const useLogo = showLogo && Boolean(logoLightUrl || logoUrl);
  const headerLogo = solid ? logoUrl || logoLightUrl : logoLightUrl || logoUrl;
  const solidLogo = logoUrl || logoLightUrl;
  const logoH = logoMaxHeight || 40;
  const book = showBook && bookHref;
  const bookStyle = bookColor?.trim()
    ? { background: bookColor, borderColor: bookColor, color: "#fff" }
    : undefined;

  // Brand lockup honouring the Elements → logo style: wordmark = name only,
  // icon = mark only (logo image, else the monogram circle), mark = mark + name.
  // Unset = the design default (the logo image alone, else the monogram + name).
  const renderBrandInner = (logoSrc?: string | null) => {
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
        style={{ height: logoH }}
      />
    ) : null;
    // The monogram circle scales with the Logo height setting too (the design's
    // 42px is the ~40 default); the serif initial keeps the same ~0.52 ratio.
    const markEl = imgEl ?? (
      <span
        className="brand-mark"
        style={{
          width: logoH,
          height: logoH,
          fontSize: Math.round(logoH * 0.52),
        }}
      >
        {monogram}
      </span>
    );
    // "Show logo" off → drop the visual mark/image, keep the brand name as a
    // clean wordmark (the home link stays visible + clickable).
    if (!showLogo) return nameEl;
    if (logoStyle === "wordmark") return nameEl;
    if (logoStyle === "icon") return markEl;
    if (logoStyle === "mark")
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

  return (
    <>
      {styleCss ? <style>{styleCss}</style> : null}
      <header className={`${cls} lay-${layout}`} style={headerStyle}>
        <div className="wrap nav-in">
          <a href={homeHref} className="brand">
            {renderBrandInner(useLogo ? headerLogo : null)}
          </a>
          <nav className="nav-links">
            {links.map((l) =>
              l.children && l.children.length > 0 ? (
                <span key={l.href + l.label} className="nav-dd">
                  <a
                    href={l.href}
                    className={l.id ? `nav-link mi-${l.id}` : "nav-link"}
                    target={l.newTab ? "_blank" : undefined}
                    rel={l.newTab ? "noopener noreferrer" : undefined}
                  >
                    {l.label}
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
                  </a>
                  <div className="nav-dd-menu">
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
                className={`btn btn-on-dark btn-sm${bookClass}`}
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
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className={menuOpen ? "mnav open" : "mnav"}>
        <div className="mnav-top">
          <a
            href={homeHref}
            className="brand"
            onClick={() => setMenuOpen(false)}
          >
            {renderBrandInner(useLogo ? solidLogo : null)}
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-label="Close menu"
            style={{ display: "block" }}
            onClick={() => setMenuOpen(false)}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
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
                  <div className="mnav-sub">
                    {l.children!.map((c) => (
                      <a
                        key={c.href + c.label}
                        href={c.href}
                        className={c.id ? `mi-${c.id}` : undefined}
                        target={c.newTab ? "_blank" : undefined}
                        rel={c.newTab ? "noopener noreferrer" : undefined}
                        onClick={() => setMenuOpen(false)}
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
            style={bookStyle}
            onClick={() => setMenuOpen(false)}
          >
            <span>{bookLabel}</span>
          </a>
        ) : null}
      </div>
    </>
  );
}
