"use client";

import { Check, Copy, Loader2, MessageCircle, Send, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import type { RequestableReview } from "@/lib/reviews/eligible";

import { requestReviewsAction } from "./actions";

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.round(ms / 86_400_000);
  if (days <= 0) {
    const hours = Math.max(1, Math.round(ms / 3_600_000));
    return `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function stayLabel(r: RequestableReview): string {
  const month = r.checkOut ?? r.checkIn;
  const m = month
    ? new Date(month).toLocaleDateString("en-ZA", {
        month: "short",
        year: "numeric",
      })
    : null;
  const nights = r.nights
    ? `${r.nights} ${r.nights === 1 ? "night" : "nights"}`
    : null;
  return [r.listingName, nights, m].filter(Boolean).join(" · ");
}

/**
 * "Request reviews" button + modal. Lists only qualifying stays (completed +
 * paid + no review yet — already-reviewed guests never appear), lets the host
 * bulk-select and send (email + in-app + thread), and grab a per-stay link to
 * copy or WhatsApp. Reused on the Reviews manager and the guest record.
 */
export function RequestReviewButton({
  bookings,
  label = "Request reviews",
  variant = "primary",
}: {
  bookings: RequestableReview[];
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const count = bookings.length;
  const allSelected = count > 0 && selected.size === count;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === count
        ? new Set()
        : new Set(bookings.map((b) => b.bookingId)),
    );
  }

  function absoluteUrl(path: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${path}`;
  }

  async function copyLink(r: RequestableReview) {
    try {
      await navigator.clipboard.writeText(absoluteUrl(r.reviewPath));
      setCopiedId(r.bookingId);
      toast.success("Review link copied.");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy — copy the link manually.");
    }
  }

  function whatsappHref(r: RequestableReview): string {
    const url = absoluteUrl(r.reviewPath);
    const first = r.guestName.split(" ")[0] || "there";
    const msg = `Hi ${first}, hope you enjoyed your stay at ${r.listingName}. Would you mind leaving a quick review? It takes about 30 seconds and you can add photos: ${url}`;
    const digits = (r.guestPhone ?? "").replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  }

  function send() {
    if (selected.size === 0) return;
    start(async () => {
      const result = await requestReviewsAction([...selected]);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.sent > 0
          ? `Sent ${result.sent} review request${result.sent === 1 ? "" : "s"}.`
          : "Nothing to send.",
      );
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  const btnCls =
    variant === "primary"
      ? "inline-flex items-center gap-1.5 rounded bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
      : "inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-accent disabled:opacity-50";

  const summary = useMemo(
    () =>
      count === 0
        ? "No guests are awaiting a review request right now."
        : `${count} completed ${count === 1 ? "stay hasn't" : "stays haven't"} been reviewed yet. Pick who to ask.`,
    [count],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={count === 0}
        title={count === 0 ? "No guests awaiting a review request" : undefined}
        className={btnCls}
      >
        <Star className="h-4 w-4" />
        {label}
        {count > 0 ? (
          <span className="rounded-pill bg-white/20 px-1.5 py-px text-[11px] font-semibold tabular-nums">
            {count}
          </span>
        ) : null}
      </button>

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Request a review"
        description={summary}
        size="lg"
      >
        {count === 0 ? (
          <p className="py-8 text-center text-sm text-brand-mute">
            Everyone who qualifies has either left a review or hasn&rsquo;t
            completed a paid stay yet. Only guests who actually stayed can
            review.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[12px] font-medium text-brand-mute">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
              />
              Select all ({count})
            </label>

            <ul className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line">
              {bookings.map((r) => {
                const checked = selected.has(r.bookingId);
                return (
                  <li
                    key={r.bookingId}
                    className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
                      checked ? "bg-brand-accent/30" : "bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.bookingId)}
                      className="h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                        {r.guestName}
                      </div>
                      <div className="truncate text-[11.5px] text-brand-mute">
                        {stayLabel(r)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-medium ${
                        r.lastRequestedAt
                          ? "border border-brand-line bg-brand-light text-brand-mute"
                          : "border border-status-pending/30 bg-status-pending/10 text-status-pending"
                      }`}
                    >
                      {r.lastRequestedAt
                        ? `Requested ${relativeAge(r.lastRequestedAt)}`
                        : "Not yet asked"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyLink(r)}
                        title="Copy review link"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-brand-line bg-white text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
                      >
                        {copiedId === r.bookingId ? (
                          <Check className="h-3.5 w-3.5 text-status-confirmed" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={whatsappHref(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send on WhatsApp"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-brand-line bg-white text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-brand-mute">
              Sending notifies the guest by email, in-app and in their chat
              thread with a link to review their stay.
            </p>
          </div>
        )}

        <FormModalFooter>
          <FormModalCancel>Close</FormModalCancel>
          {count > 0 ? (
            <button
              type="button"
              onClick={send}
              disabled={pending || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {selected.size > 0
                ? `Send ${selected.size} request${selected.size === 1 ? "" : "s"}`
                : "Send requests"}
            </button>
          ) : null}
        </FormModalFooter>
      </FormModal>
    </>
  );
}
