"use client";

import { ChevronUp, Lightbulb, Loader2, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  BOARD_STATUSES,
  STATUS_META,
  type BoardStatus,
  type FeatureRequest,
} from "@/lib/buildBoard.shared";

import {
  submitFeatureRequestAction,
  toggleFeatureVoteAction,
} from "./actions";

type Filter = "all" | BoardStatus;

type VoteState = { voted: boolean; count: number };

export function BuildBoardClient({
  requests,
  votedIds,
  isAuthenticated,
  counts,
}: {
  requests: FeatureRequest[];
  votedIds: string[];
  isAuthenticated: boolean;
  counts: Record<BoardStatus, number>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showSubmit, setShowSubmit] = useState(false);

  // Local, optimistic vote state keyed by request id.
  const votedSet = useMemo(() => new Set(votedIds), [votedIds]);
  const [votes, setVotes] = useState<Record<string, VoteState>>(() => {
    const init: Record<string, VoteState> = {};
    for (const r of requests) {
      init[r.id] = { voted: votedSet.has(r.id), count: r.voteCount };
    }
    return init;
  });

  const visible =
    filter === "all"
      ? requests
      : requests.filter((r) => r.status === filter);

  const total = requests.length;

  function goSignIn() {
    window.location.href = `/login?next=${encodeURIComponent("/build")}`;
  }

  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8 lg:py-16">
        {/* Filter bar + suggest */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterPill
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All"
              count={total}
            />
            {BOARD_STATUSES.map((s) => (
              <FilterPill
                key={s}
                active={filter === s}
                onClick={() => setFilter(s)}
                label={STATUS_META[s].label}
                count={counts[s]}
                dot={STATUS_META[s].dot}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) return goSignIn();
              setShowSubmit(true);
            }}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
          >
            <Plus className="h-4 w-4" /> Suggest a feature
          </button>
        </div>

        {/* List */}
        <ol className="mt-8 space-y-3">
          {visible.length === 0 ? (
            <li className="rounded-card border border-brand-line bg-white p-8 text-center text-brand-mute shadow-card">
              Nothing here yet.
            </li>
          ) : (
            visible.map((r) => {
              const v = votes[r.id] ?? { voted: false, count: r.voteCount };
              return (
                <li
                  key={r.id}
                  className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-4 shadow-card lg:p-5"
                >
                  <VoteButton
                    voted={v.voted}
                    count={v.count}
                    isAuthenticated={isAuthenticated}
                    onVote={(next) =>
                      setVotes((prev) => ({ ...prev, [r.id]: next }))
                    }
                    current={v}
                    requestId={r.id}
                    onSignIn={goSignIn}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={r.status} />
                      {r.hostVoteCount + r.guestVoteCount > 0 ? (
                        <span className="text-[11px] text-brand-mute">
                          {r.hostVoteCount} host · {r.guestVoteCount} guest
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 font-display text-base font-bold leading-snug text-brand-ink">
                      {r.title}
                    </h3>
                    {r.body ? (
                      <p className="mt-1 text-sm leading-relaxed text-brand-mute">
                        {r.body}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ol>
      </div>

      {showSubmit ? (
        <SubmitModal
          onClose={() => setShowSubmit(false)}
        />
      ) : null}
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition ${
        active
          ? "border-brand-primary bg-brand-primary text-white"
          : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
      }`}
    >
      {dot ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : dot}`}
        />
      ) : null}
      {label}
      <span
        className={`text-[11px] ${active ? "text-white/80" : "text-brand-mute"}`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: BoardStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function VoteButton({
  voted,
  count,
  isAuthenticated,
  onVote,
  current,
  requestId,
  onSignIn,
}: {
  voted: boolean;
  count: number;
  isAuthenticated: boolean;
  onVote: (next: VoteState) => void;
  current: VoteState;
  requestId: string;
  onSignIn: () => void;
}) {
  const [pending, start] = useTransition();

  function handle() {
    if (!isAuthenticated) return onSignIn();
    // Optimistic flip.
    const optimistic: VoteState = {
      voted: !current.voted,
      count: current.count + (current.voted ? -1 : 1),
    };
    onVote(optimistic);
    start(async () => {
      const res = await toggleFeatureVoteAction(requestId);
      if (!res.ok) {
        onVote(current); // revert
        toast.error(res.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-pressed={voted}
      className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-card border px-2 py-2 transition disabled:opacity-60 ${
        voted
          ? "border-brand-primary bg-brand-accent text-brand-primary"
          : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/50 hover:text-brand-primary"
      }`}
    >
      <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
      <span className="font-display text-sm font-bold tabular-nums text-brand-ink">
        {count}
      </span>
    </button>
  );
}

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const t = title.trim();
    if (t.length < 3) {
      toast.error("Give your idea a short title first.");
      return;
    }
    start(async () => {
      const res = await submitFeatureRequestAction({ title: t, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Thanks! We'll review it and add it to the board.");
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-brand-line bg-white p-6 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-brand-ink">
                Suggest a feature
              </h2>
              <p className="text-xs text-brand-mute">
                We review every idea before it goes on the board.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-mute hover:text-brand-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-ink">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. WhatsApp booking notifications"
              disabled={pending}
              className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-ink">
              Details <span className="font-normal text-brand-mute">(optional)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What problem would this solve for you?"
              disabled={pending}
              className="w-full resize-none rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-pill px-4 py-2 text-sm font-semibold text-brand-mute hover:text-brand-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary/90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Submit idea
          </button>
        </div>
      </div>
    </div>
  );
}
