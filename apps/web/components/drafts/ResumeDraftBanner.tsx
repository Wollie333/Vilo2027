"use client";

import { History, RotateCcw, X } from "lucide-react";

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * "Resume where you left off?" prompt shown when an unsaved draft is recovered.
 * Restore applies the draft into the form; Discard throws it away. Never a
 * silent auto-restore — the host decides.
 */
export function ResumeDraftBanner({
  savedAt,
  onRestore,
  onDiscard,
  label = "unsaved changes",
}: {
  savedAt: string | null;
  onRestore: () => void;
  onDiscard: () => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-status-pending/30 bg-status-pending/[0.07] px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-status-pending/15 text-status-pending">
        <History className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-brand-ink">
          Resume where you left off?
        </div>
        <div className="text-[12px] text-brand-mute">
          We saved your {label}
          {savedAt ? ` from ${relativeTime(savedAt)}` : ""}. Restore them or
          start fresh.
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-mute transition hover:text-brand-ink"
        >
          <X className="h-3.5 w-3.5" /> Discard
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1.5 rounded-pill bg-status-pending px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:brightness-95"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restore
        </button>
      </div>
    </div>
  );
}
