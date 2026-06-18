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
import {
  GripVertical,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  saveWebsiteRoomsAction,
  syncWebsiteRoomsAction,
} from "@/app/[locale]/dashboard/website/actions";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import type { SiteBrand, SiteData, SiteDataByType } from "@/lib/site/types";
import type { SiteThemeConfig } from "@/lib/site/themes";

import type { RoomEditorRow, RoomsEditorProperty } from "./loadRoomsEditor";
import {
  ImageField,
  TextArea,
  TextField,
  ToggleField,
} from "../pages/[pageId]/_components/fields";

type PreviewBundle = {
  brand: SiteBrand;
  theme: SiteThemeConfig;
  nav: { label: string; href: string }[];
  dataByType: Partial<SiteDataByType>;
};

export function RoomsManager({
  websiteId,
  initialProperties,
  preview,
}: {
  websiteId: string;
  initialProperties: RoomsEditorProperty[];
  preview: PreviewBundle;
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [properties, setProperties] =
    useState<RoomsEditorProperty[]>(initialProperties);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, startSave] = useTransition();
  const [syncing, startSync] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const initialJson = useMemo(
    () => JSON.stringify(initialProperties),
    [initialProperties],
  );
  const dirty = JSON.stringify(properties) !== initialJson;

  const { shown, total } = useMemo(() => {
    let s = 0;
    let n = 0;
    for (const p of properties)
      for (const r of p.rooms) {
        n += 1;
        if (r.isVisible) s += 1;
      }
    return { shown: s, total: n };
  }, [properties]);

  // Build a single rooms_preview section + its data for the preview pane.
  const previewData: SiteData = useMemo(() => {
    const d: SiteData = {};
    if (preview.dataByType.rooms_preview)
      d["rooms-preview"] = {
        type: "rooms_preview",
        data: preview.dataByType.rooms_preview,
      };
    return d;
  }, [preview]);

  function patchRoom(
    propertyId: string,
    roomId: string,
    next: Partial<RoomEditorRow>,
  ) {
    setProperties((prev) =>
      prev.map((p) =>
        p.id !== propertyId
          ? p
          : {
              ...p,
              rooms: p.rooms.map((r) =>
                r.roomId === roomId ? { ...r, ...next } : r,
              ),
            },
      ),
    );
  }

  function patchOverride(
    propertyId: string,
    next: Partial<RoomsEditorProperty["override"]>,
  ) {
    setProperties((prev) =>
      prev.map((p) =>
        p.id !== propertyId
          ? p
          : { ...p, override: { ...p.override, ...next } },
      ),
    );
  }

  function onDragEnd(propertyId: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setProperties((prev) =>
      prev.map((p) => {
        if (p.id !== propertyId) return p;
        const oldIndex = p.rooms.findIndex((r) => r.roomId === active.id);
        const newIndex = p.rooms.findIndex((r) => r.roomId === over.id);
        if (oldIndex < 0 || newIndex < 0) return p;
        return { ...p, rooms: arrayMove(p.rooms, oldIndex, newIndex) };
      }),
    );
  }

  function toggleExpanded(roomId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function onSync() {
    startSync(async () => {
      const res = await syncWebsiteRoomsAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("roomsSynced"));
      router.refresh();
    });
  }

  function onSave() {
    const rooms = properties.flatMap((p) =>
      p.rooms.map((r) => ({
        roomId: r.roomId,
        isVisible: r.isVisible,
        featured: r.featured,
        badge: r.badge,
        displayName: r.displayName,
        displayPrice: r.displayPrice,
        displayCurrency: r.displayCurrency,
        displayDesc: r.displayDesc,
      })),
    );
    const props = properties.map((p) => ({
      propertyId: p.id,
      heading: p.override.heading,
      intro: p.override.intro,
      heroPath: p.override.heroPath,
    }));
    startSave(async () => {
      const res = await saveWebsiteRoomsAction({
        websiteId,
        rooms,
        properties: props,
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("roomsSaved"));
      router.refresh();
    });
  }

  if (total === 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-card border border-dashed border-brand-line bg-brand-light/30 p-8 text-center">
          <p className="text-sm text-brand-mute">{t("roomsEmpty")}</p>
        </div>
        <SyncButton onClick={onSync} syncing={syncing} t={t} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* ── Editor pane ───────────────────────────── */}
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-brand-mute">
            {t("roomsShownCount", { shown, total })}
          </p>
          <SyncButton onClick={onSync} syncing={syncing} t={t} />
        </div>

        <div className="space-y-6">
          {properties.map((property) => (
            <section key={property.id}>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
                {property.name}
              </h3>

              {/* Per-property group override */}
              <details className="mb-2.5 rounded-card border border-brand-line bg-brand-light/20">
                <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-medium text-brand-ink">
                  {t("propertyGroupHeader")}
                </summary>
                <div className="space-y-3 border-t border-brand-line p-3.5">
                  <TextField
                    label={t("groupHeading")}
                    value={property.override.heading}
                    onChange={(v) => patchOverride(property.id, { heading: v })}
                    placeholder={property.name}
                    maxLength={120}
                  />
                  <TextArea
                    label={t("groupIntro")}
                    value={property.override.intro}
                    onChange={(v) => patchOverride(property.id, { intro: v })}
                    maxLength={600}
                    rows={2}
                  />
                  <ImageField
                    label={t("groupHero")}
                    websiteId={websiteId}
                    path={property.override.heroPath || undefined}
                    onChange={(path) =>
                      patchOverride(property.id, { heroPath: path ?? "" })
                    }
                    hint={t("groupHeroHint")}
                  />
                </div>
              </details>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => onDragEnd(property.id, e)}
              >
                <SortableContext
                  items={property.rooms.map((r) => r.roomId)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2.5">
                    {property.rooms.map((room) => (
                      <RoomRow
                        key={room.roomId}
                        room={room}
                        open={expanded.has(room.roomId)}
                        onToggleExpand={() => toggleExpanded(room.roomId)}
                        onPatch={(next) =>
                          patchRoom(property.id, room.roomId, next)
                        }
                        t={t}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </section>
          ))}
        </div>

        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-brand-line bg-white/95 px-1 py-3 backdrop-blur">
          {dirty ? (
            <span className="text-[12.5px] text-brand-mute">
              {t("roomsUnsaved")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveChanges")}
          </button>
        </div>
      </div>

      {/* ── Preview pane ──────────────────────────── */}
      <div className="space-y-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
          {t("livePreview")}
        </span>
        <div className="overflow-hidden rounded-card border border-brand-line bg-brand-light/40">
          <div className="mx-auto max-h-[78vh] overflow-y-auto bg-white">
            <SiteThemeRoot theme={preview.theme}>
              <SiteChrome brand={preview.brand} nav={preview.nav}>
                <SectionRenderer
                  sections={[
                    {
                      id: "rooms-preview",
                      type: "rooms_preview",
                      enabled: true,
                      props: { heading: t("roomsHeading"), max: 60 },
                    },
                  ]}
                  data={previewData}
                />
              </SiteChrome>
            </SiteThemeRoot>
          </div>
        </div>
        <p className="text-[11.5px] text-brand-mute">{t("roomsPreviewNote")}</p>
      </div>
    </div>
  );
}

function RoomRow({
  room,
  open,
  onToggleExpand,
  onPatch,
  t,
}: {
  room: RoomEditorRow;
  open: boolean;
  onToggleExpand: () => void;
  onPatch: (next: Partial<RoomEditorRow>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.roomId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-card border bg-white shadow-card ${
        isDragging ? "border-brand-primary" : "border-brand-line"
      }`}
    >
      <div className="flex items-center gap-2.5 p-3.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("dragToReorder")}
          className="cursor-grab touch-none text-brand-mute/70 hover:text-brand-ink active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-brand-ink">
              {room.displayName.trim() || room.baseName}
            </span>
            {room.featured ? (
              <span className="inline-flex items-center gap-0.5 rounded-pill bg-brand-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-secondary">
                <Sparkles className="h-2.5 w-2.5" />
                {t("featured")}
              </span>
            ) : null}
            {!room.isActive ? (
              <span className="rounded-pill bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                {t("roomInactive")}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleExpand}
            className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-brand-mute hover:text-brand-ink"
          >
            <SlidersHorizontal className="h-3 w-3" />
            {open ? t("roomHideOverrides") : t("roomEditDisplay")}
          </button>
        </div>

        <div className="shrink-0">
          <ToggleField
            label=""
            checked={room.isVisible}
            onChange={(v) => onPatch({ isVisible: v })}
          />
        </div>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-brand-line bg-brand-light/20 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <ToggleField
              label={t("roomFeatured")}
              checked={room.featured}
              onChange={(v) => onPatch({ featured: v })}
            />
          </div>
          <TextField
            label={t("roomBadge")}
            value={room.badge}
            onChange={(v) => onPatch({ badge: v })}
            placeholder={t("roomBadgePlaceholder")}
            maxLength={40}
          />
          <TextField
            label={t("roomDisplayName")}
            value={room.displayName}
            onChange={(v) => onPatch({ displayName: v })}
            placeholder={room.baseName}
            maxLength={120}
            hint={t("roomOverrideHint")}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("roomDisplayPrice")}
              value={room.displayPrice}
              onChange={(v) =>
                onPatch({ displayPrice: v.replace(/[^\d.]/g, "") })
              }
              placeholder={
                room.basePrice == null ? "—" : String(room.basePrice)
              }
            />
            <TextField
              label={t("roomDisplayCurrency")}
              value={room.displayCurrency}
              onChange={(v) =>
                onPatch({
                  displayCurrency: v
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 3),
                })
              }
              placeholder={room.baseCurrency}
              maxLength={3}
            />
          </div>
          <p className="text-[11.5px] text-brand-mute">
            {t("roomPriceCosmetic")}
          </p>
          <TextArea
            label={t("roomDisplayDesc")}
            value={room.displayDesc}
            onChange={(v) => onPatch({ displayDesc: v })}
            placeholder={room.baseDesc ?? ""}
            maxLength={600}
            rows={3}
          />
        </div>
      ) : null}
    </li>
  );
}

function SyncButton({
  onClick,
  syncing,
  t,
}: {
  onClick: () => void;
  syncing: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      title={t("roomsSyncHint")}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {t("roomsSync")}
    </button>
  );
}
