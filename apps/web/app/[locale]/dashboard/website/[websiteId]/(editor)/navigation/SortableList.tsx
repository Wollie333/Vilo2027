"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

/**
 * Generic drag-to-reorder list built on the same @dnd-kit engine the page
 * builder uses — so the navigation editors reorder by drag, consistently. The
 * render prop receives a ready-made drag `handle` to place wherever it likes
 * (drag is scoped to the handle, so the row's inputs stay clickable).
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  id,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
  /** Stable DndContext id — REQUIRED when nesting SortableLists (e.g. a menu
   *  tree) so dnd-kit's a11y ids are deterministic and don't mismatch on SSR
   *  hydration. Omit for a single (non-nested) list. */
  id?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, index) => (
          <SortableRow key={item.id} id={item.id}>
            {(handle) => children(item, index, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const t = useTranslations("website");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: "relative" as const,
  };
  const handle = (
    <button
      type="button"
      className="cursor-grab rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink active:cursor-grabbing"
      title={t("dragToReorder")}
      aria-label={t("dragToReorder")}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}
