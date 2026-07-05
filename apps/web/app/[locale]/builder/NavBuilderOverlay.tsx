"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Menu as MenuIcon,
  RotateCcw,
  Check,
  Save,
  Monitor,
  Tablet,
  Smartphone,
  Lock,
  GripVertical,
  IndentIncrease,
  IndentDecrease,
  Trash2,
  Plus,
  Pencil,
  Star,
  X,
  Type as TypeIcon,
  AlignCenter,
  Eye,
  Rows3,
  PanelTop,
  PanelBottom,
  type LucideIcon,
} from "lucide-react";

import { newMenuId } from "@/lib/site/namedMenus";
import type {
  SiteMenuItem,
  SiteNamedMenu,
  SiteMenuStyle,
  SiteMenuDeviceStyle,
  SiteNavigation,
  SiteBrand,
} from "@/lib/site/types";
import { themeSwatches, type SiteThemeConfig } from "@/lib/site/themes";
import { ThemeColorPicker } from "@/components/ui/ThemeColorPicker";
import { FooterColumns } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import type { Brand } from "./BrandStudioOverlay";

type NavHeader = NonNullable<SiteNavigation["header"]>;
type NavFooter = NonNullable<SiteNavigation["footer"]>;
type FootCol = NonNullable<NavFooter["columns"]>[number];
type LeftTab = "links" | "header" | "footer";
type NavDevice = "desktop" | "tablet" | "mobile";
const WEIGHT_PX: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

// ── Menu tree ⇄ flat rows (drag-to-reorder + drag-to-indent) ───────────────
// The Links editor supports ONE level of nesting (a dropdown parent + its
// children). We flatten the tree to rows tagged with a depth, let drag/indent
// reorder the flat list, then rebuild the tree — so a single algorithm handles
// reorder, indent (→ child of the row above) and outdent (→ top-level). A
// depth-0 row that is a parent carries its trailing depth-1 rows as a block.
type FlatRow = { item: SiteMenuItem; depth: 0 | 1 };

function flattenMenu(menu: SiteMenuItem[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const it of menu) {
    rows.push({ item: { ...it, children: undefined }, depth: 0 });
    for (const ch of it.children ?? [])
      rows.push({ item: { ...ch, children: undefined }, depth: 1 });
  }
  return rows;
}

function buildMenu(rows: FlatRow[]): SiteMenuItem[] {
  const out: SiteMenuItem[] = [];
  let cur: SiteMenuItem | null = null;
  for (const r of rows) {
    if (r.depth === 0) {
      cur = { ...r.item, children: undefined };
      out.push(cur);
    } else if (cur) {
      cur.children = [
        ...(cur.children ?? []),
        { ...r.item, children: undefined },
      ];
    } else {
      // Orphan child (nothing above) → promote to a top-level link.
      out.push({ ...r.item, children: undefined });
    }
  }
  return out;
}

/** Apply `fn` to the item with `id` anywhere in the tree (immutable). */
function mapMenuItem(
  menu: SiteMenuItem[],
  id: string,
  fn: (it: SiteMenuItem) => SiteMenuItem,
): SiteMenuItem[] {
  return menu.map((it) =>
    it.id === id
      ? fn(it)
      : it.children
        ? { ...it, children: mapMenuItem(it.children, id, fn) }
        : it,
  );
}

/** Remove the item with `id` anywhere in the tree (immutable). */
function removeMenuItem(menu: SiteMenuItem[], id: string): SiteMenuItem[] {
  return menu
    .filter((it) => it.id !== id)
    .map((it) =>
      it.children ? { ...it, children: removeMenuItem(it.children, id) } : it,
    );
}

// Builder V2 — Phase 4d-1: Nav/Menu builder overlay (link builder + preview).
//
// Reskins the LOCKED nav standard into the `.bse-*` overlay while keeping the
// real `SiteNavigation` JSONB as SSOT. This slice edits the TOP-LEVEL menu
// (rename / reorder / add / delete / quick-add-page) — each item's internals
// (children, autoRooms, hiddenOnPages, style, newTab) are preserved untouched,
// so nothing is lost on save. Per-device style rail, nesting, header/footer and
// per-page controls land in 4d-2+. Persistence via `saveNavigationAction`.

type PageOpt = { key: string; label: string; href: string };

export function NavBuilderOverlay({
  open,
  onClose,
  siteLabel,
  domain,
  menus,
  primaryMenuId,
  onMenusChange,
  onPrimaryMenuChange,
  menuStyle,
  onMenuStyleChange,
  header,
  onHeaderChange,
  footer,
  onFooterChange,
  initialTab = "links",
  pages,
  roomLinks = [],
  brand,
  theme,
  persists,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  siteLabel: string;
  domain: string;
  /** Named menus (multi-menu). At least one is always supplied. */
  menus: SiteNamedMenu[];
  /** Id of the menu that drives the header. */
  primaryMenuId: string;
  onMenusChange: (next: SiteNamedMenu[]) => void;
  onPrimaryMenuChange: (id: string) => void;
  menuStyle: SiteMenuStyle;
  onMenuStyleChange: (next: SiteMenuStyle) => void;
  header: NavHeader;
  onHeaderChange: (next: NavHeader) => void;
  footer: NavFooter;
  onFooterChange: (next: NavFooter) => void;
  /** Which left tab to open on (doc-switcher: "Header & menu" → links, "Footer" → footer). */
  initialTab?: LeftTab;
  pages: PageOpt[];
  /** The host's individual room-detail pages, as selectable menu links. */
  roomLinks?: PageOpt[];
  brand: Brand;
  theme: SiteThemeConfig;
  persists: boolean;
  onSave: (mode: "draft" | "publish") => void;
  onReset: () => void;
}) {
  const [device, setDevice] = useState<NavDevice>("desktop");
  const [leftTab, setLeftTab] = useState<LeftTab>(initialTab);
  const [pubOpen, setPubOpen] = useState(false);
  // Mobile ☰ drawer preview open-state (canvas only).
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Which named menu the Links tab is editing (defaults to the primary).
  const [editingMenuId, setEditingMenuId] = useState<string>(primaryMenuId);
  // Keep the editing target valid: snap to the primary each time the overlay
  // opens, and never point at a deleted menu.
  useEffect(() => {
    if (open) setEditingMenuId(primaryMenuId);
  }, [open, primaryMenuId]);
  // The ☰ drawer preview only exists on the mobile frame — close it otherwise.
  useEffect(() => {
    if (device !== "mobile") setDrawerOpen(false);
  }, [device]);
  const editingMenu =
    menus.find((m) => m.id === editingMenuId) ?? menus[0] ?? null;
  const activeMenuId = editingMenu?.id ?? primaryMenuId;
  const menu: SiteMenuItem[] = editingMenu?.items ?? [];
  // Edit the items of the currently-selected menu, leaving the others untouched.
  const onMenuChange = (nextItems: SiteMenuItem[]) =>
    onMenusChange(
      menus.map((m) =>
        m.id === activeMenuId ? { ...m, items: nextItems } : m,
      ),
    );
  const isPrimary = activeMenuId === primaryMenuId;
  const [renaming, setRenaming] = useState(false);
  const addMenu = () => {
    const id = newMenuId();
    onMenusChange([
      ...menus,
      { id, name: `Menu ${menus.length + 1}`, items: [] },
    ]);
    setEditingMenuId(id);
    setRenaming(true);
  };
  const renameMenu = (name: string) =>
    onMenusChange(
      menus.map((m) => (m.id === activeMenuId ? { ...m, name } : m)),
    );
  const deleteMenu = () => {
    if (menus.length <= 1) return;
    const next = menus.filter((m) => m.id !== activeMenuId);
    onMenusChange(next);
    setEditingMenuId(next[0]?.id ?? "");
    // If the primary was deleted, promote the first remaining menu.
    if (isPrimary && next[0]) onPrimaryMenuChange(next[0].id);
  };
  // Scroll-state preview: the canvas scrolls a mock page behind a STICKY header,
  // so the host can watch (and edit) the transparent → scrolled transition live.
  const [scrolled, setScrolled] = useState(false);
  const setHeader = (patch: Partial<NavHeader>) =>
    onHeaderChange({ ...header, ...patch });
  const setFooter = (patch: Partial<NavFooter>) =>
    onFooterChange({ ...footer, ...patch });
  // Open on the tab the doc-switcher requested each time the overlay opens.
  useEffect(() => {
    if (open) setLeftTab(initialTab);
  }, [open, initialTab]);
  const [openAcc, setOpenAcc] = useState<Set<number>>(() => new Set([0, 1]));
  const toggleAcc = (i: number) =>
    setOpenAcc((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  // ── menu-style helpers (device-aware, mirroring the page-builder inspector) ──
  const isDev = device !== "desktop";
  const layer: SiteMenuDeviceStyle =
    device === "tablet"
      ? (menuStyle.tablet ?? {})
      : device === "mobile"
        ? (menuStyle.mobile ?? {})
        : {};
  // Device-aware fields read the layer (fallback base); base-only fields read base.
  const sVal = <K extends keyof SiteMenuDeviceStyle>(
    k: K,
    dflt: NonNullable<SiteMenuDeviceStyle[K]>,
  ): NonNullable<SiteMenuDeviceStyle[K]> =>
    (isDev && layer[k] != null
      ? layer[k]
      : ((menuStyle[k as keyof SiteMenuStyle] as SiteMenuDeviceStyle[K]) ??
        dflt)) as NonNullable<SiteMenuDeviceStyle[K]>;
  const setDeviceAware = (patch: SiteMenuDeviceStyle) => {
    if (!isDev) {
      onMenuStyleChange({ ...menuStyle, ...patch });
    } else {
      const key = device as "tablet" | "mobile";
      onMenuStyleChange({
        ...menuStyle,
        [key]: { ...(menuStyle[key] ?? {}), ...patch },
      });
    }
  };
  const setBase = (patch: Partial<SiteMenuStyle>) =>
    onMenuStyleChange({ ...menuStyle, ...patch });
  // The ☰ drawer's own styling lives on menuStyle.mobile (always, regardless of the
  // device toggle); the hamburger ICON lives on header.burger.
  const mob = (menuStyle.mobile ?? {}) as NonNullable<SiteMenuStyle["mobile"]>;
  const setMobile = (patch: Partial<NonNullable<SiteMenuStyle["mobile"]>>) =>
    onMenuStyleChange({
      ...menuStyle,
      mobile: { ...(menuStyle.mobile ?? {}), ...patch },
    });
  const burgerCfg = header.burger ?? {};
  const setBurger = (patch: Partial<NonNullable<NavHeader["burger"]>>) =>
    setHeader({ burger: { ...(header.burger ?? {}), ...patch } });
  const [addLabel, setAddLabel] = useState("");
  const idRef = useRef(0);
  const newId = () => `nav-${Date.now().toString(36)}-${++idRef.current}`;

  // Drag state: the id being dragged + a live drop target (row id, whether we
  // drop above/below it, and whether the pointer is indented → nest as a child).
  const dragId = useRef<string | null>(null);
  const [drop, setDrop] = useState<{
    id: string;
    place: "before" | "after";
    indent: boolean;
  } | null>(null);

  // Flattened rows (top-level + one level of children) for the editor list.
  const rows = flattenMenu(menu);

  // ── id-based edits (work at any depth) ──
  const rename = (id: string, label: string) =>
    onMenuChange(mapMenuItem(menu, id, (it) => ({ ...it, label })));
  const remove = (id: string) => onMenuChange(removeMenuItem(menu, id));
  // Per-link destination + settings (custom URLs, open-in-new-tab). Which link's
  // settings row is expanded.
  const [editLink, setEditLink] = useState<string | null>(null);
  const setHref = (id: string, href: string) =>
    onMenuChange(mapMenuItem(menu, id, (it) => ({ ...it, href })));
  const setNewTab = (id: string, newTab: boolean) =>
    onMenuChange(
      mapMenuItem(menu, id, (it) => ({ ...it, newTab: newTab || undefined })),
    );
  const add = (label: string, href: string) => {
    const l = label.trim();
    if (!l) return;
    onMenuChange([...menu, { id: newId(), label: l, href }]);
  };

  // Is the row at index `i` a dropdown parent (a depth-0 row with children)?
  const rowIsParent = (i: number) =>
    rows[i]?.depth === 0 && rows[i + 1]?.depth === 1;

  // Set a row's nesting depth (indent → child of the row above, outdent → top).
  // A parent can't be nested (it would create a 3rd level); the first row can't
  // be a child (nothing above it to parent it).
  const setDepth = (id: string, depth: 0 | 1) => {
    const next = flattenMenu(menu);
    const i = next.findIndex((r) => r.item.id === id);
    if (i < 0 || next[i].depth === depth) return;
    if (depth === 1 && (i === 0 || rowIsParent(i))) return;
    next[i] = { ...next[i], depth };
    onMenuChange(buildMenu(next));
  };

  // Move the dragged block to sit before/after `targetId`, optionally nesting it
  // as a child. The block = the dragged row plus (if it's a parent) its trailing
  // children, so a dropdown moves as a unit.
  const moveLink = (
    dragit: string,
    targetId: string,
    place: "before" | "after",
    indent: boolean,
  ) => {
    if (dragit === targetId) return;
    const all = flattenMenu(menu);
    const from = all.findIndex((r) => r.item.id === dragit);
    if (from < 0) return;
    let end = from + 1;
    if (all[from].depth === 0)
      while (end < all.length && all[end].depth === 1) end++;
    const block = all.slice(from, end);
    // Dropping onto the block itself (or its own child) is a no-op.
    if (block.some((r) => r.item.id === targetId)) return;
    const rest = [...all.slice(0, from), ...all.slice(end)];
    let at = rest.findIndex((r) => r.item.id === targetId);
    if (at < 0) return;
    if (place === "after") at += 1;
    const isParent = block.length > 1;
    const depth: 0 | 1 = indent && !isParent && at > 0 ? 1 : 0;
    block[0] = { ...block[0], depth };
    rest.splice(at, 0, ...block);
    onMenuChange(buildMenu(rest));
  };

  const monogram = (brand.monogram || brand.name?.[0] || "W").slice(0, 2);
  const name = brand.name || siteLabel;
  const accent =
    theme.colors?.accent || theme.base?.palette.accent || "#C8702E";
  // The active theme's palette — every colour swatch in this overlay shows these
  // (Business Principle #6: host-site pickers use the active theme's colours).
  const themeCols = themeSwatches(theme);

  // Resolved preview values for the CURRENT device.
  const rColor = sVal("color", "#F4EEE6");
  const rHover = sVal("hoverColor", accent);
  const rSize = sVal("fontSize", 14);
  const rWeight = sVal("weight", "medium");
  const rUpper = sVal("uppercase", false);
  const rGap = menuStyle.itemGap ?? 6;
  const rAlign = menuStyle.align ?? "end";

  // Resolved header values for the preview.
  const ctaLabel = header.ctaLabel?.trim() || "Reserve";
  const showCta = header.showBookCta !== false;
  const showLogo = header.showLogo !== false;
  const logoStyle = header.logoStyle || "wordmark";
  const showMark = logoStyle !== "wordmark";
  const showName = logoStyle !== "icon";
  const tagline = header.tagline?.trim();
  const logoH = header.logoMaxHeight || 40;

  const cls = ["bse-overlay", open && "show", open && "in"]
    .filter(Boolean)
    .join(" ");
  const deviceCls = device === "desktop" ? "" : ` ${device}`;
  const navCls = [
    "np-nav",
    rUpper && "up",
    rAlign === "center" && "al-center",
    rAlign === "start" && "al-start",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} aria-hidden={!open}>
      <header className="bse-top">
        <button className="bse-back" type="button" onClick={onClose}>
          <ChevronLeft size={16} strokeWidth={2} />
          Back to builder
        </button>
        <div className="bse-div" />
        <div className="bse-title">
          <span className="bse-mark">
            <MenuIcon size={16} strokeWidth={1.9} />
          </span>
          <div>
            <b>Navigation</b>
            <small>Menu · {siteLabel}</small>
          </div>
        </div>
        <div className="bse-spacer" />
        <button
          className="tb-ico"
          type="button"
          title="Reset navigation to the default menu"
          style={{ color: "#BFE3D3" }}
          onClick={onReset}
        >
          <RotateCcw size={18} strokeWidth={1.9} />
        </button>
        <div className="tb-publish">
          <button
            className="tb-btn solid"
            type="button"
            onClick={() => onSave("publish")}
            disabled={!persists}
            title={persists ? "Save the menu" : "Open a real page to save"}
          >
            <Check size={16} strokeWidth={2} />
            Save menu
          </button>
          <button
            className="tb-caret"
            type="button"
            title="Save options"
            onClick={(e) => {
              e.stopPropagation();
              setPubOpen((o) => !o);
            }}
          >
            <ChevronDown size={14} strokeWidth={2.2} />
          </button>
          <div
            className={pubOpen ? "tb-menu show" : "tb-menu"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setPubOpen(false);
                onSave("draft");
              }}
            >
              <span className="mi">
                <Save size={16} strokeWidth={1.9} />
              </span>
              <span>
                <b>Save as draft</b>
                <small>Preview without going live</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPubOpen(false);
                onSave("publish");
              }}
            >
              <span className="mi">
                <Check size={16} strokeWidth={1.9} />
              </span>
              <span>
                <b>Publish navigation</b>
                <small>Apply across every page</small>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="bse-body">
        {/* link builder / header inspector */}
        <aside className="nav-left">
          <div className="nav-left-tabs">
            <button
              type="button"
              className={leftTab === "links" ? "nav-tab on" : "nav-tab"}
              onClick={() => setLeftTab("links")}
            >
              <MenuIcon size={15} strokeWidth={1.9} />
              Links
            </button>
            <button
              type="button"
              className={leftTab === "header" ? "nav-tab on" : "nav-tab"}
              onClick={() => setLeftTab("header")}
            >
              <PanelTop size={15} strokeWidth={1.9} />
              Header
            </button>
            <button
              type="button"
              className={leftTab === "footer" ? "nav-tab on" : "nav-tab"}
              onClick={() => setLeftTab("footer")}
            >
              <PanelBottom size={15} strokeWidth={1.9} />
              Footer
            </button>
          </div>
          <div className="nav-left-body">
            {leftTab === "header" ? (
              <NavHeaderInspector
                header={header}
                setHeader={setHeader}
                showCta={showCta}
                showLogo={showLogo}
                menus={menus}
                primaryMenuId={primaryMenuId}
                onPrimaryMenuChange={onPrimaryMenuChange}
              />
            ) : leftTab === "footer" ? (
              <NavFooterInspector footer={footer} setFooter={setFooter} />
            ) : (
              <>
                {/* Menu switcher — pick / create / rename / delete a named menu.
                    The link list below edits the SELECTED menu; the header renders
                    the PRIMARY menu (chosen here or on the Header tab). */}
                <div className="nav-lbl" style={{ marginTop: 8 }}>
                  Menu
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {renaming ? (
                    <input
                      className="bse-input"
                      autoFocus
                      style={{ flex: 1 }}
                      value={editingMenu?.name ?? ""}
                      onChange={(e) => renameMenu(e.target.value)}
                      onBlur={() => setRenaming(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setRenaming(false);
                      }}
                    />
                  ) : (
                    <select
                      className="bse-select"
                      style={{ flex: 1 }}
                      value={activeMenuId}
                      onChange={(e) => setEditingMenuId(e.target.value)}
                    >
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.id === primaryMenuId ? " · primary" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="lact"
                    type="button"
                    title="Rename this menu"
                    onClick={() => setRenaming((r) => !r)}
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button
                    className="lact"
                    type="button"
                    title="New menu"
                    onClick={addMenu}
                  >
                    <Plus size={15} strokeWidth={2} />
                  </button>
                  <button
                    className="lact del"
                    type="button"
                    title={
                      menus.length <= 1
                        ? "A site needs at least one menu"
                        : "Delete this menu"
                    }
                    disabled={menus.length <= 1}
                    onClick={deleteMenu}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
                {isPrimary ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      margin: "8px 0 2px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#0F7A52",
                    }}
                  >
                    <Star size={12} strokeWidth={2.2} fill="currentColor" />
                    This is the header (primary) menu
                  </div>
                ) : (
                  <button
                    className="nav-tab"
                    type="button"
                    style={{ width: "100%", margin: "8px 0 2px" }}
                    onClick={() => onPrimaryMenuChange(activeMenuId)}
                  >
                    <Star size={13} strokeWidth={2} />
                    Make this the header menu
                  </button>
                )}

                <div className="nav-lbl" style={{ marginTop: 14 }}>
                  Links · drag to reorder · drag right to nest a dropdown
                </div>
                <div className="nav-links">
                  {rows.map((r, i) => {
                    const it = r.item;
                    const parent = rowIsParent(i);
                    const canIndent = i > 0 && !parent && r.depth === 0;
                    const isDrop = drop?.id === it.id;
                    const dropAt = (e: React.DragEvent) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      return {
                        place: (e.clientY - rect.top < rect.height / 2
                          ? "before"
                          : "after") as "before" | "after",
                        indent: e.clientX - rect.left > 42,
                      };
                    };
                    return (
                      <div key={it.id} className="nav-linkwrap">
                        <div
                          className={[
                            "nav-link",
                            r.depth === 1 && "child",
                            isDrop && `drop-${drop!.place}`,
                            isDrop && drop!.indent && "drop-indent",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          draggable
                          onDragStart={() => {
                            dragId.current = it.id;
                          }}
                          onDragEnd={() => {
                            dragId.current = null;
                            setDrop(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            const { place, indent } = dropAt(e);
                            setDrop({ id: it.id, place, indent });
                          }}
                          onDragLeave={() =>
                            setDrop((d) => (d?.id === it.id ? null : d))
                          }
                          onDrop={(e) => {
                            e.preventDefault();
                            const { place, indent } = dropAt(e);
                            if (dragId.current)
                              moveLink(dragId.current, it.id, place, indent);
                            dragId.current = null;
                            setDrop(null);
                          }}
                        >
                          <span
                            className="grip"
                            title="Drag to reorder · drag right to nest"
                          >
                            <GripVertical size={14} strokeWidth={2} />
                          </span>
                          <input
                            className="lk"
                            value={it.label}
                            onChange={(e) => rename(it.id, e.target.value)}
                          />
                          {parent && <span className="drop-badge">menu</span>}
                          {it.autoRooms && (
                            <span className="drop-badge">rooms</span>
                          )}
                          {r.depth === 1 ? (
                            <button
                              className="lact"
                              type="button"
                              title="Move back to the top level"
                              onClick={() => setDepth(it.id, 0)}
                            >
                              <IndentDecrease size={14} strokeWidth={2} />
                            </button>
                          ) : (
                            <button
                              className="lact"
                              type="button"
                              disabled={!canIndent}
                              title={
                                canIndent
                                  ? "Nest under the link above (dropdown)"
                                  : parent
                                    ? "A dropdown can't nest inside another"
                                    : "Add a link above to nest under it"
                              }
                              onClick={() => setDepth(it.id, 1)}
                            >
                              <IndentIncrease size={14} strokeWidth={2} />
                            </button>
                          )}
                          <button
                            className="lact chev"
                            type="button"
                            title="Link destination & settings"
                            onClick={() =>
                              setEditLink((v) => (v === it.id ? null : it.id))
                            }
                          >
                            <ChevronDown
                              size={14}
                              strokeWidth={2}
                              style={{
                                transform:
                                  editLink === it.id
                                    ? "rotate(180deg)"
                                    : undefined,
                                transition: "transform 0.18s",
                              }}
                            />
                          </button>
                          <button
                            className="lact del"
                            type="button"
                            title="Delete"
                            onClick={() => remove(it.id)}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                        {editLink === it.id ? (
                          <div className="nav-linkset">
                            <label className="nav-linkset-row">
                              <span>Link URL</span>
                              <input
                                value={it.href}
                                placeholder="/about  ·  https://example.com"
                                onChange={(e) => setHref(it.id, e.target.value)}
                              />
                            </label>
                            <label className="nav-linkset-tog">
                              <input
                                type="checkbox"
                                checked={!!it.newTab}
                                onChange={(e) =>
                                  setNewTab(it.id, e.target.checked)
                                }
                              />
                              Open in a new tab
                            </label>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {menu.length === 0 && (
                    <div className="hint">
                      No links yet. Add one below or quick-add a page.
                    </div>
                  )}
                </div>

                <div className="nav-add">
                  <input
                    value={addLabel}
                    placeholder="New link label…"
                    onChange={(e) => setAddLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        add(addLabel, "#");
                        setAddLabel("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      add(addLabel, "#");
                      setAddLabel("");
                    }}
                  >
                    <Plus size={15} strokeWidth={2} />
                    Add
                  </button>
                </div>

                <div className="nav-quick">
                  <div className="nav-lbl" style={{ marginTop: 16 }}>
                    Quick-add a page
                  </div>
                  <select
                    className="bse-select"
                    value=""
                    onChange={(e) => {
                      const p = pages.find((x) => x.key === e.target.value);
                      if (p) add(p.label, p.href);
                    }}
                  >
                    <option value="">Choose a page…</option>
                    {pages.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {roomLinks.length > 0 && (
                  <div className="nav-quick">
                    <div className="nav-lbl" style={{ marginTop: 12 }}>
                      Quick-add a room page
                    </div>
                    <select
                      className="bse-select"
                      value=""
                      onChange={(e) => {
                        const r = roomLinks.find(
                          (x) => x.key === e.target.value,
                        );
                        if (r) add(r.label, r.href);
                      }}
                    >
                      <option value="">Choose a room…</option>
                      {roomLinks.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* live header preview */}
        <div className="bse-stage">
          <div className="bse-chrome">
            <div className="bse-dots">
              <span style={{ background: "#FF5F57" }} />
              <span style={{ background: "#FEBC2E" }} />
              <span style={{ background: "#28C840" }} />
            </div>
            <div className="bse-url">
              <Lock size={12} strokeWidth={2} color="#34D399" />
              {domain}
            </div>
            <div className="bse-spacer" />
            <div className="bse-devtog">
              {(
                [
                  ["desktop", Monitor],
                  ["tablet", Tablet],
                  ["mobile", Smartphone],
                ] as [NavDevice, LucideIcon][]
              ).map(([d, Icon]) => (
                <button
                  key={d}
                  type="button"
                  className={device === d ? "bse-devbtn on" : "bse-devbtn"}
                  title={d}
                  onClick={() => setDevice(d)}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>
          <div className="bse-scroll">
            <div
              className={`bse-device${deviceCls}`}
              style={{ position: "relative" }}
            >
              <div
                className="nav-site"
                onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 20)}
                style={
                  {
                    "--site-accent": accent,
                    "--site-ink": theme.base?.palette.ink,
                    "--nlink": rColor,
                    "--nhover": rHover,
                    "--nsize": `${rSize}px`,
                    "--nweight": WEIGHT_PX[rWeight] ?? 600,
                    "--ngap": `${rGap}px`,
                    // Scrolled-state colours (from the "Scrolled state" panel) — the
                    // sticky header flips to these once the mock page scrolls.
                    "--nlink-scrolled":
                      menuStyle.scrolledColor ??
                      theme.base?.palette.ink ??
                      "#2C2620",
                    "--nbar-scrolled-bg": header.scrolledBgColor ?? "#ffffff",
                    // Scrolled drop-shadow — the mock bar lifts once scrolled.
                    // Off → keep the subtle hairline the bar always had.
                    "--nbar-shadow": header.scrolledShadow
                      ? `0 4px ${header.scrolledShadowSize ?? 18}px 0 ${
                          header.scrolledShadowColor?.trim() ||
                          "rgba(0,0,0,0.12)"
                        }`
                      : "0 1px 0 rgba(10,20,15,0.1)",
                  } as React.CSSProperties
                }
              >
                {leftTab === "footer" ? (
                  // Render the REAL themed footer (same FooterColumns component +
                  // SiteThemeRoot the live site uses) so the footer builder canvas
                  // matches the published footer exactly.
                  <SiteThemeRoot theme={theme}>
                    <footer
                      style={{
                        background: "var(--site-surface)",
                        borderTop: "1px solid var(--site-line)",
                      }}
                    >
                      <FooterColumns
                        brand={{
                          name,
                          tagline: brand.tagline ?? null,
                          monogram: brand.monogram ?? null,
                          socials: brand.socials as SiteBrand["socials"],
                        }}
                        columns={footer.columns ?? []}
                        copyright={footer.copyright}
                      />
                    </footer>
                  </SiteThemeRoot>
                ) : (
                  <>
                    <div className="np-hero">
                      <div className="np-bar" data-scrolled={scrolled}>
                        {showLogo && (
                          <div className="np-logo">
                            {showMark && (
                              <span
                                className="mk"
                                style={{
                                  width: logoH,
                                  height: logoH,
                                  fontSize: Math.round(logoH * 0.42),
                                }}
                              >
                                {monogram}
                              </span>
                            )}
                            {showName && <span className="lname">{name}</span>}
                            {tagline && (
                              <span
                                style={{
                                  fontSize: 11,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                  color: "var(--naccent)",
                                  marginLeft: 4,
                                }}
                              >
                                {tagline}
                              </span>
                            )}
                          </div>
                        )}
                        {device !== "mobile" && (
                          <nav className={navCls}>
                            {menu.map((it, i) => (
                              <span
                                key={it.id}
                                className={i === 0 ? "nl active" : "nl"}
                              >
                                {it.label}
                                {it.children && it.children.length > 0 && (
                                  <ChevronDown
                                    className="cx"
                                    size={13}
                                    strokeWidth={2.2}
                                  />
                                )}
                              </span>
                            ))}
                            {showCta && (
                              <span className="np-reserve">{ctaLabel}</span>
                            )}
                          </nav>
                        )}
                        {device === "mobile" && (
                          <button
                            type="button"
                            aria-label={drawerOpen ? "Close menu" : "Open menu"}
                            onClick={() => setDrawerOpen((o) => !o)}
                            style={{
                              marginLeft: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: (burgerCfg.size ?? 26) + 14,
                              height: (burgerCfg.size ?? 26) + 14,
                              borderRadius: 9,
                              border: "none",
                              cursor: "pointer",
                              background:
                                burgerCfg.bg && burgerCfg.bg !== "transparent"
                                  ? burgerCfg.bg
                                  : "transparent",
                              color: burgerCfg.color ?? "#052E1F",
                            }}
                          >
                            {drawerOpen ? (
                              <X size={burgerCfg.size ?? 26} strokeWidth={2} />
                            ) : (
                              <MenuIcon
                                size={burgerCfg.size ?? 26}
                                strokeWidth={2}
                              />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="np-herovis">
                        <div className="np-eyebrow">
                          {siteLabel} · Book direct
                        </div>
                        <div className="np-title">Your stay, your way</div>
                      </div>
                      {/* Mock page below the hero so the canvas SCROLLS — the sticky
                        header flips to its scrolled state as you scroll down. */}
                      <div className="np-body">
                        <div className="np-sec">
                          <span className="np-eyeb2">The stay</span>
                          <div className="np-h2">
                            Scroll to preview the header
                          </div>
                          <p className="np-p">
                            As the page scrolls under the sticky header, it
                            switches to the scrolled-state colours from the
                            panel on the right — so you can style both states
                            and see them here.
                          </p>
                        </div>
                        <div className="np-tiles">
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="np-sec">
                          <div className="np-h2">Everything, taken care of</div>
                          <p className="np-p">
                            A representative page block, just to give the header
                            room to move.
                          </p>
                        </div>
                        <div className="np-band" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Mobile ☰ drawer — a working preview of the menu overlay, styled
                  live from the Mobile-menu panel (overlay bg, link colour/size,
                  backdrop tint). Opens/closes from the hamburger above. */}
              {device === "mobile" && leftTab !== "footer" && drawerOpen && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 40,
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    onClick={() => setDrawerOpen(false)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: mob.backdropColor ?? "rgba(0,0,0,0.4)",
                    }}
                  />
                  <aside
                    style={{
                      position: "relative",
                      width: "78%",
                      maxWidth: 320,
                      height: "100%",
                      background: mob.overlayBg ?? "#FFFFFF",
                      boxShadow: "-8px 0 30px rgba(0,0,0,0.18)",
                      padding: "16px 18px 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      overflowY: "auto",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Close menu"
                      onClick={() => setDrawerOpen(false)}
                      style={{
                        alignSelf: "flex-end",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: mob.color ?? "#052E1F",
                        padding: 4,
                        marginBottom: 4,
                      }}
                    >
                      <X size={20} strokeWidth={2} />
                    </button>
                    {menu.length === 0 && (
                      <span style={{ opacity: 0.5, fontSize: 13 }}>
                        No links in this menu yet.
                      </span>
                    )}
                    {menu.map((it) => (
                      <span
                        key={it.id}
                        style={{
                          padding: "11px 2px",
                          borderBottom: "1px solid rgba(128,128,128,0.18)",
                          color: mob.color ?? "#052E1F",
                          fontSize: mob.fontSize ?? 16,
                          fontWeight: WEIGHT_PX[mob.weight ?? "medium"] ?? 500,
                          textTransform: mob.uppercase ? "uppercase" : "none",
                          letterSpacing: mob.uppercase ? "0.04em" : undefined,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        {it.label}
                        {((it.children && it.children.length > 0) ||
                          it.autoRooms) && (
                          <ChevronDown
                            size={15}
                            strokeWidth={2}
                            style={{ opacity: 0.5 }}
                          />
                        )}
                      </span>
                    ))}
                    {showCta && (
                      <span
                        className="np-reserve"
                        style={{
                          marginTop: 16,
                          justifyContent: "center",
                          textAlign: "center",
                        }}
                      >
                        {ctaLabel}
                      </span>
                    )}
                  </aside>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* per-device style rail (menu styling — hidden on the Footer tab) */}
        {leftTab !== "footer" && (
          <aside className="bse-rail nav-right">
            <div className="nav-devbar">
              <span className="dl">Styling</span>
              <div className="nav-devseg">
                {(
                  [
                    ["desktop", Monitor],
                    ["tablet", Tablet],
                    ["mobile", Smartphone],
                  ] as [NavDevice, LucideIcon][]
                ).map(([d, Icon]) => (
                  <button
                    key={d}
                    type="button"
                    className={device === d ? "on" : undefined}
                    title={d}
                    onClick={() => setDevice(d)}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                  </button>
                ))}
              </div>
              {isDev && <span className="nav-dtag">{device}</span>}
            </div>

            <NavAcc
              i={0}
              openAcc={openAcc}
              toggle={toggleAcc}
              Icon={TypeIcon}
              title="Top-level links"
              sub="Colour, weight & size"
            >
              <Swatch
                label="Link colour"
                value={rColor}
                swatches={themeCols}
                onChange={(v) => setDeviceAware({ color: v })}
              />
              <Swatch
                label="Hover colour"
                value={rHover}
                swatches={themeCols}
                onChange={(v) => setDeviceAware({ hoverColor: v })}
              />
              <SelRow
                label="Font weight"
                value={rWeight}
                options={[
                  ["normal", "Light"],
                  ["medium", "Regular"],
                  ["semibold", "Semibold"],
                  ["bold", "Bold"],
                ]}
                onChange={(v) =>
                  setDeviceAware({ weight: v as SiteMenuDeviceStyle["weight"] })
                }
              />
              <ToggleRow
                label="UPPERCASE links"
                value={rUpper}
                onChange={(v) => setDeviceAware({ uppercase: v })}
              />
              <Rng
                label="Link size"
                min={11}
                max={20}
                value={rSize}
                suffix="px"
                onChange={(v) => setDeviceAware({ fontSize: v })}
              />
            </NavAcc>

            <NavAcc
              i={1}
              openAcc={openAcc}
              toggle={toggleAcc}
              Icon={AlignCenter}
              title="Layout"
              sub="Alignment & spacing (all devices)"
            >
              <SegRow
                label="Menu alignment"
                value={menuStyle.align ?? "end"}
                options={[
                  ["start", "Left"],
                  ["center", "Center"],
                  ["end", "Right"],
                ]}
                onChange={(v) =>
                  setBase({ align: v as SiteMenuStyle["align"] })
                }
              />
              <Rng
                label="Link spacing"
                min={0}
                max={28}
                value={menuStyle.itemGap ?? 6}
                suffix="px"
                onChange={(v) => setBase({ itemGap: v })}
              />
            </NavAcc>

            <NavAcc
              i={2}
              openAcc={openAcc}
              toggle={toggleAcc}
              Icon={Eye}
              title="Scrolled state"
              sub="Transparent-over-hero headers"
            >
              <Swatch
                label="Scrolled background"
                value={header.scrolledBgColor ?? "#FFFFFF"}
                swatches={themeCols}
                onChange={(v) => setHeader({ scrolledBgColor: v })}
              />
              <Swatch
                label="Scrolled link colour"
                value={menuStyle.scrolledColor ?? "#2C2620"}
                swatches={themeCols}
                onChange={(v) => setBase({ scrolledColor: v })}
              />
              <Swatch
                label="Scrolled hover colour"
                value={menuStyle.scrolledHoverColor ?? accent}
                swatches={themeCols}
                onChange={(v) => setBase({ scrolledHoverColor: v })}
              />
              <Swatch
                label="Scrolled border colour"
                value={header.scrolledBorderColor ?? "#E4EFE8"}
                swatches={themeCols}
                onChange={(v) => setHeader({ scrolledBorderColor: v })}
              />
              <ToggleRow
                label="Drop-shadow on scroll"
                value={!!header.scrolledShadow}
                onChange={(v) => setHeader({ scrolledShadow: v })}
              />
              {header.scrolledShadow ? (
                <>
                  <Swatch
                    label="Shadow colour"
                    value={header.scrolledShadowColor ?? "rgba(0,0,0,0.12)"}
                    swatches={themeCols}
                    onChange={(v) => setHeader({ scrolledShadowColor: v })}
                  />
                  <Rng
                    label="Shadow size"
                    min={0}
                    max={60}
                    value={header.scrolledShadowSize ?? 18}
                    suffix="px"
                    onChange={(v) => setHeader({ scrolledShadowSize: v })}
                  />
                </>
              ) : null}
            </NavAcc>

            <NavAcc
              i={3}
              openAcc={openAcc}
              toggle={toggleAcc}
              Icon={Rows3}
              title="Dropdown menu"
              sub="Sub-item styling"
            >
              <Swatch
                label="Item colour"
                value={menuStyle.submenuColor ?? "#3A2E20"}
                swatches={themeCols}
                onChange={(v) => setBase({ submenuColor: v })}
              />
              <Swatch
                label="Item hover colour"
                value={menuStyle.submenuHoverColor ?? "#065F46"}
                swatches={themeCols}
                onChange={(v) => setBase({ submenuHoverColor: v })}
              />
              <Swatch
                label="Background"
                value={menuStyle.submenuBg ?? "#FFFFFF"}
                swatches={themeCols}
                onChange={(v) => setBase({ submenuBg: v })}
              />
              <Swatch
                label="Scrolled item colour"
                value={menuStyle.scrolledSubmenuColor ?? "#3A2E20"}
                swatches={themeCols}
                onChange={(v) => setBase({ scrolledSubmenuColor: v })}
              />
              <Swatch
                label="Scrolled background"
                value={menuStyle.scrolledSubmenuBg ?? "#FFFFFF"}
                swatches={themeCols}
                onChange={(v) => setBase({ scrolledSubmenuBg: v })}
              />
            </NavAcc>

            {/* Mobile menu — the ☰ drawer overlay + the hamburger icon. Always
                edits menuStyle.mobile / header.burger (mobile-specific), regardless
                of the device toggle above. Applies on the live site + canvas. */}
            <NavAcc
              i={4}
              openAcc={openAcc}
              toggle={toggleAcc}
              Icon={Smartphone}
              title="Mobile menu"
              sub="The ☰ drawer overlay + hamburger"
            >
              <Swatch
                label="Overlay background"
                value={mob.overlayBg ?? "#FFFFFF"}
                swatches={themeCols}
                onChange={(v) => setMobile({ overlayBg: v })}
              />
              <Swatch
                label="Link colour"
                value={mob.color ?? "#052E1F"}
                swatches={themeCols}
                onChange={(v) => setMobile({ color: v })}
              />
              <Rng
                label="Link size"
                min={14}
                max={28}
                value={mob.fontSize ?? 16}
                suffix="px"
                onChange={(v) => setMobile({ fontSize: v })}
              />
              <SelRow
                label="Link weight"
                value={mob.weight ?? "medium"}
                options={[
                  ["normal", "Light"],
                  ["medium", "Regular"],
                  ["semibold", "Semibold"],
                  ["bold", "Bold"],
                ]}
                onChange={(v) =>
                  setMobile({ weight: v as SiteMenuDeviceStyle["weight"] })
                }
              />
              <ToggleRow
                label="UPPERCASE links"
                value={mob.uppercase ?? false}
                onChange={(v) => setMobile({ uppercase: v })}
              />
              <Swatch
                label="Backdrop tint"
                value={mob.backdropColor ?? "rgba(0,0,0,0.4)"}
                swatches={themeCols}
                onChange={(v) => setMobile({ backdropColor: v })}
              />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.55,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "12px 0 2px",
                }}
              >
                Hamburger icon
              </div>
              <SelRow
                label="Icon style"
                value={burgerCfg.style ?? "lines"}
                options={[
                  ["lines", "Lines"],
                  ["short", "Staggered"],
                  ["dots", "Dots"],
                  ["grid", "Grid"],
                ]}
                onChange={(v) =>
                  setBurger({
                    style: v as NonNullable<NavHeader["burger"]>["style"],
                  })
                }
              />
              <Swatch
                label="Icon colour"
                value={burgerCfg.color ?? "#052E1F"}
                swatches={themeCols}
                onChange={(v) => setBurger({ color: v })}
              />
              <Swatch
                label="Button background"
                value={burgerCfg.bg ?? "transparent"}
                swatches={themeCols}
                onChange={(v) => setBurger({ bg: v })}
              />
              <Rng
                label="Icon size"
                min={18}
                max={40}
                value={burgerCfg.size ?? 26}
                suffix="px"
                onChange={(v) => setBurger({ size: v })}
              />
            </NavAcc>
          </aside>
        )}
      </div>
    </div>
  );
}

// ── rail control primitives ───────────────────────────────────
function NavAcc({
  i,
  openAcc,
  toggle,
  Icon,
  title,
  sub,
  children,
}: {
  i: number;
  openAcc: Set<number>;
  toggle: (i: number) => void;
  Icon: LucideIcon;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  const isOpen = openAcc.has(i);
  return (
    <section className={isOpen ? "bse-acc open" : "bse-acc"}>
      <button className="bse-acc-head" type="button" onClick={() => toggle(i)}>
        <span className="hic">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span>
          <span className="tt">{title}</span>
          <span className="sb">{sub}</span>
        </span>
        <ChevronDown className="chev" size={18} strokeWidth={1.9} />
      </button>
      <div className="bse-acc-body">{children}</div>
    </section>
  );
}

function Ctl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bse-ctl">
      <div className="bse-lbl">{label}</div>
      {children}
    </div>
  );
}

// Single-swatch colour field — the app-wide SSOT `ThemeColorPicker` (one active
// circle → popover above with the theme palette + a custom picker). `swatches` is
// the active theme's palette (Business Principle #6).
function Swatch({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Ctl label={label}>
      <ThemeColorPicker
        value={value || undefined}
        fallback={value || "#000000"}
        swatches={swatches}
        onChange={onChange}
      />
    </Ctl>
  );
}

function SelRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <Ctl label={label}>
      <select
        className="bse-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Ctl>
  );
}

function SegRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <Ctl label={label}>
      <div className="bse-seg">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={value === v ? "opt on" : "opt"}
            onClick={() => onChange(v)}
          >
            <span className="nm">{l}</span>
          </button>
        ))}
      </div>
    </Ctl>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bse-ctl">
      <div className="togrow">
        <label>{label}</label>
        <div
          className={value ? "tog on" : "tog"}
          onClick={() => onChange(!value)}
        />
      </div>
    </div>
  );
}

function Rng({
  label,
  min,
  max,
  value,
  suffix,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Ctl label={label}>
      <div className="bse-rng-row">
        <input
          className="bse-rng"
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="bse-rng-val">
          {value}
          {suffix ?? ""}
        </span>
      </div>
    </Ctl>
  );
}

// ── Header inspector (left "Header" tab) ──────────────────────
function NavHeaderInspector({
  header,
  setHeader,
  showCta,
  showLogo,
  menus,
  primaryMenuId,
  onPrimaryMenuChange,
}: {
  header: NavHeader;
  setHeader: (patch: Partial<NavHeader>) => void;
  showCta: boolean;
  showLogo: boolean;
  menus: SiteNamedMenu[];
  primaryMenuId: string;
  onPrimaryMenuChange: (id: string) => void;
}) {
  return (
    <>
      <div className="nav-lbl" style={{ marginTop: 10 }}>
        Primary menu
      </div>
      <Ctl label="Menu shown in the header">
        <select
          className="bse-select"
          value={primaryMenuId}
          onChange={(e) => onPrimaryMenuChange(e.target.value)}
        >
          {menus.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.items.length} link
              {m.items.length === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </Ctl>

      <div className="nav-lbl" style={{ marginTop: 16 }}>
        Brand & CTA
      </div>
      <Ctl label="Book button label">
        <input
          className="bse-input"
          value={header.ctaLabel ?? ""}
          placeholder="Reserve"
          onChange={(e) => setHeader({ ctaLabel: e.target.value })}
        />
      </Ctl>
      <Ctl label="Tagline">
        <input
          className="bse-input"
          value={header.tagline ?? ""}
          placeholder="Beside the brand name"
          onChange={(e) => setHeader({ tagline: e.target.value })}
        />
      </Ctl>
      <ToggleRow
        label="Show “Book now” button"
        value={showCta}
        onChange={(v) => setHeader({ showBookCta: v })}
      />

      <div className="nav-lbl" style={{ marginTop: 16 }}>
        Behaviour
      </div>
      <ToggleRow
        label="Sticky header"
        value={header.sticky !== false}
        onChange={(v) => setHeader({ sticky: v })}
      />
      <ToggleRow
        label="Transparent over hero"
        value={!!header.transparentOverHero}
        onChange={(v) => setHeader({ transparentOverHero: v })}
      />

      <div className="nav-lbl" style={{ marginTop: 16 }}>
        Logo
      </div>
      <ToggleRow
        label="Show logo"
        value={showLogo}
        onChange={(v) => setHeader({ showLogo: v })}
      />
      <SegRow
        label="Logo style"
        value={header.logoStyle ?? "wordmark"}
        options={[
          ["wordmark", "Name"],
          ["mark", "Mark + name"],
          ["icon", "Icon"],
        ]}
        onChange={(v) => setHeader({ logoStyle: v as NavHeader["logoStyle"] })}
      />
      <Rng
        label="Logo height"
        min={28}
        max={64}
        value={header.logoMaxHeight ?? 40}
        suffix="px"
        onChange={(v) => setHeader({ logoMaxHeight: v })}
      />
    </>
  );
}

// ── Footer inspector (left "Footer" tab) ──────────────────────
let footIdN = 0;
const footId = (p: string) => `${p}-${Date.now().toString(36)}-${++footIdN}`;

function NavFooterInspector({
  footer,
  setFooter,
}: {
  footer: NavFooter;
  setFooter: (patch: Partial<NavFooter>) => void;
}) {
  const cols: FootCol[] = footer.columns ?? [];
  const setCols = (next: FootCol[]) => setFooter({ columns: next });
  const news = footer.newsletter ?? {};
  const setNews = (patch: Partial<NonNullable<NavFooter["newsletter"]>>) =>
    setFooter({ newsletter: { ...news, ...patch } });

  const patchCol = (ci: number, patch: Partial<FootCol>) =>
    setCols(cols.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const addCol = () =>
    setCols([...cols, { id: footId("fc"), heading: "New column", links: [] }]);
  const delCol = (ci: number) => setCols(cols.filter((_, i) => i !== ci));
  const addLink = (ci: number, label: string) => {
    const l = label.trim();
    if (!l) return;
    patchCol(ci, {
      links: [...cols[ci].links, { id: footId("fl"), label: l, href: "#" }],
    });
  };
  const renameLink = (ci: number, li: number, label: string) =>
    patchCol(ci, {
      links: cols[ci].links.map((lk, i) => (i === li ? { ...lk, label } : lk)),
    });
  const delLink = (ci: number, li: number) =>
    patchCol(ci, { links: cols[ci].links.filter((_, i) => i !== li) });

  return (
    <>
      <div className="nav-lbl" style={{ marginTop: 10 }}>
        Footer base
      </div>
      <Ctl label="Copyright line">
        <input
          className="bse-input"
          value={footer.copyright ?? ""}
          placeholder="© Your business"
          onChange={(e) => setFooter({ copyright: e.target.value })}
        />
      </Ctl>
      <ToggleRow
        label="Show “Powered by Wielo”"
        value={footer.showPoweredBy !== false}
        onChange={(v) => setFooter({ showPoweredBy: v })}
      />

      <div className="nav-lbl" style={{ marginTop: 16 }}>
        Newsletter
      </div>
      <ToggleRow
        label="Show sign-up block"
        value={!!news.enabled}
        onChange={(v) => setNews({ enabled: v })}
      />
      {news.enabled && (
        <>
          <Ctl label="Heading">
            <input
              className="bse-input"
              value={news.heading ?? ""}
              placeholder="Join the list"
              onChange={(e) => setNews({ heading: e.target.value })}
            />
          </Ctl>
          <Ctl label="Body">
            <input
              className="bse-input"
              value={news.body ?? ""}
              placeholder="A note now and then — no spam."
              onChange={(e) => setNews({ body: e.target.value })}
            />
          </Ctl>
        </>
      )}

      <div className="nav-lbl" style={{ marginTop: 16 }}>
        Link columns
      </div>
      {cols.map((col, ci) => (
        <div className="foot-col" key={col.id}>
          <div className="foot-col-head">
            <input
              value={col.heading ?? ""}
              placeholder="Column heading"
              onChange={(e) => patchCol(ci, { heading: e.target.value })}
            />
            <button
              className="lact del"
              type="button"
              title="Delete column"
              onClick={() => delCol(ci)}
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="nav-links">
            {col.links.map((lk, li) => (
              <div className="nav-link" key={lk.id}>
                <input
                  className="lk"
                  value={lk.label}
                  onChange={(e) => renameLink(ci, li, e.target.value)}
                />
                <button
                  className="lact del"
                  type="button"
                  title="Delete"
                  onClick={() => delLink(ci, li)}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          <FootAddLink onAdd={(l) => addLink(ci, l)} />
        </div>
      ))}
      <button
        className="nav-tab"
        type="button"
        style={{ width: "100%", marginTop: 4 }}
        onClick={addCol}
      >
        <Plus size={15} strokeWidth={2} />
        Add column
      </button>
    </>
  );
}

function FootAddLink({ onAdd }: { onAdd: (label: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="nav-add" style={{ marginTop: 8 }}>
      <input
        value={v}
        placeholder="New link…"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(v);
            setV("");
          }
        }}
      />
      <button
        type="button"
        onClick={() => {
          onAdd(v);
          setV("");
        }}
      >
        <Plus size={15} strokeWidth={2} />
        Add
      </button>
    </div>
  );
}
