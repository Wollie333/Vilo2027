"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Plus,
  X,
  GripVertical,
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

import {
  WIDGET_DEFS,
  WIDGET_GROUPS,
  type WidgetControl,
} from "@/lib/website/widgets/registry";
import type {
  PageDoc,
  SectionNode,
  ColumnNode,
  WidgetNode,
  WidgetType,
} from "@/lib/website/pageDoc.schema";
import {
  findNode,
  moveNode,
  removeNode,
  duplicateNode,
  addSection,
  insertWidget,
  moveNodeInto,
  updateNodeProps,
  updateNode,
} from "@/lib/website/pageDocOps";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import type { SitePreset } from "@/lib/site/themes";

// Section-structure layouts offered by the "Add section" modal.
const STRUCTURES: { key: string; label: string; spans: number[] }[] = [
  { key: "12", label: "1 column", spans: [12] },
  { key: "6-6", label: "2 columns", spans: [6, 6] },
  { key: "4-4-4", label: "3 columns", spans: [4, 4, 4] },
  { key: "8-4", label: "2/3 + 1/3", spans: [8, 4] },
  { key: "4-8", label: "1/3 + 2/3", spans: [4, 8] },
  { key: "3-3-3-3", label: "4 columns", spans: [3, 3, 3, 3] },
];

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
  themeBase,
  initialDoc,
}: {
  docName: string;
  themeLabel: string;
  themeBase: SitePreset;
  initialDoc: PageDoc;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<PanelMode>("widgets");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doc, setDoc] = useState<PageDoc>(initialDoc);
  const [structureOpen, setStructureOpen] = useState(false);
  const [badge, setBadge] = useState<{
    top: number;
    left: number;
    kind: string;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = selectedId ? findNode(doc, selectedId) : null;

  // Selection → outline the matching canvas node. Re-runs on doc changes so the
  // outline follows the node after a mutation.
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    stageEl
      .querySelectorAll(".wb-node-sel")
      .forEach((e) => e.classList.remove("wb-node-sel"));
    if (!selectedId) return;
    stageEl
      .querySelector(`[data-node-id="${selectedId}"]`)
      ?.classList.add("wb-node-sel");
  }, [selectedId, doc]);

  // Position the floating badge over the selected node (top-left corner), synced
  // to canvas scroll. Cleared when nothing is selected / the node is gone.
  const placeBadge = useCallback(() => {
    const wrap = canvasRef.current;
    const node = selectedId
      ? stageRef.current?.querySelector<HTMLElement>(
          `[data-node-id="${selectedId}"]`,
        )
      : null;
    if (!wrap || !node) {
      setBadge(null);
      return;
    }
    const nr = node.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    setBadge({
      top: nr.top - wr.top + wrap.scrollTop,
      left: nr.left - wr.left + wrap.scrollLeft,
      kind: node.dataset.nodeKind ?? "widget",
    });
  }, [selectedId]);

  useLayoutEffect(() => {
    placeBadge();
  }, [placeBadge, doc, device]);

  useEffect(() => {
    const wrap = canvasRef.current;
    if (!wrap) return;
    const onScroll = () => placeBadge();
    wrap.addEventListener("scroll", onScroll, { passive: true });
    return () => wrap.removeEventListener("scroll", onScroll);
  }, [placeBadge]);

  // Select a node and open its inspector (Settings). Null just deselects.
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setMode("settings");
  }, []);

  // Click a canvas node → select the innermost node; empty click → deselect.
  const onCanvasClick = (e: React.MouseEvent) => {
    const node = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-node-id]",
    );
    selectNode(node?.dataset.nodeId ?? null);
  };

  // Inspector → patch the selected node's props (Content) live.
  const patchProps = useCallback(
    (key: string, value: unknown) => {
      if (selectedId)
        setDoc((d) => updateNodeProps(d, selectedId, { [key]: value }));
    },
    [selectedId],
  );

  // Inspector → patch node-level fields (Style / Advanced) live.
  const patchNode = useCallback(
    (patch: Record<string, unknown>) => {
      if (selectedId) setDoc((d) => updateNode(d, selectedId, patch));
    },
    [selectedId],
  );

  // ── structural mutations ──
  const canMove = (dir: -1 | 1): boolean => {
    if (!selected) return false;
    const j = selected.index + dir;
    return j >= 0 && j < selected.siblings.length;
  };
  const doMove = (dir: -1 | 1) => {
    if (selectedId) setDoc((d) => moveNode(d, selectedId, dir));
  };
  const doDelete = () => {
    if (!selectedId) return;
    setDoc((d) => removeNode(d, selectedId));
    setSelectedId(null);
  };
  const doDuplicate = () => {
    if (!selectedId) return;
    const { doc: next, newId } = duplicateNode(doc, selectedId);
    setDoc(next);
    if (newId) setSelectedId(newId);
  };
  const doAddSection = (spans: number[]) => {
    const { doc: next, newId } = addSection(doc, spans);
    setDoc(next);
    setSelectedId(newId);
    setStructureOpen(false);
  };

  // ── drag-drop (Phase 3c-2) ──
  // Refs (not state) hold the in-flight payload + target so dragover doesn't
  // re-render. Only the drop-line position + the `dragging` flag are state.
  const dragRef = useRef<
    { kind: "new"; type: WidgetType } | { kind: "move"; id: string } | null
  >(null);
  const dropRef = useRef<{ columnId: string; beforeId: string | null } | null>(
    null,
  );
  const dropColRef = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropLine, setDropLine] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const clearDrop = useCallback(() => {
    dropColRef.current?.classList.remove("wb-drop-over");
    dropColRef.current = null;
    dropRef.current = null;
    setDropLine(null);
  }, []);

  const endDrag = useCallback(() => {
    clearDrop();
    dragRef.current = null;
    setDragging(false);
  }, [clearDrop]);

  const startWidgetDrag = (type: WidgetType, e: React.DragEvent) => {
    dragRef.current = { kind: "new", type };
    setDragging(true);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", type);
  };
  const startMoveDrag = (e: React.DragEvent) => {
    if (!selectedId) return;
    dragRef.current = { kind: "move", id: selectedId };
    setDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "move");
  };

  const onCanvasDragOver = (e: React.DragEvent) => {
    if (!dragRef.current) return;
    const col = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-node-kind="column"]',
    );
    if (!col) {
      if (dropRef.current) clearDrop();
      return;
    }
    e.preventDefault(); // allow the drop
    e.dataTransfer.dropEffect =
      dragRef.current.kind === "new" ? "copy" : "move";
    const columnId = col.dataset.nodeId ?? "";
    const widgets = [
      ...col.querySelectorAll<HTMLElement>(
        ':scope > [data-node-kind="widget"]',
      ),
    ];
    let beforeId: string | null = null;
    let beforeEl: HTMLElement | null = null;
    for (const w of widgets) {
      const r = w.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        beforeId = w.dataset.nodeId ?? null;
        beforeEl = w;
        break;
      }
    }
    const prev = dropRef.current;
    if (prev && prev.columnId === columnId && prev.beforeId === beforeId)
      return;
    if (dropColRef.current !== col) {
      dropColRef.current?.classList.remove("wb-drop-over");
      col.classList.add("wb-drop-over");
      dropColRef.current = col;
    }
    dropRef.current = { columnId, beforeId };
    const wrap = canvasRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const cr = col.getBoundingClientRect();
    const left = cr.left - wr.left + wrap.scrollLeft + 8;
    const width = cr.width - 16;
    let top: number;
    if (beforeEl) {
      top = beforeEl.getBoundingClientRect().top - wr.top + wrap.scrollTop - 2;
    } else if (widgets.length) {
      top =
        widgets[widgets.length - 1].getBoundingClientRect().bottom -
        wr.top +
        wrap.scrollTop -
        2;
    } else {
      top = cr.top - wr.top + wrap.scrollTop + 8;
    }
    setDropLine({ top, left, width });
  };

  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragRef.current;
    const drop = dropRef.current;
    clearDrop();
    dragRef.current = null;
    setDragging(false);
    if (!drag || !drop) return;
    if (drag.kind === "new") {
      const { doc: next, newId } = insertWidget(
        doc,
        drop.columnId,
        drop.beforeId,
        drag.type,
      );
      setDoc(next);
      if (newId) setSelectedId(newId);
    } else {
      setDoc(moveNodeInto(doc, drag.id, drop.columnId, drop.beforeId));
      setSelectedId(drag.id);
    }
  };

  // Memoize the themed canvas so drop-line / dragging state changes don't re-run
  // the (heavy) PageDocRenderer tree mid-drag.
  const canvas = useMemo(
    () => (
      <SiteThemeRoot theme={{ base: themeBase }}>
        <PageDocRenderer doc={doc} device={device} />
      </SiteThemeRoot>
    ),
    [themeBase, doc, device],
  );

  const stageClass = ["stage", device, dragging && "wb-dragging"]
    .filter(Boolean)
    .join(" ");

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
                    : selected
                      ? nodeMeta(selected.node as AnyNode).label
                      : "Settings"}
                <small>
                  {mode === "widgets"
                    ? "Drag a block onto the page"
                    : mode === "navigator"
                      ? "The page structure"
                      : selected
                        ? "Editing this block"
                        : "Nothing selected"}
                </small>
              </div>
            </div>

            <div className="panel-body">
              {mode === "widgets" && (
                <WidgetLibrary
                  query={query}
                  setQuery={setQuery}
                  onWidgetDragStart={startWidgetDrag}
                  onWidgetDragEnd={endDrag}
                />
              )}
              {mode === "navigator" && (
                <Navigator
                  doc={doc}
                  selectedId={selectedId}
                  onSelect={selectNode}
                />
              )}
              {mode === "settings" &&
                (selected ? (
                  <Inspector
                    node={selected.node as AnyNode}
                    onPatch={patchProps}
                    onPatchNode={patchNode}
                  />
                ) : (
                  <PanelPlaceholder
                    Icon={Settings}
                    title="Nothing selected"
                    body="Select an element on the canvas to edit its content. Style, spacing and per-device overrides land in Phase 3d-2."
                  />
                ))}
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
          <main
            className="canvas-wrap"
            ref={canvasRef}
            onClick={onCanvasClick}
            onDragOver={onCanvasDragOver}
            onDrop={onCanvasDrop}
          >
            <div className={stageClass} ref={stageRef}>
              {canvas}
              <button
                className="add-sec"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStructureOpen(true);
                }}
              >
                <Plus size={17} strokeWidth={2} /> Add section
              </button>
            </div>

            {dropLine && (
              <div
                className="dropline-abs"
                style={{
                  top: dropLine.top,
                  left: dropLine.left,
                  width: dropLine.width,
                }}
              />
            )}

            {badge && selected && (
              <div
                className={badgeClass(badge.kind)}
                style={{ top: badge.top, left: badge.left }}
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  className="nb-grip"
                  draggable
                  onDragStart={startMoveDrag}
                  onDragEnd={endDrag}
                  title="Drag to move"
                >
                  <GripVertical size={13} strokeWidth={2} />
                </span>
                <span className="nb-lbl">
                  {nodeMeta(selected.node as AnyNode).label}
                </span>
                <button
                  title="Move up"
                  type="button"
                  onClick={() => doMove(-1)}
                  disabled={!canMove(-1)}
                >
                  <ArrowUp size={14} strokeWidth={2} />
                </button>
                <button
                  title="Move down"
                  type="button"
                  onClick={() => doMove(1)}
                  disabled={!canMove(1)}
                >
                  <ArrowDown size={14} strokeWidth={2} />
                </button>
                <button title="Duplicate" type="button" onClick={doDuplicate}>
                  <Copy size={14} strokeWidth={2} />
                </button>
                <button title="Delete" type="button" onClick={doDelete}>
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            )}

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

      {/* structure picker */}
      <div className={structureOpen ? "scrim show" : "scrim"}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button
            className="tb-ico"
            type="button"
            style={{ float: "right", color: "var(--mute)" }}
            onClick={() => setStructureOpen(false)}
            title="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
          <h3>Choose a structure</h3>
          <p>Pick a column layout for your new section.</p>
          <div className="layouts">
            {STRUCTURES.map((s) => (
              <div
                className="layout"
                key={s.key}
                onClick={() => doAddSection(s.spans)}
              >
                <div className="cols">
                  {s.spans.map((span, i) => (
                    <i key={i} style={{ flex: span }} />
                  ))}
                </div>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function badgeClass(kind: string): string {
  return [
    "node-badge",
    kind === "section" && "k-section",
    kind === "column" && "k-column",
  ]
    .filter(Boolean)
    .join(" ");
}

function WidgetLibrary({
  query,
  setQuery,
  onWidgetDragStart,
  onWidgetDragEnd,
}: {
  query: string;
  setQuery: (v: string) => void;
  onWidgetDragStart: (type: WidgetType, e: React.DragEvent) => void;
  onWidgetDragEnd: () => void;
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
                    onDragStart={(e) =>
                      onWidgetDragStart(d.type as WidgetType, e)
                    }
                    onDragEnd={onWidgetDragEnd}
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

const Navigator = memo(function Navigator({
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
});

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

// ── Inspector (Phase 3d) ──────────────────────────────────────
const INSPECTOR_TABS = ["content", "style", "advanced"] as const;
type InspectorTab = (typeof INSPECTOR_TABS)[number];

function Inspector({
  node,
  onPatch,
  onPatchNode,
}: {
  node: AnyNode;
  onPatch: (key: string, value: unknown) => void;
  onPatchNode: (patch: Record<string, unknown>) => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("content");
  const def = WIDGET_DEFS[node.type as keyof typeof WIDGET_DEFS];
  const props = ("props" in node ? node.props : {}) as Record<string, unknown>;

  return (
    <>
      <div className="tabs">
        {INSPECTOR_TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? "tab on" : "tab"}
            type="button"
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="tabpane">
        {tab === "content" &&
          (def?.content ? (
            def.content.map((ctl, i) => (
              <Control key={i} ctl={ctl} props={props} onPatch={onPatch} />
            ))
          ) : (
            <div className="insp-stub">
              This block’s copy comes from the theme blueprint — no content
              controls yet. Use Style &amp; Advanced to restyle it; per-widget
              controls for composite blocks land in a later slice.
            </div>
          ))}
        {tab === "style" && <StylePane node={node} onPatchNode={onPatchNode} />}
        {tab === "advanced" && (
          <AdvancedPane node={node} onPatchNode={onPatchNode} />
        )}
      </div>
    </>
  );
}

const TONE_OPTS: [string, string][] = [
  ["default", "Default"],
  ["accent", "Accent"],
  ["dark", "Dark"],
  ["muted", "Muted"],
];
const VIS_OPTS: [string, string][] = [
  ["all", "All"],
  ["desktop", "Desktop"],
  ["mobile", "Mobile"],
];

type NodeFields = {
  tone?: string;
  bg?: string;
  visibility?: string;
  cssId?: string;
  cssClass?: string;
  space?: Record<string, number>;
  type: string;
};

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
    <div className="ctl">
      <div className="ctl-l">
        <label>{label}</label>
      </div>
      <div className="seg">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={value === v ? "on" : undefined}
            onClick={() => onChange(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="ctl">
      <div className="ctl-l">
        <label>{label}</label>
      </div>
      <input
        className="inp"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function StylePane({
  node,
  onPatchNode,
}: {
  node: AnyNode;
  onPatchNode: (patch: Record<string, unknown>) => void;
}) {
  const n = node as unknown as NodeFields;
  return (
    <>
      <SegRow
        label="Colour tone"
        value={n.tone ?? "default"}
        options={TONE_OPTS}
        onChange={(v) => onPatchNode({ tone: v === "default" ? undefined : v })}
      />
      {node.type === "section" && (
        <TextRow
          label="Background"
          value={n.bg}
          placeholder="var(--site-surface) or #FBF4E6"
          onChange={(v) => onPatchNode({ bg: v.trim() || undefined })}
        />
      )}
      <div className="hint">
        Tone recolours the block from the theme palette; Background overrides it
        with a specific colour (sections).
      </div>
    </>
  );
}

function SpaceBox({
  label,
  keys,
  labels,
  space,
  two,
  onSet,
}: {
  label: string;
  keys: string[];
  labels: string[];
  space: Record<string, number>;
  two?: boolean;
  onSet: (k: string, v: number) => void;
}) {
  return (
    <div className="ctl">
      <div className="ctl-l">
        <label>{label}</label>
      </div>
      <div className={two ? "box4 box2" : "box4"}>
        {keys.map((k, i) => (
          <div className="f" key={k}>
            <input
              inputMode="numeric"
              value={space[k] ?? 0}
              onChange={(e) => {
                const v = e.target.value === "" ? 0 : Number(e.target.value);
                if (!Number.isNaN(v)) onSet(k, v);
              }}
            />
            <span>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedPane({
  node,
  onPatchNode,
}: {
  node: AnyNode;
  onPatchNode: (patch: Record<string, unknown>) => void;
}) {
  const n = node as unknown as NodeFields;
  const space = n.space ?? {};
  const setSpace = (k: string, v: number) =>
    onPatchNode({ space: { ...space, [k]: v } });
  return (
    <>
      <SpaceBox
        label="Padding"
        keys={["pt", "pr", "pb", "pl"]}
        labels={["T", "R", "B", "L"]}
        space={space}
        onSet={setSpace}
      />
      <SpaceBox
        label="Margin"
        keys={["mt", "mb"]}
        labels={["T", "B"]}
        space={space}
        two
        onSet={setSpace}
      />
      <SegRow
        label="Visible on"
        value={n.visibility ?? "all"}
        options={VIS_OPTS}
        onChange={(v) =>
          onPatchNode({ visibility: v === "all" ? undefined : v })
        }
      />
      <TextRow
        label="CSS ID"
        value={n.cssId}
        placeholder="my-section"
        onChange={(v) => onPatchNode({ cssId: v.trim() || undefined })}
      />
      <TextRow
        label="CSS class"
        value={n.cssClass}
        placeholder="promo dark"
        onChange={(v) => onPatchNode({ cssClass: v.trim() || undefined })}
      />
    </>
  );
}

const str = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const COLOR_TOKENS: [string, string][] = [
  ["default", "Default"],
  ["accent", "Accent"],
  ["ink", "Ink"],
  ["mute", "Mute"],
];
const ALIGN_OPTS: [string, string][] = [
  ["left", "Left"],
  ["center", "Center"],
  ["right", "Right"],
];

function Control({
  ctl,
  props,
  onPatch,
}: {
  ctl: WidgetControl;
  props: Record<string, unknown>;
  onPatch: (key: string, value: unknown) => void;
}) {
  if (ctl.kind === "hint") return <div className="hint">{ctl.text}</div>;

  const val = props[ctl.key];
  const label = (
    <div className="ctl-l">
      <label>{ctl.label}</label>
      {ctl.kind === "range" && <span className="val">{num(val)}</span>}
    </div>
  );

  switch (ctl.kind) {
    case "text":
      return (
        <div className="ctl">
          {label}
          <input
            className="inp"
            value={str(val)}
            placeholder={ctl.placeholder}
            onChange={(e) => onPatch(ctl.key, e.target.value)}
          />
        </div>
      );
    case "textarea":
      return (
        <div className="ctl">
          {label}
          <textarea
            className="inp"
            value={str(val)}
            onChange={(e) => onPatch(ctl.key, e.target.value)}
          />
        </div>
      );
    case "select":
      return (
        <div className="ctl">
          {label}
          <select
            className="inp"
            value={str(val)}
            onChange={(e) => onPatch(ctl.key, e.target.value)}
          >
            {ctl.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      );
    case "seg":
    case "align": {
      const options = ctl.kind === "align" ? ALIGN_OPTS : ctl.options;
      return (
        <div className="ctl">
          {label}
          <div className="seg">
            {options.map(([v, l]) => (
              <button
                key={v}
                type="button"
                className={str(val) === v ? "on" : undefined}
                onClick={() => onPatch(ctl.key, v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "color":
      return (
        <div className="ctl">
          {label}
          <div className="seg">
            {COLOR_TOKENS.map(([v, l]) => (
              <button
                key={v}
                type="button"
                className={str(val) === v ? "on" : undefined}
                onClick={() => onPatch(ctl.key, v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      );
    case "range":
      return (
        <div className="ctl">
          {label}
          <input
            type="range"
            className="rng"
            min={ctl.min}
            max={ctl.max}
            step={ctl.step ?? 1}
            value={num(val)}
            onChange={(e) => onPatch(ctl.key, Number(e.target.value))}
          />
        </div>
      );
    case "toggle":
      return (
        <div className="ctl">
          <div className="togrow">
            <label>{ctl.label}</label>
            <div
              className={val ? "tog on" : "tog"}
              onClick={() => onPatch(ctl.key, !val)}
            />
          </div>
          {ctl.hint && <div className="hint">{ctl.hint}</div>}
        </div>
      );
    default:
      return null;
  }
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
