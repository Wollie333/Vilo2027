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
  return (
    <div className="nv-device">
      <div className="nv-frame">
        {ann?.enabled && ann.message?.trim() ? (
          <div className="nv-announce">{ann.message}</div>
        ) : null}
        <div className="nv-bar">
          <div className="nv-brand">
            <span className="nv-mark">{mark(brandName)}</span>
            <span className="nv-name">{brandName}</span>
          </div>
          {/* Collapsed views show only the ☰ icon (no inline menu, book hidden);
              the drawer carries them on the live site. */}
          <div className="nv-menu">
            {collapsed
              ? null
              : menu.slice(0, 6).map((m) => (
                  <span className="nv-mi" key={m.id}>
                    {m.label}
                    {m.children && m.children.length > 0 ? (
                      <span className="car">
                        <ChevronDown style={{ width: 14, height: 14 }} />
                      </span>
                    ) : null}
                  </span>
                ))}
          </div>
          <div className="nv-right">
            {collapsed ? (
              <Menu style={{ width: 20, height: 20, color: "var(--ink)" }} />
            ) : cta ? (
              <span className="nv-cta solid">{cta}</span>
            ) : null}
          </div>
        </div>
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
