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
  Check,
  Copy,
  Eye,
  EyeOff,
  File as FileIcon,
  GripVertical,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  deleteSavedSectionAction,
  publishWebsiteAction,
  saveDraftSectionsAction,
  saveSavedSectionAction,
} from "@/app/[locale]/dashboard/website/actions";
import type { SavedSection } from "@/app/[locale]/dashboard/website/schemas";
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
  SiteBrand,
  SiteData,
  SiteDataByType,
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

import { SectionEditor } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/SectionEditor";
import { SectionLibrary } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/SectionLibrary";

const asset = (p: string | null | undefined) => websiteAssetUrl(p) ?? undefined;

type Device = "desktop" | "tablet" | "phone";

/** Build the by-id SiteData map for the live preview from the per-type pool. */
function buildPreviewData(
  sections: WebsiteSection[],
  pool: Partial<SiteDataByType>,
): SiteData {
  const data: SiteData = {};
  const keys: SectionType[] = [
    "gallery",
    "rooms_preview",
    "location",
    "reviews",
    "blog_preview",
    "specials_preview",
    "form",
    "trust",
    "booking_search",
    "availability_calendar",
    "rate_table",
  ];
  for (const s of sections) {
    if (!keys.includes(s.type)) continue;
    const slice = (pool as Record<string, unknown>)[s.type];
    if (slice) data[s.id] = { type: s.type, data: slice } as SiteData[string];
  }
  return data;
}

/** First section that fails validation, so we can point the host straight at it. */
function firstInvalidSection(list: WebsiteSection[]): WebsiteSection | null {
  const res = sectionsSchema.safeParse(list);
  if (res.success) return null;
  const idx = res.error.issues[0]?.path[0];
  if (typeof idx === "number" && list[idx]) return list[idx];
  return list[0] ?? null;
}

export function PageBuilder({
  websiteId,
  pageId,
  pageTitle,
  subdomain,
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
  pageTitle: string;
  subdomain: string;
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
  const [device, setDevice] = useState<Device>("desktop");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [publishing, startPublish] = useTransition();
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
  const selected = selectedId
    ? (sections.find((s) => s.id === selectedId) ?? null)
    : null;

  function mutate(next: WebsiteSection[]) {
    setSections(next);
    setDirty(true);
  }
  const updateSection = (next: WebsiteSection) =>
    mutate(sections.map((s) => (s.id === next.id ? next : s)));
  const toggleEnabled = (id: string) =>
    mutate(
      sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
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
  function addSection(type: SectionType) {
    const s = newSection(type);
    mutate([...sections, s]);
    setSelectedId(s.id);
  }
  function insertSaved(saved: SavedSection) {
    const copy = {
      ...structuredClone(saved.section),
      id: crypto.randomUUID(),
    } as WebsiteSection;
    mutate([...sections, copy]);
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

  function onPublish() {
    const bad = firstInvalidSection(sections);
    if (bad) {
      setSelectedId(bad.id);
      toast.error(
        t("sectionInvalid", { section: t(`sectionType_${bad.type}`) }),
      );
      return;
    }
    startPublish(async () => {
      // Persist the latest draft first, then publish the snapshot.
      const draft = await saveDraftSectionsAction({
        websiteId,
        pageId,
        sections,
      });
      if (!draft.ok) {
        toast.error(t("draftSaveError"));
        return;
      }
      setDirty(false);
      const res = await publishWebsiteAction(websiteId);
      if (!res.ok) {
        toast.error(t("publishError"));
        return;
      }
      toast.success(t("sitePublished"));
      router.refresh();
    });
  }

  // Debounced autosave — valid drafts persist ~1.5s after the last edit.
  useEffect(() => {
    if (!dirty || saving || publishing) return;
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
  }, [sections, dirty, saving, publishing, websiteId, pageId]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const deviceClass =
    device === "tablet"
      ? "device tablet"
      : device === "phone"
        ? "device mobile"
        : "device";
  const devices: Array<{ key: Device; icon: typeof Monitor; title: string }> = [
    { key: "desktop", icon: Monitor, title: t("deviceDesktop") },
    { key: "tablet", icon: Tablet, title: t("deviceTablet") },
    { key: "phone", icon: Smartphone, title: t("devicePhone") },
  ];
  const enabled = sections.filter((s) => s.enabled);
  const autoLabel =
    autoStatus === "saving"
      ? t("autosaving")
      : dirty
        ? t("unsavedChanges")
        : autoStatus === "saved"
          ? t("autosaved")
          : "";

  return (
    <div
      className="vilo-builder"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header className="etop">
        <Link href={`/dashboard/website/${websiteId}/pages`} className="eback">
          <FileIcon style={{ width: 16, height: 16 }} />
          {t("allPages")}
        </Link>
        <div className="epage">
          <span className="pico">
            <FileIcon style={{ width: 16, height: 16 }} />
          </span>
          <div>
            <div className="ptit">{pageTitle}</div>
            <div className="psub">{subdomain}</div>
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="seg" role="group" aria-label={t("livePreview")}>
            {devices.map((d) => {
              const Ico = d.icon;
              return (
                <button
                  key={d.key}
                  type="button"
                  title={d.title}
                  aria-pressed={device === d.key}
                  className={device === d.key ? "on" : ""}
                  onClick={() => setDevice(d.key)}
                >
                  <Ico style={{ width: 15, height: 15 }} />
                </button>
              );
            })}
          </div>

          <span className="savedot" aria-live="polite">
            {autoStatus === "saving" ? (
              <Loader2
                className="animate-spin"
                style={{ width: 13, height: 13 }}
              />
            ) : null}
            {autoLabel}
          </span>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onPublish}
            disabled={publishing}
          >
            {publishing ? (
              <Loader2
                className="animate-spin"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <Rocket style={{ width: 15, height: 15 }} />
            )}
            {t("publishCta")}
          </button>
        </div>
      </header>

      <div className="ebody">
        {/* ── Palette / outline ─────────────────────── */}
        <aside className="epanel l">
          <div className="epanel-h">
            <h3>{t("pbOutline")}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setLibraryOpen(true)}
              style={{ marginLeft: "auto" }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {t("addSection")}
            </button>
          </div>
          <div className="epanel-b thin">
            {sections.length === 0 ? (
              <div className="insp-empty">{t("noSections")}</div>
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
                  <div className="ol">
                    {sections.map((s) => (
                      <OutlineItem
                        key={s.id}
                        section={s}
                        selected={selectedId === s.id}
                        onSelect={() => setSelectedId(s.id)}
                        onToggle={() => toggleEnabled(s.id)}
                        onRemove={() => removeSection(s.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </aside>

        {/* ── Canvas (live theme/brand preview) ─────── */}
        <div className="canvas-wrap thin">
          <div className={deviceClass}>
            <SiteThemeRoot theme={theme}>
              <SiteChrome
                brand={brand}
                nav={nav}
                navigation={navigation}
                header={theme.header}
                footer={theme.footer}
              >
                {enabled.length === 0 ? (
                  <div className="canvas-empty">{t("noSections")}</div>
                ) : (
                  enabled.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        position: "relative",
                        cursor: "pointer",
                        outline:
                          selectedId === s.id ? "2px solid #10B981" : "none",
                        outlineOffset: -2,
                      }}
                    >
                      <SectionRenderer
                        sections={[s]}
                        data={previewData}
                        asset={asset}
                      />
                    </div>
                  ))
                )}
              </SiteChrome>
            </SiteThemeRoot>
          </div>
        </div>

        {/* ── Inspector ─────────────────────────────── */}
        <aside className="epanel r">
          {selected ? (
            <>
              <div className="epanel-h">
                <h3>{t(`sectionType_${selected.type}`)}</h3>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="iconbtn"
                    title={
                      selected.enabled ? t("hideSection") : t("showSection")
                    }
                    onClick={() => toggleEnabled(selected.id)}
                  >
                    {selected.enabled ? (
                      <Eye style={{ width: 15, height: 15 }} />
                    ) : (
                      <EyeOff style={{ width: 15, height: 15 }} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    title={t("duplicateSection")}
                    onClick={() => duplicateSection(selected.id)}
                  >
                    <Copy style={{ width: 15, height: 15 }} />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    title={t("deleteSection")}
                    onClick={() => removeSection(selected.id)}
                  >
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </div>
              <div className="epanel-b thin">
                {isAutoPopulate(selected.type) ? (
                  <p className="insp-sec" style={{ fontSize: 12.5 }}>
                    {t("visualEditLiveHint")}
                  </p>
                ) : null}
                <SectionEditor
                  websiteId={websiteId}
                  section={selected}
                  onChange={updateSection}
                />
              </div>
            </>
          ) : (
            <div className="insp-empty">{t("pbSelectHint")}</div>
          )}
        </aside>
      </div>

      <SectionLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={(type) => {
          addSection(type);
          setLibraryOpen(false);
        }}
        savedSections={savedSections}
        onPickSaved={(s) => {
          insertSaved(s);
          setLibraryOpen(false);
        }}
        onDeleteSaved={deleteSaved}
      />

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
              {saving ? <Check style={{ width: 15, height: 15 }} /> : null}
              {t("saveBlockConfirm")}
            </button>
          </FormModalFooter>
        </FormModal>
      ) : null}
    </div>
  );
}

/** One outline row — drag to reorder (grip), click to select, hide/delete. */
function OutlineItem({
  section,
  selected,
  onSelect,
  onToggle,
  onRemove,
}: {
  section: WebsiteSection;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
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
    <div
      ref={setNodeRef}
      style={style}
      className={`ol-item${selected ? "sel" : ""}${section.enabled ? "" : "hidden"}`}
      onClick={onSelect}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("dragToReorder")}
        className="iconbtn"
        style={{ cursor: "grab" }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical style={{ width: 14, height: 14 }} />
      </button>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {t(`sectionType_${section.type}`)}
      </span>
      {isAutoPopulate(section.type) ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#4A7C6A",
            background: "#E8F3EE",
            padding: "2px 5px",
            borderRadius: 5,
          }}
        >
          {t("liveBadge")}
        </span>
      ) : null}
      <button
        type="button"
        className="iconbtn"
        title={section.enabled ? t("hideSection") : t("showSection")}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {section.enabled ? (
          <Eye style={{ width: 14, height: 14 }} />
        ) : (
          <EyeOff style={{ width: 14, height: 14 }} />
        )}
      </button>
      <button
        type="button"
        className="iconbtn"
        title={t("deleteSection")}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
