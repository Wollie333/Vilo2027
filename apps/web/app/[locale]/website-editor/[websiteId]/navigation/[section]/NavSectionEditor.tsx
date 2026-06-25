"use client";

import {
  ArrowLeft,
  Check,
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
import type { SiteFooterColumn, SiteMenuItem } from "@/lib/site/types";

import {
  NavFooterPreview,
  NavHeaderPreview,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavPreviews";
import {
  MenuBuilder,
  type PageOption,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/MenuBuilder";
import {
  FooterInspector,
  HeaderInspector,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavInspectors";

type Section = "header" | "menu" | "footer";
type Device = "desktop" | "tablet" | "phone";

const SECTION_ICON = { header: PanelTop, menu: Menu, footer: PanelBottom };

export function NavSectionEditor({
  websiteId,
  section,
  initial,
  pages,
  brandName,
  subdomain,
}: {
  websiteId: string;
  section: Section;
  initial: NavigationConfig;
  pages: PageOption[];
  brandName: string;
  subdomain: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [nav, setNav] = useState<NavigationConfig>(initial);
  const [saving, startSave] = useTransition();
  const [device, setDevice] = useState<Device>("desktop");

  const deviceClass =
    device === "tablet"
      ? "device tablet"
      : device === "phone"
        ? "device mobile"
        : "device";
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
        {/* canvas — live preview in the shared device frame */}
        <div className="canvas-wrap thin">
          <div className={deviceClass}>
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
              />
            ) : section === "menu" ? (
              <div className="insp-sec">
                <MenuBuilder
                  menu={nav.menu ?? []}
                  pages={pages}
                  onChange={setMenu}
                />
              </div>
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
      </div>
    </div>
  );
}
