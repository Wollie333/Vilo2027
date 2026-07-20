"use client";

import { Check, GitMerge, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  BOARD_STATUSES,
  STATUS_META,
  type AdminFeatureRequest,
  type BoardStatus,
} from "@/lib/buildBoard.shared";

import {
  createFeatureRequestAction,
  deleteRequestAction,
  mergeRequestsAction,
  setRequestPublishedAction,
  setRequestStatusAction,
  updateFeatureRequestTextAction,
} from "./actions";

export function BuildBoardAdmin({
  pending,
  published,
  merged,
}: {
  pending: AdminFeatureRequest[];
  published: AdminFeatureRequest[];
  merged: AdminFeatureRequest[];
}) {
  return (
    <div className="space-y-8">
      <NewItemCard />

      {/* Pending queue */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-brand-ink">
          Pending review
          <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {pending.length}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-card border border-brand-line bg-white p-4 text-sm text-brand-mute">
            No submissions waiting. New ideas from{" "}
            <code className="text-[12px]">/build</code> land here first.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <PendingRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      {/* Published board */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-brand-ink">
          On the board
          <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
            {published.length}
          </span>
        </h2>
        {published.length === 0 ? (
          <p className="rounded-card border border-brand-line bg-white p-4 text-sm text-brand-mute">
            Nothing published yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {published.map((r) => (
              <PublishedRow key={r.id} r={r} others={published} />
            ))}
          </ul>
        )}
      </section>

      {merged.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-sm font-bold text-brand-mute">
            Merged ({merged.length})
          </h2>
          <ul className="space-y-1.5">
            {merged.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-brand-line bg-brand-light/40 px-3 py-2 text-[13px] text-brand-mute"
              >
                <span className="line-through">{r.title}</span> → merged
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Meta({ r }: { r: AdminFeatureRequest }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-mute">
      <span>{r.voteCount} votes</span>
      <span>
        {r.hostVoteCount} host · {r.guestVoteCount} guest
      </span>
      {r.submitterRole ? <span>by {r.submitterRole}</span> : null}
      {r.submitterEmail ? <span>{r.submitterEmail}</span> : null}
    </div>
  );
}

// Title + body block that flips into an edit form. Shared by both row types.
function EditableTitleBody({ r }: { r: AdminFeatureRequest }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(r.title);
  const [body, setBody] = useState(r.body ?? "");
  const [pending, start] = useTransition();

  function save() {
    if (title.trim().length < 3) {
      toast.error("Title needs at least 3 characters.");
      return;
    }
    start(async () => {
      try {
        await updateFeatureRequestTextAction({
          id: r.id,
          title: title.trim(),
          body,
        });
        toast.success("Updated.");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update.");
      }
    });
  }

  function cancel() {
    setTitle(r.title);
    setBody(r.body ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          disabled={pending}
          className="w-full rounded-md border border-brand-line bg-white px-2 py-1.5 text-sm font-semibold text-brand-ink outline-none focus:border-brand-primary"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={2}
          disabled={pending}
          placeholder="Description (optional)"
          className="w-full resize-none rounded-md border border-brand-line bg-white px-2 py-1.5 text-sm text-brand-mute outline-none focus:border-brand-primary"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-pill bg-brand-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-3 py-1 text-xs font-semibold text-brand-mute disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        <span className="font-semibold text-brand-ink">{r.title}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit title & description"
          className="mt-0.5 shrink-0 text-brand-mute hover:text-brand-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {r.body ? <p className="mt-1 text-sm text-brand-mute">{r.body}</p> : null}
    </div>
  );
}

function NewItemCard() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<BoardStatus>("under_review");
  const [publishNow, setPublishNow] = useState(true);
  const [pending, start] = useTransition();

  function create() {
    if (title.trim().length < 3) {
      toast.error("Give it a title (3+ characters).");
      return;
    }
    start(async () => {
      try {
        await createFeatureRequestAction({
          title: title.trim(),
          body,
          status,
          isPublic: publishNow,
        });
        toast.success(publishNow ? "Added to the board." : "Saved as pending.");
        setTitle("");
        setBody("");
        setStatus("under_review");
        setPublishNow(true);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" /> New item
      </button>
    );
  }

  return (
    <div className="rounded-card border border-dashed border-brand-line bg-brand-light/40 p-5">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-brand-primary" />
        <h3 className="font-display text-sm font-bold text-brand-ink">
          New board item
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="Title — e.g. WhatsApp booking notifications"
          disabled={pending}
          className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Description (optional)"
          disabled={pending}
          className="w-full resize-none rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-mute outline-none focus:border-brand-primary"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BoardStatus)}
            disabled={pending}
            className="rounded-[10px] border border-brand-line bg-white px-2 py-2 text-sm text-brand-ink"
          >
            {BOARD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-brand-ink">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-brand-primary"
            />
            Publish to the board now
          </label>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-[10px] px-4 py-2 text-sm font-semibold text-brand-mute hover:text-brand-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PendingRow({ r }: { r: AdminFeatureRequest }) {
  const [pending, start] = useTransition();

  function approve() {
    start(async () => {
      try {
        await setRequestPublishedAction({ id: r.id, isPublic: true });
        toast.success("Published to the board.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to publish.");
      }
    });
  }
  function remove() {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteRequestAction({ id: r.id });
        toast.success("Deleted.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete.");
      }
    });
  }

  return (
    <li className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EditableTitleBody r={r} />
          <Meta r={r} />
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={approve}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-pill bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-3 py-1.5 text-xs font-semibold text-brand-mute hover:text-rose-600 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function PublishedRow({
  r,
  others,
}: {
  r: AdminFeatureRequest;
  others: AdminFeatureRequest[];
}) {
  const [pending, start] = useTransition();
  const [merging, setMerging] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  function changeStatus(status: string) {
    start(async () => {
      try {
        await setRequestStatusAction({ id: r.id, status });
        toast.success("Status updated.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update.");
      }
    });
  }
  function unpublish() {
    start(async () => {
      try {
        await setRequestPublishedAction({ id: r.id, isPublic: false });
        toast.success("Removed from the board.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed.");
      }
    });
  }
  function remove() {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteRequestAction({ id: r.id });
        toast.success("Deleted.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete.");
      }
    });
  }
  function doMerge() {
    if (!mergeTarget) return;
    const target = others.find((o) => o.id === mergeTarget);
    if (!confirm(`Merge "${r.title}" into "${target?.title}"?`)) return;
    start(async () => {
      try {
        await mergeRequestsAction({ sourceId: r.id, targetId: mergeTarget });
        toast.success("Merged.");
        setMerging(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to merge.");
      }
    });
  }

  const meta = STATUS_META[r.status];

  return (
    <li className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className={`mb-1.5 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <EditableTitleBody r={r} />
          <Meta r={r} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <select
            value={r.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={pending}
            className="rounded-md border border-brand-line bg-white px-2 py-1 text-xs text-brand-ink disabled:opacity-60"
          >
            {BOARD_STATUSES.map((s: BoardStatus) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMerging((v) => !v)}
              disabled={pending}
              title="Merge a duplicate into this"
              className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-2.5 py-1 text-xs font-semibold text-brand-mute hover:text-brand-ink disabled:opacity-60"
            >
              <GitMerge className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={unpublish}
              disabled={pending}
              title="Remove from board"
              className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-2.5 py-1 text-xs font-semibold text-brand-mute hover:text-brand-ink disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              title="Delete"
              className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-2.5 py-1 text-xs font-semibold text-brand-mute hover:text-rose-600 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {merging ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
          <span className="text-xs text-brand-mute">Merge this into:</span>
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-brand-line bg-white px-2 py-1 text-xs text-brand-ink"
          >
            <option value="">Choose a target…</option>
            {others
              .filter((o) => o.id !== r.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={doMerge}
            disabled={pending || !mergeTarget}
            className="rounded-pill bg-brand-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            Merge
          </button>
        </div>
      ) : null}
    </li>
  );
}
