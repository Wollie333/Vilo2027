"use client";

import {
  CalendarCheck,
  Copy,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import {
  createWebsiteFormAction,
  deleteWebsiteFormAction,
  duplicateWebsiteFormAction,
} from "@/app/[locale]/dashboard/website/actions";
import type { FormType } from "@/lib/website/forms.schema";
import { Modal } from "@/components/ui/modal";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import type { FormEditorRow } from "./loadFormsEditor";

const GRID = "minmax(0,1fr) 132px 110px 132px 96px";

const TYPE_ICON: Record<FormType, typeof Mail> = {
  contact: CalendarCheck,
  custom: FileText,
  newsletter: Mail,
};

type Filter = "all" | "live" | "draft";

const TEMPLATES: Array<{ key: string; type: FormType; icon: typeof Mail }> = [
  { key: "blank", type: "custom", icon: FileText },
  { key: "booking", type: "contact", icon: CalendarCheck },
  { key: "newsletter", type: "newsletter", icon: Mail },
  { key: "contact", type: "contact", icon: Inbox },
  { key: "review", type: "contact", icon: Star },
];

export function FormsList({
  websiteId,
  initialForms,
}: {
  websiteId: string;
  initialForms: FormEditorRow[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [forms, setForms] = useState<FormEditorRow[]>(initialForms);
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  function duplicate(formId: string) {
    setDuplicatingId(formId);
    void (async () => {
      const res = await duplicateWebsiteFormAction({ websiteId, formId });
      if (!res.ok) {
        setDuplicatingId(null);
        toast.error(t("formsCreateError"));
        return;
      }
      toast.success(t("formDuplicated"));
      router.push(`/website-editor/${websiteId}/forms/${res.id}`);
    })();
  }

  const shown =
    filter === "all" ? forms : forms.filter((f) => f.status === filter);
  const totalSubs = forms.reduce((a, f) => a + f.submissionCount, 0);
  const monthSubs = forms.reduce((a, f) => a + f.submissionsThisMonth, 0);
  const liveCount = forms.filter((f) => f.status === "live").length;
  const deleting = deleteId ? forms.find((f) => f.id === deleteId) : null;

  const FILTERS: Array<[Filter, string]> = [
    ["all", t("formFilterAll")],
    ["live", t("formFilterLive")],
    ["draft", t("formFilterDraft")],
  ];

  return (
    <div className="wielo-cms mx-auto max-w-[1180px]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <h1
            className="font-display text-[20px] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {t("formsHeading")}
          </h1>
          <span className="tag">{forms.length}</span>
        </div>
        <p
          className="hidden text-[13px] lg:block"
          style={{ color: "var(--mute)" }}
        >
          {t("formsListSub")}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="stat">
          <div className="sv">{monthSubs}</div>
          <div className="sl">{t("formStatMonth")}</div>
        </div>
        <div className="stat">
          <div className="sv">{liveCount}</div>
          <div className="sl">{t("formStatLive")}</div>
        </div>
        <div className="stat">
          <div className="sv">{totalSubs}</div>
          <div className="sl">{t("formStatTotal")}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="eseg">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "on" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/dashboard/website/${websiteId}/forms/responses`}
            className="btn btn-ghost btn-sm"
          >
            <Inbox style={{ width: 15, height: 15 }} />
            {t("formViewSubmissions")}
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus style={{ width: 15, height: 15 }} />
            {t("newForm")}
          </button>
        </div>
      </div>

      <section
        style={{
          border: "1px solid var(--line)",
          borderRadius: 16,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          className="ptr"
          style={{
            gridTemplateColumns: GRID,
            cursor: "default",
            paddingTop: 11,
            paddingBottom: 11,
            background: "#FAFCFB",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="smallcaps">{t("formColForm")}</div>
          <div className="smallcaps">{t("formColType")}</div>
          <div className="smallcaps">{t("formColStatus")}</div>
          <div className="smallcaps">{t("formColSubs")}</div>
          <div className="smallcaps" style={{ textAlign: "right" }}>
            {t("pagesColActions")}
          </div>
        </div>

        <div style={{ padding: 8 }}>
          {shown.length === 0 ? (
            <div
              className="px-4 py-12 text-center text-[13px]"
              style={{ color: "var(--mute)" }}
            >
              {t("formsEmpty")}
            </div>
          ) : (
            shown.map((f) => (
              <FormRow
                key={f.id}
                websiteId={websiteId}
                form={f}
                duplicating={duplicatingId === f.id}
                onDelete={() => setDeleteId(f.id)}
                onDuplicate={() => duplicate(f.id)}
              />
            ))
          )}
        </div>
      </section>

      <div
        className="mt-4 flex items-center gap-2 text-[12px]"
        style={{ color: "var(--mute)" }}
      >
        <Inbox style={{ width: 14, height: 14, color: "#10B981" }} />
        {t("formsTip")}
      </div>

      <NewFormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        websiteId={websiteId}
      />

      <Modal
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        intent="destructive"
        title={t("deleteFormTitle")}
        description={
          deleting ? t("deleteFormBody", { name: deleting.name }) : undefined
        }
        actions={[
          {
            label: t("deleteFormConfirm"),
            kind: "danger",
            onClick: async () => {
              if (!deleteId) return;
              const res = await deleteWebsiteFormAction({
                websiteId,
                formId: deleteId,
              });
              if (!res.ok) {
                toast.error(t("saveError"));
                return;
              }
              setForms((fs) => fs.filter((x) => x.id !== deleteId));
              setDeleteId(null);
              toast.success(t("formDeleted"));
            },
          },
          { label: t("cancel") },
        ]}
      />
    </div>
  );
}

function FormRow({
  websiteId,
  form,
  duplicating,
  onDelete,
  onDuplicate,
}: {
  websiteId: string;
  form: FormEditorRow;
  duplicating: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const t = useTranslations("website");
  const Icon = TYPE_ICON[form.type];
  const live = form.status === "live";
  const fieldCount = form.fields.length;
  const where =
    form.embedLabels.length > 0
      ? form.embedLabels.slice(0, 2).join(" · ")
      : t("formNotEmbedded");

  return (
    <Link
      href={`/website-editor/${websiteId}/forms/${form.id}`}
      className="ptr"
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="fthumb">
          <i className="s" />
          <i />
          <i className="fbtn" />
        </div>
        <div className="min-w-0">
          <div
            className="truncate font-display text-[14px] font-bold"
            style={{ color: "var(--ink)" }}
          >
            {form.name}
          </div>
          <div
            className="truncate text-[11.5px]"
            style={{ color: "var(--mute)" }}
          >
            {t("formFieldsCount", { count: fieldCount })} · {where}
          </div>
        </div>
      </div>

      <div>
        <span
          className="tag"
          style={{
            background: "#F0FDF4",
            borderColor: "#D7EEE2",
            color: "#3A7A5E",
          }}
        >
          <Icon style={{ width: 12, height: 12 }} />
          {t(`formType_${form.type}`)}
        </span>
      </div>

      <div>
        <span className={live ? "tag green" : "tag"}>
          <span className="d" />
          {live ? t("statusLive") : t("statusDraftPage")}
        </span>
      </div>

      <div className="text-[12.5px]" style={{ color: "var(--mute)" }}>
        <span className="num" style={{ color: "var(--ink)", fontWeight: 600 }}>
          {form.submissionCount}
        </span>{" "}
        {t("formSubsLabel")}
        <div className="mt-0.5 text-[11px]">
          {t("formThisMonth", { count: form.submissionsThisMonth })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span className="btn btn-ghost btn-sm" style={{ height: 32 }}>
          <Pencil style={{ width: 14, height: 14, color: "var(--mute)" }} />
          {t("editPage")}
        </span>
        <RowMenu
          websiteId={websiteId}
          duplicating={duplicating}
          canDelete={!form.isDefault}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      </div>
    </Link>
  );
}

function RowMenu({
  websiteId,
  duplicating,
  canDelete,
  onDelete,
  onDuplicate,
}: {
  websiteId: string;
  duplicating: boolean;
  /** False for default forms — they're never-delete. */
  canDelete: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
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
        title={t("formMenu")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal style={{ width: 17, height: 17 }} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-[12px] border bg-white py-1"
          style={{
            borderColor: "var(--line)",
            top: "100%",
            boxShadow: "0 18px 40px -18px rgba(6,78,59,.45)",
          }}
        >
          <Link
            href={`/dashboard/website/${websiteId}/forms/responses`}
            className="rm-item"
            onClick={() => setOpen(false)}
          >
            <Inbox style={{ width: 15, height: 15 }} />
            {t("viewSubmissions")}
          </Link>
          <button
            type="button"
            className="rm-item"
            disabled={duplicating}
            onClick={stop(onDuplicate)}
          >
            {duplicating ? (
              <Loader2
                className="animate-spin"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <Copy style={{ width: 15, height: 15 }} />
            )}
            {t("duplicateForm")}
          </button>
          {canDelete ? (
            <button
              type="button"
              className="rm-item rm-danger"
              onClick={stop(onDelete)}
            >
              <Trash2 style={{ width: 15, height: 15 }} />
              {t("deleteForm")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NewFormModal({
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
  const [, start] = useTransition();
  // Stays true from the click through the route change — the modal keeps showing
  // a loading state until the form builder renders (no close-then-blank flash).
  const [creating, setCreating] = useState(false);

  function pick(tpl: (typeof TEMPLATES)[number]) {
    setCreating(true);
    start(async () => {
      const res = await createWebsiteFormAction({
        websiteId,
        name: t(`formTpl_${tpl.key}`),
        type: tpl.type,
        template: tpl.key,
      });
      if (!res.ok) {
        setCreating(false);
        toast.error(t("formsCreateError"));
        return;
      }
      // Don't close the modal — navigate while it stays open, so it dissolves
      // straight into the builder instead of flashing an empty screen.
      router.push(`/website-editor/${websiteId}/forms/${res.id}`);
    });
  }

  return (
    <FormModal
      open={open}
      // Block dismissal while creating so the loading state can't be cancelled
      // into a blank gap.
      onOpenChange={(o) => {
        if (!creating) onOpenChange(o);
      }}
      title={t("newFormTitle")}
      description={t("newFormSub")}
    >
      {creating ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-brand-primary" />
          <p className="text-sm font-semibold text-brand-ink">
            {t("formsCreating")}
          </p>
          <p className="text-[12px] text-brand-mute">{t("formsCreatingSub")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => pick(tpl)}
                  className="flex items-start gap-3 rounded-[12px] border border-brand-line bg-white p-3 text-left transition hover:border-brand-primary hover:bg-brand-light"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-brand-ink">
                      {t(`formTpl_${tpl.key}`)}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-brand-mute">
                      {t(`formTplDesc_${tpl.key}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <FormModalFooter>
            <FormModalCancel>{t("cancel")}</FormModalCancel>
          </FormModalFooter>
        </>
      )}
    </FormModal>
  );
}
