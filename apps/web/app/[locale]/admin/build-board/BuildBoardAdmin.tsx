"use client";

import { Check, GitMerge, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  BOARD_STATUSES,
  STATUS_META,
  type AdminFeatureRequest,
  type BoardStatus,
} from "@/lib/buildBoard.shared";

import {
  deleteRequestAction,
  mergeRequestsAction,
  setRequestPublishedAction,
  setRequestStatusAction,
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
        <div className="min-w-0">
          <div className="font-semibold text-brand-ink">{r.title}</div>
          {r.body ? (
            <p className="mt-1 text-sm text-brand-mute">{r.body}</p>
          ) : null}
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
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <span className="font-semibold text-brand-ink">{r.title}</span>
          </div>
          {r.body ? (
            <p className="mt-1 text-sm text-brand-mute">{r.body}</p>
          ) : null}
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
