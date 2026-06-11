"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";

import {
  addIcalFeedAction,
  removeIcalFeedAction,
  syncIcalFeedAction,
} from "./actions";

export type Feed = {
  id: string;
  source_label: string;
  url: string;
  status: "active" | "error" | "disabled";
  last_sync_at: string | null;
  last_error: string | null;
  imported_count: number;
};

const SOURCE_PRESETS = ["Airbnb", "Booking.com", "VRBO", "Google", "Other"];

export function FeedManager({
  listingId,
  feeds,
}: {
  listingId: string;
  feeds: Feed[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Airbnb");
  const [pending, start] = useTransition();
  const [pendingFeedId, setPendingFeedId] = useState<string | null>(null);

  function add() {
    if (!/^https?:\/\//i.test(url)) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    start(async () => {
      const result = await addIcalFeedAction({
        listingId,
        url: url.trim(),
        sourceLabel,
      });
      if (result.ok) {
        toast.success("Feed added — hit Sync to import.");
        setAdding(false);
        setUrl("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function syncNow(feedId: string) {
    setPendingFeedId(feedId);
    start(async () => {
      const result = await syncIcalFeedAction({ feedId });
      setPendingFeedId(null);
      if (result.ok) {
        toast.success(
          result.imported
            ? `Synced — blocked ${result.imported} dates.`
            : "Synced — no future blocks in this feed.",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function remove(feedId: string) {
    const ok = await modal.destructive({
      title: "Remove this feed?",
      description: "Imported blocks for it will be cleared from the calendar.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setPendingFeedId(feedId);
    start(async () => {
      const result = await removeIcalFeedAction({ feedId });
      setPendingFeedId(null);
      if (result.ok) {
        toast.success("Feed removed.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {feeds.length === 0 && !adding ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center">
          <p className="text-sm text-brand-mute">
            No external calendars connected yet for this listing.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" />
            Add calendar
          </button>
        </div>
      ) : null}

      {feeds.map((feed) => {
        const isPending = pendingFeedId === feed.id && pending;
        return (
          <article
            key={feed.id}
            className="rounded-card border border-brand-line bg-white p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                  feed.status === "error"
                    ? "bg-status-cancelled/10 text-status-cancelled"
                    : "bg-brand-accent text-brand-primary"
                }`}
              >
                {feed.status === "error" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-brand-ink">
                    {feed.source_label}
                  </span>
                  {feed.status === "error" ? (
                    <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium text-status-cancelled">
                      Error
                    </span>
                  ) : feed.last_sync_at ? (
                    <span className="inline-flex items-center rounded-pill border border-status-confirmed/30 bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-medium text-status-confirmed">
                      {feed.imported_count} dates blocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute">
                      Never synced
                    </span>
                  )}
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-brand-mute">
                  {feed.url}
                </div>
                {feed.last_sync_at ? (
                  <div className="mt-1 text-[11px] text-brand-mute">
                    Last synced{" "}
                    {new Date(feed.last_sync_at).toLocaleString("en-ZA")}
                  </div>
                ) : null}
                {feed.last_error ? (
                  <div className="mt-2 text-[11px] text-status-cancelled">
                    {feed.last_error}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncNow(feed.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
                >
                  {isPending && pendingFeedId === feed.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  Sync
                </button>
                <button
                  type="button"
                  onClick={() => remove(feed.id)}
                  disabled={pending}
                  aria-label="Remove feed"
                  className="rounded p-2 text-brand-mute transition-colors hover:bg-brand-light hover:text-status-cancelled disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </article>
        );
      })}

      {adding ? (
        <div className="space-y-3 rounded-card border border-brand-line bg-brand-light/50 p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Source
              </span>
              <select
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
              >
                {SOURCE_PRESETS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Calendar URL
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://calendar.airbnb.com/calendar/ical/…"
                className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              disabled={pending}
              className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-white hover:text-brand-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={pending || url.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Add feed
            </button>
          </div>
        </div>
      ) : feeds.length > 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another calendar
        </button>
      ) : null}
    </div>
  );
}
