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
  Copy,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import {
  createPageAction,
  deletePageAction,
  duplicatePageAction,
  savePagesAction,
} from "@/app/[locale]/dashboard/website/actions";
import { PAGE_TEMPLATES } from "@/app/[locale]/dashboard/website/schemas";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Modal } from "@/components/ui/modal";

export type ManagedPage = {
  id: string;
  kind: string;
  slug: string;
  title: string | null;
  navLabel: string | null;
  showInNav: boolean;
  draftCount: number;
  publishedCount: number;
};

export function PagesManager({
  websiteId,
  initialPages,
}: {
  websiteId: string;
  initialPages: ManagedPage[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pages, setPages] = useState<ManagedPage[]>(initialPages);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function pageTitle(p: ManagedPage) {
    if (p.kind === "home") return t("pageHome");
    if (p.kind === "about") return t("pageAbout");
    return p.title || p.slug;
  }

  function patch(id: string, next: Partial<ManagedPage>) {
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...next } : p)));
    setDirty(true);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(pages, oldIndex, newIndex);
    // The home page always stays first, even if another page is dropped above it.
    const homeIdx = reordered.findIndex((p) => p.kind === "home");
    if (homeIdx > 0) reordered.unshift(reordered.splice(homeIdx, 1)[0]);
    setPages(reordered);
    setDirty(true);
  }

  function onSave() {
    startSave(async () => {
      const res = await savePagesAction({
        websiteId,
        pages: pages.map((p) => ({
          id: p.id,
          navLabel: p.navLabel ?? "",
          showInNav: p.showInNav,
        })),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      setDirty(false);
      toast.success(t("pagesSaved"));
      router.refresh();
    });
  }

  const deleting = deleteId ? pages.find((p) => p.id === deleteId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <Plus className="h-4 w-4" />
          {t("addPage")}
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveNav")}
          </button>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2.5">
            {pages.map((p) => (
              <PageRow
                key={p.id}
                websiteId={websiteId}
                page={p}
                title={pageTitle(p)}
                locked={p.kind === "home"}
                onPatch={patch}
                onDelete={() => setDeleteId(p.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <AddPageModal
        open={addOpen}
        onOpenChange={setAddOpen}
        websiteId={websiteId}
      />

      <Modal
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        intent="destructive"
        title={t("deletePageTitle")}
        description={
          deleting
            ? t("deletePageBody", { page: pageTitle(deleting) })
            : undefined
        }
        actions={[
          {
            label: t("deletePageConfirm"),
            kind: "danger",
            onClick: async () => {
              if (!deleteId) return;
              const res = await deletePageAction(websiteId, deleteId);
              if (!res.ok) {
                toast.error(
                  res.error === "cannot_delete_home"
                    ? t("cannotDeleteHome")
                    : t("saveError"),
                );
                return;
              }
              setPages((ps) => ps.filter((x) => x.id !== deleteId));
              setDeleteId(null);
              toast.success(t("pageDeleted"));
              router.refresh();
            },
          },
          { label: t("cancel") },
        ]}
      />
    </div>
  );
}

function PageRow({
  websiteId,
  page,
  title,
  locked,
  onPatch,
  onDelete,
}: {
  websiteId: string;
  page: ManagedPage;
  title: string;
  locked: boolean;
  onPatch: (id: string, next: Partial<ManagedPage>) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [dup, startDup] = useTransition();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  function onDuplicate() {
    startDup(async () => {
      const res = await duplicatePageAction(websiteId, page.id);
      if (!res.ok) {
        toast.error(t("duplicateError"));
        return;
      }
      toast.success(t("pageDuplicated"));
      router.push(`/dashboard/website/${websiteId}/pages/${res.id}`);
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-card border bg-white p-3 transition ${
        isDragging ? "border-brand-primary shadow-lift" : "border-brand-line"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {locked ? (
          <span
            aria-hidden
            title={t("homeStaysFirst")}
            className="cursor-not-allowed text-brand-mute/30"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("dragToReorder")}
            className="cursor-grab touch-none text-brand-mute/70 hover:text-brand-ink active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary">
          <FileText className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-brand-ink">
              {title}
            </span>
            {page.publishedCount === 0 ? (
              <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-mute">
                {t("notPublishedYet")}
              </span>
            ) : null}
          </div>
          <span className="text-[12px] text-brand-mute">
            {t("sectionCount", { count: page.draftCount })} · /
            {page.kind === "home" ? "" : page.slug}
          </span>
        </div>

        <Link
          href={`/dashboard/website/${websiteId}/pages/${page.id}`}
          title={t("editPage")}
          className="shrink-0 rounded-[10px] border border-brand-line bg-white p-2.5 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={dup}
          title={t("duplicatePage")}
          className="shrink-0 rounded-[10px] border border-brand-line bg-white p-2.5 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
        >
          {dup ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
        {page.kind !== "home" ? (
          <button
            type="button"
            onClick={onDelete}
            title={t("deletePage")}
            className="shrink-0 rounded-[10px] border border-brand-line bg-white p-2.5 text-brand-mute transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Nav controls */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-brand-line pt-3">
        <label className="flex flex-1 items-center gap-2">
          <span className="text-[12px] font-medium text-brand-mute">
            {t("navLabel")}
          </span>
          <input
            value={page.navLabel ?? ""}
            onChange={(e) => onPatch(page.id, { navLabel: e.target.value })}
            placeholder={title}
            maxLength={60}
            className="min-w-0 flex-1 rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => onPatch(page.id, { showInNav: !page.showInNav })}
          className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-[12px] font-semibold transition ${
            page.showInNav
              ? "bg-brand-accent text-brand-secondary"
              : "bg-brand-light text-brand-mute"
          }`}
        >
          {page.showInNav ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {page.showInNav ? t("inNav") : t("hiddenFromNav")}
        </button>
      </div>
    </li>
  );
}

function AddPageModal({
  open,
  onOpenChange,
  websiteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [template, setTemplate] =
    useState<(typeof PAGE_TEMPLATES)[number]>("blank");
  const [pending, start] = useTransition();

  function onCreate() {
    if (!title.trim()) {
      toast.error(t("pageTitleRequired"));
      return;
    }
    start(async () => {
      const res = await createPageAction({ websiteId, title, template });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      onOpenChange(false);
      setTitle("");
      setTemplate("blank");
      router.push(`/dashboard/website/${websiteId}/pages/${res.id}`);
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t("addPageTitle")}
      description={t("addPageSub")}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-ink">
            {t("pageTitleLabel")}
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("pageTitlePlaceholder")}
            maxLength={120}
            className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </label>
        <div>
          <span className="block text-[13px] font-semibold text-brand-ink">
            {t("pageTemplate")}
          </span>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
            {PAGE_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setTemplate(tpl)}
                className={`rounded-[10px] border px-3 py-2.5 text-left text-[13px] transition ${
                  template === tpl
                    ? "border-brand-primary bg-brand-light"
                    : "border-brand-line bg-white hover:bg-brand-light"
                }`}
              >
                <span className="block font-semibold text-brand-ink">
                  {t(`pageTemplate_${tpl}`)}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-brand-mute">
                  {t(`pageTemplateDesc_${tpl}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <FormModalFooter>
        <FormModalCancel>{t("cancel")}</FormModalCancel>
        <button
          type="button"
          onClick={onCreate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("createPage")}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
