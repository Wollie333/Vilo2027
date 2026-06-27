"use client";

import {
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  Menu,
  Monitor,
  PanelBottom,
  PanelTop,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { saveNavigationAction } from "@/app/[locale]/dashboard/website/actions";
import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";
import { SafariNavCanvas } from "@/components/site/safari/SafariNavCanvas";
import { SiteChromeCanvas } from "@/components/site/SiteChromeCanvas";
import { buildSafariNav } from "@/lib/site/safariNav";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  MenuPageOverride,
  SiteBrand,
  SiteConversion,
  SiteFooterColumn,
  SiteMenuItem,
  SiteNavItem,
  SiteNavigation,
} from "@/lib/site/types";

import {
  NavFooterPreview,
  NavHeaderPreview,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavPreviews";
import type { PageOption } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/MenuBuilder";
import {
  FooterInspector,
  HeaderInspector,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavInspectors";

import { MenuStudio } from "./MenuStudio";
import type { NavBackdrop } from "./page";

type Section = "header" | "menu" | "footer";
type Device = "desktop" | "tablet" | "phone";

const SECTION_ICON = { header: PanelTop, menu: Menu, footer: PanelBottom };

type HeaderLayout = "classic" | "centered" | "split" | "minimal";
const HEADER_LAYOUTS: HeaderLayout[] = [
  "classic",
  "centered",
  "split",
  "minimal",
];

/** Tiny diagram of a header arrangement for the layout-picker cards. */
function LayoutDiagram({ kind }: { kind: HeaderLayout }) {
  const logo = (
    <span
      style={{ width: 16, height: 8, borderRadius: 2, background: "#10B981" }}
    />
  );
  const lines = (
    <span style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 14,
            height: 4,
            borderRadius: 2,
            background: "#cbd5e1",
          }}
        />
      ))}
    </span>
  );
  const btn = (
    <span
      style={{ width: 18, height: 9, borderRadius: 3, background: "#0f172a" }}
    />
  );
  const burger = (
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 12, height: 2, background: "#0f172a" }} />
      ))}
    </span>
  );
  const shell: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minHeight: 30,
    padding: "0 8px",
    gap: 5,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 5,
  };
  if (kind === "centered") {
    return (
      <span
        style={{ ...shell, flexDirection: "column", gap: 4, padding: "6px" }}
      >
        {logo}
        {lines}
      </span>
    );
  }
  if (kind === "split") {
    return (
      <span style={shell}>
        {lines}
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {logo}
        </span>
        {btn}
      </span>
    );
  }
  if (kind === "minimal") {
    return (
      <span style={shell}>
        {logo}
        <span style={{ flex: 1 }} />
        {burger}
      </span>
    );
  }
  // classic
  return (
    <span style={shell}>
      {logo}
      <span style={{ flex: 1 }} />
      {lines}
      <span style={{ flex: 1 }} />
      {btn}
    </span>
  );
}

export function NavSectionEditor({
  websiteId,
  section,
  initial,
  pages,
  rooms = [],
  brandName,
  brand,
  themePreset,
  subdomain,
  backdrops = [],
  homeBookHref = null,
  contactEmail = null,
  contactPhone = null,
  themeConfig = null,
  navItems = [],
  conversion = null,
  chromeLayout = "full",
  darkChrome = false,
}: {
  websiteId: string;
  section: Section;
  initial: NavigationConfig;
  pages: PageOption[];
  rooms?: { roomId: string; name: string }[];
  brandName: string;
  brand: SiteBrand;
  themePreset?: string | null;
  subdomain: string;
  /** The host's real pages (draft) — the canvas backdrop behind the chrome. */
  backdrops?: NavBackdrop[];
  homeBookHref?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  /** Generic-theme canvas inputs (non-Safari). */
  themeConfig?: SiteThemeConfig | null;
  navItems?: SiteNavItem[];
  conversion?: SiteConversion | null;
  chromeLayout?: "full" | "boxed";
  darkChrome?: boolean;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [nav, setNav] = useState<NavigationConfig>(initial);
  const [saving, startSave] = useTransition();
  const [device, setDevice] = useState<Device>("desktop");
  // Which real page sits behind the live menu (default the first = home).
  const [backdropKey, setBackdropKey] = useState<string>(
    backdrops[0]?.key ?? "home",
  );
  const activeBackdrop =
    backdrops.find((b) => b.key === backdropKey) ?? backdrops[0];
  const homeSections = activeBackdrop?.sections ?? [];
  const homeData = activeBackdrop?.data;

  const deviceClass =
    device === "tablet"
      ? "device tablet"
      : device === "phone"
        ? "device mobile"
        : "device";

  // Live theme preview: render the REAL chrome (built from the live navConfig +
  // brand) so header/menu/footer edits — colours, logo, columns — show instantly
  // and match the published site. Falls back to the generic preview off-theme.
  const isSafari = themePreset === "safari";
  const safariNav = isSafari
    ? buildSafariNav(
        {
          nav: pages,
          navigation: nav,
          brand,
          preview: false,
          subdomain: "",
        },
        // Filter the canvas menu by the page sitting behind it (per-page rules).
        backdropKey,
      )
    : null;
  const devices: Array<{ key: Device; icon: LucideIcon; title: string }> = [
    { key: "desktop", icon: Monitor, title: t("deviceDesktop") },
    { key: "tablet", icon: Tablet, title: t("deviceTablet") },
    { key: "phone", icon: Smartphone, title: t("devicePhone") },
  ];

  const setHeader = (patch: Partial<NavigationConfig["header"]>) =>
    setNav((n) => ({ ...n, header: { ...n.header, ...patch } }));
  const setTop = (patch: Partial<NavigationConfig["topBar"]>) =>
    setNav((n) => ({ ...n, topBar: { ...n.topBar, ...patch } }));
  const setFooter = (patch: Partial<NavigationConfig["footer"]>) =>
    setNav((n) => ({ ...n, footer: { ...n.footer, ...patch } }));
  const setMenu = (menu: SiteMenuItem[]) => setNav((n) => ({ ...n, menu }));
  const setMenuStyle = (patch: Partial<NavigationConfig["menuStyle"]>) =>
    setNav((n) => ({ ...n, menuStyle: { ...n.menuStyle, ...patch } }));
  // Per-page appearance/style override for one page key (merges over the global).
  const setPerPage = (key: string, patch: Partial<MenuPageOverride>) =>
    setNav((n) => {
      const cur = (n.perPage ?? {})[key] ?? {};
      const next = { ...cur, ...patch };
      // Drop keys set back to undefined so an empty override doesn't linger.
      for (const k of Object.keys(next) as (keyof MenuPageOverride)[])
        if (next[k] === undefined) delete next[k];
      return { ...n, perPage: { ...(n.perPage ?? {}), [key]: next } };
    });
  const setColumns = (columns: SiteFooterColumn[]) =>
    setNav((n) => ({ ...n, footer: { ...n.footer, columns } }));

  function onSave() {
    startSave(async () => {
      const res = await saveNavigationAction({ websiteId, navigation: nav });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("navSaved"));
      router.refresh();
    });
  }

  const title =
    section === "header"
      ? t("navHeaderTitle")
      : section === "menu"
        ? t("navMenuTitle")
        : t("navFooterTitle");
  const Icon = SECTION_ICON[section];

  return (
    <div
      className="vilo-builder"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header className="etop">
        <Link
          href={`/dashboard/website/${websiteId}/navigation`}
          className="eback"
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          {t("navHeading")}
        </Link>
        <div className="epage">
          <span className="pico">
            <Icon style={{ width: 16, height: 16 }} />
          </span>
          <div>
            <div className="ptit">{title}</div>
            <div className="psub">{subdomain}</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 14,
          }}
        >
          <div className="seg" role="group" aria-label={t("livePreview")}>
            {devices.map((d) => {
              const Ico = d.icon;
              return (
                <button
                  key={d.key}
                  type="button"
                  title={d.title}
                  aria-pressed={device === d.key}
                  className={device === d.key ? "on" : ""}
                  onClick={() => setDevice(d.key)}
                >
                  <Ico style={{ width: 16, height: 16 }} />
                </button>
              );
            })}
          </div>
          {/* Which real page sits behind the live menu (Safari real-page canvas). */}
          {isSafari && backdrops.length > 1 ? (
            <label
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title={t("navBackdropTitle")}
            >
              <Layers style={{ width: 15, height: 15, color: "#64748b" }} />
              <select
                value={backdropKey}
                onChange={(e) => setBackdropKey(e.target.value)}
                aria-label={t("navBackdropTitle")}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "5px 8px",
                  fontSize: 12.5,
                  background: "#fff",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                {backdrops.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2
                className="animate-spin"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <Check style={{ width: 15, height: 15 }} />
            )}
            {t("save")}
          </button>
        </div>
      </header>

      <div className="ebody">
        {section === "menu" ? (
          /* Menu: Elementor-style 3-tab builder (left) · preview · item inspector */
          <MenuStudio
            nav={nav}
            setMenu={setMenu}
            setMenuStyle={setMenuStyle}
            setHeader={setHeader}
            pages={pages}
            rooms={rooms}
            device={device}
            brandName={brandName}
            brand={brand}
            themePreset={themePreset}
            homeSections={homeSections}
            homeData={homeData}
            homeBookHref={homeBookHref}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            themeConfig={themeConfig}
            navItems={navItems}
            conversion={conversion}
            chromeLayout={chromeLayout}
            darkChrome={darkChrome}
            backdropKey={backdropKey}
            pageList={backdrops.map((b) => ({ key: b.key, label: b.label }))}
            setPerPage={setPerPage}
          />
        ) : (
          <>
            {/* Header: left sidebar = layout picker (4 styles). */}
            {section === "header" ? (
              <aside className="epanel l" style={{ width: 232 }}>
                <div className="epanel-h">
                  <PanelTop
                    style={{ width: 16, height: 16, color: "#10B981" }}
                  />
                  <h3>{t("navHeaderLayoutTitle")}</h3>
                </div>
                <div
                  className="epanel-b thin"
                  style={{ display: "grid", gap: 10, padding: 12 }}
                >
                  {HEADER_LAYOUTS.map((key) => {
                    const on = (nav.header?.layout ?? "classic") === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setHeader({ layout: key })}
                        aria-pressed={on}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 7,
                          padding: 10,
                          borderRadius: 10,
                          border: `1.5px solid ${on ? "#10B981" : "#e5e7eb"}`,
                          background: on ? "#ECFDF5" : "#fff",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <LayoutDiagram kind={key} />
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: on ? "#047857" : "#0f172a",
                          }}
                        >
                          {t(`headerLayout_${key}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            ) : null}

            {/* canvas — live preview in the shared device frame. For Safari the
                chrome becomes a bounded, scrollable viewport with a sticky header
                (CSS `.nav-scroll-preview`) so the host can preview the scroll
                interaction — the transparent→solid fade + scroll background. */}
            <div className="canvas-wrap thin">
              <div
                className={[deviceClass, isSafari ? "nav-scroll-preview" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isSafari && safariNav ? (
                  <SafariNavCanvas
                    brandName={brandName}
                    nav={safariNav}
                    bookHref={homeBookHref}
                    sections={homeSections}
                    data={homeData}
                    contactEmail={contactEmail}
                    contactPhone={contactPhone}
                    forceMobileOpen={device === "phone"}
                    previewDevice={device}
                  />
                ) : themeConfig ? (
                  /* Generic theme: the REAL page behind the live chrome. */
                  <SiteChromeCanvas
                    theme={themeConfig}
                    brand={brand}
                    nav={navItems}
                    navigation={nav as unknown as SiteNavigation}
                    currentPageKey={backdropKey}
                    conversion={conversion ?? undefined}
                    layout={chromeLayout}
                    darkChrome={darkChrome}
                    bookHref={homeBookHref}
                    websiteId={websiteId}
                    sections={homeSections}
                    data={homeData}
                  />
                ) : (
                  <div className="vilo-nav">
                    {section === "footer" ? (
                      <NavFooterPreview nav={nav} brandName={brandName} />
                    ) : (
                      <NavHeaderPreview
                        nav={nav}
                        brandName={brandName}
                        device={device}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* inspector */}
            <aside className="epanel r" style={{ width: 348 }}>
              <div className="epanel-h">
                <Icon style={{ width: 16, height: 16, color: "#10B981" }} />
                <h3>{t("navInspectorTitle", { name: title })}</h3>
              </div>
              <div className="epanel-b thin">
                {section === "header" ? (
                  <HeaderInspector
                    nav={nav}
                    setHeader={setHeader}
                    setTop={setTop}
                    pages={pages}
                    transparentDefault={isSafari}
                  />
                ) : (
                  <FooterInspector
                    nav={nav}
                    pages={pages}
                    setFooter={setFooter}
                    setColumns={setColumns}
                  />
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
