"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Menu,
  ChevronDown,
  Rows3,
  Columns3,
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
import type {
  PageDoc,
  SectionNode,
  ColumnNode,
  WidgetNode,
} from "@/lib/website/pageDoc.schema";

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
  doc,
  stage,
}: {
  docName: string;
  themeLabel: string;
  doc: PageDoc;
  stage: ReactNode;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<PanelMode>("widgets");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Selection → outline + reveal the matching (server-rendered) canvas node.
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    stageEl
      .querySelectorAll(".wb-node-sel")
      .forEach((e) => e.classList.remove("wb-node-sel"));
    if (!selectedId) return;
    const el = stageEl.querySelector(`[data-node-id="${selectedId}"]`);
    if (el) {
      el.classList.add("wb-node-sel");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedId]);

  // Click a canvas node → select the innermost node; empty click → deselect.
  const onCanvasClick = (e: React.MouseEvent) => {
    const node = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-node-id]",
    );
    setSelectedId(node?.dataset.nodeId ?? null);
  };

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
                className={device === key ? "tb-dev on" : "tb-dev"}
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
                <Navigator
                  doc={doc}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
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
                className={mode === "widgets" ? "foot-ico on" : "foot-ico"}
                type="button"
                onClick={() => setMode("widgets")}
              >
                <LayoutGrid size={18} strokeWidth={1.7} />
                Widgets
              </button>
              <button
                className={mode === "navigator" ? "foot-ico on" : "foot-ico"}
                type="button"
                onClick={() => setMode("navigator")}
              >
                <ListTree size={18} strokeWidth={1.7} />
                Navigator
              </button>
              <button
                className={mode === "settings" ? "foot-ico on" : "foot-ico"}
                type="button"
                onClick={() => setMode("settings")}
              >
                <Settings size={18} strokeWidth={1.7} />
                Settings
              </button>
            </div>
          </aside>

          {/* CANVAS */}
          <main className="canvas-wrap" onClick={onCanvasClick}>
            <div className={`stage ${device}`} ref={stageRef}>
              {stage}
            </div>
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

// ── Navigator (Phase 3b) ──────────────────────────────────────
type AnyNode = SectionNode | ColumnNode | WidgetNode;

function nodeMeta(
  node: AnyNode,
  sectionIndex?: number,
): { label: string; Icon: LucideIcon } {
  if (node.type === "section") {
    return {
      label: sectionIndex != null ? `Section ${sectionIndex + 1}` : "Section",
      Icon: Rows3,
    };
  }
  if (node.type === "column") {
    return { label: `Column · ${node.span}`, Icon: Columns3 };
  }
  const def = WIDGET_DEFS[node.type as keyof typeof WIDGET_DEFS];
  const p = node.props as Record<string, unknown>;
  const snippet = [p.text, p.heading, p.headline, p.title, p.label, p.body]
    .find((v): v is string => typeof v === "string" && v.trim().length > 0)
    ?.trim()
    .slice(0, 18);
  const base = def?.label ?? node.type;
  return {
    label: snippet ? `${base} · ${snippet}` : base,
    Icon: WIDGET_ICONS[def?.icon ?? ""] ?? Square,
  };
}

function Navigator({
  doc,
  selectedId,
  onSelect,
}: {
  doc: PageDoc;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const kids = doc.root.kids;
  return (
    <div className="nav-tree">
      {kids.length === 0 ? (
        <div className="nav-empty">Empty page.</div>
      ) : (
        kids.map((s, i) => (
          <NavNode
            key={s.id}
            node={s}
            sectionIndex={i}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function NavNode({
  node,
  sectionIndex,
  selectedId,
  onSelect,
}: {
  node: AnyNode;
  sectionIndex?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const kids = "kids" in node ? (node.kids as AnyNode[]) : [];
  const hasKids = kids.length > 0;
  const { label, Icon } = nodeMeta(node, sectionIndex);
  const sel = node.id === selectedId;

  const rowClass = ["nav-row", sel && "sel", collapsed && "collapsed"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="nav-node">
      <div
        className={rowClass}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
      >
        <span
          className="tw"
          onClick={(e) => {
            e.stopPropagation();
            if (hasKids) setCollapsed((c) => !c);
          }}
        >
          {hasKids ? <ChevronDown size={13} strokeWidth={2.2} /> : null}
        </span>
        <span className="ni">
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <span className="nlbl">{label}</span>
      </div>
      {hasKids && (
        <div className="nav-kids">
          {kids.map((k) => (
            <NavNode
              key={k.id}
              node={k}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
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
