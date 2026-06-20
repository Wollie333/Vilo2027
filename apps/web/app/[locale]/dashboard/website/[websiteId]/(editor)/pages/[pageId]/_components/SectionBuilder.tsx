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
  Bookmark,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Pointer,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  saveDraftSectionsAction,
  saveSavedSectionAction,
  deleteSavedSectionAction,
} from "@/app/[locale]/dashboard/website/actions";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  SiteData,
  SiteDataByType,
  SiteBrand,
  SiteNavItem,
  SiteNavigation,
} from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import { newSection } from "@/lib/website/sectionDefaults";
import {
  isAutoPopulate,
  sectionsSchema,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import type { SavedSection } from "@/app/[locale]/dashboard/website/schemas";

import { DeviceFrame } from "./DeviceFrame";
import { SectionEditor } from "./SectionEditor";
import { SectionLibrary } from "./SectionLibrary";

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
      case "specials_preview":
        if (pool.specials_preview)
          data[s.id] = {
            type: "specials_preview",
            data: pool.specials_preview,
          };
        break;
      case "form":
        if (pool.form) data[s.id] = { type: "form", data: pool.form };
        break;
      case "trust":
        if (pool.trust) data[s.id] = { type: "trust", data: pool.trust };
        break;
      default:
        break;
    }
  }
  return data;
}

/**
 * First section that fails validation — lets us tell the host exactly which
 * section to fix instead of the old silent, all-or-nothing save rejection.
 */
function firstInvalidSection(list: WebsiteSection[]): WebsiteSection | null {
  const res = sectionsSchema.safeParse(list);
  if (res.success) return null;
  const idx = res.error.issues[0]?.path[0];
  if (typeof idx === "number" && list[idx]) return list[idx];
  return list[0] ?? null;
}

export function SectionBuilder({
  websiteId,
  pageId,
  initialSections,
  brand,
  theme,
  nav,
  navigation,
  dataByType,
  savedSections,
}: {
  websiteId: string;
  pageId: string;
  initialSections: WebsiteSection[];
  brand: SiteBrand;
  theme: SiteThemeConfig;
  nav: SiteNavItem[];
  navigation: SiteNavigation;
  dataByType: Partial<SiteDataByType>;
  savedSections: SavedSection[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [sections, setSections] = useState<WebsiteSection[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSections[0]?.id ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [visualEdit, setVisualEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [autoStatus, setAutoStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveBlockFor, setSaveBlockFor] = useState<WebsiteSection | null>(null);
  const [blockName, setBlockName] = useState("");

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

  const editingSection = editingId
    ? (sections.find((s) => s.id === editingId) ?? null)
    : null;

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
    if (editingId === id) setEditingId(null);
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
  }

  /** Insert a saved block as a fresh section (cloned with a new id). */
  function insertSaved(saved: SavedSection) {
    const copy = {
      ...structuredClone(saved.section),
      id: crypto.randomUUID(),
    } as WebsiteSection;
    mutate([...sections, copy]);
    setSelectedId(copy.id);
  }

  function confirmSaveBlock() {
    const section = saveBlockFor;
    const name = blockName.trim();
    if (!section || !name) return;
    startSave(async () => {
      const res = await saveSavedSectionAction({ websiteId, name, section });
      if (!res.ok) {
        toast.error(t("blockSaveError"));
        return;
      }
      setSaveBlockFor(null);
      setBlockName("");
      toast.success(t("blockSaved"));
      router.refresh();
    });
  }

  function deleteSaved(id: string) {
    startSave(async () => {
      const res = await deleteSavedSectionAction({ websiteId, id });
      if (res.ok) router.refresh();
      else toast.error(t("blockSaveError"));
    });
  }

  function onSave() {
    const bad = firstInvalidSection(sections);
    if (bad) {
      setSelectedId(bad.id);
      toast.error(
        t("sectionInvalid", { section: t(`sectionType_${bad.type}`) }),
      );
      return;
    }
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
      setAutoStatus("saved");
      toast.success(t("draftSaved"));
      router.refresh();
    });
  }

  // Debounced autosave — persists valid drafts ~1.5s after the last edit so
  // navigation can't silently lose work. Invalid drafts are held back (the host
  // fixes the flagged field via manual Save) rather than auto-saving broken data.
  useEffect(() => {
    if (!dirty || saving) return;
    if (firstInvalidSection(sections)) {
      setAutoStatus("error");
      return;
    }
    const id = setTimeout(() => {
      setAutoStatus("saving");
      void saveDraftSectionsAction({ websiteId, pageId, sections }).then(
        (res) => {
          if (res.ok) {
            setDirty(false);
            setAutoStatus("saved");
          } else {
            setAutoStatus("error");
          }
        },
      );
    }, 1500);
    return () => clearTimeout(id);
  }, [sections, dirty, saving, websiteId, pageId]);

  // Warn on tab close / hard refresh with unsaved edits (autosave covers soft
  // in-app navigation; this catches the cases beforeunload can).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const enabledSections = sections.filter((s) => s.enabled);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* ── Editor pane ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Plus className="h-4 w-4" />
            {t("addSection")}
          </button>

          <div className="flex items-center gap-2.5">
            <span
              className="text-[12px] font-medium text-brand-mute"
              aria-live="polite"
            >
              {dirty
                ? autoStatus === "saving"
                  ? t("autosaving")
                  : t("unsavedChanges")
                : autoStatus === "saved"
                  ? t("autosaved")
                  : null}
            </span>
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
                    onSaveBlock={() => {
                      setSaveBlockFor(s);
                      setBlockName("");
                    }}
                    onChange={updateSection}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Preview pane ──────────────────────────── */}
      <DeviceFrame
        toolbar={
          <button
            type="button"
            onClick={() => setVisualEdit((v) => !v)}
            title={t("visualEditHint")}
            className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
              visualEdit
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-brand-line bg-white text-brand-mute hover:text-brand-ink"
            }`}
          >
            <Pointer className="h-3.5 w-3.5" />
            {t("visualEdit")}
          </button>
        }
      >
        <SiteThemeRoot theme={theme}>
          <SiteChrome
            brand={brand}
            nav={nav}
            navigation={navigation}
            header={theme.header}
            footer={theme.footer}
          >
            {visualEdit ? (
              // Visual mode: each section gets a click-to-edit hotspot overlay.
              enabledSections.map((s) => (
                <div key={s.id} className="group relative">
                  <SectionRenderer
                    sections={[s]}
                    data={previewData}
                    asset={asset}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(s.id)}
                    className="absolute inset-0 z-10 flex items-start justify-start bg-brand-primary/0 ring-inset transition group-hover:bg-brand-primary/5 group-hover:ring-2 group-hover:ring-brand-primary"
                  >
                    <span className="m-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-ink px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lift transition group-hover:opacity-100">
                      <Pencil className="h-3 w-3" />
                      {t("editSectionLabel", {
                        section: t(`sectionType_${s.type}`),
                      })}
                    </span>
                  </button>
                </div>
              ))
            ) : (
              <SectionRenderer
                sections={sections}
                data={previewData}
                asset={asset}
              />
            )}
          </SiteChrome>
        </SiteThemeRoot>
      </DeviceFrame>

      {/* Section library picker (replaces the old dropdown). */}
      <SectionLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={addSection}
        savedSections={savedSections}
        onPickSaved={(s) => {
          insertSaved(s);
          setLibraryOpen(false);
        }}
        onDeleteSaved={deleteSaved}
      />

      {/* Save-as-block name dialog */}
      {saveBlockFor ? (
        <FormModal
          open
          onOpenChange={(o) => {
            if (!o) {
              setSaveBlockFor(null);
              setBlockName("");
            }
          }}
          title={t("saveBlockTitle")}
          description={t("saveBlockSub")}
        >
          <input
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder={t("blockNamePlaceholder")}
            maxLength={80}
            className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
          <FormModalFooter>
            <FormModalCancel>{t("cancel")}</FormModalCancel>
            <button
              type="button"
              onClick={confirmSaveBlock}
              disabled={saving || !blockName.trim()}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("saveBlockConfirm")}
            </button>
          </FormModalFooter>
        </FormModal>
      ) : null}

      {/* Visual-edit drawer — edit the clicked section; preview updates live. */}
      {editingSection ? (
        <FormModal
          open
          onOpenChange={(o) => !o && setEditingId(null)}
          title={t(`sectionType_${editingSection.type}`)}
          description={
            isAutoPopulate(editingSection.type)
              ? t("visualEditLiveHint")
              : t("visualEditHint")
          }
          size="lg"
        >
          <SectionEditor
            websiteId={websiteId}
            section={editingSection}
            onChange={updateSection}
          />
          <FormModalFooter>
            <FormModalCancel>{t("done")}</FormModalCancel>
          </FormModalFooter>
        </FormModal>
      ) : null}
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
  onSaveBlock,
  onChange,
}: {
  section: WebsiteSection;
  websiteId: string;
  open: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSaveBlock: () => void;
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
          onClick={onSaveBlock}
          title={t("saveAsBlock")}
          className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <Bookmark className="h-4 w-4" />
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
