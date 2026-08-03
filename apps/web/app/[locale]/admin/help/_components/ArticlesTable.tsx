"use client";

import {
  AlertCircle,
  ArchiveRestore,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Eye,
  FolderInput,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { modal } from "@/components/ui/modal-host";

import {
  bulkArchiveArticles,
  bulkMoveArticles,
  bulkPublishArticles,
  bulkRestoreArticles,
  bulkSoftDeleteArticles,
} from "../articles/actions";

export type AdminArticleRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  audience: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  saved_count: number;
  featured_rank: number | null;
  category_id: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type Props = {
  rows: AdminArticleRow[];
  categoryMap: Record<string, string>;
  categories: { id: string; name: string }[];
  isTrash: boolean;
};

export function ArticlesTable({
  rows,
  categoryMap,
  categories,
  isTrash,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function clear() {
    setSelected(new Set());
  }

  function afterRun(
    res: { ok: true; count: number } | { ok: false; error: string },
    verb: string,
  ) {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOkMsg(`${verb} ${res.count} article${res.count === 1 ? "" : "s"}.`);
    clear();
    router.refresh();
  }

  const selectedIds = () => Array.from(selected);

  function doPublish() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      afterRun(await bulkPublishArticles(selectedIds()), "Published");
    });
  }

  async function doArchive() {
    setError(null);
    setOkMsg(null);
    const reason = await modal.prompt({
      title: `Archive ${selected.size} article${selected.size === 1 ? "" : "s"}?`,
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you archiving these?",
      minLength: 5,
      confirmLabel: "Archive",
    });
    if (!reason) return;
    startTransition(async () => {
      afterRun(await bulkArchiveArticles(selectedIds(), reason), "Archived");
    });
  }

  async function doDelete() {
    setError(null);
    setOkMsg(null);
    const reason = await modal.prompt({
      title: `Delete ${selected.size} article${selected.size === 1 ? "" : "s"}?`,
      description: "They're soft-deleted and can be restored from Trash.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting these?",
      minLength: 5,
      confirmLabel: "Delete",
      intent: "destructive",
    });
    if (!reason) return;
    startTransition(async () => {
      afterRun(await bulkSoftDeleteArticles(selectedIds(), reason), "Deleted");
    });
  }

  async function doRestore() {
    setError(null);
    setOkMsg(null);
    const reason = await modal.prompt({
      title: `Restore ${selected.size} article${selected.size === 1 ? "" : "s"}?`,
      description: "They come back as drafts.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you restoring these?",
      minLength: 5,
      confirmLabel: "Restore",
    });
    if (!reason) return;
    startTransition(async () => {
      afterRun(await bulkRestoreArticles(selectedIds(), reason), "Restored");
    });
  }

  function doMove() {
    if (!someSelected) return;
    setError(null);
    setOkMsg(null);
    const categoryId =
      moveTo === "" ? null : moveTo === "__none__" ? null : moveTo;
    startTransition(async () => {
      afterRun(await bulkMoveArticles(selectedIds(), categoryId), "Moved");
      setMoveTo("");
    });
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <p className="px-5 py-10 text-center text-sm text-brand-mute">
          No articles match this filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}
      {okMsg ? (
        <div className="flex items-start gap-2 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {okMsg}
        </div>
      ) : null}

      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-brand-line bg-white px-4 py-2.5 shadow-card">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={toggleAll}
            className="rounded border-brand-line"
          />
          {someSelected ? `${selected.size} selected` : "Select all"}
        </label>

        {someSelected ? (
          <>
            <span className="mx-1 h-4 w-px bg-brand-line" />
            {isTrash ? (
              <BulkBtn
                onClick={doRestore}
                disabled={pending}
                icon={ArchiveRestore}
              >
                Restore
              </BulkBtn>
            ) : (
              <>
                <BulkBtn onClick={doPublish} disabled={pending} icon={BookOpen}>
                  Publish
                </BulkBtn>
                <BulkBtn onClick={doArchive} disabled={pending}>
                  Archive
                </BulkBtn>
                <div className="inline-flex items-center gap-1">
                  <select
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    className="rounded border border-brand-line bg-white px-2 py-1.5 text-xs text-brand-ink"
                  >
                    <option value="">Move to…</option>
                    <option value="__none__">— Uncategorised —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <BulkBtn
                    onClick={doMove}
                    disabled={pending || moveTo === ""}
                    icon={FolderInput}
                  >
                    Move
                  </BulkBtn>
                </div>
                <BulkBtn
                  onClick={doDelete}
                  disabled={pending}
                  icon={Trash2}
                  tone="danger"
                >
                  Delete
                </BulkBtn>
              </>
            )}
            <button
              type="button"
              onClick={clear}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-ink"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </>
        ) : (
          <span className="ml-auto text-[12px] text-brand-mute">
            Select articles to publish, archive, move or delete in bulk.
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <ul className="divide-y divide-brand-line">
          {rows.map((a) => {
            const isSel = selected.has(a.id);
            return (
              <li
                key={a.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isSel ? "bg-brand-accent/40" : "hover:bg-brand-light/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(a.id)}
                  aria-label={`Select ${a.title}`}
                  className="rounded border-brand-line"
                />
                <Link
                  href={`/admin/help/articles/${a.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-brand-ink">
                        {a.title}
                      </span>
                      <StatusPill status={a.deleted_at ? "trash" : a.status} />
                      <AudiencePill audience={a.audience} />
                      {a.featured_rank ? (
                        <span className="inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-brand-secondary">
                          #{a.featured_rank}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-brand-mute">
                      <span>/help/{a.slug}</span>
                      {a.category_id && categoryMap[a.category_id] ? (
                        <span>· {categoryMap[a.category_id]}</span>
                      ) : null}
                      <span>
                        · Updated{" "}
                        {new Date(a.updated_at).toLocaleDateString("en-ZA")}
                      </span>
                    </div>
                  </div>
                  <div className="hidden items-center gap-4 sm:flex">
                    <Stat icon={Eye} value={a.view_count} />
                    <Stat icon={Bookmark} value={a.saved_count} />
                    <Stat
                      icon={ThumbsUp}
                      value={a.helpful_count}
                      tone={a.helpful_count > 0 ? "positive" : undefined}
                    />
                    <Stat
                      icon={ThumbsDown}
                      value={a.not_helpful_count}
                      tone={a.not_helpful_count > 0 ? "negative" : undefined}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function BulkBtn({
  onClick,
  disabled,
  icon: Icon,
  tone,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon?: typeof BookOpen;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
        tone === "danger"
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function Stat({
  icon: Icon,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  value: number;
  tone?: "positive" | "negative";
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 font-mono text-[12px] ${
        tone === "negative"
          ? "text-red-700"
          : tone === "positive"
            ? "text-emerald-700"
            : "text-brand-mute"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {value}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-800",
    draft: "bg-amber-100 text-amber-800",
    archived: "bg-brand-light text-brand-mute",
    trash: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize ${cls[status] ?? cls.draft}`}
    >
      {status}
    </span>
  );
}

function AudiencePill({ audience }: { audience: string }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-semibold capitalize text-brand-mute">
      {audience}
    </span>
  );
}
