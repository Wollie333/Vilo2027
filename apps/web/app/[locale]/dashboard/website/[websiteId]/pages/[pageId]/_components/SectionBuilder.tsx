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
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveDraftSectionsAction } from "@/app/[locale]/dashboard/website/actions";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  SiteData,
  SiteDataByType,
  SiteBrand,
  SiteNavItem,
} from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import { newSection } from "@/lib/website/sectionDefaults";
import {
  SECTION_TYPES,
  isAutoPopulate,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";

import { SectionEditor } from "./SectionEditor";

const asset = (p: string | null | undefined) => websiteAssetUrl(p) ?? undefined;

/** Build the by-id SiteData map for the preview from the per-type live pool. */
function buildPreviewData(
  sections: WebsiteSection[],
  pool: Partial<SiteDataByType>,
): SiteData {
  const data: SiteData = {};
  for (const s of sections) {
    switch (s.type) {
      case "gallery":
        if (pool.gallery) data[s.id] = { type: "gallery", data: pool.gallery };
        break;
      case "rooms_preview":
        if (pool.rooms_preview)
          data[s.id] = { type: "rooms_preview", data: pool.rooms_preview };
        break;
      case "location":
        if (pool.location)
          data[s.id] = { type: "location", data: pool.location };
        break;
      case "reviews":
        if (pool.reviews) data[s.id] = { type: "reviews", data: pool.reviews };
        break;
      case "blog_preview":
        if (pool.blog_preview)
          data[s.id] = { type: "blog_preview", data: pool.blog_preview };
        break;
      default:
        break;
    }
  }
  return data;
}

export function SectionBuilder({
  websiteId,
  pageId,
  initialSections,
  brand,
  theme,
  nav,
  dataByType,
}: {
  websiteId: string;
  pageId: string;
  initialSections: WebsiteSection[];
  brand: SiteBrand;
  theme: SiteThemeConfig;
  nav: SiteNavItem[];
  dataByType: Partial<SiteDataByType>;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [sections, setSections] = useState<WebsiteSection[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSections[0]?.id ?? null,
  );
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [dirty, setDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const previewRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const previewData = useMemo(
    () => buildPreviewData(sections, dataByType),
    [sections, dataByType],
  );

  function mutate(next: WebsiteSection[]) {
    setSections(next);
    setDirty(true);
  }

  function updateSection(next: WebsiteSection) {
    mutate(sections.map((s) => (s.id === next.id ? next : s)));
  }

  function toggleEnabled(id: string) {
    mutate(
      sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  function removeSection(id: string) {
    mutate(sections.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateSection(id: string) {
    const i = sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const copy = {
      ...structuredClone(sections[i]),
      id: crypto.randomUUID(),
    } as WebsiteSection;
    mutate([...sections.slice(0, i + 1), copy, ...sections.slice(i + 1)]);
    setSelectedId(copy.id);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    mutate(arrayMove(sections, oldIndex, newIndex));
  }

  function addSection(type: SectionType) {
    const s = newSection(type);
    mutate([...sections, s]);
    setSelectedId(s.id);
    setAddOpen(false);
  }

  function onSave() {
    startSave(async () => {
      const res = await saveDraftSectionsAction({
        websiteId,
        pageId,
        sections,
      });
      if (!res.ok) {
        toast.error(t("draftSaveError"));
        return;
      }
      setDirty(false);
      toast.success(t("draftSaved"));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* ── Editor pane ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <Plus className="h-4 w-4" />
              {t("addSection")}
              <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
            </button>
            {addOpen ? (
              <>
                <button
                  type="button"
                  aria-hidden
                  onClick={() => setAddOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute left-0 top-full z-20 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-[12px] border border-brand-line bg-white p-1.5 shadow-card">
                  {SECTION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addSection(type)}
                      className="flex w-full items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                    >
                      {t(`sectionType_${type}`)}
                      {isAutoPopulate(type) ? (
                        <span className="rounded-pill bg-brand-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-secondary">
                          {t("liveBadge")}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {dirty ? t("saveDraft") : t("draftSavedShort")}
          </button>
        </div>

        {sections.length === 0 ? (
          <p className="rounded-card border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
            {t("noSections")}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {sections.map((s) => (
                  <SortableSectionRow
                    key={s.id}
                    section={s}
                    websiteId={websiteId}
                    open={selectedId === s.id}
                    onSelect={() =>
                      setSelectedId(selectedId === s.id ? null : s.id)
                    }
                    onToggle={() => toggleEnabled(s.id)}
                    onDuplicate={() => duplicateSection(s.id)}
                    onRemove={() => removeSection(s.id)}
                    onChange={updateSection}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Preview pane ──────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("livePreview")}
          </span>
          <div className="inline-flex rounded-[10px] border border-brand-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              title={t("deviceDesktop")}
              className={`rounded-[8px] p-1.5 ${
                device === "desktop"
                  ? "bg-brand-primary text-white"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("phone")}
              title={t("devicePhone")}
              className={`rounded-[8px] p-1.5 ${
                device === "phone"
                  ? "bg-brand-primary text-white"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-brand-line bg-brand-light/40">
          <div
            ref={previewRef}
            className={`mx-auto max-h-[78vh] overflow-y-auto bg-white transition-[max-width] ${
              device === "phone" ? "max-w-[390px]" : "max-w-full"
            }`}
          >
            <SiteThemeRoot theme={theme}>
              <SiteChrome brand={brand} nav={nav}>
                <SectionRenderer
                  sections={sections}
                  data={previewData}
                  asset={asset}
                />
              </SiteChrome>
            </SiteThemeRoot>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One draggable section row (grip handle = drag; keyboard-accessible via dnd-kit). */
function SortableSectionRow({
  section,
  websiteId,
  open,
  onSelect,
  onToggle,
  onDuplicate,
  onRemove,
  onChange,
}: {
  section: WebsiteSection;
  websiteId: string;
  open: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-card border bg-white transition ${
        open ? "border-brand-primary shadow-card" : "border-brand-line"
      } ${isDragging ? "shadow-lift" : ""}`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("dragToReorder")}
          className="cursor-grab touch-none text-brand-mute/70 hover:text-brand-ink active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={`truncate text-sm font-semibold ${
              section.enabled
                ? "text-brand-ink"
                : "text-brand-mute line-through"
            }`}
          >
            {t(`sectionType_${section.type}`)}
          </span>
          {isAutoPopulate(section.type) ? (
            <span className="shrink-0 rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-mute">
              {t("liveBadge")}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onToggle}
          title={section.enabled ? t("hideSection") : t("showSection")}
          className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          {section.enabled ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title={t("duplicateSection")}
          className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title={t("deleteSection")}
          className="rounded p-1.5 text-brand-mute hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSelect}
          aria-label={t("editSection")}
          className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open ? (
        <div className="border-t border-brand-line px-3.5 py-4">
          <SectionEditor
            websiteId={websiteId}
            section={section}
            onChange={onChange}
          />
        </div>
      ) : null}
    </li>
  );
}
