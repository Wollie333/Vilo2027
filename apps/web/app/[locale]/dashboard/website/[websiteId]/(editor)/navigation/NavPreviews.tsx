import { ChevronDown, Menu } from "lucide-react";

import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";

type PreviewDevice = "desktop" | "tablet" | "phone";

/** Does the menu collapse to a ☰ at this device, given the collapse setting? */
function isCollapsed(collapse: string, device: PreviewDevice): boolean {
  if (device === "phone") return collapse !== "never";
  if (device === "tablet") return collapse === "tablet";
  return false;
}

// Lightweight live previews for the Navigation manager cards, themed with the
// scoped `.vilo-nav` chrome (nav.css). Built from the site's real navigation
// config + brand — a stylised mini-frame, not the full public header/footer.

function mark(name: string) {
  return (name[0] || "·").toUpperCase();
}

/** weight token → CSS font-weight (mirrors SiteChrome.MENU_WEIGHT). */
const MENU_WEIGHT: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export function NavHeaderPreview({
  nav,
  brandName,
  device = "desktop",
}: {
  nav: NavigationConfig;
  brandName: string;
  device?: PreviewDevice;
}) {
  const menu = nav.menu ?? [];
  const collapsed = isCollapsed(nav.header.menuCollapse ?? "mobile", device);
  const showBook = nav.header.showBookCta !== false;
  const cta = showBook ? nav.header.ctaLabel?.trim() : undefined;
  const ann = nav.topBar;
  // Reflect the Style tab (menuStyle) so the preview matches the live header.
  const ms = nav.menuStyle;
  const miStyle: React.CSSProperties = {
    color: ms?.color?.trim() || undefined,
    fontWeight: MENU_WEIGHT[ms?.weight ?? "medium"] ?? 500,
    textTransform: ms?.uppercase ? "uppercase" : undefined,
    letterSpacing: ms?.uppercase ? "0.05em" : undefined,
  };
  // Hover colour can't be expressed inline (no :hover) — and the inline base
  // colour would win over a plain rule, so the scoped hover rule uses !important.
  const hover = ms?.hoverColor?.trim();

  // Reflect the header background: a solid colour when not transparent, or a
  // see-through bar when transparent-over-hero (matches the live header).
  const headerBg = nav.header?.transparentOverHero
    ? "transparent"
    : nav.header?.bgColor?.trim() || undefined;
  const barBg: React.CSSProperties = headerBg ? { background: headerBg } : {};
  // Menu alignment — mirror the live header: neutralise nav.css's forced
  // `margin-left:auto` on .nv-menu, then position via flex justify (per layout).
  const menuAlign = nav.menuStyle?.align ?? "start";
  const menuJustify =
    menuAlign === "center"
      ? "center"
      : menuAlign === "end"
        ? "flex-end"
        : "flex-start";
  // Layout-aware pieces, so the preview matches the chosen header style.
  const layout = nav.header?.layout ?? "classic";
  // Respect the header's logo rules so the preview matches the live header:
  //  • showLogo  → hide the logo entirely (empty slot keeps the layout)
  //  • logoStyle → icon = mark only, wordmark = name only, mark = both
  //  • logoMaxHeight → scale the mark (the preview mark is ~0.45× the live px)
  const showLogo = nav.header?.showLogo !== false;
  const logoStyle = nav.header?.logoStyle;
  const logoH = nav.header?.logoMaxHeight;
  const markSize = logoH ? Math.max(10, Math.round(logoH * 0.45)) : undefined;
  const brandEl = !showLogo ? (
    <span aria-hidden />
  ) : (
    <div className="nv-brand">
      {logoStyle !== "wordmark" ? (
        <span
          className="nv-mark"
          style={markSize ? { width: markSize, height: markSize } : undefined}
        >
          {mark(brandName)}
        </span>
      ) : null}
      {logoStyle !== "icon" ? (
        <span className="nv-name">{brandName}</span>
      ) : null}
    </div>
  );
  const menuItems =
    collapsed || menu.length === 0
      ? null
      : menu.slice(0, 6).map((m) => (
          <span className="nv-mi" key={m.id} style={miStyle}>
            {m.label}
            {m.children && m.children.length > 0 ? (
              <span className="car">
                <ChevronDown style={{ width: 14, height: 14 }} />
              </span>
            ) : null}
          </span>
        ));
  const menuEl = menuItems ? (
    <div className="nv-menu nvhm-pv" style={{ marginLeft: 0 }}>
      {menuItems}
    </div>
  ) : null;
  const burgerEl = (
    <Menu style={{ width: 20, height: 20, color: "var(--ink)" }} />
  );
  const ctaEl = cta ? <span className="nv-cta solid">{cta}</span> : null;
  return (
    <div className="nv-device">
      <div className="nv-frame">
        {hover ? (
          <style>{`.nvhm-pv .nv-mi:hover{color:${hover} !important}`}</style>
        ) : null}
        {ann?.enabled && ann.message?.trim() ? (
          <div className="nv-announce">{ann.message}</div>
        ) : null}
        {/* Collapsed views (or "minimal") show the ☰ icon; the drawer carries
            the menu + book on the live site. Otherwise arrange per layout. */}
        {collapsed || layout === "minimal" ? (
          <div
            className="nv-bar"
            style={{ ...barBg, justifyContent: "space-between" }}
          >
            {brandEl}
            <div className="nv-right" style={{ gap: 8, marginLeft: "auto" }}>
              {layout === "minimal" ? ctaEl : null}
              {burgerEl}
            </div>
          </div>
        ) : layout === "centered" ? (
          <div
            className="nv-bar"
            style={{ ...barBg, flexDirection: "column", gap: 10 }}
          >
            {brandEl}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: menuJustify,
                gap: 16,
                width: "100%",
              }}
            >
              {menuEl}
              {ctaEl}
            </div>
          </div>
        ) : layout === "split" ? (
          <div
            className="nv-bar"
            style={{
              ...barBg,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: menuJustify }}>
              {menuEl}
            </div>
            {brandEl}
            <div style={{ justifySelf: "end" }}>{ctaEl}</div>
          </div>
        ) : (
          <div className="nv-bar" style={barBg}>
            {brandEl}
            <div
              style={{ flex: 1, display: "flex", justifyContent: menuJustify }}
            >
              {menuEl}
            </div>
            <div className="nv-right">{ctaEl}</div>
          </div>
        )}
        <div className="nv-stub">
          <div className="ln t" />
          <div className="ln" />
          <div className="ln" style={{ width: "88%" }} />
          <div className="ln" style={{ width: "70%" }} />
        </div>
      </div>
    </div>
  );
}

export function NavMenuPills({ nav }: { nav: NavigationConfig }) {
  const menu = nav.menu ?? [];
  if (menu.length === 0) {
    return (
      <span className="text-[12.5px]" style={{ color: "var(--mute)" }}>
        No custom menu — pages are listed automatically.
      </span>
    );
  }
  return (
    <>
      {menu.map((m) => (
        <span className="nv-pill" key={m.id}>
          {m.label}
          {m.children && m.children.length > 0 ? (
            <span style={{ color: "#9DB4A8", fontSize: 11 }}>
              ▾ {m.children.length}
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function NavFooterPreview({
  nav,
  brandName,
}: {
  nav: NavigationConfig;
  brandName: string;
}) {
  const columns = nav.footer.columns ?? [];
  return (
    <div className="nv-foot">
      <div className="nv-foot-top">
        <div>
          <div className="fbrand">
            <span className="fmark">{mark(brandName)}</span>
            <span className="fname">{brandName}</span>
          </div>
        </div>
        {columns.slice(0, 3).map((c) => (
          <div className="fcol" key={c.id}>
            <div className="fcol-h">{c.heading}</div>
            {c.links.slice(0, 4).map((l) => (
              <a key={l.id}>{l.label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="nv-foot-bot">
        <span>{nav.footer.copyright?.trim() || `© ${brandName}`}</span>
        {nav.footer.showPoweredBy !== false ? (
          <span>Powered by Vilo</span>
        ) : null}
      </div>
    </div>
  );
}
