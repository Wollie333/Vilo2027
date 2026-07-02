"use client";

import {
  Copy,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { PendingLink } from "@/components/ui/pending-link";
import type { RoomChild } from "./loadPagesList";
import {
  createPageAction,
  deletePageAction,
  duplicatePageAction,
  savePagesAction,
} from "@/app/[locale]/dashboard/website/actions";
import {
  PAGE_TEMPLATES,
  PAGE_TEMPLATE_SECTIONS,
} from "@/app/[locale]/dashboard/website/schemas";
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
  thumbUrl: string | null;
};

// System templates (THEME_CONTRACT.md Class 2): auto-driven, edit-only, never in
// nav, never deletable — they're load-bearing for the booking flow. Everything
// else is a normal "Site page" the host fully controls.
const SYSTEM_KINDS = new Set([
  "room_detail",
  "checkout",
  "thank-you",
  "search_results",
]);
const isSystemPage = (p: ManagedPage) => SYSTEM_KINDS.has(p.kind);

// Pages mockup grid: Page · Type · Status · Sections · Actions.
const GRID = "minmax(0,1fr) 120px 110px 120px 96px";

export function PagesManager({
  websiteId,
  subdomain,
  initialPages,
  rooms = [],
}: {
  websiteId: string;
  subdomain: string;
  initialPages: ManagedPage[];
  rooms?: RoomChild[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pages, setPages] = useState<ManagedPage[]>(initialPages);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [, startSave] = useTransition();

  function pageTitle(p: ManagedPage) {
    if (p.kind === "home") return t("pageHome");
    if (p.kind === "about") return t("pageAbout");
    if (p.kind === "room_detail") return t("pageRoomDetail");
    if (p.kind === "checkout") return t("pageCheckout");
    if (p.kind === "thank-you") return t("pageThankYou");
    if (p.kind === "search_results") return t("pageSearchResults");
    return p.title || p.slug;
  }
  function pageType(p: ManagedPage) {
    if (p.kind === "home") return t("pageTypeLanding");
    if (p.kind === "room_detail") return t("pageTypeRoomTemplate");
    if (p.kind === "checkout") return t("pageTypeCheckout");
    if (p.kind === "thank-you") return t("pageTypeThankYou");
    if (p.kind === "search_results") return t("pageTypeSearchResults");
    return t("pageTypeStandard");
  }

  const sitePages = pages.filter((p) => !isSystemPage(p));
  const systemPages = pages.filter(isSystemPage);

  function toggleNav(p: ManagedPage) {
    const next = pages.map((x) =>
      x.id === p.id ? { ...x, showInNav: !x.showInNav } : x,
    );
    setPages(next);
    startSave(async () => {
      const res = await savePagesAction({
        websiteId,
        pages: next.map((x) => ({
          id: x.id,
          navLabel: x.navLabel ?? "",
          showInNav: x.showInNav,
        })),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        setPages(pages);
        return;
      }
      toast.success(p.showInNav ? t("hiddenFromNav") : t("inNav"));
      router.refresh();
    });
  }

  const deleting = deleteId ? pages.find((p) => p.id === deleteId) : null;

  function renderTable(
    heading: string,
    list: ManagedPage[],
    systemSection = false,
  ) {
    return (
      <section
        style={{
          border: "1px solid var(--line)",
          borderRadius: 16,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 pb-1 pt-3.5"
          style={{ color: "var(--ink)" }}
        >
          <span className="font-display text-[14px] font-bold">{heading}</span>
          <span className="tag">{list.length}</span>
        </div>
        <div
          className="ptr"
          style={{
            gridTemplateColumns: GRID,
            cursor: "default",
            paddingTop: 11,
            paddingBottom: 11,
            background: "#FAFCFB",
            borderBottom: "1px solid var(--line)",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div className="smallcaps">{t("pagesColPage")}</div>
          <div className="smallcaps">{t("pagesColType")}</div>
          <div className="smallcaps">{t("pagesColStatus")}</div>
          <div className="smallcaps">{t("pagesColSections")}</div>
          <div className="smallcaps" style={{ textAlign: "right" }}>
            {t("pagesColActions")}
          </div>
        </div>

        <div style={{ padding: 8 }}>
          {list.map((p) => (
            <Fragment key={p.id}>
              <PageRow
                websiteId={websiteId}
                subdomain={subdomain}
                page={p}
                title={pageTitle(p)}
                type={pageType(p)}
                system={systemSection}
                onDuplicate={() => router.refresh()}
                onToggleNav={() => toggleNav(p)}
                onDelete={() => setDeleteId(p.id)}
              />
              {/* The room-detail template renders for every room; the host can
                  also customize each room — so the rooms nest beneath it, each
                  opening the builder scoped to that room. */}
              {p.kind === "room_detail"
                ? rooms.map((room) => (
                    <RoomChildRow
                      key={room.roomId}
                      subdomain={subdomain}
                      room={room}
                    />
                  ))
                : null}
            </Fragment>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="wielo-cms mx-auto max-w-[1180px]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <h1
            className="font-display text-[20px] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {t("pagesHeading")}
          </h1>
          <span className="tag">{pages.length}</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus style={{ width: 15, height: 15 }} />
            {t("addPage")}
          </button>
        </div>
      </div>

      {renderTable(t("pagesSiteHeading"), sitePages)}

      {systemPages.length > 0 ? (
        <div className="mt-6">
          {renderTable(t("pagesSystemHeading"), systemPages, true)}
          <p className="mt-2 text-[12px]" style={{ color: "var(--mute)" }}>
            {t("pagesSystemNote")}
          </p>
        </div>
      ) : null}

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

/** A single room nested under the room-detail template — opens the builder
 *  scoped to that room (the `?room=` param drives "This room only" editing). */
function RoomChildRow({
  subdomain,
  room,
}: {
  subdomain: string;
  room: RoomChild;
}) {
  const t = useTranslations("website");
  // Display-only: every room renders from the shared Room detail template, which
  // is edited via the Rooms / Room detail page in the builder (per-room overrides
  // were retired in the Builder V2 cutover).
  return (
    <div className="row" style={{ gridTemplateColumns: GRID }}>
      <div
        className="flex min-w-0 items-center gap-2.5"
        style={{ paddingLeft: 30 }}
      >
        <span style={{ color: "var(--mute)", fontSize: 13 }}>↳</span>
        <div className="min-w-0">
          <div
            className="truncate text-[13px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            {room.name}
          </div>
          <div
            className="mono truncate text-[11px]"
            style={{ color: "var(--mute)" }}
          >
            {subdomain}/rooms/…
          </div>
        </div>
      </div>
      <div className="text-[12.5px]" style={{ color: "var(--mute)" }}>
        {t("pageTypeRoomPage")}
      </div>
      <div />
      <div />
      <div />
    </div>
  );
}

function PageRow({
  websiteId,
  subdomain,
  page,
  title,
  type,
  system,
  onDuplicate,
  onToggleNav,
  onDelete,
}: {
  websiteId: string;
  subdomain: string;
  page: ManagedPage;
  title: string;
  type: string;
  /** Rendered in the System-templates section → edit-only (no dup/nav/delete). */
  system: boolean;
  onDuplicate: () => void;
  onToggleNav: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [dup, startDup] = useTransition();
  const live = page.publishedCount > 0;
  const path =
    page.kind === "home"
      ? "/"
      : page.kind === "room_detail"
        ? "/rooms/…"
        : `/${page.slug}`;

  function onDuplicateClick() {
    startDup(async () => {
      const res = await duplicatePageAction(websiteId, page.id);
      if (!res.ok) {
        toast.error(t("duplicateError"));
        return;
      }
      toast.success(t("pageDuplicated"));
      onDuplicate();
      router.push(`/builder?websiteId=${websiteId}&pageId=${res.id}`);
    });
  }

  return (
    <PendingLink
      href={`/builder?websiteId=${websiteId}&pageId=${page.id}`}
      busy={{ title: t("openingEditor"), message: t("openingEditorMsg") }}
      className="ptr"
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="pthumb">
          {page.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.thumbUrl} alt="" />
          ) : (
            <>
              <div className="tb" />
              <div className="ph" />
            </>
          )}
        </div>
        <div className="min-w-0">
          <div
            className="truncate font-display text-[14px] font-bold"
            style={{ color: "var(--ink)" }}
          >
            {title}
          </div>
          <div
            className="mono truncate text-[11.5px]"
            style={{ color: "var(--mute)" }}
          >
            {subdomain}
            {path}
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 text-[12.5px]"
        style={{ color: "var(--mute)" }}
      >
        {type}
        {system ? <span className="tag">{t("pageSystemBadge")}</span> : null}
      </div>

      <div>
        <span className={live ? "tag green" : "tag"}>
          <span className="d" />
          {live ? t("statusLive") : t("statusDraftPage")}
        </span>
      </div>

      <div className="text-[12.5px]" style={{ color: "var(--mute)" }}>
        {t("sectionCount", { count: page.draftCount })}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span className="btn btn-ghost btn-sm" style={{ height: 32 }}>
          <Pencil style={{ width: 14, height: 14, color: "var(--mute)" }} />
          {t("editPage")}
        </span>
        {/* The room-detail template is a system page — no duplicate/nav/delete. */}
        {system ? null : (
          <RowMenu
            dup={dup}
            inNav={page.showInNav}
            canDelete={page.kind !== "home"}
            onDuplicate={onDuplicateClick}
            onToggleNav={onToggleNav}
            onDelete={onDelete}
          />
        )}
      </div>
    </PendingLink>
  );
}

/** Small per-row "⋯" dropdown (duplicate · nav visibility · delete). */
function RowMenu({
  dup,
  inNav,
  canDelete,
  onDuplicate,
  onToggleNav,
  onDelete,
}: {
  dup: boolean;
  inNav: boolean;
  canDelete: boolean;
  onDuplicate: () => void;
  onToggleNav: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("website");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const stop = (fn: () => void) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative" style={{ height: 32 }}>
      <button
        type="button"
        className="icon-btn"
        style={{ height: 32, width: 32 }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("pageMenu")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {dup ? (
          <Loader2 className="animate-spin" style={{ width: 17, height: 17 }} />
        ) : (
          <MoreHorizontal style={{ width: 17, height: 17 }} />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[12px] border bg-white py-1"
          style={{
            borderColor: "var(--line)",
            top: "100%",
            boxShadow: "0 18px 40px -18px rgba(6,78,59,.45)",
          }}
        >
          <button type="button" className="rm-item" onClick={stop(onDuplicate)}>
            <Copy style={{ width: 15, height: 15 }} />
            {t("duplicatePage")}
          </button>
          <button type="button" className="rm-item" onClick={stop(onToggleNav)}>
            {inNav ? (
              <EyeOff style={{ width: 15, height: 15 }} />
            ) : (
              <Eye style={{ width: 15, height: 15 }} />
            )}
            {inNav ? t("hideFromNav") : t("showInNav")}
          </button>
          {canDelete ? (
            <button
              type="button"
              className="rm-item rm-danger"
              onClick={stop(onDelete)}
            >
              <Trash2 style={{ width: 15, height: 15 }} />
              {t("deletePage")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
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
      router.push(`/builder?websiteId=${websiteId}&pageId=${res.id}`);
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
          <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
            {PAGE_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setTemplate(tpl)}
                className={`rounded-[10px] border p-2.5 text-left transition ${
                  template === tpl
                    ? "border-brand-primary bg-brand-light"
                    : "border-brand-line bg-white hover:bg-brand-light"
                }`}
              >
                <div className="mb-2 flex flex-col gap-1 rounded-[8px] border border-brand-line bg-brand-light/40 p-1.5">
                  {PAGE_TEMPLATE_SECTIONS[tpl].slice(0, 5).map((type, i) => (
                    <div
                      key={i}
                      className="truncate rounded bg-white px-1.5 py-1 text-[10px] font-medium text-brand-mute"
                    >
                      {t(`sectionType_${type}`)}
                    </div>
                  ))}
                </div>
                <span className="block text-[13px] font-semibold text-brand-ink">
                  {t(`pageTemplate_${tpl}`)}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-brand-mute">
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
