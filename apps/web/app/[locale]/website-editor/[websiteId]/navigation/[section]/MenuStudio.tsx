"use client";

import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Smartphone,
  Trash2,
  Type as TypeIcon,
  CornerDownRight,
} from "lucide-react";
import { useState } from "react";

import { useTranslations } from "next-intl";

import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";
import type { PageOption } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/MenuBuilder";
import { NavHeaderPreview } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavPreviews";
import { SafariNavCanvas } from "@/components/site/safari/SafariNavCanvas";
import { SiteChromeCanvas } from "@/components/site/SiteChromeCanvas";
import { buildSafariNav } from "@/lib/site/safariNav";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  MenuItemStyleLayer,
  MenuPageOverride,
  SiteBrand,
  SiteConversion,
  SiteData,
  SiteMenuDeviceStyle,
  SiteMenuItem,
  SiteNavItem,
  SiteNavigation,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { MenuTree } from "./MenuTree";

type Device = "desktop" | "tablet" | "phone";
type Tab = "links" | "mobile";

// ── Pure tree helpers (path = array of sibling indices) ───────
function uid() {
  return crypto.randomUUID();
}
function newItem(): SiteMenuItem {
  return { id: uid(), label: "New link", href: "/" };
}
function editSiblings(
  menu: SiteMenuItem[],
  path: number[],
  fn: (siblings: SiteMenuItem[], idx: number) => SiteMenuItem[],
): SiteMenuItem[] {
  if (path.length === 1) return fn(menu, path[0]);
  const [i, ...rest] = path;
  return menu.map((it, idx) =>
    idx === i
      ? { ...it, children: editSiblings(it.children ?? [], rest, fn) }
      : it,
  );
}
function getAt(menu: SiteMenuItem[], path: number[]): SiteMenuItem | null {
  let list = menu;
  let node: SiteMenuItem | null = null;
  for (const i of path) {
    node = list[i] ?? null;
    if (!node) return null;
    list = node.children ?? [];
  }
  return node;
}
const samePath = (a: number[] | null, b: number[]) =>
  !!a && a.length === b.length && a.every((v, i) => v === b[i]);

export function MenuStudio({
  nav,
  setMenu,
  setMenuStyle,
  setHeader,
  pages,
  rooms = [],
  device,
  setDevice,
  brandName,
  brand,
  themePreset,
  homeSections = [],
  homeData,
  homeBookHref = null,
  contactEmail = null,
  contactPhone = null,
  themeConfig = null,
  navItems = [],
  conversion = null,
  chromeLayout = "full",
  darkChrome = false,
  backdropKey = "home",
  pageList = [],
  setPerPage,
}: {
  nav: NavigationConfig;
  setMenu: (menu: SiteMenuItem[]) => void;
  setMenuStyle: (patch: Partial<NavigationConfig["menuStyle"]>) => void;
  setHeader: (patch: Partial<NavigationConfig["header"]>) => void;
  pages: PageOption[];
  rooms?: { roomId: string; name: string }[];
  device: Device;
  /** Set the active device (the inspector device tabs drive the shared switcher). */
  setDevice?: (d: Device) => void;
  brandName: string;
  brand: SiteBrand;
  themePreset?: string | null;
  /** The host's real home page (draft) — the canvas backdrop behind the chrome. */
  homeSections?: WebsiteSection[];
  homeData?: SiteData;
  homeBookHref?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  /** Generic-theme canvas inputs (non-Safari). */
  themeConfig?: SiteThemeConfig | null;
  navItems?: SiteNavItem[];
  conversion?: SiteConversion | null;
  chromeLayout?: "full" | "boxed";
  darkChrome?: boolean;
  /** The page sitting behind the menu (canvas backdrop) — for per-page rules. */
  backdropKey?: string;
  /** All pages (key + label) for the per-link page-visibility control. */
  pageList?: { key: string; label: string }[];
  /** Set a per-page appearance/style override (Layout tab → This page). */
  setPerPage?: (key: string, patch: Partial<MenuPageOverride>) => void;
}) {
  const t = useTranslations("website");
  const menu = nav.menu ?? [];
  const isSafari = themePreset === "safari";
  // Is the header transparent over the hero? (Safari defaults to transparent.)
  // Only then does a separate "scrolled" colour make sense.
  const headerTransparent = isSafari
    ? nav.header?.transparentOverHero !== false
    : nav.header?.transparentOverHero === true;
  const safariNav = isSafari
    ? buildSafariNav(
        {
          nav: pages,
          navigation: nav,
          brand,
          preview: false,
          subdomain: "",
        },
        backdropKey,
      )
    : null;
  const [tab, setTab] = useState<Tab>("links");
  const [selected, setSelected] = useState<number[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const selectedItem = selected ? getAt(menu, selected) : null;

  // The selected link's per-device style layer (desktop base / tablet / mobile),
  // driven by the top-bar device switcher — exactly like the global Style tab.
  const selStyle = selectedItem?.style ?? {};
  const selLayer: MenuItemStyleLayer =
    device === "tablet"
      ? (selStyle.tablet ?? {})
      : device === "phone"
        ? (selStyle.mobile ?? {})
        : selStyle;
  const setItemStyle = (patch: Partial<MenuItemStyleLayer>) => {
    if (!selected || !selectedItem) return;
    const cur = selectedItem.style ?? {};
    if (device === "tablet")
      update(selected, {
        style: { ...cur, tablet: { ...(cur.tablet ?? {}), ...patch } },
      });
    else if (device === "phone")
      update(selected, {
        style: { ...cur, mobile: { ...(cur.mobile ?? {}), ...patch } },
      });
    else update(selected, { style: { ...cur, ...patch } });
  };

  const update = (path: number[], patch: Partial<SiteMenuItem>) =>
    setMenu(
      editSiblings(menu, path, (sib, idx) =>
        sib.map((it, k) => (k === idx ? { ...it, ...patch } : it)),
      ),
    );
  const remove = (path: number[]) => {
    setMenu(
      editSiblings(menu, path, (sib, idx) => sib.filter((_, k) => k !== idx)),
    );
    if (samePath(selected, path)) setSelected(null);
  };
  const addChild = (path: number[]) => {
    const item = getAt(menu, path);
    setMenu(
      editSiblings(menu, path, (sib, idx) =>
        sib.map((it, k) =>
          k === idx
            ? { ...it, children: [...(it.children ?? []), newItem()] }
            : it,
        ),
      ),
    );
    setOpen((p) => ({ ...p, [item?.id ?? ""]: true }));
  };
  const addTop = (item?: SiteMenuItem) => setMenu([...menu, item ?? newItem()]);

  // One row of the drag-to-nest tree (the rest of the tree machinery — flatten,
  // depth projection, reorder + reparent — lives in MenuTree).
  const renderRow = ({
    item,
    path,
    depth,
    handleProps,
  }: {
    item: SiteMenuItem;
    path: number[];
    depth: number;
    handleProps: Record<string, unknown>;
    ghost: boolean;
  }) => {
    const hasKids = !!item.children && item.children.length > 0;
    const hasAutoRooms = !!item.autoRooms && rooms.length > 0;
    const isOpen = open[item.id] ?? true;
    const isSel = samePath(selected, path);
    return (
      <div
        className={`group flex items-center gap-0.5 rounded-[8px] py-1 pr-1.5 ${
          isSel ? "bg-brand-light" : "hover:bg-brand-light/50"
        }`}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink active:cursor-grabbing"
          title={t("dragToReorder")}
          aria-label={t("dragToReorder")}
          {...handleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {hasKids || hasAutoRooms ? (
          <button
            type="button"
            onClick={() => setOpen((p) => ({ ...p, [item.id]: !isOpen }))}
            className="text-brand-mute"
            aria-label="Toggle"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <button
          type="button"
          onClick={() => setSelected(path)}
          className="flex flex-1 items-center gap-1.5 truncate text-left text-[13px] font-medium text-brand-ink"
        >
          <span className="truncate">{item.label || t("navLinkLabel")}</span>
          {item.autoRooms ? (
            <span className="shrink-0 rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary">
              {t("menuAutoRoomsBadge")}
            </span>
          ) : null}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          {depth < 2 && !item.autoRooms ? (
            <IconBtn title={t("navAddChild")} onClick={() => addChild(path)}>
              <CornerDownRight className="h-3.5 w-3.5" />
            </IconBtn>
          ) : null}
          <IconBtn title={t("mediaDelete")} danger onClick={() => remove(path)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>
    );
  };

  // Live (read-only) room rows beneath an auto-rooms item — they aren't draggable
  // menu items, so they render here rather than in the flattened tree.
  const renderExtra = (item: SiteMenuItem, path: number[]) => {
    if (!item.autoRooms || rooms.length === 0) return null;
    if (!(open[item.id] ?? true)) return null;
    return (
      <div style={{ marginLeft: 16 }}>
        {rooms.map((r) => {
          const isHidden = (item.hiddenRoomIds ?? []).includes(r.roomId);
          return (
            <div
              key={r.roomId}
              className="group flex items-center gap-1 rounded-[8px] px-1.5 py-1 hover:bg-brand-light/40"
            >
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-brand-line" />
              <button
                type="button"
                onClick={() => setSelected(path)}
                className={`flex-1 truncate text-left text-[12.5px] ${
                  isHidden ? "text-brand-mute line-through" : "text-brand-ink"
                }`}
              >
                {r.name}
              </button>
              <IconBtn
                title={isHidden ? t("menuAutoRoomShow") : t("menuAutoRoomHide")}
                onClick={() => {
                  const set = new Set(item.hiddenRoomIds ?? []);
                  if (isHidden) set.delete(r.roomId);
                  else set.add(r.roomId);
                  update(path, { hiddenRoomIds: [...set] });
                }}
              >
                {isHidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </IconBtn>
            </div>
          );
        })}
      </div>
    );
  };

  const ms = nav.menuStyle ?? {};
  // Device-scoped styling (page-builder pattern): the top-bar device switcher
  // selects which layer the Style tab edits — desktop base, the tablet override,
  // or the mobile drawer. Only the fields that DIFFER from desktop are stored.
  const devLayer: SiteMenuDeviceStyle & { overlayBg?: string } =
    device === "tablet"
      ? (ms.tablet ?? {})
      : device === "phone"
        ? (ms.mobile ?? {})
        : ms;
  const setDeviceStyle = (patch: Partial<SiteMenuDeviceStyle>) => {
    if (device === "tablet")
      setMenuStyle({ tablet: { ...(ms.tablet ?? {}), ...patch } });
    else if (device === "phone")
      setMenuStyle({ mobile: { ...(ms.mobile ?? {}), ...patch } });
    else setMenuStyle(patch);
  };
  // Per-device LOGO override (desktop edits the base header logo; tablet/mobile
  // edit the override). Surfaced in the menu builder's Menu style inspector.
  type LogoLayer = {
    show?: boolean;
    style?: "wordmark" | "icon" | "mark";
    maxHeight?: number;
  };
  const baseLogoLayer: LogoLayer = {
    show: nav.header.showLogo !== false,
    style: nav.header.logoStyle,
    maxHeight: nav.header.logoMaxHeight,
  };
  const logoLayer: LogoLayer =
    device === "tablet"
      ? (nav.header.logoTablet ?? {})
      : device === "phone"
        ? (nav.header.logoMobile ?? {})
        : baseLogoLayer;
  const setLogo = (patch: Partial<LogoLayer>) => {
    if (device === "tablet")
      setHeader({
        logoTablet: { ...(nav.header.logoTablet ?? {}), ...patch },
      });
    else if (device === "phone")
      setHeader({
        logoMobile: { ...(nav.header.logoMobile ?? {}), ...patch },
      });
    else {
      const p: Partial<NavigationConfig["header"]> = {};
      if (patch.show !== undefined) p.showLogo = patch.show;
      if (patch.style !== undefined) p.logoStyle = patch.style;
      if (patch.maxHeight !== undefined) p.logoMaxHeight = patch.maxHeight;
      setHeader(p);
    }
  };
  const resetLogoLayer = () => {
    if (device === "tablet") setHeader({ logoTablet: undefined });
    else if (device === "phone") setHeader({ logoMobile: undefined });
  };

  // Reset the active device's menu style back to the theme default.
  const resetDeviceStyle = () => {
    if (device === "tablet") setMenuStyle({ tablet: undefined });
    else if (device === "phone") setMenuStyle({ mobile: undefined });
    else
      setMenuStyle({
        color: undefined,
        hoverColor: undefined,
        scrolledColor: undefined,
        scrolledHoverColor: undefined,
        fontSize: undefined,
        weight: "medium",
        uppercase: false,
      });
  };

  // Device tab strip (Desktop · Tablet · Mobile) — the single device selector,
  // synced to the canvas; the page-builder pattern, in the inspector header.
  const deviceTabs = (
    <div
      role="tablist"
      className="mx-3 mt-3 overflow-hidden rounded-[10px] border border-brand-line"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}
    >
      {(["desktop", "tablet", "phone"] as const).map((d) => (
        <button
          key={d}
          type="button"
          role="tab"
          aria-selected={device === d}
          onClick={() => setDevice?.(d)}
          className={`px-2 py-1.5 text-[12px] font-semibold transition ${
            device === d
              ? "bg-brand-primary text-white"
              : "bg-white text-brand-mute hover:bg-brand-light"
          }`}
        >
          {t(`menuStyleDevice_${d}`)}
        </button>
      ))}
    </div>
  );

  // GLOBAL menu style — shown in the right inspector when NO link is selected
  // (page-builder "deselect = global settings"). Device-aware via the tabs above.
  const menuStyleInspector = (
    <div className="insp-sec space-y-3">
      {/* LOGO — desktop edits the base header logo; tablet/mobile override it. */}
      <div className="space-y-3 rounded-[10px] border border-brand-line p-2.5">
        <GroupLabel>{t("menuLogoGroup")}</GroupLabel>
        {device !== "desktop" ? (
          <p className="-mt-1 text-[11.5px] text-brand-mute">
            {t("menuLogoOverrideHint")}
          </p>
        ) : null}
        <CheckRow
          label={t("navShowLogo")}
          checked={logoLayer.show ?? baseLogoLayer.show ?? true}
          onChange={(v) => setLogo({ show: v })}
          onReset={device !== "desktop" ? resetLogoLayer : undefined}
        />
        <label className="block">
          <span className="block text-[12.5px] font-semibold text-brand-ink">
            {t("navLogoStyle")}
          </span>
          <select
            value={logoLayer.style ?? ""}
            onChange={(e) =>
              setLogo({
                style: (e.target.value as LogoLayer["style"]) || undefined,
              })
            }
            className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
          >
            <option value="">
              {device === "desktop"
                ? t("navLogoStyleDefault")
                : t("menuItemInherit")}
            </option>
            <option value="wordmark">{t("navLogoStyle_wordmark")}</option>
            <option value="icon">{t("navLogoStyle_icon")}</option>
            <option value="mark">{t("navLogoStyle_mark")}</option>
          </select>
        </label>
        <RangeField
          label={t("navLogoHeight")}
          value={logoLayer.maxHeight}
          fallback={baseLogoLayer.maxHeight ?? 40}
          min={16}
          max={96}
          onChange={(n) => setLogo({ maxHeight: n })}
        />
      </div>

      <GroupLabel>
        {device === "phone"
          ? t("menuStyleOverlayGroup")
          : t("menuStyleTopGroup")}
      </GroupLabel>
      <ColorField
        label={
          device === "desktop" && headerTransparent
            ? t("menuStyleColorOverHero")
            : t("menuStyleColor")
        }
        value={devLayer.color ?? ""}
        onChange={(v) => setDeviceStyle({ color: v || undefined })}
      />
      <ColorField
        label={t("menuStyleHover")}
        value={devLayer.hoverColor ?? ""}
        onChange={(v) => setDeviceStyle({ hoverColor: v || undefined })}
      />
      {device === "desktop" && headerTransparent ? (
        <>
          <ColorField
            label={t("menuStyleColorScrolled")}
            value={ms.scrolledColor ?? ""}
            onChange={(v) => setMenuStyle({ scrolledColor: v || undefined })}
          />
          <ColorField
            label={t("menuStyleHoverScrolled")}
            value={ms.scrolledHoverColor ?? ""}
            onChange={(v) =>
              setMenuStyle({ scrolledHoverColor: v || undefined })
            }
          />
        </>
      ) : null}
      <label className="block">
        <span className="block text-[12.5px] font-semibold text-brand-ink">
          {t("menuStyleWeight")}
        </span>
        <select
          value={devLayer.weight ?? ms.weight ?? "medium"}
          onChange={(e) =>
            setDeviceStyle({
              weight: e.target.value as SiteMenuDeviceStyle["weight"],
            })
          }
          className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
        >
          <option value="normal">{t("menuWeightNormal")}</option>
          <option value="medium">{t("menuWeightMedium")}</option>
          <option value="semibold">{t("menuWeightSemibold")}</option>
          <option value="bold">{t("menuWeightBold")}</option>
        </select>
      </label>
      <CheckRow
        label={t("menuStyleUppercase")}
        checked={devLayer.uppercase ?? ms.uppercase ?? false}
        onChange={(v) => setDeviceStyle({ uppercase: v })}
      />
      <RangeField
        label={t("menuStyleSize")}
        value={devLayer.fontSize}
        fallback={device === "phone" ? 26 : 12}
        min={device === "phone" ? 16 : 9}
        max={device === "phone" ? 48 : 22}
        onChange={(n) => setDeviceStyle({ fontSize: n })}
      />
      {/* Desktop only — dropdown (sub-menu) styling + layout. */}
      {device === "desktop" ? (
        <>
          <div className="mt-1 border-t border-brand-line pt-3">
            <GroupLabel>{t("menuStyleSubGroup")}</GroupLabel>
            <p className="mb-2 text-[11.5px] text-brand-mute">
              {t("menuStyleSubHint")}
            </p>
            <div className="space-y-3">
              <ColorField
                label={t("menuStyleSubColor")}
                value={ms.submenuColor ?? ""}
                onChange={(v) => setMenuStyle({ submenuColor: v })}
              />
              <ColorField
                label={t("menuStyleSubHover")}
                value={ms.submenuHoverColor ?? ""}
                onChange={(v) => setMenuStyle({ submenuHoverColor: v })}
              />
              <ColorField
                label={t("menuStyleSubBg")}
                value={ms.submenuBg ?? ""}
                onChange={(v) => setMenuStyle({ submenuBg: v })}
              />
            </div>
          </div>
          <div className="mt-1 border-t border-brand-line pt-3">
            <GroupLabel>{t("menuTabLayout")}</GroupLabel>
            <label className="mt-2 block">
              <span className="block text-[12.5px] font-semibold text-brand-ink">
                {t("menuAlignLabel")}
              </span>
              <select
                value={ms.align ?? "start"}
                onChange={(e) =>
                  setMenuStyle({
                    align: e.target.value as "start" | "center" | "end",
                  })
                }
                className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
              >
                <option value="start">{t("menuAlign_start")}</option>
                <option value="center">{t("menuAlign_center")}</option>
                <option value="end">{t("menuAlign_end")}</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="flex items-center justify-between text-[12.5px] font-semibold text-brand-ink">
                {t("menuItemGapLabel")}
                <span className="text-[12px] tabular-nums text-brand-mute">
                  {ms.itemGap ?? t("menuItemGapDefault")}
                  {ms.itemGap ? "px" : ""}
                </span>
              </span>
              <input
                type="range"
                min={8}
                max={56}
                value={ms.itemGap ?? 38}
                onChange={(e) =>
                  setMenuStyle({ itemGap: Number(e.target.value) })
                }
                className="mt-2 w-full"
              />
              {ms.itemGap ? (
                <button
                  type="button"
                  onClick={() => setMenuStyle({ itemGap: undefined })}
                  className="mt-1 text-[11.5px] font-medium text-brand-mute hover:text-brand-ink"
                >
                  {t("reset")}
                </button>
              ) : null}
            </label>
          </div>
        </>
      ) : null}
      {/* This-page overrides — appearance + style for the page behind the menu. */}
      {setPerPage
        ? (() => {
            const ppo = nav.perPage?.[backdropKey] ?? {};
            const label =
              pageList.find((p) => p.key === backdropKey)?.label ?? backdropKey;
            const transpVal =
              ppo.transparentOverHero === undefined
                ? ""
                : ppo.transparentOverHero
                  ? "transparent"
                  : "solid";
            return (
              <div className="mt-1 space-y-3 rounded-[10px] border border-brand-line p-2.5">
                <GroupLabel>
                  {t("menuPageOverridesTitle", { page: label })}
                </GroupLabel>
                <p className="text-[11.5px] text-brand-mute">
                  {t("menuPageOverridesHint")}
                </p>
                <label className="block">
                  <span className="block text-[12.5px] font-semibold text-brand-ink">
                    {t("menuPageTransparency")}
                  </span>
                  <select
                    value={transpVal}
                    onChange={(e) =>
                      setPerPage(backdropKey, {
                        transparentOverHero:
                          e.target.value === ""
                            ? undefined
                            : e.target.value === "transparent",
                      })
                    }
                    className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                  >
                    <option value="">{t("menuPageTransp_inherit")}</option>
                    <option value="transparent">
                      {t("menuPageTransp_transparent")}
                    </option>
                    <option value="solid">{t("menuPageTransp_solid")}</option>
                  </select>
                </label>
                <ColorField
                  label={t("menuPageBarColor")}
                  value={ppo.bgColor ?? ""}
                  onChange={(v) =>
                    setPerPage(backdropKey, { bgColor: v || undefined })
                  }
                />
                <ColorField
                  label={
                    headerTransparent
                      ? t("menuStyleColorOverHero")
                      : t("menuStyleColor")
                  }
                  value={ppo.color ?? ""}
                  onChange={(v) =>
                    setPerPage(backdropKey, { color: v || undefined })
                  }
                />
                {headerTransparent ? (
                  <ColorField
                    label={t("menuStyleColorScrolled")}
                    value={ppo.scrolledColor ?? ""}
                    onChange={(v) =>
                      setPerPage(backdropKey, { scrolledColor: v || undefined })
                    }
                  />
                ) : null}
                <RangeField
                  label={t("menuStyleSize")}
                  value={ppo.fontSize}
                  fallback={14}
                  min={9}
                  max={40}
                  onChange={(n) => setPerPage(backdropKey, { fontSize: n })}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPerPage(backdropKey, {
                      transparentOverHero: undefined,
                      bgColor: undefined,
                      color: undefined,
                      hoverColor: undefined,
                      scrolledColor: undefined,
                      fontSize: undefined,
                    })
                  }
                  className="text-[11.5px] font-semibold text-brand-mute hover:text-brand-ink"
                >
                  ↺ {t("menuResetToTheme")}
                </button>
              </div>
            );
          })()
        : null}
      <button
        type="button"
        onClick={resetDeviceStyle}
        className="mt-1 text-[11.5px] font-semibold text-brand-mute hover:text-brand-ink"
      >
        ↺ {t("menuResetToTheme")}
      </button>
    </div>
  );

  // MOBILE MENU panel (left "Mobile menu" tab) — the ☰ chrome: when it collapses,
  // the drawer background, and (task 23) the icon design. Drawer LINK styling lives
  // in the inspector's Mobile device tab.
  const burger = nav.header.burger ?? {};
  const mobileMenuPanel = (
    <div className="insp-sec space-y-3">
      <p className="rounded-[8px] bg-brand-light/60 px-2.5 py-2 text-[11.5px] leading-snug text-brand-mute">
        {t("menuMobilePanelHint")}
      </p>

      {/* The ☰ icon design. */}
      <GroupLabel>{t("menuBurgerGroup")}</GroupLabel>
      <ColorField
        label={t("menuBurgerColor")}
        value={burger.color ?? ""}
        onChange={(v) =>
          setHeader({ burger: { ...burger, color: v || undefined } })
        }
      />
      <ColorField
        label={t("menuBurgerBg")}
        value={burger.bg ?? ""}
        onChange={(v) =>
          setHeader({ burger: { ...burger, bg: v || undefined } })
        }
      />
      <RangeField
        label={t("menuBurgerSize")}
        value={burger.size}
        fallback={26}
        min={16}
        max={48}
        onChange={(n) => setHeader({ burger: { ...burger, size: n } })}
      />
      <label className="block">
        <span className="block text-[12.5px] font-semibold text-brand-ink">
          {t("menuBurgerWeight")}
        </span>
        <select
          value={burger.weight ?? "regular"}
          onChange={(e) =>
            setHeader({
              burger: {
                ...burger,
                weight: e.target.value as "thin" | "regular" | "bold",
              },
            })
          }
          className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
        >
          <option value="thin">{t("menuBurgerThin")}</option>
          <option value="regular">{t("menuBurgerRegular")}</option>
          <option value="bold">{t("menuBurgerBold")}</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-[12.5px] font-semibold text-brand-ink">
          {t("menuBurgerStyle")}
        </span>
        <select
          value={burger.style ?? "lines"}
          onChange={(e) =>
            setHeader({
              burger: {
                ...burger,
                style: e.target.value as "lines" | "short" | "dots" | "grid",
              },
            })
          }
          className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
        >
          <option value="lines">{t("menuBurgerStyle_lines")}</option>
          <option value="short">{t("menuBurgerStyle_short")}</option>
          <option value="dots">{t("menuBurgerStyle_dots")}</option>
          <option value="grid">{t("menuBurgerStyle_grid")}</option>
        </select>
      </label>

      {/* The slide-in drawer. */}
      <div className="mt-1 border-t border-brand-line pt-3">
        <GroupLabel>{t("menuDrawerGroup")}</GroupLabel>
        <div className="mt-2">
          <ColorField
            label={t("menuStyleOverlayBg")}
            value={ms.mobile?.overlayBg ?? ""}
            onChange={(v) =>
              setMenuStyle({
                mobile: { ...(ms.mobile ?? {}), overlayBg: v || undefined },
              })
            }
          />
        </div>
      </div>

      {/* When the inline menu collapses to the ☰. */}
      <div className="mt-1 border-t border-brand-line pt-3">
        <label className="block">
          <span className="block text-[12.5px] font-semibold text-brand-ink">
            {t("navMenuCollapse")}
          </span>
          <select
            value={nav.header.menuCollapse ?? "mobile"}
            onChange={(e) =>
              setHeader({
                menuCollapse: e.target.value as "mobile" | "tablet" | "never",
              })
            }
            className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
          >
            <option value="mobile">{t("navCollapseMobile")}</option>
            <option value="tablet">{t("navCollapseTablet")}</option>
            <option value="never">{t("navCollapseNever")}</option>
          </select>
          <p className="mt-1 text-[11.5px] text-brand-mute">
            {t("navMenuCollapseHint")}
          </p>
        </label>
      </div>
    </div>
  );

  return (
    <>
      {/* LEFT — tabbed builder */}
      <aside className="epanel l" style={{ width: 320 }}>
        <div
          role="tablist"
          className="m-3 grid grid-cols-2 overflow-hidden rounded-[10px] border border-brand-line"
        >
          {(
            [
              ["links", t("menuTabLinks"), TypeIcon],
              ["mobile", t("menuTabMobile"), Smartphone],
            ] as const
          ).map(([key, label, Ico]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                // Opening the Mobile menu tab shows the ☰ + drawer in the canvas.
                if (key === "mobile") setDevice?.("phone");
              }}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 text-[12.5px] font-semibold transition ${
                tab === key
                  ? "bg-brand-primary text-white"
                  : "bg-white text-brand-mute hover:bg-brand-light"
              }`}
            >
              <Ico style={{ width: 14, height: 14 }} />
              {label}
            </button>
          ))}
        </div>

        <div className="epanel-b thin" style={{ paddingTop: 0 }}>
          {tab === "links" ? (
            <div className="insp-sec">
              <div className="px-1.5 pb-2">
                <MenuTree
                  menu={menu}
                  setMenu={setMenu}
                  open={open}
                  renderRow={renderRow}
                  renderExtra={renderExtra}
                />
              </div>
              <button
                type="button"
                onClick={() => addTop()}
                className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-secondary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("navAddLink")}
              </button>
              {pages.length > 0 ? (
                <div className="mt-3">
                  <span className="block text-[11.5px] font-semibold text-brand-mute">
                    {t("menuAddFromPage")}
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      const p = pages.find((x) => x.href === e.target.value);
                      if (p)
                        addTop({ id: uid(), label: p.label, href: p.href });
                      e.target.value = "";
                    }}
                    className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                  >
                    <option value="">{t("menuPickPage")}</option>
                    {pages.map((p) => (
                      <option key={p.href} value={p.href}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : (
            mobileMenuPanel
          )}
        </div>
      </aside>

      {/* CENTER — live preview: the host's REAL home page behind the live chrome,
          so the menu they're editing shows on the actual design (Safari). The
          `nav-scroll-preview` viewport lets them scroll the real page + watch the
          sticky menu behave. Off-theme keeps the generic header preview. */}
      <div className="canvas-wrap thin">
        <div
          className={[
            device === "tablet"
              ? "device tablet"
              : device === "phone"
                ? "device mobile"
                : "device",
            "nav-canvas",
            isSafari ? "nav-scroll-preview" : "",
          ]
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
              forceMobileOpen={device === "phone" && tab !== "mobile"}
              previewDevice={device}
            />
          ) : themeConfig ? (
            <SiteChromeCanvas
              theme={themeConfig}
              brand={brand}
              nav={navItems}
              navigation={nav as unknown as SiteNavigation}
              currentPageKey={backdropKey}
              previewDevice={device}
              conversion={conversion ?? undefined}
              layout={chromeLayout}
              darkChrome={darkChrome}
              bookHref={homeBookHref}
              sections={homeSections}
              data={homeData}
            />
          ) : (
            <div className="vilo-nav">
              <NavHeaderPreview
                nav={nav}
                brandName={brandName}
                device={device}
              />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — selected link inspector */}
      <aside className="epanel r" style={{ width: 312 }}>
        <div className="epanel-h">
          <TypeIcon style={{ width: 16, height: 16, color: "#10B981" }} />
          <h3>
            {selectedItem && selected
              ? t("menuSelectedLink")
              : t("menuStyleTitle")}
          </h3>
        </div>
        {/* Screen-size tabs (page-builder pattern) — drive which device layer the
            controls below edit, for BOTH the link panel and the global menu style. */}
        {deviceTabs}
        <div className="epanel-b thin">
          {selectedItem && selected ? (
            <div className="insp-sec space-y-3">
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("navLinkLabel")}
                </span>
                <input
                  type="text"
                  value={selectedItem.label}
                  maxLength={60}
                  onChange={(e) => update(selected, { label: e.target.value })}
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                />
              </label>
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("navLinkHref")}
                </span>
                <input
                  type="text"
                  value={selectedItem.href}
                  maxLength={500}
                  onChange={(e) => update(selected, { href: e.target.value })}
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                />
              </label>
              {pages.length > 0 ? (
                <label className="block">
                  <span className="block text-[12.5px] font-semibold text-brand-ink">
                    {t("menuLinkToPage")}
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      const p = pages.find((x) => x.href === e.target.value);
                      if (p) update(selected, { href: p.href });
                      e.target.value = "";
                    }}
                    className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                  >
                    <option value="">{t("menuPickPage")}</option>
                    {pages.map((p) => (
                      <option key={p.href} value={p.href}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <CheckRow
                label={t("navLinkNewTab")}
                checked={selectedItem.newTab ?? false}
                onChange={(v) => update(selected, { newTab: v })}
              />

              {/* Auto-rooms: turn this item's dropdown into the live room list. */}
              <div className="space-y-2 rounded-[10px] border border-brand-line p-2.5">
                <CheckRow
                  label={t("menuAutoRoomsToggle")}
                  checked={!!selectedItem.autoRooms}
                  onChange={(v) => {
                    update(selected, {
                      autoRooms: v,
                      hiddenRoomIds: v
                        ? (selectedItem.hiddenRoomIds ?? [])
                        : undefined,
                    });
                    // Expand the item so its rooms populate in the tree at once.
                    if (v) setOpen((p) => ({ ...p, [selectedItem.id]: true }));
                  }}
                />
                {selectedItem.autoRooms ? (
                  rooms.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="block text-[11.5px] text-brand-mute">
                        {t("menuAutoRoomsHint")}
                      </span>
                      {rooms.map((r) => {
                        const hidden = (
                          selectedItem.hiddenRoomIds ?? []
                        ).includes(r.roomId);
                        return (
                          <CheckRow
                            key={r.roomId}
                            label={r.name}
                            checked={!hidden}
                            onChange={(show) => {
                              const set = new Set(
                                selectedItem.hiddenRoomIds ?? [],
                              );
                              if (show) set.delete(r.roomId);
                              else set.add(r.roomId);
                              update(selected, { hiddenRoomIds: [...set] });
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <span className="block text-[11.5px] text-brand-mute">
                      {t("menuAutoRoomsEmpty")}
                    </span>
                  )
                ) : null}
              </div>

              {/* Per-page VISIBILITY — show/hide this link on specific pages.
                  Unchecking a page hides the link there; the canvas reflects it
                  when that page is the backdrop. */}
              {pageList.length > 0 ? (
                <div className="insp-sec space-y-2 border-t border-brand-line pt-3">
                  <GroupLabel>{t("menuPageVisibility")}</GroupLabel>
                  <p className="text-[11.5px] text-brand-mute">
                    {t("menuPageVisibilityHint")}
                  </p>
                  {pageList.map((p) => {
                    const hidden = (selectedItem.hiddenOnPages ?? []).includes(
                      p.key,
                    );
                    return (
                      <CheckRow
                        key={p.key}
                        label={p.label}
                        checked={!hidden}
                        onChange={(show) => {
                          const set = new Set(selectedItem.hiddenOnPages ?? []);
                          if (show) set.delete(p.key);
                          else set.add(p.key);
                          update(selected, {
                            hiddenOnPages: set.size ? [...set] : undefined,
                          });
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}

              {/* Per-link STYLE — overrides the global menu style for THIS link,
                  per screen size (the inspector device tabs pick the layer). */}
              <div className="insp-sec space-y-3 border-t border-brand-line pt-3">
                <GroupLabel>{t("menuItemStyleTitle")}</GroupLabel>
                <p className="-mt-1 text-[11.5px] text-brand-mute">
                  {t("menuItemStyleHint")}
                </p>
                <ColorField
                  label={t("menuStyleColor")}
                  value={selLayer.color ?? ""}
                  onChange={(v) => setItemStyle({ color: v || undefined })}
                />
                <ColorField
                  label={t("menuStyleHover")}
                  value={selLayer.hoverColor ?? ""}
                  onChange={(v) => setItemStyle({ hoverColor: v || undefined })}
                />
                <RangeField
                  label={t("menuStyleSize")}
                  value={selLayer.fontSize}
                  fallback={device === "phone" ? 22 : 14}
                  min={8}
                  max={48}
                  onChange={(n) => setItemStyle({ fontSize: n })}
                />
                <label className="block">
                  <span className="block text-[12.5px] font-semibold text-brand-ink">
                    {t("menuStyleWeight")}
                  </span>
                  <select
                    value={selLayer.weight ?? ""}
                    onChange={(e) =>
                      setItemStyle({
                        weight:
                          (e.target.value as MenuItemStyleLayer["weight"]) ||
                          undefined,
                      })
                    }
                    className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                  >
                    <option value="">{t("menuItemInherit")}</option>
                    <option value="normal">{t("menuWeightNormal")}</option>
                    <option value="medium">{t("menuWeightMedium")}</option>
                    <option value="semibold">{t("menuWeightSemibold")}</option>
                    <option value="bold">{t("menuWeightBold")}</option>
                  </select>
                </label>
                <CheckRow
                  label={t("menuStyleUppercase")}
                  checked={selLayer.uppercase ?? false}
                  onChange={(v) => setItemStyle({ uppercase: v })}
                  onReset={() => setItemStyle({ uppercase: undefined })}
                />
                <ColorField
                  label={t("menuItemBg")}
                  value={selLayer.bg ?? ""}
                  onChange={(v) => setItemStyle({ bg: v || undefined })}
                />
                <CheckRow
                  label={t("menuItemPill")}
                  checked={selLayer.pill ?? false}
                  onChange={(v) => setItemStyle({ pill: v || undefined })}
                  onReset={() => setItemStyle({ pill: undefined })}
                />
                <button
                  type="button"
                  onClick={() =>
                    selected && update(selected, { style: undefined })
                  }
                  className="mt-1 text-[11.5px] font-semibold text-brand-mute hover:text-brand-ink"
                >
                  ↺ {t("menuResetToTheme")}
                </button>
              </div>

              <button
                type="button"
                onClick={() => remove(selected)}
                className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("navDeleteLink")}
              </button>
            </div>
          ) : (
            menuStyleInspector
          )}
        </div>
      </aside>
    </>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1 transition ${
        danger
          ? "text-brand-mute hover:bg-white hover:text-red-600"
          : "text-brand-mute hover:bg-white hover:text-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold text-brand-ink">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value || "#0f172a"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-brand-line bg-white"
        />
        <input
          type="text"
          value={value}
          placeholder="theme default"
          maxLength={40}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-[11.5px] font-medium text-brand-mute hover:text-brand-ink"
          >
            ✕
          </button>
        ) : null}
      </div>
    </label>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-brand-mute">
      {children}
    </div>
  );
}

function RangeField({
  label,
  value,
  fallback,
  min,
  max,
  onChange,
}: {
  label: string;
  value?: number;
  fallback: number;
  min: number;
  max: number;
  onChange: (n: number | undefined) => void;
}) {
  const t = useTranslations("website");
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[12.5px] font-semibold text-brand-ink">
        {label}
        <span className="text-[12px] tabular-nums text-brand-mute">
          {value ?? fallback}px
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value ?? fallback}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
      {typeof value === "number" ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="mt-1 text-[11.5px] font-medium text-brand-mute hover:text-brand-ink"
        >
          {t("reset")}
        </button>
      ) : null}
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  onReset,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** When set + the value is on, shows a reset to clear back to the theme default. */
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-brand-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        {label}
      </label>
      {onReset && checked ? (
        <button
          type="button"
          onClick={onReset}
          className="text-[11.5px] font-medium text-brand-mute hover:text-brand-ink"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
