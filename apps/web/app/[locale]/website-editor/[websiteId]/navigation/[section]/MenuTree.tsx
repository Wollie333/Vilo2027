"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";

import type { SiteMenuItem } from "@/lib/site/types";

// Drag-to-nest menu tree (the dnd-kit "sortable tree" pattern). The whole tree is
// ONE DndContext over a flattened list of the visible items, so dragging can both
// reorder AND change depth: drag right past a half-indent to nest under the item
// above, drag left to outdent. Depth is clamped to the menu's two-level limit
// (top → sub → subsub). Auto-rooms items are leaves here — their live room rows
// render via `renderExtra`, never as draggable menu items.

const INDENT = 16; // px per depth level (matches the row marginLeft)
export const MENU_MAX_DEPTH = 2; // top(0) → sub(1) → subsub(2)

type Flat = {
  id: string;
  item: SiteMenuItem;
  depth: number;
  parentId: string | null;
  /** Path of sibling indices to this node (for select / edit). */
  path: number[];
  hasChildren: boolean;
  collapsed: boolean;
};

/** Flatten the visible tree (collapsed branches are hidden). */
function flatten(
  items: SiteMenuItem[],
  open: Record<string, boolean>,
  parentId: string | null = null,
  depth = 0,
  basePath: number[] = [],
): Flat[] {
  return items.flatMap((item, index) => {
    const path = [...basePath, index];
    const kids = item.children ?? [];
    const hasChildren = kids.length > 0;
    // Auto-rooms items never expose draggable children (their rooms are virtual).
    const isOpen = (open[item.id] ?? true) && !item.autoRooms;
    const row: Flat = {
      id: item.id,
      item,
      depth,
      parentId,
      path,
      hasChildren,
      collapsed: hasChildren && !isOpen,
    };
    return isOpen && hasChildren
      ? [row, ...flatten(kids, open, item.id, depth + 1, path)]
      : [row];
  });
}

/** Rebuild a nested tree from a flat list whose depth/parent were re-projected. */
function buildTree(flat: Omit<Flat, "path" | "hasChildren" | "collapsed">[]) {
  const root: SiteMenuItem[] = [];
  const byId = new Map<string, SiteMenuItem>();
  // Strip children — they're re-attached from the flat parentIds below.
  for (const f of flat) byId.set(f.id, { ...f.item, children: undefined });
  for (const f of flat) {
    const node = byId.get(f.id)!;
    if (f.parentId && byId.has(f.parentId)) {
      const parent = byId.get(f.parentId)!;
      (parent.children ??= []).push(node);
    } else {
      root.push(node);
    }
  }
  return root;
}

/** Where the dragged row would land (depth + parent) given the pointer offset. */
function getProjection(
  flat: Flat[],
  activeId: string,
  overId: string,
  dragOffsetX: number,
) {
  const overIndex = flat.findIndex((f) => f.id === overId);
  const activeIndex = flat.findIndex((f) => f.id === activeId);
  const newItems = arrayMove(flat, activeIndex, overIndex);
  const prev = newItems[overIndex - 1];
  const next = newItems[overIndex + 1];
  const dragDepth = Math.round(dragOffsetX / INDENT);
  const projected = (flat[activeIndex]?.depth ?? 0) + dragDepth;
  const maxDepth = Math.min(prev ? prev.depth + 1 : 0, MENU_MAX_DEPTH);
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, Math.min(projected, maxDepth));

  function parentIdAt(): string | null {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id;
    // Shallower than prev — inherit the parent of the nearest ancestor at depth.
    const ancestor = newItems
      .slice(0, overIndex)
      .reverse()
      .find((f) => f.depth === depth);
    return ancestor?.parentId ?? null;
  }
  return { depth, parentId: parentIdAt() };
}

export function MenuTree({
  menu,
  setMenu,
  open,
  renderRow,
  renderExtra,
}: {
  menu: SiteMenuItem[];
  setMenu: (next: SiteMenuItem[]) => void;
  open: Record<string, boolean>;
  /** Row content for one item (label/handle/select/nest/delete). */
  renderRow: (args: {
    item: SiteMenuItem;
    path: number[];
    depth: number;
    handleProps: Record<string, unknown>;
    ghost: boolean;
  }) => ReactNode;
  /** Extra content under a row (e.g. an auto-rooms item's live room rows). */
  renderExtra?: (
    item: SiteMenuItem,
    path: number[],
    depth: number,
  ) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const flat = useMemo(() => flatten(menu, open), [menu, open]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  const projection =
    activeId && overId ? getProjection(flat, activeId, overId, offsetX) : null;

  function reset() {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setOverId(String(e.active.id));
  }
  function onDragMove(e: DragMoveEvent) {
    setOffsetX(e.delta.x);
  }
  function onDragOver(e: DragOverEvent) {
    setOverId(e.over ? String(e.over.id) : null);
  }
  function onDragEnd(e: DragEndEvent) {
    const proj = projection;
    reset();
    const { active, over } = e;
    if (!over || !proj) return;
    const activeIndex = flat.findIndex((f) => f.id === active.id);
    const overIndex = flat.findIndex((f) => f.id === over.id);
    if (activeIndex < 0 || overIndex < 0) return;
    const moved = arrayMove(flat, activeIndex, overIndex).map((f) => ({
      id: f.id,
      item: f.item,
      depth: f.depth,
      parentId: f.parentId,
    }));
    const movedIndex = moved.findIndex((f) => f.id === active.id);
    moved[movedIndex] = {
      ...moved[movedIndex],
      depth: proj.depth,
      parentId: proj.parentId,
    };
    setMenu(buildTree(moved));
  }

  return (
    <DndContext
      id="menu-tree"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <SortableContext
        items={flat.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        {flat.map((f) => (
          <Row
            key={f.id}
            id={f.id}
            depth={activeId === f.id && projection ? projection.depth : f.depth}
          >
            {(handleProps, ghost) => (
              <>
                {renderRow({
                  item: f.item,
                  path: f.path,
                  depth:
                    activeId === f.id && projection
                      ? projection.depth
                      : f.depth,
                  handleProps,
                  ghost,
                })}
                {renderExtra?.(f.item, f.path, f.depth)}
              </>
            )}
          </Row>
        ))}
      </SortableContext>
      <DragOverlay />
    </DndContext>
  );
}

function Row({
  id,
  depth,
  children,
}: {
  id: string;
  depth: number;
  children: (handleProps: Record<string, unknown>, ghost: boolean) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    marginLeft: depth * INDENT,
    opacity: isDragging ? 0.45 : 1,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}
