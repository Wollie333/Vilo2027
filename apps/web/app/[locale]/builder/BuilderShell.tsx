"use client";

import { useState, type ReactNode } from "react";
import {
  Menu,
  ChevronDown,
  LayoutGrid,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  RotateCcw,
  Palette,
  Settings,
  Eye,
  Upload,
  ListTree,
  Search,
  // widget-library glyphs (registry `icon` names)
  Heading,
  Type,
  MousePointerClick,
  Image as ImageIcon,
  Minus,
  MoveVertical,
  Sparkles,
  Play,
  BedDouble,
  RectangleHorizontal,
  CalendarSearch,
  CalendarDays,
  Star,
  Tag,
  MapPin,
  Map as MapIcon,
  Hexagon,
  Share2,
  Square,
  type LucideIcon,
} from "lucide-react";

import { WIDGET_DEFS, WIDGET_GROUPS } from "@/lib/website/widgets/registry";

// Builder V2 — Phase 3a chrome shell (client).
//
// Pixel-faithful port of the founder prototype's chrome: emerald topbar, 332px
// three-mode left panel (Widgets / Navigator / Settings), centred canvas stage
// with device widths. The STAGE CONTENT is server-rendered (the themed PageDoc)
// and passed in as `stage` — the client shell only owns chrome + UI state, so
// the heavy section render stays in the RSC tree. Drag-drop, selection, the
// inspector and overlays land in Phase 3b–3e.

type Device = "desktop" | "tablet" | "mobile";
type PanelMode = "widgets" | "navigator" | "settings";

// Resolve a registry icon name → a lucide component (fallback: Square).
const WIDGET_ICONS: Record<string, LucideIcon> = {
  Heading,
  Type,
  MousePointerClick,
  Image: ImageIcon,
  Minus,
  MoveVertical,
  Sparkles,
  LayoutGrid,
  Play,
  BedDouble,
  RectangleHorizontal,
  CalendarSearch,
  CalendarDays,
  Star,
  Tag,
  MapPin,
  Map: MapIcon,
  Hexagon,
  Menu,
  Share2,
};

const DEVICES: { key: Device; label: string; Icon: LucideIcon }[] = [
  { key: "desktop", label: "Desktop", Icon: Monitor },
  { key: "tablet", label: "Tablet", Icon: Tablet },
  { key: "mobile", label: "Mobile", Icon: Smartphone },
];

function WieloMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 100 100" fill="none" aria-hidden>
      <path
        d="M18 28 L36 74 L50 46 L64 74 L82 28"
        fill="none"
        stroke="#fff"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BuilderShell({
  docName,
  themeLabel,
  stage,
}: {
  docName: string;
  themeLabel: string;
  stage: ReactNode;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<PanelMode>("widgets");
  const [query, setQuery] = useState("");

  return (
    <div className="wb">
      <div className="app">
        {/* ===== TOPBAR ===== */}
        <header className="topbar">
          <button className="tb-ico" title="Menu" type="button">
            <Menu size={20} strokeWidth={2} />
          </button>
          <div className="tb-logo">
            <span className="mark">
              <WieloMark />
            </span>
            Wielo
          </div>
          <div className="tb-div" />
          <button className="tb-page" title="Switch document" type="button">
            <span className="dot" />
            {docName}
            <span className="docsub">· draft</span>
            <ChevronDown size={13} strokeWidth={2.2} style={{ opacity: 0.7 }} />
          </button>
          <div className="tb-div" />
          <button className="tb-tpl-btn" title="Templates" type="button">
            <LayoutGrid size={15} strokeWidth={1.9} />
            Templates
            <ChevronDown size={13} strokeWidth={2.2} />
          </button>

          <div className="tb-spacer" />

          <div className="tb-devs">
            {DEVICES.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`tb-dev${device === key ? "on" : ""}`}
                title={label}
                type="button"
                onClick={() => setDevice(key)}
              >
                <Icon size={18} strokeWidth={1.8} />
              </button>
            ))}
          </div>
          <div className="tb-div" />
          <button className="tb-ico" title="Undo" type="button" disabled>
            <Undo2 size={18} strokeWidth={1.9} />
          </button>
          <button className="tb-ico" title="Redo" type="button" disabled>
            <Redo2 size={18} strokeWidth={1.9} />
          </button>
          <button className="tb-ico" title="Reset page" type="button">
            <RotateCcw size={18} strokeWidth={1.9} />
          </button>
          <button
            className="tb-ico"
            title="Brand Studio — colours, fonts & logo"
            type="button"
          >
            <Palette size={18} strokeWidth={1.9} />
          </button>
          <button
            className="tb-ico"
            title="Page settings (SEO & tracking)"
            type="button"
          >
            <Settings size={18} strokeWidth={1.9} />
          </button>
          <div className="tb-div" />
          <button className="tb-btn ghost" type="button">
            <Eye size={16} strokeWidth={1.9} />
            Preview
          </button>
          <div className="tb-publish">
            <button className="tb-btn solid" type="button">
              <Upload size={16} strokeWidth={2} />
              Publish
            </button>
            <button className="tb-caret" title="Publish options" type="button">
              <ChevronDown size={14} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {/* ===== BODY ===== */}
        <div className="body">
          {/* LEFT PANEL */}
          <aside className="panel">
            <div className="panel-head">
              <div className="title">
                {mode === "widgets"
                  ? "Widgets"
                  : mode === "navigator"
                    ? "Navigator"
                    : "Settings"}
                <small>
                  {mode === "widgets"
                    ? "Drag a block onto the page"
                    : mode === "navigator"
                      ? "The page structure"
                      : "Selected element"}
                </small>
              </div>
            </div>

            <div className="panel-body">
              {mode === "widgets" && (
                <WidgetLibrary query={query} setQuery={setQuery} />
              )}
              {mode === "navigator" && (
                <PanelPlaceholder
                  Icon={ListTree}
                  title="Navigator"
                  body="The section → column → widget tree lands in Phase 3b, wired to this page."
                />
              )}
              {mode === "settings" && (
                <PanelPlaceholder
                  Icon={Settings}
                  title="Nothing selected"
                  body="Select an element on the canvas to edit its content, style and layout. The inspector lands in Phase 3d."
                />
              )}
            </div>

            <div className="panel-foot">
              <button
                className={`foot-ico${mode === "widgets" ? "on" : ""}`}
                type="button"
                onClick={() => setMode("widgets")}
              >
                <LayoutGrid size={18} strokeWidth={1.7} />
                Widgets
              </button>
              <button
                className={`foot-ico${mode === "navigator" ? "on" : ""}`}
                type="button"
                onClick={() => setMode("navigator")}
              >
                <ListTree size={18} strokeWidth={1.7} />
                Navigator
              </button>
              <button
                className={`foot-ico${mode === "settings" ? "on" : ""}`}
                type="button"
                onClick={() => setMode("settings")}
              >
                <Settings size={18} strokeWidth={1.7} />
                Settings
              </button>
            </div>
          </aside>

          {/* CANVAS */}
          <main className="canvas-wrap">
            <div className={`stage ${device}`}>{stage}</div>
            <div className="dev-label">
              {device === "tablet"
                ? "768 px"
                : device === "mobile"
                  ? "380 px"
                  : ""}{" "}
              · {themeLabel}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function WidgetLibrary({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (v: string) => void;
}) {
  const q = query.trim().toLowerCase();
  return (
    <>
      <div className="lib-search">
        <div className="box">
          <Search size={16} strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks…"
          />
        </div>
      </div>
      {WIDGET_GROUPS.map(([group, label]) => {
        const defs = Object.values(WIDGET_DEFS).filter(
          (d) =>
            d.group === group &&
            (!q || d.label.toLowerCase().includes(q) || d.type.includes(q)),
        );
        if (defs.length === 0) return null;
        return (
          <div className="lib-group" key={group}>
            <h4>{label}</h4>
            <div className="wgrid">
              {defs.map((d) => {
                const Icon = WIDGET_ICONS[d.icon] ?? Square;
                return (
                  <div
                    className="widget"
                    key={d.type}
                    title={d.label}
                    draggable
                  >
                    <span className="wi">
                      <Icon size={19} strokeWidth={1.8} />
                    </span>
                    <span>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function PanelPlaceholder({
  Icon,
  title,
  body,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="panel-ph">
      <div className="ph-ic">
        <Icon size={24} strokeWidth={1.7} />
      </div>
      <b>{title}</b>
      <p>{body}</p>
    </div>
  );
}
