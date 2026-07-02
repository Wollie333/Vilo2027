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
  Trash2,
  Plus,
  Type as TypeIcon,
  AlignCenter,
  Eye,
  Rows3,
  PanelTop,
  PanelBottom,
  type LucideIcon,
} from "lucide-react";

import type {
  SiteMenuItem,
  SiteMenuStyle,
  SiteMenuDeviceStyle,
  SiteNavigation,
} from "@/lib/site/types";
import type { SiteThemeConfig } from "@/lib/site/themes";
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
  menu,
  onMenuChange,
  menuStyle,
  onMenuStyleChange,
  header,
  onHeaderChange,
  footer,
  onFooterChange,
  initialTab = "links",
  pages,
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
  menu: SiteMenuItem[];
  onMenuChange: (next: SiteMenuItem[]) => void;
  menuStyle: SiteMenuStyle;
  onMenuStyleChange: (next: SiteMenuStyle) => void;
  header: NavHeader;
  onHeaderChange: (next: NavHeader) => void;
  footer: NavFooter;
  onFooterChange: (next: NavFooter) => void;
  /** Which left tab to open on (doc-switcher: "Header & menu" → links, "Footer" → footer). */
  initialTab?: LeftTab;
  pages: PageOpt[];
  brand: Brand;
  theme: SiteThemeConfig;
  persists: boolean;
  onSave: (mode: "draft" | "publish") => void;
  onReset: () => void;
}) {
  const [device, setDevice] = useState<NavDevice>("desktop");
  const [leftTab, setLeftTab] = useState<LeftTab>(initialTab);
  const [pubOpen, setPubOpen] = useState(false);
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
  const [addLabel, setAddLabel] = useState("");
  const idRef = useRef(0);
  const newId = () => `nav-${Date.now().toString(36)}-${++idRef.current}`;

  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const rename = (i: number, label: string) =>
    onMenuChange(menu.map((m, j) => (j === i ? { ...m, label } : m)));
  const remove = (i: number) => onMenuChange(menu.filter((_, j) => j !== i));
  const add = (label: string, href: string) => {
    const l = label.trim();
    if (!l) return;
    onMenuChange([...menu, { id: newId(), label: l, href }]);
  };
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...menu];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onMenuChange(next);
  };

  const monogram = (brand.monogram || brand.name?.[0] || "W").slice(0, 2);
  const name = brand.name || siteLabel;
  const accent =
    theme.colors?.accent || theme.base?.palette.accent || "#C8702E";

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
              />
            ) : leftTab === "footer" ? (
              <NavFooterInspector footer={footer} setFooter={setFooter} />
            ) : (
              <>
                <div className="nav-lbl">Links · drag to reorder</div>
                <div className="nav-links">
                  {menu.map((it, i) => (
                    <div
                      key={it.id}
                      className={
                        dragOver === i ? "nav-link drag-over" : "nav-link"
                      }
                      draggable
                      onDragStart={() => {
                        dragIdx.current = i;
                      }}
                      onDragEnd={() => {
                        dragIdx.current = null;
                        setDragOver(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(i);
                      }}
                      onDragLeave={() =>
                        setDragOver((d) => (d === i ? null : d))
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIdx.current != null)
                          reorder(dragIdx.current, i);
                        setDragOver(null);
                      }}
                    >
                      <span className="grip" title="Drag to reorder">
                        <GripVertical size={14} strokeWidth={2} />
                      </span>
                      <input
                        className="lk"
                        value={it.label}
                        onChange={(e) => rename(i, e.target.value)}
                      />
                      {it.children && it.children.length > 0 && (
                        <span className="drop-badge">menu</span>
                      )}
                      {it.autoRooms && (
                        <span className="drop-badge">rooms</span>
                      )}
                      <button
                        className="lact del"
                        type="button"
                        title="Delete"
                        onClick={() => remove(i)}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
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
            <div className={`bse-device${deviceCls}`}>
              <div
                className="nav-site"
                style={
                  {
                    "--site-accent": accent,
                    "--site-ink": theme.base?.palette.ink,
                    "--nlink": rColor,
                    "--nhover": rHover,
                    "--nsize": `${rSize}px`,
                    "--nweight": WEIGHT_PX[rWeight] ?? 600,
                    "--ngap": `${rGap}px`,
                  } as React.CSSProperties
                }
              >
                {leftTab === "footer" ? (
                  <FooterPreview footer={footer} name={name} />
                ) : (
                  <div className="np-hero">
                    <div className="np-bar">
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
                                color: "var(--nhover)",
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
                        <span
                          className="np-reserve"
                          style={{ marginLeft: "auto" }}
                        >
                          <MenuIcon size={18} strokeWidth={2} />
                        </span>
                      )}
                    </div>
                    <div className="np-eyebrow">{siteLabel} · Book direct</div>
                    <div className="np-title">Your stay, your way</div>
                  </div>
                )}
              </div>
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
                palette={["#F4EEE6", "#FFFFFF", accent, "#2C2620", "#052E1F"]}
                onChange={(v) => setDeviceAware({ color: v })}
              />
              <Swatch
                label="Hover colour"
                value={rHover}
                palette={["#F3C98A", accent, "#FFFFFF", "#2C2620"]}
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
                label="Scrolled link colour"
                value={menuStyle.scrolledColor ?? "#2C2620"}
                palette={["#2C2620", "#052E1F", accent, "#FFFFFF"]}
                onChange={(v) => setBase({ scrolledColor: v })}
              />
              <Swatch
                label="Scrolled hover colour"
                value={menuStyle.scrolledHoverColor ?? accent}
                palette={[accent, "#065F46", "#2C2620", "#052E1F"]}
                onChange={(v) => setBase({ scrolledHoverColor: v })}
              />
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
                palette={["#3A2E20", "#052E1F", "#2C2620", accent]}
                onChange={(v) => setBase({ submenuColor: v })}
              />
              <Swatch
                label="Item hover colour"
                value={menuStyle.submenuHoverColor ?? "#065F46"}
                palette={["#065F46", accent, "#2C2620", "#052E1F"]}
                onChange={(v) => setBase({ submenuHoverColor: v })}
              />
              <Swatch
                label="Background"
                value={menuStyle.submenuBg ?? "#FFFFFF"}
                palette={["#FFFFFF", "#FBF4E6", "#F0FDF4", "#2C2620"]}
                onChange={(v) => setBase({ submenuBg: v })}
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

function Swatch({
  label,
  value,
  palette,
  onChange,
}: {
  label: string;
  value: string;
  palette: string[];
  onChange: (v: string) => void;
}) {
  const cur = value.toLowerCase();
  return (
    <Ctl label={label}>
      <div className="bse-swgrid">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            className={cur === c.toLowerCase() ? "bse-sw on" : "bse-sw"}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
        ))}
      </div>
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
}: {
  header: NavHeader;
  setHeader: (patch: Partial<NavHeader>) => void;
  showCta: boolean;
  showLogo: boolean;
}) {
  return (
    <>
      <div className="nav-lbl" style={{ marginTop: 10 }}>
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

function FooterPreview({ footer, name }: { footer: NavFooter; name: string }) {
  const cols = footer.columns ?? [];
  const news = footer.newsletter ?? {};
  return (
    <div className="np-footwrap">
      <div className="np-foot-cols">
        {cols.length === 0 && (
          <div className="np-foot-col">
            <h5>Explore</h5>
            <a>Add columns in the panel →</a>
          </div>
        )}
        {cols.map((col) => (
          <div className="np-foot-col" key={col.id}>
            <h5>{col.heading || "Column"}</h5>
            {col.links.map((lk) => (
              <a key={lk.id}>{lk.label}</a>
            ))}
          </div>
        ))}
        {news.enabled && (
          <div className="np-foot-news">
            <h5>{news.heading || "Join the list"}</h5>
            <p>{news.body || "A note now and then — no spam."}</p>
            <div className="row">
              <input placeholder="you@email.com" readOnly />
              <span className="sub">Sign up</span>
            </div>
          </div>
        )}
      </div>
      <div className="np-foot-base">
        <span>{footer.copyright?.trim() || `© ${name}`}</span>
        {footer.showPoweredBy !== false && <span>· Powered by Wielo</span>}
      </div>
    </div>
  );
}
